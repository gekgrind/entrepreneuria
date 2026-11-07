/**
 * GoHighLevel (LeadConnector API v2) lead adapter.
 *
 * Pure of env and `server-only` so it can be unit-tested with a fake
 * fetch; construct it through ./server.ts, which reads server-side env.
 *
 * VERIFY before staging use (spec §8, §10E): endpoint shapes, custom
 * field keys, token scopes and rate limits against the actual sub-account.
 *
 * Duplicate safety: contacts go through /contacts/upsert (dedupes by email
 * or phone); an opportunity is created only when no open one exists for
 * that contact in the configured pipeline. A retry therefore converges on
 * one contact and one opportunity.
 */

export interface GhlConfig {
  token: string;
  locationId: string;
  pipelineId: string;
  pipelineStageId: string;
  apiVersion: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Logical field name → GHL custom field key, e.g. { style_interest: "contact.style_interest" }. */
  customFieldKeys: Record<string, string>;
}

export interface CrmLead {
  name: string;
  email: string;
  phone?: string;
  companyName: string;
  website?: string;
  source: string;
  tags: string[];
  customFields: Record<string, string | undefined>;
  opportunityName: string;
  note: string;
}

export interface CrmSyncResult {
  contactId: string;
  opportunityId: string;
  opportunityCreated: boolean;
}

export interface LeadCrm {
  syncLead(lead: CrmLead): Promise<CrmSyncResult>;
}

export class GhlError extends Error {
  constructor(
    message: string,
    public readonly step: "contact" | "opportunity" | "note",
    public readonly status: number | null,
    public readonly retryable: boolean,
    public readonly contactId?: string
  ) {
    super(message);
    this.name = "GhlError";
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const RETRYABLE = (status: number) => status === 429 || status >= 500;

export function createGhlClient(
  config: GhlConfig,
  deps: { fetch?: FetchLike; sleep?: (ms: number) => Promise<void> } = {}
): LeadCrm {
  const doFetch = deps.fetch ?? ((i, init) => fetch(i, init));
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const base = (config.baseUrl ?? "https://services.leadconnectorhq.com").replace(/\/$/, "");
  const timeoutMs = config.timeoutMs ?? 8000;

  async function call<T>(
    step: GhlError["step"],
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    contactId?: string
  ): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await doFetch(`${base}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${config.token}`,
            Version: config.apiVersion,
            Accept: "application/json",
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          cache: "no-store",
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        if (attempt === 0) {
          await sleep(600);
          continue;
        }
        throw new GhlError(`GHL ${step} request failed: ${(err as Error).message}`, step, null, true, contactId);
      }
      clearTimeout(timer);

      if (res.ok) return (await res.json().catch(() => ({}))) as T;

      if (RETRYABLE(res.status) && attempt === 0) {
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 5) * 1000 : 600);
        continue;
      }
      throw new GhlError(`GHL ${step} returned ${res.status}`, step, res.status, RETRYABLE(res.status), contactId);
    }
    /* istanbul ignore next — loop always returns or throws */
    throw new GhlError(`GHL ${step} exhausted retries`, step, null, true, contactId);
  }

  function customFields(values: CrmLead["customFields"]) {
    return Object.entries(values)
      .filter(([name, v]) => v !== undefined && v !== "" && config.customFieldKeys[name])
      .map(([name, v]) => ({ key: config.customFieldKeys[name], field_value: v }));
  }

  return {
    async syncLead(lead) {
      const upsert = await call<{ contact?: { id?: string } }>("contact", "POST", "/contacts/upsert", {
        locationId: config.locationId,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        companyName: lead.companyName,
        website: lead.website,
        source: lead.source,
        tags: lead.tags,
        customFields: customFields(lead.customFields),
      });
      const contactId = upsert.contact?.id;
      if (!contactId) throw new GhlError("GHL upsert returned no contact id", "contact", 200, true);

      const q = new URLSearchParams({
        location_id: config.locationId,
        contact_id: contactId,
        pipeline_id: config.pipelineId,
        status: "open",
      });
      const search = await call<{ opportunities?: Array<{ id?: string }> }>(
        "opportunity",
        "GET",
        `/opportunities/search?${q}`,
        undefined,
        contactId
      );
      const existing = search.opportunities?.find((o) => o.id)?.id;

      let opportunityId = existing;
      if (!opportunityId) {
        const created = await call<{ opportunity?: { id?: string } }>(
          "opportunity",
          "POST",
          "/opportunities/",
          {
            locationId: config.locationId,
            pipelineId: config.pipelineId,
            pipelineStageId: config.pipelineStageId,
            contactId,
            name: lead.opportunityName,
            status: "open",
          },
          contactId
        );
        opportunityId = created.opportunity?.id;
        if (!opportunityId) {
          throw new GhlError("GHL opportunity create returned no id", "opportunity", 200, true, contactId);
        }
      }

      await call("note", "POST", `/contacts/${encodeURIComponent(contactId)}/notes`, { body: lead.note }, contactId);

      return { contactId, opportunityId, opportunityCreated: !existing };
    },
  };
}

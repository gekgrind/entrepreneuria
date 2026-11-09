/**
 * GoHighLevel SANDBOX integration check for the lead adapter (client.ts).
 *
 * Exercises the real adapter against a GHL sub-account and reads back what
 * landed: new contacts, existing-contact protection, consent-tag
 * protection, partial failures and retries. It runs from
 * scripts/ghl-sandbox-check.mts, which defaults to the in-memory fake and
 * touches the network only with --live and the guards below. It is never
 * part of `npm test` against a real account; the unit test runs it against
 * the fake.
 *
 * Safety:
 *   - Only GHL_SANDBOX_* credentials are read, never the production GHL_*
 *     ones, and the run refuses if they match production values.
 *   - The sandbox location id must be typed twice (GHL_SANDBOX_CONFIRM_LOCATION).
 *   - Before any write, the location's workflows are listed; any published
 *     workflow, or a listing that can't be read, stops the run unless the
 *     owner attests the sub-account has no automations.
 *   - All data is synthetic (example.com addresses, 555-01xx numbers), every
 *     tag carries the run's prefix, and the real `sms-consent` tag is never
 *     sent: consent protection is tested with a synthetic probe tag.
 *   - Failures are injected client-side (the request is never sent, or its
 *     response is replaced), so nothing malformed reaches the account.
 */
import { createGhlClient, createKeyedLock, createRecentOpportunities, GhlError, type CrmLead, type GhlConfig, type CrmSyncResult } from "./client";
import { parseCustomFieldIds } from "./config";

type Env = Record<string, string | undefined>;
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface SandboxConfig {
  token: string;
  locationId: string;
  pipelineId: string;
  pipelineStageId: string;
  apiVersion: string;
  baseUrl?: string;
  customFieldIds: GhlConfig["customFieldIds"];
}

export type GuardResult = { ok: true; config: SandboxConfig; warnings: string[] } | { ok: false; errors: string[] };

/** Validates the sandbox environment. Pure, so the refusals are unit-tested. */
export function checkSandboxEnv(env: Env): GuardResult {
  const errors: string[] = [];
  const need = (name: string) => {
    const v = env[name]?.trim();
    if (!v) errors.push(`${name} is required`);
    return v ?? "";
  };
  const token = need("GHL_SANDBOX_TOKEN");
  const locationId = need("GHL_SANDBOX_LOCATION_ID");
  const pipelineId = need("GHL_SANDBOX_PIPELINE_ID");
  const pipelineStageId = need("GHL_SANDBOX_PIPELINE_STAGE_ID");

  if (env.CI) errors.push("refusing to run in CI");
  if (locationId && env.GHL_SANDBOX_CONFIRM_LOCATION !== locationId) {
    errors.push("GHL_SANDBOX_CONFIRM_LOCATION must repeat GHL_SANDBOX_LOCATION_ID exactly");
  }
  if (token && env.GHL_API_TOKEN && token === env.GHL_API_TOKEN) errors.push("sandbox token equals the production GHL_API_TOKEN");
  if (locationId && env.GHL_LOCATION_ID && locationId === env.GHL_LOCATION_ID) {
    errors.push("sandbox location equals the production GHL_LOCATION_ID");
  }
  if (pipelineId && env.GHL_PIPELINE_ID && pipelineId === env.GHL_PIPELINE_ID) errors.push("sandbox pipeline equals the production GHL_PIPELINE_ID");
  if (errors.length) return { ok: false, errors };

  const { ids, problems } = parseCustomFieldIds(env.GHL_SANDBOX_CUSTOM_FIELD_IDS);
  return {
    ok: true,
    warnings: problems.map((p) => p.replaceAll("GHL_CUSTOM_FIELD_IDS", "GHL_SANDBOX_CUSTOM_FIELD_IDS")),
    config: {
      token,
      locationId,
      pipelineId,
      pipelineStageId,
      apiVersion: env.GHL_SANDBOX_API_VERSION ?? "2021-07-28",
      customFieldIds: ids,
    },
  };
}

/** Lists the sub-account's workflows; refuses if any is published or the list can't be read. */
export async function checkNoLiveWorkflows(
  config: SandboxConfig,
  fetch: FetchLike,
  opts: { ownerAttestsNoAutomations?: boolean } = {}
): Promise<{ ok: boolean; detail: string }> {
  const base = (config.baseUrl ?? "https://services.leadconnectorhq.com").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/workflows/?locationId=${encodeURIComponent(config.locationId)}`, {
      headers: { Authorization: `Bearer ${config.token}`, Version: config.apiVersion, Accept: "application/json" },
    });
    const data = res.ok ? ((await res.json()) as { workflows?: Array<{ name?: string; status?: string }> }) : null;
    if (!data || !Array.isArray(data.workflows)) throw new Error(`workflow list unreadable (HTTP ${res.status})`);
    const live = data.workflows.filter((w) => w?.status !== "draft");
    if (live.length) return { ok: false, detail: `${live.length} workflow(s) not in draft; use a sub-account with no active automations` };
    return { ok: true, detail: `${data.workflows.length} workflow(s), none active` };
  } catch (err) {
    if (opts.ownerAttestsNoAutomations) return { ok: true, detail: `workflow check skipped on owner attestation (${(err as Error).message})` };
    return { ok: false, detail: `${(err as Error).message}; grant workflows.readonly or set GHL_SANDBOX_ATTEST_NO_AUTOMATIONS=yes` };
  }
}

/* ---- fault injection (client-side only) ---- */

interface FaultRule {
  method: string;
  path: RegExp;
  /** "status": don't send, answer with `status`. "applied-status": send, then replace the response with `status`. */
  kind: "status" | "applied-status";
  status: number;
  times: number;
}

function faultyFetch(inner: FetchLike, rules: FaultRule[], observe?: (path: string, method: string, body: unknown) => void): FetchLike {
  return async (url, init) => {
    const method = init?.method ?? "GET";
    const path = new URL(url).pathname;
    const rule = rules.find((r) => r.times > 0 && r.method === method && r.path.test(path));
    if (rule) {
      rule.times--;
      if (rule.kind === "applied-status") await inner(url, init).then((r) => r.arrayBuffer().catch(() => null));
      return new Response(JSON.stringify({ injected: true }), { status: rule.status, headers: { "content-type": "application/json" } });
    }
    const res = await inner(url, init);
    if (observe) {
      const copy = res.clone();
      observe(path, method, await copy.json().catch(() => null));
    }
    return res;
  };
}

/* ---- read-back ---- */

interface ContactView {
  id: string;
  name: string | null;
  phone: string | null;
  companyName: string | null;
  website: string | null;
  tags: string[];
  customFields: Map<string, unknown>;
  keys: string[];
}

function reader(config: SandboxConfig, fetch: FetchLike) {
  const base = (config.baseUrl ?? "https://services.leadconnectorhq.com").replace(/\/$/, "");
  const get = async (path: string) => {
    const res = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${config.token}`, Version: config.apiVersion, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`GET ${path.split("?")[0]} → ${res.status}`);
    return res.json() as Promise<any>;
  };
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    async contact(id: string): Promise<ContactView> {
      const c = (await get(`/contacts/${encodeURIComponent(id)}`))?.contact ?? {};
      const name = str(c.name) ?? str(c.contactName) ?? (str([c.firstName, c.lastName].filter(Boolean).join(" ")) || null);
      return {
        id,
        name,
        phone: str(c.phone),
        companyName: str(c.companyName),
        website: str(c.website),
        tags: Array.isArray(c.tags) ? c.tags : [],
        customFields: new Map((Array.isArray(c.customFields) ? c.customFields : []).map((f: any) => [f?.id, f?.value ?? f?.fieldValue])),
        keys: Object.keys(c).sort(),
      };
    },
    async notesWith(id: string, reference: string): Promise<string[]> {
      const notes = (await get(`/contacts/${encodeURIComponent(id)}/notes`))?.notes ?? [];
      return notes.map((n: any) => String(n?.body ?? "")).filter((b: string) => b.includes(`Reference: ${reference}`));
    },
    async openOpportunities(id: string): Promise<number> {
      const q = new URLSearchParams({ location_id: config.locationId, contact_id: id, pipeline_id: config.pipelineId, status: "open" });
      return ((await get(`/opportunities/search?${q}`))?.opportunities ?? []).length;
    },
  };
}

/* ---- scenarios ---- */

export interface CheckResult {
  scenario: string;
  check: string;
  pass: boolean;
  detail?: string;
}

export interface SandboxRun {
  results: CheckResult[];
  createdContactIds: string[];
  observations: string[];
}

export async function runSandboxScenarios(opts: {
  config: SandboxConfig;
  fetch: FetchLike;
  runId: string;
  sleep?: (ms: number) => Promise<void>;
  reconcileDelayMs?: number;
  log?: (line: string) => void;
}): Promise<SandboxRun> {
  const { config, runId } = opts;
  const log = opts.log ?? (() => {});
  const results: CheckResult[] = [];
  const created = new Set<string>();
  const observations: string[] = [];
  const read = reader(config, opts.fetch);
  const prefix = `sandbox-${runId}`;
  const probeTag = `${prefix}-consent-probe`;
  let seq = 0;

  const expect = (scenario: string, check: string, pass: boolean, detail?: string) => {
    results.push({ scenario, check, pass, detail });
    log(`${pass ? "PASS" : "FAIL"}  ${scenario}: ${check}${detail ? ` (${detail})` : ""}`);
  };

  const fieldIds = config.customFieldIds;
  const lead = (email: string, over: Partial<CrmLead> = {}): CrmLead => ({
    name: "Sandbox Tester",
    email,
    phone: `+1404555${String(100 + (seq % 100)).padStart(4, "0")}`,
    companyName: `Sandbox Co ${runId}`,
    website: `sandbox-${runId}.example.com`,
    source: "website-services:sandbox-check",
    tags: [`${prefix}`, `${prefix}-preview-request`],
    customFields: { style_interest: "modern-craftsman", package_interest: "growth", business_type: "Sandbox" },
    opportunityName: `Sandbox Co ${runId} — website preview`,
    note: `Sandbox check ${runId}`,
    reference: crypto.randomUUID(),
    ...over,
  });
  const email = (label: string) => `ghl-sandbox+${runId}-${label}@example.com`;

  // One client per scenario, as the route builds one per request. Shared lock and memory, as in one process.
  const lock = createKeyedLock();
  const recent = createRecentOpportunities();
  const client = (rules: FaultRule[] = [], observe?: (path: string, method: string, body: unknown) => void) =>
    createGhlClient(
      { ...config, reconcileDelayMs: opts.reconcileDelayMs ?? 2000 },
      { fetch: faultyFetch(opts.fetch, rules, observe), lock, recentOpportunities: recent, sleep: opts.sleep }
    );
  const sync = async (c: ReturnType<typeof client>, l: CrmLead): Promise<CrmSyncResult | Error> => {
    seq++;
    try {
      const r = await c.syncLead(l);
      created.add(r.contactId);
      return r;
    } catch (err) {
      if (err instanceof GhlError && err.contactId) created.add(err.contactId);
      return err as Error;
    }
  };
  const ok = (r: CrmSyncResult | Error): r is CrmSyncResult => !(r instanceof Error);

  // S1 — new contact: details, fields, tags, one note, one opportunity, and the upsert's `new` flag.
  {
    const S = "S1 new contact";
    let newFlag: unknown = "not observed";
    const l = lead(email("new"));
    const r = await sync(
      client([], (path, method, body) => {
        if (method === "POST" && path === "/contacts/upsert") newFlag = (body as { new?: unknown } | null)?.new;
      }),
      l
    );
    expect(S, "sync succeeds", ok(r), ok(r) ? undefined : String(r));
    expect(S, "upsert reports new: true for a new email", newFlag === true, `observed ${JSON.stringify(newFlag)}`);
    if (ok(r)) {
      const c = await read.contact(r.contactId);
      observations.push(`contact fields returned by GET /contacts/{id}: ${c.keys.join(", ")}`);
      expect(S, "name applied", c.name === l.name, `got ${JSON.stringify(c.name)}`);
      expect(S, "phone applied", c.phone === l.phone, `got ${JSON.stringify(c.phone)}`);
      expect(S, "company applied", c.companyName === l.companyName, `got ${JSON.stringify(c.companyName)}`);
      for (const [name, id] of Object.entries(fieldIds)) {
        const want = l.customFields[name as keyof CrmLead["customFields"]];
        if (id && want) expect(S, `custom field ${name} applied`, c.customFields.get(id) === want, `got ${JSON.stringify(c.customFields.get(id))}`);
      }
      expect(S, "tags added", l.tags.every((t) => c.tags.includes(t)), `tags ${c.tags.filter((t) => t.startsWith(prefix)).join(",")}`);
      expect(S, "exactly one note for the submission", (await read.notesWith(r.contactId, l.reference)).length === 1);
      expect(S, "exactly one open opportunity", (await read.openOpportunities(r.contactId)) === 1);
      expect(S, "no existing-contact warning", !r.warnings.includes("existing_contact_details_not_updated"), r.warnings.join(","));

      // S6 — retry of the same submission is a no-op.
      const S6 = "S6 retry same submission";
      const again = await sync(client(), l);
      expect(S6, "sync succeeds", ok(again));
      expect(S6, "same contact", ok(again) && again.contactId === r.contactId);
      expect(S6, "still one note", (await read.notesWith(r.contactId, l.reference)).length === 1);
      expect(S6, "still one opportunity", (await read.openOpportunities(r.contactId)) === 1);
    }
  }

  // S2 — existing contact is never overwritten; consent probe tag withheld; details only in the note.
  {
    const S = "S2 existing contact";
    const addr = email("existing");
    const original = lead(addr, { name: "Sandbox Original", companyName: `Original Co ${runId}` });
    const first = await sync(client(), original);
    expect(S, "seed contact created", ok(first));
    if (ok(first)) {
      const before = await read.contact(first.contactId);
      const second = lead(addr, {
        name: "Sandbox Overwrite Attempt",
        phone: "+14045550199",
        companyName: "Overwrite Co",
        website: "overwrite.example.com",
        tags: [`${prefix}`, `${prefix}-second-request`],
        newContactTags: [probeTag],
        customFields: { style_interest: "local-professional", package_interest: "starter", business_type: "Overwrite" },
      });
      const r = await sync(client(), second);
      expect(S, "second sync succeeds", ok(r));
      const after = await read.contact(first.contactId);
      expect(S, "same contact matched", ok(r) && r.contactId === first.contactId);
      expect(S, "name unchanged", after.name === before.name, `${JSON.stringify(before.name)} → ${JSON.stringify(after.name)}`);
      expect(S, "phone unchanged", after.phone === before.phone, `${JSON.stringify(before.phone)} → ${JSON.stringify(after.phone)}`);
      expect(S, "company unchanged", after.companyName === before.companyName);
      expect(S, "website unchanged", after.website === before.website);
      for (const id of Object.values(fieldIds)) {
        if (id) expect(S, `custom field ${id} unchanged`, after.customFields.get(id) === before.customFields.get(id));
      }
      expect(S, "consent probe tag NOT added", !after.tags.includes(probeTag));
      expect(S, "non-consent tag added", after.tags.includes(`${prefix}-second-request`));
      const notes = await read.notesWith(first.contactId, second.reference);
      expect(S, "note carries the submitted details, marked not applied", notes.length === 1 && /not applied: this contact already existed/.test(notes[0]) && notes[0].includes("Overwrite Co"));
      expect(S, "warnings name the protection", ok(r) && r.warnings.includes("existing_contact_details_not_updated") && r.warnings.includes("consent_tags_withheld_existing_contact"), ok(r) ? r.warnings.join(",") : "");
      expect(S, "still one opportunity", (await read.openOpportunities(first.contactId)) === 1);
    }
  }

  // S3 — consent probe tag IS applied to a contact this submission created.
  {
    const S = "S3 consent tag on new contact";
    const r = await sync(client(), lead(email("consent-new"), { newContactTags: [probeTag] }));
    expect(S, "sync succeeds", ok(r));
    if (ok(r)) expect(S, "consent probe tag added", (await read.contact(r.contactId)).tags.includes(probeTag));
  }

  // S4 — details update fails (injected 503 twice, never sent): the lead still lands.
  {
    const S = "S4 details update fails";
    const l = lead(email("put-fails"));
    const r = await sync(client([{ method: "PUT", path: /^\/contacts\/[^/]+$/, kind: "status", status: 503, times: 2 }]), l);
    expect(S, "sync succeeds", ok(r), ok(r) ? undefined : String(r));
    if (ok(r)) {
      expect(S, "warning reported", r.warnings.includes("contact_details_not_applied:503"), r.warnings.join(","));
      const notes = await read.notesWith(r.contactId, l.reference);
      expect(S, "note holds the details", notes.length === 1 && notes[0].includes(l.companyName) && notes[0].includes(l.phone!));
      expect(S, "tags added", (await read.contact(r.contactId)).tags.includes(`${prefix}-preview-request`));
      expect(S, "one opportunity", (await read.openOpportunities(r.contactId)) === 1);
    }
  }

  // S5 — upsert applied but its response lost (replaced by 500): the retry sees an existing contact.
  {
    const S = "S5 upsert response lost";
    const l = lead(email("upsert-lost"));
    const r = await sync(client([{ method: "POST", path: /^\/contacts\/upsert$/, kind: "applied-status", status: 500, times: 1 }]), l);
    expect(S, "sync succeeds", ok(r), ok(r) ? undefined : String(r));
    if (ok(r)) {
      expect(S, "known limitation: treated as existing, details left in the note", r.warnings.includes("existing_contact_details_not_updated"));
      expect(S, "flagged as created-status-unknown for review", r.warnings.includes("contact_created_status_unknown"), r.warnings.join(","));
      expect(S, "note holds the details", (await read.notesWith(r.contactId, l.reference)).some((n) => n.includes(l.companyName)));
      expect(S, "one opportunity", (await read.openOpportunities(r.contactId)) === 1);
    }
  }

  // S7 — opportunity create applied but its response lost: reconciled by search, never duplicated.
  {
    const S = "S7 opportunity response lost";
    const l = lead(email("opp-lost"));
    const r = await sync(client([{ method: "POST", path: /^\/opportunities\/$/, kind: "applied-status", status: 500, times: 1 }]), l);
    if (ok(r)) {
      expect(S, "reconciled", r.warnings.includes("opportunity_reconciled_after_ambiguous_create"), r.warnings.join(","));
      expect(S, "exactly one opportunity", (await read.openOpportunities(r.contactId)) === 1);
    } else {
      // A lagging search index can leave it unknown; the adapter then throws a retryable error instead of duplicating.
      const id = r instanceof GhlError ? r.contactId : undefined;
      const count = id ? await read.openOpportunities(id) : -1;
      expect(S, "unknown outcome surfaced as a retryable error, at most one opportunity", r instanceof GhlError && r.retryable && count <= 1, `${String(r)}; open=${count}`);
    }
  }

  return { results, createdContactIds: [...created], observations };
}

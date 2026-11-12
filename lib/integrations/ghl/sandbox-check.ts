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
 *   - Existing contacts (owner, 2026-11-09): the adapter must write NOTHING
 *     to them. S2 and S5 prove it against the real account.
 *   - Failures are injected client-side (the request is never sent, or its
 *     response is replaced), so nothing malformed reaches the account.
 */
import {
  createGhlClient,
  createKeyedLock,
  createRecentOpportunities,
  GhlError,
  GhlMatchedExistingError,
  type CrmLead,
  type GhlConfig,
  type CrmSyncResult,
} from "./client";
import { parseCustomFieldIds } from "./config";
import { createSandboxGuard, type CleanupReport, type CleanupState, type Snapshot } from "./sandbox-guard";
import { createMemoryManifest, JOURNAL_VERSION, type RunManifest } from "./sandbox-ledger";

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
  /** Exact sub-account name; --live refuses unless GHL reports this name for the location. */
  expectedLocationName: string;
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
  const expectedLocationName = need("GHL_SANDBOX_EXPECT_LOCATION_NAME");
  if (expectedLocationName && !/sandbox/i.test(expectedLocationName)) {
    errors.push('GHL_SANDBOX_EXPECT_LOCATION_NAME must name a sandbox sub-account (contain "sandbox")');
  }

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
      expectedLocationName,
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
  /** A list from a response, or an error: an unreadable answer is never an empty one. */
  const list = (body: any, key: string): any[] => {
    const items = body?.[key];
    if (!Array.isArray(items)) throw new Error(`${key} list was unreadable`);
    const total = body?.meta?.total;
    if (typeof total === "number" && total > items.length) throw new Error(`${key} list was incomplete (${items.length} of ${total})`);
    return items;
  };
  const ids = (items: any[]) => {
    const out = items.map((o) => o?.id);
    if (out.some((x) => typeof x !== "string" || !x)) throw new Error("a listed record had no id");
    return out as string[];
  };
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
      const notes = list(await get(`/contacts/${encodeURIComponent(id)}/notes`), "notes");
      return notes.map((n: any) => String(n?.body ?? "")).filter((b: string) => b.includes(`Reference: ${reference}`));
    },
    /** Ids of open opportunities a search returns, for checking results by identity. */
    async openIn(filters: Record<string, string>): Promise<string[]> {
      const q = new URLSearchParams({ location_id: config.locationId, status: "open", limit: "100", ...filters });
      return ids(list(await get(`/opportunities/search?${q}`), "opportunities"));
    },
    /** A record's own pipeline and stage, read by id rather than from the search under test. */
    async membership(id: string): Promise<{ pipelineId: string | null; stageId: string | null }> {
      const o = (await get(`/opportunities/${encodeURIComponent(id)}`))?.opportunity ?? {};
      return { pipelineId: str(o.pipelineId), stageId: str(o.pipelineStageId) };
    },
    async openOpportunities(id: string): Promise<number> {
      const q = new URLSearchParams({ location_id: config.locationId, contact_id: id, pipeline_id: config.pipelineId, status: "open" });
      return ids(list(await get(`/opportunities/search?${q}`), "opportunities")).length;
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
  createdOpportunityIds: string[];
  observations: string[];
  /** Why the guard stopped the run, if it did. */
  stopped: string | null;
  cleanup: CleanupReport | null;
  /** Things the run could not establish. Reported separately: neither passed nor failed. */
  unproven: string[];
}

/** Most records S8 will read individually to confirm their pipeline and stage. */
const MAX_IDENTITY_READS = 25;

/**
 * "minimal" is the owner-approved live scope (criterion H): S1 (one new
 * contact and one opportunity) plus S8 (the open-request count). "full" adds
 * S2–S7 and is the default against the fake.
 */
export type SandboxScope = "minimal" | "full";

export async function runSandboxScenarios(opts: {
  config: SandboxConfig;
  fetch: FetchLike;
  runId: string;
  sleep?: (ms: number) => Promise<void>;
  reconcileDelayMs?: number;
  log?: (line: string) => void;
  scope?: SandboxScope;
  /** Durable run journal; tests default to memory. */
  manifest?: RunManifest;
  /** Delete everything the run created and verify it is gone (always on for --live). */
  cleanup?: boolean;
  /** Another stage of the same pipeline, so S8 can prove GHL honours the stage filter. */
  otherStageId?: string;
  /** Another pipeline in the location, so S8 can prove GHL honours the pipeline filter. */
  otherPipelineId?: string;
  gitSha?: string;
  /** Overall budget per sync. A paced live run needs more than the production default. */
  syncBudgetMs?: number;
  settleAttempts?: number;
  settleDelayMs?: number;
}): Promise<SandboxRun> {
  const { config, runId } = opts;
  const scope = opts.scope ?? "full";
  const log = opts.log ?? (() => {});
  const results: CheckResult[] = [];
  const observations: string[] = [];
  const unproven: string[] = [];
  const manifest = opts.manifest ?? createMemoryManifest();
  const guard = createSandboxGuard(config, opts.fetch, runId, manifest, {
    sleep: opts.sleep,
    settleAttempts: opts.settleAttempts,
    settleDelayMs: opts.settleDelayMs,
    // "full" exercises the adapter's own retries (S5, S6), so it runs only against the fake.
    singleAttemptWrites: scope === "minimal",
  });
  const read = reader(config, guard.fetch);
  const prefix = `sandbox-${runId}`;
  const probeTag = `${prefix}-consent-probe`;
  let seq = 0;

  const expect = (scenario: string, check: string, pass: boolean, detail?: string) => {
    results.push({ scenario, check, pass, detail });
    log(`${pass ? "PASS" : "FAIL"}  ${scenario}: ${check}${detail ? ` (${detail})` : ""}`);
  };
  const running = () => guard.halted === null;

  await manifest.append({
    t: "start",
    runId,
    locationId: config.locationId,
    pipelineId: config.pipelineId,
    stageId: config.pipelineStageId,
    gitSha: opts.gitSha ?? "unknown",
    scope,
    at: new Date().toISOString(),
    journalVersion: JOURNAL_VERSION,
  });
  let pre: Snapshot | null = null;
  try {
    pre = await guard.snapshot();
    await manifest.append({ t: "snapshot", phase: "pre", ...pre });
    observations.push(`pre-run contacts in the location: ${pre.total}`);
  } catch (err) {
    expect("preflight", "contact snapshot before any write", false, (err as Error).message);
    await manifest.append({ t: "end", ok: false, at: new Date().toISOString() });
    return { results, createdContactIds: [], createdOpportunityIds: [], observations, stopped: "no snapshot", cleanup: null, unproven };
  }

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
  const recentContacts = createRecentOpportunities(30 * 60_000);
  const client = (rules: FaultRule[] = [], observe?: (path: string, method: string, body: unknown) => void) =>
    createGhlClient(
      { ...config, reconcileDelayMs: opts.reconcileDelayMs ?? 2000, syncBudgetMs: opts.syncBudgetMs },
      { fetch: faultyFetch(guard.fetch, rules, observe), lock, recentOpportunities: recent, recentContacts, sleep: opts.sleep }
    );
  // Ownership is tracked by the guard from create responses only, never from errors.
  const sync = async (c: ReturnType<typeof client>, l: CrmLead): Promise<CrmSyncResult | Error> => {
    seq++;
    try {
      return await c.syncLead(l);
    } catch (err) {
      return err as Error;
    }
  };
  const ok = (r: CrmSyncResult | Error): r is CrmSyncResult => !(r instanceof Error);

  try {
  // S8 (before) — open-request counts, read-only: the intake stage, the whole pipeline, and another stage.
  const counts = async () => {
    const c = client();
    return {
      stage: await c.countOpenOpportunities!({ stageId: config.pipelineStageId }),
      pipeline: await c.countOpenOpportunities!({}),
      other: opts.otherStageId ? await c.countOpenOpportunities!({ stageId: opts.otherStageId }) : null,
    };
  };
  let before: Awaited<ReturnType<typeof counts>> | null = null;
  try {
    before = await counts();
    observations.push(`open opportunities before: stage ${before.stage}, pipeline ${before.pipeline}, other stage ${before.other ?? "n/a"}`);
  } catch (err) {
    expect("S8 open-request count", "count readable before S1", false, (err as Error).message);
  }
  let s1Opportunity = false;

  // S1 — new contact: details, fields, tags, one note, one opportunity, and the upsert's `new` flag.
  if (running()) {
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
      s1Opportunity = (await read.openOpportunities(r.contactId)) === 1;
      expect(S, "exactly one open opportunity", s1Opportunity);
      expect(S, "no existing-contact warning", !r.warnings.includes("existing_contact_details_not_updated"), r.warnings.join(","));
    }
    if (ok(r) && scope === "full" && running()) {
      // S6 — retry of the same submission is a no-op.
      const S6 = "S6 retry same submission";
      const again = await sync(client(), l);
      expect(S6, "sync succeeds", ok(again));
      expect(S6, "same contact", ok(again) && again.contactId === r.contactId);
      expect(S6, "still one note", (await read.notesWith(r.contactId, l.reference)).length === 1);
      expect(S6, "still one opportunity", (await read.openOpportunities(r.contactId)) === 1);
    }
  }

  // S8 (after) — S1 added exactly one open opportunity in the intake stage. Another stage's
  // count must not move: if it does, GHL ignores pipeline_stage_id and capacity would over-count.
  if (before && s1Opportunity) {
    const S = "S8 open-request count";
    try {
      const after = await counts();
      observations.push(`open opportunities after S1: stage ${after.stage}, pipeline ${after.pipeline}, other stage ${after.other ?? "n/a"}`);
      expect(S, "intake-stage count rose by exactly 1", after.stage === before.stage + 1, `${before.stage} → ${after.stage}`);
      expect(S, "pipeline count rose by exactly 1", after.pipeline === before.pipeline + 1, `${before.pipeline} → ${after.pipeline}`);
      expect(
        S,
        "another stage's count did not move (stage filter honoured)",
        before.other !== null && after.other === before.other,
        before.other === null ? "no other stage in the pipeline: add one to prove the filter" : `${before.other} → ${after.other}`
      );

      // Absolute counts and record identities: count deltas alone can pass with a filter ignored.
      const runOpportunity = guard.createdOpportunityIds()[0];
      const pipelineFilter = { pipeline_id: config.pipelineId };
      const stageIds = await read.openIn({ ...pipelineFilter, pipeline_stage_id: config.pipelineStageId });
      const pipelineIds = await read.openIn(pipelineFilter);
      const otherStageIds = opts.otherStageId ? await read.openIn({ ...pipelineFilter, pipeline_stage_id: opts.otherStageId }) : null;
      const otherPipelineIds = opts.otherPipelineId ? await read.openIn({ pipeline_id: opts.otherPipelineId }) : null;
      expect(S, "intake-stage count matches the records returned", after.stage === stageIds.length, `${after.stage} vs ${stageIds.length}`);
      expect(S, "pipeline count matches the records returned", after.pipeline === pipelineIds.length, `${after.pipeline} vs ${pipelineIds.length}`);
      expect(S, "the run's opportunity is in the intake-stage results", stageIds.includes(runOpportunity));
      expect(S, "the run's opportunity is in the pipeline results", pipelineIds.includes(runOpportunity));
      if (otherStageIds) expect(S, "the run's opportunity is excluded from another stage's results", !otherStageIds.includes(runOpportunity));
      else unproven.push("stage exclusion: the pipeline has no other stage to query");
      if (otherPipelineIds) {
        expect(S, "the run's opportunity is excluded from another pipeline's results", !otherPipelineIds.includes(runOpportunity));
        expect(S, "no record is returned for both pipelines", otherPipelineIds.every((id) => !pipelineIds.includes(id)));
      } else {
        unproven.push("pipeline exclusion: the location has no other pipeline to query, so GHL's pipeline filter is not proven");
      }

      const expected: Array<[string, string, string | null]> = [
        ...stageIds.map((id): [string, string, string | null] => [id, config.pipelineId, config.pipelineStageId]),
        ...pipelineIds.map((id): [string, string, string | null] => [id, config.pipelineId, null]),
        ...(otherStageIds ?? []).map((id): [string, string, string | null] => [id, config.pipelineId, opts.otherStageId!]),
        ...(otherPipelineIds ?? []).map((id): [string, string, string | null] => [id, opts.otherPipelineId!, null]),
      ];
      const ids = [...new Set(expected.map(([id]) => id))];
      if (ids.length > MAX_IDENTITY_READS) {
        unproven.push(`record identities: ${ids.length} records is more than the ${MAX_IDENTITY_READS} S8 reads individually`);
      } else {
        const actual = new Map<string, { pipelineId: string | null; stageId: string | null }>();
        for (const id of ids) actual.set(id, await read.membership(id));
        if ([...actual.values()].some((m) => !m.pipelineId || !m.stageId)) {
          unproven.push("record identities: GHL's records did not carry pipeline and stage ids");
        } else {
          const wrong = expected.filter(([id, pipeline, stage]) => actual.get(id)?.pipelineId !== pipeline || (stage !== null && actual.get(id)?.stageId !== stage));
          expect(S, "every returned record belongs to the queried pipeline and stage", wrong.length === 0, wrong.length ? `${wrong.length} mismatch(es): ${[...new Set(wrong.map(([id]) => id))].join(",")}` : `${ids.length} record(s) read by id`);
        }
      }
    } catch (err) {
      expect(S, "count readable after S1", false, (err as Error).message);
    }
  }

  // S2 — existing contact: NOTHING is written (no upsert, details, tags, note or opportunity).
  if (scope === "full" && running()) {
    const S = "S2 existing contact untouched";
    const addr = email("existing");
    const original = lead(addr, { name: "Sandbox Original", companyName: `Original Co ${runId}` });
    const first = await sync(client(), original);
    expect(S, "seed contact created", ok(first));
    if (ok(first)) {
      const before = await read.contact(first.contactId);
      const notesBefore = await read.notesWith(first.contactId, original.reference);
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
      expect(S, "sync stops as an existing contact", r instanceof GhlMatchedExistingError && r.reason === "existing", String(r));
      expect(S, "matched the right contact", r instanceof GhlMatchedExistingError && r.contactId === first.contactId);
      const after = await read.contact(first.contactId);
      expect(S, "name unchanged", after.name === before.name, `${JSON.stringify(before.name)} → ${JSON.stringify(after.name)}`);
      expect(S, "phone unchanged", after.phone === before.phone, `${JSON.stringify(before.phone)} → ${JSON.stringify(after.phone)}`);
      expect(S, "company unchanged", after.companyName === before.companyName);
      expect(S, "website unchanged", after.website === before.website);
      for (const id of Object.values(fieldIds)) {
        if (id) expect(S, `custom field ${id} unchanged`, after.customFields.get(id) === before.customFields.get(id));
      }
      expect(S, "tags unchanged (none added)", JSON.stringify([...after.tags].sort()) === JSON.stringify([...before.tags].sort()), after.tags.join(","));
      expect(S, "no note for the second submission", (await read.notesWith(first.contactId, second.reference)).length === 0);
      expect(S, "first note untouched", (await read.notesWith(first.contactId, original.reference)).length === notesBefore.length);
      expect(S, "still one opportunity", (await read.openOpportunities(first.contactId)) === 1);
    }
  }

  // S3 — consent probe tag IS applied to a contact this submission created.
  if (scope === "full" && running()) {
    const S = "S3 consent tag on new contact";
    const r = await sync(client(), lead(email("consent-new"), { newContactTags: [probeTag] }));
    expect(S, "sync succeeds", ok(r));
    if (ok(r)) expect(S, "consent probe tag added", (await read.contact(r.contactId)).tags.includes(probeTag));
  }

  // S4 — details update fails (injected 503 twice, never sent): the lead still lands.
  if (scope === "full" && running()) {
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

  // S5 — upsert applied but its response lost: the retry's `new` is false, so the sync stops
  //      (fails safe into manual review) and writes nothing beyond the email-only contact.
  if (scope === "full" && running()) {
    const S = "S5 upsert response lost";
    const l = lead(email("upsert-lost"));
    const r = await sync(client([{ method: "POST", path: /^\/contacts\/upsert$/, kind: "applied-status", status: 500, times: 1 }]), l);
    expect(S, "sync stops as a match (review), not as new", r instanceof GhlMatchedExistingError && r.reason === "matched_on_upsert", String(r));
    if (r instanceof GhlMatchedExistingError) {
      const c = await read.contact(r.contactId);
      expect(S, "no details written", !c.name || c.name === "", JSON.stringify(c.name));
      expect(S, "no tags written", c.tags.length === 0, c.tags.join(","));
      expect(S, "no note", (await read.notesWith(r.contactId, l.reference)).length === 0);
      expect(S, "no opportunity", (await read.openOpportunities(r.contactId)) === 0);
    }
  }

  // S7 — opportunity create applied but its response lost: reconciled by search, never duplicated.
  if (scope === "full" && running()) {
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
  } catch (err) {
    // A throwing read-back must not skip the cleanup below.
    expect("run", "scenarios finished without an exception", false, (err as Error).message);
  } finally {
    // Criterion G: a refusal stops the scenarios; it is a failure, never retried.
    if (guard.halted) expect("guard", "run completed without a safety stop", false, guard.halted);
  }

  // Cleanup runs even after a failure or a safety stop: it only touches records this run proved it created.
  let cleanup: CleanupReport | null = null;
  if (opts.cleanup) {
    try {
      cleanup = await guard.cleanup({ pre });
      for (const line of cleanup.lines) log(line);
      const pending = cleanup.state === "pending_consistency" ? "pending consistency" : undefined;
      expect("cleanup", "every created contact and opportunity deleted and verified absent", cleanup.idsAbsent, cleanup.idsAbsent ? undefined : (pending ?? cleanup.state));
      expect("cleanup", "pre-existing contacts intact and total restored", cleanup.baseline?.ok === true, cleanup.baseline?.detail ?? pending ?? "not verified");
    } catch (err) {
      expect("cleanup", "cleanup finished without an exception", false, (err as Error).message);
    }
  }
  try {
    await manifest.append({
      t: "end",
      ok: results.every((r) => r.pass),
      at: new Date().toISOString(),
      cleanupState: cleanup?.state,
      unproven: unproven.length ? unproven : undefined,
    });
  } catch (err) {
    expect("journal", "terminal entry written", false, (err as Error).message);
  }

  return {
    results,
    createdContactIds: guard.createdContactIds(),
    createdOpportunityIds: guard.createdOpportunityIds(),
    observations,
    stopped: guard.halted,
    cleanup,
    unproven,
  };
}

/**
 * --reconcile: removes whatever an earlier run left behind, using only its
 * manifest. It never deletes a record the manifest does not name (an
 * unconfirmed create is matched by the run's unique synthetic email and
 * re-read before deletion), never retries a DELETE, and refuses a manifest
 * for another location or pipeline.
 */
export async function reconcileSandboxRun(opts: {
  config: SandboxConfig;
  fetch: FetchLike;
  manifest: RunManifest;
  log?: (line: string) => void;
  sleep?: (ms: number) => Promise<void>;
  settleAttempts?: number;
  settleDelayMs?: number;
}): Promise<{ ok: boolean; state: CleanupState; lines: string[] }> {
  const entries = await opts.manifest.entries();
  const start = entries.find((e) => e.t === "start");
  if (!start || start.t !== "start") return { ok: false, state: "failed", lines: ["FAIL  manifest has no start entry"] };
  if (start.locationId !== opts.config.locationId || start.pipelineId !== opts.config.pipelineId) {
    return { ok: false, state: "failed", lines: ["FAIL  manifest belongs to another location or pipeline; nothing done"] };
  }
  const guard = createSandboxGuard(opts.config, opts.fetch, start.runId, opts.manifest, { sleep: opts.sleep, settleAttempts: opts.settleAttempts, settleDelayMs: opts.settleDelayMs });
  guard.adopt(entries);
  const preEntry = entries.find((e) => e.t === "snapshot" && e.phase === "pre");
  const pre = preEntry && preEntry.t === "snapshot" ? { total: preEntry.total, ids: preEntry.ids } : null;
  const report = await guard.cleanup({ pre });
  await opts.manifest.append({ t: "end", ok: report.ok, at: new Date().toISOString(), cleanupState: report.state });
  for (const l of report.lines) opts.log?.(l);
  return { ok: report.ok, state: report.state, lines: report.lines };
}

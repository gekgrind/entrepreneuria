/**
 * Rate-limit pacing and eventual-consistency verification for the GHL sandbox
 * harness. In-memory fake and a virtual clock only; no network, placeholder ids.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createGhlClient } from "./client";
import { createFakeGhl } from "./fake-ghl.test-helper";
import { checkNoLiveWorkflows, reconcileSandboxRun, runSandboxScenarios, type SandboxConfig } from "./sandbox-check";
import { verifySandboxIdentity } from "./sandbox-discover";
import { createSandboxGuard } from "./sandbox-guard";
import { createMemoryManifest } from "./sandbox-ledger";
import { createPacedFetch, DEFAULT_RATE_PER_10S, MAX_RATE_PER_10S, parseHarnessEnv } from "./sandbox-pacer";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const IDS = { style_interest: "SandboxStyleField001", package_interest: "SandboxPkgField00002" };
const config: SandboxConfig = {
  token: "sandbox-token",
  locationId: "loc_sandbox",
  pipelineId: "pipe_sandbox",
  pipelineStageId: "stage_sandbox",
  apiVersion: "2021-07-28",
  customFieldIds: IDS,
  expectedLocationName: "Test Sandbox",
};
const URL_A = "https://services.leadconnectorhq.com/contacts/x";

function clock() {
  let t = 1_000_000;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
  };
}

/** Records when each request reached the network, answering from `answer`. */
function recorder(c: ReturnType<typeof clock>, answer: (n: number) => Response = () => Response.json({})) {
  const sent: Array<{ at: number; method: string; signal: AbortSignal | null | undefined }> = [];
  const inner: FetchLike = async (_url, init) => {
    sent.push({ at: c.now(), method: init?.method ?? "GET", signal: init?.signal });
    return answer(sent.length);
  };
  return { sent, inner };
}

const r429 = (headers: Record<string, string> = {}) => new Response("{}", { status: 429, headers });
const maxInWindow = (times: number[], windowMs: number) =>
  Math.max(0, ...times.map((start) => times.filter((t) => t >= start && t < start + windowMs).length));

function sandbox(opts: Parameters<typeof createFakeGhl>[0] = {}) {
  const ghl = createFakeGhl({ knownFieldIds: Object.values(IDS), ...opts });
  const existing = Array.from({ length: 5 }, (_, i) =>
    ghl.seedContact(`owner-contact-${i}@example.org`, [`original-${i}`], {}, { name: `Person ${i}`, phone: `+1770555020${i}` })
  );
  const frozen = () => existing.map((c) => JSON.stringify({ ...c, tags: [...c.tags], customFields: [...c.customFields] }));
  const before = frozen();
  return { ghl, existing, untouched: () => assert.deepEqual(frozen(), before, "pre-existing contacts changed") };
}

/** GHL's observed limit on a virtual clock: over `max` requests in 10 seconds gets a 429. */
function limited(inner: FetchLike, c: ReturnType<typeof clock>, max = 25) {
  const seen: number[] = [];
  let rejected = 0;
  const fetch: FetchLike = async (url, init) => {
    const t = c.now();
    while (seen.length && seen[0] <= t - 10_000) seen.shift();
    if (seen.length >= max) {
      rejected++;
      return r429({ "x-ratelimit-interval-milliseconds": "10000", "x-ratelimit-max": String(max) });
    }
    seen.push(t);
    return inner(url, init);
  };
  return { fetch, rejected: () => rejected };
}

/** A contact list that keeps showing deleted contacts for `times` list reads, as GHL's did. */
function staleList(ghl: ReturnType<typeof createFakeGhl>, times: number) {
  const deleted: string[] = [];
  let left = times;
  let listReads = 0;
  const fetch: FetchLike = async (url, init) => {
    const u = new URL(url);
    const method = init?.method ?? "GET";
    const m = u.pathname.match(/^\/contacts\/([^/]+)$/);
    if (method === "DELETE" && m) deleted.push(m[1]);
    const res = await ghl.fetch(url, init);
    if (method === "GET" && u.pathname === "/contacts/" && deleted.length) {
      listReads++;
      if (left > 0) {
        left--;
        const body = (await res.json()) as { contacts: Array<{ id: string }>; meta: { total: number } };
        return Response.json({ contacts: [...body.contacts, ...deleted.map((id) => ({ id }))], meta: { total: body.meta.total + deleted.length } });
      }
    }
    return res;
  };
  return { fetch, reads: () => listReads, settle: () => (left = 0) };
}

const deletes = (ghl: ReturnType<typeof createFakeGhl>) => ghl.calls.filter((c) => c.method === "DELETE").map((c) => c.path);

describe("sandbox pacer: pacing", () => {
  it("never exceeds the configured rate in any 10-second window", async () => {
    const c = clock();
    const { sent, inner } = recorder(c);
    const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
    for (let i = 0; i < 100; i++) await paced.fetch(URL_A);
    assert.equal(sent.length, 100);
    assert.ok(maxInWindow(sent.map((s) => s.at), 10_000) <= DEFAULT_RATE_PER_10S);
  });

  it("the default and the maximum both stay below the observed 25 per 10 seconds", () => {
    assert.ok(DEFAULT_RATE_PER_10S < 25);
    assert.ok(MAX_RATE_PER_10S < 25);
    assert.throws(() => createPacedFetch(async () => Response.json({}), { ratePer10s: 25 }), /from 1 to 20/);
    assert.throws(() => createPacedFetch(async () => Response.json({}), { ratePer10s: 0 }), /from 1 to 20/);
  });

  it("reads harness settings and refuses invalid ones rather than adjusting them", () => {
    assert.deepEqual(parseHarnessEnv({}), { ok: true, settings: { ratePer10s: 15, settleAttempts: undefined, settleDelayMs: undefined } });
    assert.deepEqual(parseHarnessEnv({ GHL_SANDBOX_RATE_PER_10S: "10", GHL_SANDBOX_SETTLE_ATTEMPTS: "3", GHL_SANDBOX_SETTLE_DELAY_MS: "0" }), {
      ok: true,
      settings: { ratePer10s: 10, settleAttempts: 3, settleDelayMs: 0 },
    });
    for (const bad of [{ GHL_SANDBOX_RATE_PER_10S: "25" }, { GHL_SANDBOX_RATE_PER_10S: "ten" }, { GHL_SANDBOX_SETTLE_ATTEMPTS: "0" }, { GHL_SANDBOX_SETTLE_DELAY_MS: "-1" }]) {
      assert.equal(parseHarnessEnv(bad).ok, false, JSON.stringify(bad));
    }
  });

  it("pauses for a window when the server reports few requests remaining", async () => {
    const c = clock();
    const { sent, inner } = recorder(c, (n) =>
      n === 1 ? new Response("{}", { headers: { "x-ratelimit-remaining": "2", "x-ratelimit-interval-milliseconds": "10000" } }) : Response.json({})
    );
    const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
    await paced.fetch(URL_A);
    await paced.fetch(URL_A);
    assert.ok(sent[1].at - sent[0].at >= 10_000);
  });

  it("owns the timeout, so a caller's expired signal cannot cancel a queued request", async () => {
    const c = clock();
    const { sent, inner } = recorder(c);
    const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
    const res = await paced.fetch(URL_A, { signal: AbortSignal.abort() });
    assert.equal(res.status, 200);
    assert.equal(sent[0].signal?.aborted, false);
  });
});

describe("sandbox pacer: 429 handling", () => {
  it("retries a GET after a 429 and honours Retry-After", async () => {
    const c = clock();
    const { sent, inner } = recorder(c, (n) => (n === 1 ? r429({ "retry-after": "20" }) : Response.json({ ok: true })));
    const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
    const res = await paced.fetch(URL_A);
    assert.equal(res.status, 200);
    assert.equal(sent.length, 2);
    assert.ok(sent[1].at - sent[0].at >= 20_000);
    assert.deepEqual(paced.stats(), { sent: 2, throttled: 1, retries: 1 });
  });

  it("honours the rate-limit interval header", async () => {
    const c = clock();
    const { sent, inner } = recorder(c, (n) => (n === 1 ? r429({ "x-ratelimit-interval-milliseconds": "12000" }) : Response.json({})));
    const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
    await paced.fetch(URL_A);
    assert.ok(sent[1].at - sent[0].at >= 12_000);
  });

  it("backoff is bounded: a persistent 429 on a GET stops after the retry limit and the wait never exceeds the cap", async () => {
    const c = clock();
    const { sent, inner } = recorder(c, () => r429({ "x-ratelimit-interval-milliseconds": "1000" }));
    const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep, maxReadRetries: 3, baseBackoffMs: 2_000, maxBackoffMs: 5_000 });
    const res = await paced.fetch(URL_A);
    assert.equal(res.status, 429);
    assert.equal(sent.length, 4, "the first attempt plus three retries");
    const gaps = sent.slice(1).map((s, i) => s.at - sent[i].at);
    assert.deepEqual(gaps, [2_000, 4_000, 5_000]);
  });

  for (const method of ["POST", "PUT", "DELETE"]) {
    it(`never re-sends a ${method} after a 429, and later requests still wait`, async () => {
      const c = clock();
      const { sent, inner } = recorder(c, (n) => (n === 1 ? r429() : Response.json({})));
      const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
      const res = await paced.fetch(URL_A, { method });
      assert.equal(res.status, 429);
      assert.equal(sent.length, 1);
      await paced.fetch(URL_A);
      assert.ok(sent[1].at - sent[0].at >= 10_000);
    });
  }

  it("does not retry other failures", async () => {
    const c = clock();
    const { sent, inner } = recorder(c, () => new Response("{}", { status: 500 }));
    const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
    assert.equal((await paced.fetch(URL_A)).status, 500);
    assert.equal(sent.length, 1);
  });

  for (const [name, headers] of [
    ["a long Retry-After", { "retry-after": "3600" }],
    ["an exhausted daily limit", { "x-ratelimit-daily-remaining": "0", "x-ratelimit-daily-reset": "3600000" }],
  ] as const) {
    it(`${name} closes the pacer: nothing further is sent, including deletes`, async () => {
      const c = clock();
      const { sent, inner } = recorder(c, () => r429(headers));
      const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
      assert.equal((await paced.fetch(URL_A)).status, 429);
      assert.equal(sent.length, 1, "no retry");
      assert.match(paced.closed ?? "", /over the 30000 ms bound/);
      const after = c.now();
      assert.equal((await paced.fetch(URL_A)).status, 429);
      assert.equal((await paced.fetch(URL_A, { method: "DELETE" })).status, 429);
      assert.equal(sent.length, 1, "not sent");
      assert.equal(c.now(), after, "no waiting on a closed pacer");
    });
  }
});

describe("sandbox preflight fails closed when rate limited", () => {
  it("the identity gate and workflow check refuse, and nothing is written", async () => {
    const c = clock();
    const { sent, inner } = recorder(c, () => r429({ "retry-after": "3600" }));
    const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
    assert.equal((await checkNoLiveWorkflows(config, paced.fetch)).ok, false);
    const identity = await verifySandboxIdentity(config, config.expectedLocationName, paced.fetch);
    assert.equal(identity.ok, false);
    assert.ok(identity.errors.some((e) => /location could not be read/.test(e)), identity.errors.join("; "));
    assert.deepEqual(sent.map((s) => s.method), ["GET"], "closed after the first 429");
  });
});

describe("sandbox run under GHL's rate limit", () => {
  const virtual = (c: ReturnType<typeof clock>) => ({ reconcileDelayMs: 0, sleep: c.sleep, otherStageId: "stage_other", syncBudgetMs: 300_000 });

  it("reproduces the incident without pacing", async () => {
    const c = clock();
    const { ghl } = sandbox();
    const limit = limited(ghl.fetch, c, 12);
    const run = await runSandboxScenarios({ config, fetch: limit.fetch, runId: "unpaced", scope: "minimal", cleanup: true, ...virtual(c), settleAttempts: 1 });
    assert.ok(limit.rejected() > 0);
    assert.ok(run.results.some((r) => !r.pass));
    assert.notEqual(run.cleanup?.state, "verified");
  });

  it("with pacing the same run gets no 429, S1 and S8 pass, and cleanup is verified", async () => {
    const c = clock();
    const { ghl, untouched } = sandbox();
    const limit = limited(ghl.fetch, c);
    const paced = createPacedFetch(limit.fetch, { now: c.now, sleep: c.sleep });
    const run = await runSandboxScenarios({ config, fetch: paced.fetch, runId: "paced", scope: "minimal", cleanup: true, ...virtual(c) });
    assert.deepEqual(run.results.filter((r) => !r.pass), []);
    assert.equal(limit.rejected(), 0);
    assert.ok(run.results.filter((r) => r.scenario.startsWith("S1")).length >= 10, "the S1 checks still run");
    assert.ok(run.results.filter((r) => r.scenario.startsWith("S8")).length >= 3);
    assert.equal(run.cleanup?.state, "verified");
    assert.equal(ghl.contacts.size, 5);
    assert.equal(ghl.opportunities.length, 0);
    untouched();
  });

  it("a 429 on S8's after-count is retried, and S8 still proves the counts", async () => {
    const c = clock();
    const { ghl } = sandbox();
    let armed = false;
    let rejected = 0;
    const fetch: FetchLike = async (url, init) => {
      const u = new URL(url);
      if (init?.method === "POST" && u.pathname === "/opportunities/") armed = true;
      if (armed && u.pathname === "/opportunities/search" && u.searchParams.get("limit") === "100" && !u.searchParams.get("contact_id") && rejected < 2) {
        rejected++;
        return r429();
      }
      return ghl.fetch(url, init);
    };
    const paced = createPacedFetch(fetch, { now: c.now, sleep: c.sleep });
    const run = await runSandboxScenarios({ config, fetch: paced.fetch, runId: "s8retry", scope: "minimal", cleanup: true, ...virtual(c) });
    assert.equal(rejected, 2);
    assert.deepEqual(run.results.filter((r) => !r.pass), []);
  });

  it("S8 counts only the intended stage: other stages and other pipelines are excluded", async () => {
    const c = clock();
    const { ghl } = sandbox();
    const other = ghl.seedContact("other@example.org", []);
    const seed = (id: string, pipelineId: string, stageId: string, status = "open") =>
      ghl.opportunities.push({ id, contactId: other.id, pipelineId, stageId, status, name: "x" });
    seed("op_other_stage", "pipe_sandbox", "stage_other");
    seed("op_other_pipeline", "pipe_elsewhere", "stage_sandbox");
    seed("op_closed", "pipe_sandbox", "stage_sandbox", "won");

    const client = createGhlClient({ ...config, reconcileDelayMs: 0 }, { fetch: ghl.fetch, sleep: c.sleep });
    assert.equal(await client.countOpenOpportunities!({ stageId: "stage_sandbox" }), 0);
    assert.equal(await client.countOpenOpportunities!({ stageId: "stage_other" }), 1);
    assert.equal(await client.countOpenOpportunities!({}), 1);

    const run = await runSandboxScenarios({ config, fetch: ghl.fetch, runId: "s8count", scope: "minimal", cleanup: false, ...virtual(c) });
    assert.deepEqual(run.results.filter((r) => !r.pass), []);
    assert.ok(run.observations.includes("open opportunities before: stage 0, pipeline 1, other stage 1"), run.observations.join("; "));
    assert.ok(run.observations.includes("open opportunities after S1: stage 1, pipeline 2, other stage 1"), run.observations.join("; "));
  });
});

describe("sandbox cleanup: eventual consistency", () => {
  const quiet = { reconcileDelayMs: 0, sleep: async () => {}, otherStageId: "stage_other" };

  it("a contact list that lags is polled until it converges, and every attempt is journalled", async () => {
    const { ghl, untouched } = sandbox();
    const lag = staleList(ghl, 2);
    const manifest = createMemoryManifest();
    const run = await runSandboxScenarios({ config, fetch: lag.fetch, runId: "lag", scope: "minimal", manifest, cleanup: true, ...quiet });
    assert.deepEqual(run.results.filter((r) => !r.pass), []);
    assert.equal(run.cleanup?.state, "verified");
    const attempts = manifest.log.filter((e) => e.t === "verify_attempt");
    assert.deepEqual(attempts.map((e) => (e.t === "verify_attempt" ? [e.attempt, e.verdict] : [])), [[1, "waiting"], [2, "waiting"], [3, "verified"]]);
    assert.equal(lag.reads(), 3);
    assert.deepEqual(manifest.log.at(-1), { ...manifest.log.at(-1), t: "end", ok: true, cleanupState: "verified" });
    untouched();
  });

  it("a list that never converges is pending, bounded, with one DELETE per record; reconcile verifies later without deleting again", async () => {
    const { ghl, untouched } = sandbox();
    const lag = staleList(ghl, 1_000);
    const manifest = createMemoryManifest();
    const run = await runSandboxScenarios({ config, fetch: lag.fetch, runId: "never", scope: "minimal", manifest, cleanup: true, ...quiet, settleAttempts: 4 });
    assert.equal(run.cleanup?.state, "pending_consistency");
    assert.equal(run.cleanup?.ok, false);
    assert.equal(run.cleanup?.idsAbsent, true);
    assert.equal(manifest.log.filter((e) => e.t === "verify_attempt").length, 4, "bounded");
    assert.equal(lag.reads(), 4);
    assert.equal(deletes(ghl).length, 2);
    assert.deepEqual(manifest.log.at(-1), { ...manifest.log.at(-1), t: "end", ok: false, cleanupState: "pending_consistency" });

    lag.settle();
    const rec = await reconcileSandboxRun({ config, fetch: lag.fetch, manifest, sleep: async () => {} });
    assert.equal(rec.state, "verified", rec.lines.join("\n"));
    assert.equal(deletes(ghl).length, 2, "no further deletes");
    untouched();
  });

  it("unreadable verification reads are pending, never verified", async () => {
    const { ghl } = sandbox();
    let deleted = false;
    const fetch: FetchLike = async (url, init) => {
      const u = new URL(url);
      if (init?.method === "DELETE" && u.pathname.startsWith("/contacts/")) deleted = true;
      return deleted && u.pathname === "/contacts/" ? r429() : ghl.fetch(url, init);
    };
    const run = await runSandboxScenarios({ config, fetch, runId: "blind", scope: "minimal", cleanup: true, ...quiet, settleAttempts: 2 });
    assert.equal(run.cleanup?.state, "pending_consistency");
    assert.equal(run.cleanup?.baseline, null);
    assert.equal(ghl.contacts.size, 5);
  });

  it("a matching count is not enough: a record still present by id is a confirmed failure", async () => {
    const { ghl } = sandbox();
    // The DELETE is acknowledged and the list looks restored, but the record is still readable by id.
    const hidden = new Set<string>();
    const fetch: FetchLike = async (url, init) => {
      const u = new URL(url);
      const m = u.pathname.match(/^\/contacts\/([^/]+)$/);
      if (init?.method === "DELETE" && m) {
        hidden.add(m[1]);
        return Response.json({ succeded: true });
      }
      if ((init?.method ?? "GET") === "GET" && u.pathname === "/contacts/") {
        const body = (await (await ghl.fetch(url, init)).json()) as { contacts: Array<{ id: string }>; meta: { total: number } };
        const contacts = body.contacts.filter((x) => !hidden.has(x.id));
        return Response.json({ contacts, meta: { total: contacts.length } });
      }
      return ghl.fetch(url, init);
    };
    const manifest = createMemoryManifest();
    const run = await runSandboxScenarios({ config, fetch, runId: "ghostid", scope: "minimal", manifest, cleanup: true, ...quiet, settleAttempts: 2 });
    assert.equal(run.cleanup?.baseline?.ok, true, "the count and ids look restored");
    assert.equal(run.cleanup?.state, "failed");
    assert.equal(run.cleanup?.ok, false);
    assert.ok(run.cleanup?.lines.some((l) => /still present after DELETE/.test(l)));
    assert.ok(manifest.log.some((e) => e.t === "delete_failed" && e.kind === "contact"));
  });

  it("a matching count is not enough: the right total with a pre-existing contact missing is a failure", async () => {
    const { ghl, existing } = sandbox();
    const lag = staleList(ghl, 1_000);
    const fetch: FetchLike = async (url, init) => {
      const u = new URL(url);
      if ((init?.method ?? "GET") === "GET" && u.pathname === "/contacts/") {
        const res = await lag.fetch(url, init);
        const body = (await res.json()) as { contacts: Array<{ id: string }>; meta: { total: number } };
        if (body.meta.total === 6 && deletes(ghl).length) {
          const contacts = body.contacts.filter((x) => x.id !== existing[0].id);
          return Response.json({ contacts, meta: { total: contacts.length } });
        }
        return Response.json(body);
      }
      return lag.fetch(url, init);
    };
    const run = await runSandboxScenarios({ config, fetch, runId: "swap", scope: "minimal", cleanup: true, ...quiet, settleAttempts: 2 });
    assert.equal(run.cleanup?.state, "failed");
    assert.ok(run.cleanup?.lines.some((l) => l.includes(`pre-existing contacts missing: ${existing[0].id}`)), run.cleanup?.lines.join("\n"));
  });

  it("a contact the run did not create appearing in the list is a failure, and is not deleted", async () => {
    const { ghl } = sandbox();
    const fetch: FetchLike = async (url, init) => {
      const u = new URL(url);
      if (init?.method === "DELETE" && u.pathname.startsWith("/contacts/") && !ghl.contacts.has("late")) {
        const res = await ghl.fetch(url, init);
        ghl.contacts.set("late", { id: "late", email: "late@example.org", tags: new Set(), customFields: new Map() });
        return res;
      }
      return ghl.fetch(url, init);
    };
    const run = await runSandboxScenarios({ config, fetch, runId: "foreign", scope: "minimal", cleanup: true, ...quiet, settleAttempts: 2 });
    assert.equal(run.cleanup?.state, "failed");
    assert.ok(ghl.contacts.has("late"));
    assert.ok(!deletes(ghl).includes("/contacts/late"));
  });

  it("cleanup deletes only run records, even with opportunities on pre-existing contacts in the same pipeline", async () => {
    const { ghl, existing, untouched } = sandbox();
    ghl.opportunities.push({ id: "op_owner", contactId: existing[0].id, pipelineId: "pipe_sandbox", stageId: "stage_sandbox", status: "open", name: "keep" });
    const lag = staleList(ghl, 1);
    const manifest = createMemoryManifest();
    const run = await runSandboxScenarios({ config, fetch: lag.fetch, runId: "owned", scope: "minimal", manifest, cleanup: true, ...quiet, otherStageId: "stage_other" });
    assert.equal(run.cleanup?.state, "verified");
    assert.deepEqual(deletes(ghl).sort(), [`/contacts/${run.createdContactIds[0]}`, `/opportunities/${run.createdOpportunityIds[0]}`].sort());
    assert.ok(ghl.opportunities.some((o) => o.id === "op_owner"));
    for (const c of existing) assert.ok(!deletes(ghl).includes(`/contacts/${c.id}`));
    untouched();
  });

  for (const status of [429, 500]) {
    for (const [kind, path] of [["opportunity", /^\/opportunities\//], ["contact", /^\/contacts\//]] as const) {
      it(`a ${status} on a ${kind} DELETE is never retried, through the pacer`, async () => {
        const c = clock();
        const { ghl } = sandbox();
        ghl.fail({ method: "DELETE", path, kind: status });
        const paced = createPacedFetch(ghl.fetch, { now: c.now, sleep: c.sleep });
        const manifest = createMemoryManifest();
        const run = await runSandboxScenarios({ config, fetch: paced.fetch, runId: `del${status}${kind}`, scope: "minimal", manifest, cleanup: true, reconcileDelayMs: 0, sleep: c.sleep, otherStageId: "stage_other", syncBudgetMs: 300_000 });
        assert.equal(run.cleanup?.state, "failed");
        assert.equal(ghl.count("DELETE", path), 1, "one attempt only");
        if (kind === "opportunity") assert.equal(ghl.count("DELETE", /^\/contacts\//), 0, "its contact is kept");
        assert.ok(manifest.log.some((e) => e.t === "delete_failed" && e.kind === kind && /not retried/.test(e.reason)));
      });
    }
  }

  it("rate-limit exhaustion during cleanup sends no DELETE, keeps the journal, and a later reconcile finishes", async () => {
    const c = clock();
    const { ghl, untouched } = sandbox();
    let armed = false;
    const fetch: FetchLike = async (url, init) => {
      const u = new URL(url);
      if (init?.method === "POST" && u.pathname === "/opportunities/") armed = true;
      if (armed && u.pathname === "/opportunities/search" && u.searchParams.get("status") === "all") return r429({ "retry-after": "3600" });
      return ghl.fetch(url, init);
    };
    const paced = createPacedFetch(fetch, { now: c.now, sleep: c.sleep });
    const manifest = createMemoryManifest();
    const run = await runSandboxScenarios({ config, fetch: paced.fetch, runId: "exhaust", scope: "minimal", manifest, cleanup: true, reconcileDelayMs: 0, sleep: c.sleep, otherStageId: "stage_other", syncBudgetMs: 300_000 });
    assert.equal(run.cleanup?.state, "failed");
    assert.deepEqual(deletes(ghl), []);
    assert.equal(ghl.contacts.size, 6);
    assert.ok(manifest.log.some((e) => e.t === "created" && e.kind === "opportunity"));

    const rec = await reconcileSandboxRun({ config, fetch: ghl.fetch, manifest, sleep: async () => {} });
    assert.equal(rec.state, "verified", rec.lines.join("\n"));
    assert.equal(ghl.contacts.size, 5);
    assert.equal(ghl.opportunities.length, 0);
    untouched();
  });

  it("an unconfirmed opportunity delete keeps its contact in place", async () => {
    const { ghl } = sandbox();
    const manifest = createMemoryManifest();
    const guard = createSandboxGuard(config, async (url, init) => {
      const u = new URL(url);
      const method = init?.method ?? "GET";
      if (method === "GET" && /^\/opportunities\/[^/]+$/.test(u.pathname) && ghl.count("DELETE", /^\/opportunities\//)) return r429();
      return ghl.fetch(url, init);
    }, "unsure", manifest, { sleep: async () => {}, settleAttempts: 3 });
    const up = await guard.fetch("https://services.leadconnectorhq.com/contacts/upsert", {
      method: "POST",
      body: JSON.stringify({ email: "ghl-sandbox+unsure-new@example.com", locationId: "loc_sandbox" }),
    });
    const contactId = ((await up.json()) as { contact: { id: string } }).contact.id;
    await guard.fetch("https://services.leadconnectorhq.com/opportunities/", {
      method: "POST",
      body: JSON.stringify({ contactId, locationId: "loc_sandbox", pipelineId: "pipe_sandbox", pipelineStageId: "stage_sandbox", status: "open", name: "Sandbox unsure" }),
    });
    const report = await guard.cleanup();
    assert.equal(report.state, "failed");
    assert.equal(ghl.count("DELETE", /^\/opportunities\//), 1);
    assert.equal(ghl.count("DELETE", /^\/contacts\//), 0);
    assert.equal(manifest.log.filter((e) => e.t === "verify_record").length, 3, "bounded and journalled");
  });
});

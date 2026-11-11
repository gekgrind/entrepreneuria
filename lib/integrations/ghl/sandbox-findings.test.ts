/**
 * Regression tests for the independent review of the GHL sandbox harness
 * (findings GHL-01 to GHL-07). In-memory fake and virtual clocks only; no
 * network, placeholder ids.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createGhlClient } from "./client";
import { createFakeGhl } from "./fake-ghl.test-helper";
import { reconcileSandboxRun, runSandboxScenarios, type SandboxConfig } from "./sandbox-check";
import { createSandboxGuard } from "./sandbox-guard";
import { createMemoryManifest, type ManifestEntry } from "./sandbox-ledger";
import { createPacedFetch } from "./sandbox-pacer";

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
const OTHER_PIPELINE = "pipe_elsewhere";
const noSleep = async () => {};
const quiet = { reconcileDelayMs: 0, sleep: noSleep, otherStageId: "stage_other", otherPipelineId: OTHER_PIPELINE, scope: "minimal" as const, cleanup: true };

function sandbox(opts: Parameters<typeof createFakeGhl>[0] = {}) {
  const ghl = createFakeGhl({ knownFieldIds: Object.values(IDS), ...opts });
  const existing = Array.from({ length: 5 }, (_, i) =>
    ghl.seedContact(`owner-contact-${i}@example.org`, [`original-${i}`], {}, { name: `Person ${i}`, phone: `+1770555020${i}` })
  );
  const frozen = () => existing.map((c) => JSON.stringify({ ...c, tags: [...c.tags], customFields: [...c.customFields] }));
  const before = frozen();
  return { ghl, existing, untouched: () => assert.deepEqual(frozen(), before, "pre-existing contacts changed") };
}

const deletes = (ghl: ReturnType<typeof createFakeGhl>) => ghl.calls.filter((c) => c.method === "DELETE").map((c) => c.path);
const isDelete = (init: RequestInit | undefined, u: URL, prefix: string) => init?.method === "DELETE" && u.pathname.startsWith(prefix);
const r429 = (headers: Record<string, string> = {}) => new Response("{}", { status: 429, headers });

function clock() {
  let t = 1_000_000;
  return {
    now: () => t,
    // Moves to an absolute target, so concurrent sleepers don't add up.
    sleep: async (ms: number) => {
      const target = t + ms;
      await new Promise((r) => setImmediate(r));
      t = Math.max(t, target);
    },
  };
}

function recorder(c: ReturnType<typeof clock>, answer: (n: number) => Response = () => Response.json({})) {
  const sent: number[] = [];
  const inner: FetchLike = async () => {
    sent.push(c.now());
    return answer(sent.length);
  };
  return { sent, inner };
}

const URL_A = "https://services.leadconnectorhq.com/contacts/x";

describe("GHL-01: a DELETE is attempted at most once, across restarts", () => {
  it("journals the intent before the DELETE leaves the process", async () => {
    const { ghl } = sandbox();
    const manifest = createMemoryManifest();
    const seen: Array<boolean> = [];
    const fetch: FetchLike = async (url, init) => {
      if (init?.method === "DELETE") {
        const id = new URL(url).pathname.split("/").pop();
        seen.push(manifest.log.some((e) => (e as { t: string }).t === "delete_intent" && (e as { id?: string }).id === id));
      }
      return ghl.fetch(url, init);
    };
    const run = await runSandboxScenarios({ config, fetch, runId: "intent", manifest, ...quiet });
    assert.equal(run.cleanup?.state, "verified");
    assert.deepEqual(seen, [true, true]);
  });

  it("no DELETE is sent if the intent cannot be journalled", async () => {
    const { ghl } = sandbox();
    const manifest = createMemoryManifest();
    manifest.failOn = (e) => (e as { t: string }).t === "delete_intent";
    const run = await runSandboxScenarios({ config, fetch: ghl.fetch, runId: "nointent", manifest, ...quiet });
    assert.equal(run.cleanup?.state, "failed");
    assert.deepEqual(deletes(ghl), []);
  });

  const ambiguous: Array<[string, (ghl: ReturnType<typeof createFakeGhl>) => FetchLike]> = [
    ["returned 500", (ghl) => async (url, init) => (isDelete(init, new URL(url), "/opportunities/") ? (ghl.calls.push({ method: "DELETE", path: new URL(url).pathname, body: null, headers: {} }), new Response("{}", { status: 500 })) : ghl.fetch(url, init))],
    ["timed out", (ghl) => async (url, init) => {
      if (isDelete(init, new URL(url), "/opportunities/")) {
        ghl.calls.push({ method: "DELETE", path: new URL(url).pathname, body: null, headers: {} });
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      return ghl.fetch(url, init);
    }],
    ["was accepted but the record still reads as present", (ghl) => async (url, init) => (isDelete(init, new URL(url), "/opportunities/") ? (ghl.calls.push({ method: "DELETE", path: new URL(url).pathname, body: null, headers: {} }), Response.json({ succeded: true })) : ghl.fetch(url, init))],
  ];
  for (const [name, wrap] of ambiguous) {
    it(`an opportunity DELETE that ${name} is never repeated by --reconcile`, async () => {
      const { ghl, untouched } = sandbox();
      const fetch = wrap(ghl);
      const manifest = createMemoryManifest();
      const run = await runSandboxScenarios({ config, fetch, runId: "amb", manifest, ...quiet, settleAttempts: 2 });
      assert.equal(run.cleanup?.state, "failed");
      assert.equal(deletes(ghl).length, 1);

      const rec = await reconcileSandboxRun({ config, fetch, manifest, sleep: noSleep, settleAttempts: 2 });
      assert.equal(rec.state, "failed", rec.lines.join("\n"));
      assert.equal(deletes(ghl).length, 1, "still one attempt after the restart");
      assert.ok(rec.lines.some((l) => /will not be repeated/.test(l)), rec.lines.join("\n"));
      untouched();
    });
  }

  it("a crash after the DELETE but before it is journalled does not repeat it", async () => {
    const { ghl } = sandbox();
    const manifest = createMemoryManifest();
    manifest.failOn = (e) => e.t === "deleted" && e.kind === "contact";
    // The contact DELETE lands, then the process dies before recording it. Simulate GHL still answering "present".
    const stale = new Set<string>();
    const fetch: FetchLike = async (url, init) => {
      const u = new URL(url);
      if (isDelete(init, u, "/contacts/")) {
        ghl.calls.push({ method: "DELETE", path: u.pathname, body: null, headers: {} });
        stale.add(u.pathname);
        return Response.json({ succeded: true });
      }
      return ghl.fetch(url, init);
    };
    const run = await runSandboxScenarios({ config, fetch, runId: "crashdel", manifest, ...quiet, settleAttempts: 2 });
    assert.equal(run.cleanup?.state, "failed");
    assert.equal(stale.size, 1);
    const rec = await reconcileSandboxRun({ config, fetch, manifest, sleep: noSleep, settleAttempts: 2 });
    assert.notEqual(rec.state, "verified");
    assert.equal(deletes(ghl).filter((p) => p.startsWith("/contacts/")).length, 1);
  });

  for (const [name, entries, version] of [
    ["a journalled deleted entry", (id: string): ManifestEntry[] => [{ t: "deleted", kind: "contact", id }], undefined],
    ["a journalled DELETE failure", (id: string): ManifestEntry[] => [{ t: "delete_failed", kind: "contact", id, reason: "DELETE returned 500; not retried" }], undefined],
    ["a journalled deleted entry (current version)", (id: string): ManifestEntry[] => [{ t: "deleted", kind: "contact", id }], 2],
    ["a journalled DELETE failure (current version)", (id: string): ManifestEntry[] => [{ t: "delete_failed", kind: "contact", id, reason: "DELETE returned 500; not retried" }], 2],
  ] as const) {
    it(`older journals: ${name} also blocks a repeat`, async () => {
      const { ghl } = sandbox();
      const c = ghl.seedContact("ghl-sandbox+old-new@example.com", []);
      const manifest = createMemoryManifest([
        { t: "start", runId: "old", locationId: "loc_sandbox", pipelineId: "pipe_sandbox", stageId: "stage_sandbox", gitSha: "-", scope: "minimal", at: "2026-11-10T00:00:00.000Z", ...(version ? { journalVersion: version } : {}) },
        { t: "created", kind: "contact", id: c.id, email: c.email },
        ...entries(c.id),
      ]);
      const rec = await reconcileSandboxRun({ config, fetch: ghl.fetch, manifest, sleep: noSleep, settleAttempts: 2 });
      assert.equal(rec.state, "failed");
      assert.deepEqual(deletes(ghl), []);
      assert.ok(ghl.contacts.has(c.id));
    });
  }

  it("a journalled failure that never sent a DELETE does not block the first attempt", async () => {
    const { ghl } = sandbox();
    const c = ghl.seedContact("ghl-sandbox+nosend-new@example.com", []);
    const manifest = createMemoryManifest([
      { t: "start", runId: "nosend", locationId: "loc_sandbox", pipelineId: "pipe_sandbox", stageId: "stage_sandbox", gitSha: "-", scope: "minimal", at: "2026-11-10T00:00:00.000Z", journalVersion: 2 },
      { t: "created", kind: "contact", id: c.id, email: c.email },
      { t: "delete_failed", kind: "contact", id: c.id, reason: "read-back did not match the run's record; no delete sent" },
    ]);
    const rec = await reconcileSandboxRun({ config, fetch: ghl.fetch, manifest, sleep: noSleep });
    assert.equal(rec.state, "verified", rec.lines.join("\n"));
    assert.equal(deletes(ghl).length, 1);
  });

  it("after the owner removes the record by hand, --reconcile verifies it and finishes, still without repeating", async () => {
    const { ghl, untouched } = sandbox();
    ghl.fail({ method: "DELETE", path: /^\/opportunities\//, kind: 500 });
    const manifest = createMemoryManifest();
    const run = await runSandboxScenarios({ config, fetch: ghl.fetch, runId: "byhand", manifest, ...quiet, settleAttempts: 2 });
    assert.equal(run.cleanup?.state, "failed");
    ghl.opportunities.length = 0; // the owner deletes it in GoHighLevel

    const rec = await reconcileSandboxRun({ config, fetch: ghl.fetch, manifest, sleep: noSleep, settleAttempts: 2 });
    assert.equal(rec.state, "verified", rec.lines.join("\n"));
    assert.equal(deletes(ghl).filter((p) => p.startsWith("/opportunities/")).length, 1);
    assert.equal(ghl.contacts.size, 5);
    untouched();
  });
});

describe("GHL-02: unknown opportunities are never claimed", () => {
  const withIntruder = (ghl: ReturnType<typeof createFakeGhl>, pipelineId: string): FetchLike => async (url, init) => {
    const res = await ghl.fetch(url, init);
    if (init?.method === "POST" && new URL(url).pathname === "/opportunities/") {
      const contactId = JSON.parse(String(init.body)).contactId as string;
      ghl.opportunities.push({ id: "op_person", contactId, pipelineId, stageId: "stage_sandbox", status: "open", name: "Added by a person" });
    }
    return res;
  };

  for (const [name, pipelineId] of [["the same pipeline", "pipe_sandbox"], ["another pipeline", OTHER_PIPELINE]] as const) {
    it(`an opportunity a person added to the run contact in ${name} stops cleanup with nothing deleted`, async () => {
      const { ghl, untouched } = sandbox();
      const manifest = createMemoryManifest();
      const run = await runSandboxScenarios({ config, fetch: withIntruder(ghl, pipelineId), runId: "person", manifest, ...quiet, settleAttempts: 2 });
      assert.equal(run.cleanup?.state, "failed");
      assert.deepEqual(deletes(ghl), [], "nothing deleted, contact preserved");
      assert.ok(ghl.opportunities.some((o) => o.id === "op_person"));
      assert.equal(ghl.contacts.size, 6);
      assert.ok(!manifest.log.some((e) => e.t === "created" && e.id === "op_person"), "ownership was not claimed");
      assert.ok(run.cleanup?.lines.some((l) => l.includes("op_person")), run.cleanup?.lines.join("\n"));
      untouched();
    });
  }

  it("an open create intent does not make a differently named opportunity ownable", async () => {
    const { ghl } = sandbox();
    const fetch: FetchLike = async (url, init) => {
      if (init?.method === "POST" && new URL(url).pathname === "/opportunities/") {
        const body = JSON.parse(String(init.body));
        ghl.opportunities.push({ id: "op_lookalike", contactId: body.contactId, pipelineId: body.pipelineId, stageId: body.pipelineStageId, status: "open", name: "Not this run" });
        return new Response("", { status: 502 });
      }
      return ghl.fetch(url, init);
    };
    const run = await runSandboxScenarios({ config, fetch, runId: "lookalike", ...quiet, settleAttempts: 2 });
    assert.equal(run.cleanup?.state, "failed");
    assert.deepEqual(deletes(ghl), []);
  });
});

describe("GHL-03: ambiguous opportunity creates stay unresolved until settled", () => {
  const lost = (ghl: ReturnType<typeof createFakeGhl>, mode: "502" | "throw"): FetchLike => async (url, init) => {
    const res = await ghl.fetch(url, init);
    if (init?.method === "POST" && new URL(url).pathname === "/opportunities/") {
      if (mode === "throw") throw new DOMException("The operation was aborted.", "AbortError");
      return new Response("", { status: 502 });
    }
    return res;
  };

  for (const mode of ["502", "throw"] as const) {
    it(`a lost create (${mode}) with a lagging search: the contact is kept and cleanup is never verified`, async () => {
      const { ghl } = sandbox({ searchLag: 1_000 });
      const manifest = createMemoryManifest();
      const run = await runSandboxScenarios({ config, fetch: lost(ghl, mode), runId: "lost", manifest, ...quiet, settleAttempts: 3 });
      assert.equal(run.cleanup?.state, "failed");
      assert.deepEqual(deletes(ghl), [], "the parent contact is not deleted");
      assert.equal(ghl.opportunities.length, 1, "the landed opportunity is still there");
      assert.ok(run.cleanup?.lines.some((l) => /unresolved/.test(l)), run.cleanup?.lines.join("\n"));

      const rec = await reconcileSandboxRun({ config, fetch: ghl.fetch, manifest, sleep: noSleep, settleAttempts: 2 });
      assert.notEqual(rec.state, "verified", "still unresolved after a restart");
      assert.deepEqual(deletes(ghl), []);
    });
  }

  it("a lost create that surfaces within the polling budget is proven by its run-specific identity, then removed", async () => {
    const { ghl, untouched } = sandbox({ searchLag: 3 });
    const manifest = createMemoryManifest();
    const run = await runSandboxScenarios({ config, fetch: lost(ghl, "502"), runId: "surfaces", manifest, ...quiet, settleAttempts: 8 });
    assert.equal(run.cleanup?.state, "verified", run.cleanup?.lines.join("\n"));
    assert.ok(manifest.log.some((e) => e.t === "created" && e.kind === "opportunity" && e.recovered));
    assert.equal(ghl.opportunities.length, 0);
    assert.equal(ghl.contacts.size, 5);
    untouched();
  });

  it("a definite rejection (4xx) resolves the intent, so the contact can be removed", async () => {
    const { ghl } = sandbox();
    ghl.fail({ method: "POST", path: /^\/opportunities\/$/, kind: 400 });
    const manifest = createMemoryManifest();
    const run = await runSandboxScenarios({ config, fetch: ghl.fetch, runId: "reject", manifest, ...quiet });
    assert.equal(run.cleanup?.state, "verified", run.cleanup?.lines.join("\n"));
    assert.ok(manifest.log.some((e) => (e as { t: string }).t === "create_rejected"));
    assert.equal(ghl.contacts.size, 5);
  });

  it("an older journal's intent with no recorded name stays unresolved", async () => {
    const { ghl } = sandbox();
    const c = ghl.seedContact("ghl-sandbox+legacy-new@example.com", []);
    ghl.opportunities.push({ id: "op_legacy", contactId: c.id, pipelineId: "pipe_sandbox", stageId: "stage_sandbox", status: "open", name: "Sandbox Co legacy" });
    const manifest = createMemoryManifest([
      { t: "start", runId: "legacy", locationId: "loc_sandbox", pipelineId: "pipe_sandbox", stageId: "stage_sandbox", gitSha: "-", scope: "minimal", at: "2026-11-10T00:00:00.000Z" },
      { t: "created", kind: "contact", id: c.id, email: c.email },
      { t: "intent", kind: "opportunity", contactId: c.id },
    ]);
    const rec = await reconcileSandboxRun({ config, fetch: ghl.fetch, manifest, sleep: noSleep, settleAttempts: 2 });
    assert.equal(rec.state, "failed");
    assert.deepEqual(deletes(ghl), []);
  });

  it("an unresolved contact create is never verified, even when the baseline looks restored", async () => {
    const { ghl } = sandbox();
    // The upsert never lands, but its response is lost, so the run cannot know that.
    const fetch: FetchLike = async (url, init) =>
      init?.method === "POST" && new URL(url).pathname === "/contacts/upsert" ? new Response("", { status: 502 }) : ghl.fetch(url, init);
    const run = await runSandboxScenarios({ config, fetch, runId: "neverlanded", ...quiet, settleAttempts: 2 });
    assert.equal(ghl.contacts.size, 5, "nothing was created");
    assert.equal(run.cleanup?.state, "failed");
    assert.ok(run.cleanup?.lines.some((l) => /unresolved/.test(l)), run.cleanup?.lines.join("\n"));
  });

  it("a contact create that cannot be found stays unresolved and is never verified", async () => {
    const { ghl } = sandbox();
    const hidden: FetchLike = async (url, init) => {
      const u = new URL(url);
      if (init?.method === "POST" && u.pathname === "/contacts/upsert") {
        await ghl.fetch(url, init);
        return new Response("", { status: 502 });
      }
      if (u.pathname === "/contacts/search/duplicate" && ghl.count("POST", "/contacts/upsert")) return Response.json({ contact: null });
      return ghl.fetch(url, init);
    };
    const run = await runSandboxScenarios({ config, fetch: hidden, runId: "ghostcontact", ...quiet, settleAttempts: 2 });
    assert.equal(run.cleanup?.state, "failed");
    assert.ok(run.cleanup?.lines.some((l) => /unresolved/.test(l)), run.cleanup?.lines.join("\n"));
  });
});

describe("GHL-04: cleanup and the terminal journal entry always run", () => {
  const failOnce = (ghl: ReturnType<typeof createFakeGhl>, match: (u: URL) => boolean): FetchLike => {
    let spent = false;
    return async (url, init) => {
      const u = new URL(url);
      const armed = ghl.count("POST", "/opportunities/") > 0;
      if (armed && !spent && (init?.method ?? "GET") === "GET" && match(u)) {
        spent = true;
        return new Response("{}", { status: 500 });
      }
      return ghl.fetch(url, init);
    };
  };
  const cases: Array<[string, (u: URL) => boolean]> = [
    ["contact read-back", (u) => /^\/contacts\/ct_[^/]+$/.test(u.pathname)],
    ["notes read-back", (u) => /\/notes$/.test(u.pathname)],
    ["opportunity read-back", (u) => u.pathname === "/opportunities/search" && u.searchParams.has("contact_id") && u.searchParams.get("status") === "open"],
  ];
  for (const [name, match] of cases) {
    it(`a throwing ${name} does not skip cleanup`, async () => {
      const { ghl, untouched } = sandbox();
      const manifest = createMemoryManifest();
      const run = await runSandboxScenarios({ config, fetch: failOnce(ghl, match), runId: "readback", manifest, ...quiet });
      assert.ok(run.results.some((r) => !r.pass), "the failure is recorded");
      assert.equal(run.cleanup?.state, "verified", run.cleanup?.lines.join("\n"));
      assert.equal(ghl.contacts.size, 5);
      assert.equal(ghl.opportunities.length, 0);
      assert.equal(manifest.log.at(-1)?.t, "end");
      untouched();
    });
  }

  it("a cleanup that fails still writes the terminal entry", async () => {
    const { ghl } = sandbox();
    let armed = false;
    const fetch: FetchLike = async (url, init) => {
      const u = new URL(url);
      if (init?.method === "POST" && u.pathname === "/opportunities/") armed = true;
      if (armed && u.pathname === "/opportunities/search" && u.searchParams.get("status") === "all") throw new Error("network down");
      return ghl.fetch(url, init);
    };
    const manifest = createMemoryManifest();
    const run = await runSandboxScenarios({ config, fetch, runId: "cleanfail", manifest, ...quiet });
    assert.equal(run.cleanup?.state, "failed");
    assert.deepEqual(manifest.log.at(-1), { ...manifest.log.at(-1), t: "end", ok: false, cleanupState: "failed" });
  });

  it("a journal failure on the terminal entry is reported, not thrown", async () => {
    const { ghl } = sandbox();
    const manifest = createMemoryManifest();
    manifest.failOn = (e) => e.t === "end";
    const run = await runSandboxScenarios({ config, fetch: ghl.fetch, runId: "noend", manifest, ...quiet });
    assert.ok(run.results.some((r) => !r.pass && r.scenario === "journal"));
  });
});

describe("GHL-05: rate-limit headers", () => {
  it("honours Retry-After in seconds", async () => {
    const c = clock();
    const { sent, inner } = recorder(c, (n) => (n === 1 ? r429({ "retry-after": "20" }) : Response.json({})));
    const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
    await paced.fetch(URL_A);
    assert.ok(sent[1] - sent[0] >= 20_000);
  });

  it("honours Retry-After as an HTTP date within the bound", async () => {
    const c = clock();
    const when = new Date(c.now() + 20_000).toUTCString();
    const { sent, inner } = recorder(c, (n) => (n === 1 ? r429({ "retry-after": when }) : Response.json({})));
    const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
    assert.equal((await paced.fetch(URL_A)).status, 200);
    assert.ok(sent[1] - sent[0] >= 20_000, `waited ${sent[1] - sent[0]} ms`);
  });

  it("an HTTP date past the bound closes the pacer", async () => {
    const c = clock();
    const when = new Date(c.now() + 60_000).toUTCString();
    const { sent, inner } = recorder(c, () => r429({ "retry-after": when }));
    const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
    assert.equal((await paced.fetch(URL_A)).status, 429);
    assert.equal(sent.length, 1);
    assert.match(paced.closed ?? "", /over the 30000 ms bound/);
  });

  it("an unparseable Retry-After falls back to the default window, and a past date adds nothing", async () => {
    for (const value of ["soon-ish", new Date(1000).toUTCString()]) {
      const c = clock();
      const { sent, inner } = recorder(c, (n) => (n === 1 ? r429({ "retry-after": value }) : Response.json({})));
      const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
      assert.equal((await paced.fetch(URL_A)).status, 200);
      assert.equal(sent[1] - sent[0], 10_000, value);
    }
  });

  it("a low-remaining cooldown longer than the bound is not shortened: the pacer closes", async () => {
    const c = clock();
    const { sent, inner } = recorder(c, () => new Response("{}", { headers: { "x-ratelimit-remaining": "1", "x-ratelimit-interval-milliseconds": "60000" } }));
    const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
    assert.equal((await paced.fetch(URL_A)).status, 200);
    assert.match(paced.closed ?? "", /over the 30000 ms bound/);
    assert.equal((await paced.fetch(URL_A)).status, 429);
    assert.equal(sent.length, 1, "not sent");
  });

  it("Retry-After on a successful response is honoured", async () => {
    const c = clock();
    const { sent, inner } = recorder(c, (n) => (n === 1 ? new Response("{}", { headers: { "retry-after": "15" } }) : Response.json({})));
    const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
    await paced.fetch(URL_A);
    await paced.fetch(URL_A);
    assert.ok(sent[1] - sent[0] >= 15_000);
  });

  it("an exhausted daily limit on a successful response closes the pacer", async () => {
    const c = clock();
    const { sent, inner } = recorder(c, () => new Response("{}", { headers: { "x-ratelimit-daily-remaining": "0", "x-ratelimit-daily-reset": "3600000" } }));
    const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
    await paced.fetch(URL_A);
    assert.equal((await paced.fetch(URL_A)).status, 429);
    assert.equal(sent.length, 1);
  });

  it("concurrent requests each get their own slot", async () => {
    const c = clock();
    const { sent, inner } = recorder(c);
    const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep, ratePer10s: 20 });
    await Promise.all(Array.from({ length: 45 }, () => paced.fetch(URL_A)));
    assert.equal(sent.length, 45);
    const gaps = sent.slice(1).map((t, i) => t - sent[i]);
    assert.ok(Math.min(...gaps) >= paced.spacingMs, `smallest gap ${Math.min(...gaps)}`);
    const busiest = Math.max(...sent.map((s) => sent.filter((t) => t >= s && t < s + 10_000).length));
    assert.ok(busiest <= 20, `${busiest} in one window`);
  });

  it("spacing uses a monotonic clock: a wall-clock jump does not release requests early", async () => {
    const realNow = Date.now;
    const sent: number[] = [];
    const paced = createPacedFetch(async () => {
      sent.push(performance.now());
      // The wall clock jumps ten minutes ahead after the first request (an NTP step).
      if (sent.length === 1) Date.now = () => realNow() + 600_000;
      return Response.json({});
    }, { ratePer10s: 20 });
    try {
      await paced.fetch(URL_A);
      await paced.fetch(URL_A);
    } finally {
      Date.now = realNow;
    }
    assert.ok(sent[1] - sent[0] >= paced.spacingMs - 5, `gap ${sent[1] - sent[0]}`);
  });

  it("concurrent requests are spaced on real timers too", async () => {
    const sent: number[] = [];
    const paced = createPacedFetch(async () => {
      sent.push(performance.now());
      return Response.json({});
    }, { ratePer10s: 20 });
    await Promise.all(Array.from({ length: 5 }, () => paced.fetch(URL_A)));
    const gaps = sent.slice(1).map((t, i) => t - sent[i]);
    assert.ok(Math.min(...gaps) >= paced.spacingMs - 5, `smallest gap ${Math.min(...gaps)}`);
  });
});

describe("GHL-06: sandbox writes are attempted once, through adapter, guard and pacer", () => {
  const paced = (inner: FetchLike) => {
    const c = clock();
    return { c, fetch: createPacedFetch(inner, { now: c.now, sleep: c.sleep }).fetch };
  };
  const writes: Array<[string, string, RegExp]> = [
    ["upsert", "POST", /^\/contacts\/upsert$/],
    ["details PUT", "PUT", /^\/contacts\/[^/]+$/],
    ["tags", "POST", /\/tags$/],
    ["note", "POST", /\/notes$/],
    ["opportunity create", "POST", /^\/opportunities\/$/],
  ];
  for (const [name, method, path] of writes) {
    for (const kind of [503, "applied-500", 422] as const) {
      it(`a ${name} answered with ${kind} is sent once and stops the run`, async () => {
        const { ghl, untouched } = sandbox();
        ghl.fail({ method, path, kind });
        const { c, fetch } = paced(ghl.fetch);
        const manifest = createMemoryManifest();
        const run = await runSandboxScenarios({ config, fetch, runId: "once", manifest, ...quiet, sleep: c.sleep, syncBudgetMs: 300_000 });
        assert.equal(ghl.count(method, path), 1, "one attempt");
        assert.ok(run.stopped, "the run stopped");
        assert.notEqual(run.cleanup, null);
        untouched();
      });
    }
    it(`a ${name} that throws is sent once and stops the run`, async () => {
      const { ghl } = sandbox();
      let thrown = false;
      const inner: FetchLike = async (url, init) => {
        if (!thrown && (init?.method ?? "GET") === method && path.test(new URL(url).pathname)) {
          thrown = true;
          ghl.calls.push({ method, path: new URL(url).pathname, body: null, headers: {} });
          throw new TypeError("fetch failed");
        }
        return ghl.fetch(url, init);
      };
      const { c, fetch } = paced(inner);
      const run = await runSandboxScenarios({ config, fetch, runId: "throws", ...quiet, sleep: c.sleep, syncBudgetMs: 300_000 });
      assert.equal(ghl.count(method, path), 1, "one attempt");
      assert.ok(run.stopped, "the run stopped");
    });
  }

  it("a successful write with an unreadable body is not re-sent", async () => {
    const { ghl } = sandbox();
    ghl.fail({ method: "PUT", path: /^\/contacts\/[^/]+$/, kind: "garbage-200" });
    const run = await runSandboxScenarios({ config, fetch: ghl.fetch, runId: "garbled", ...quiet });
    assert.equal(ghl.count("PUT", /^\/contacts\/[^/]+$/), 1);
    assert.ok(run.stopped);
  });

  it("guard: a repeat of an identical write is refused before sending", async () => {
    const { ghl } = sandbox();
    const guard = createSandboxGuard(config, ghl.fetch, "repeat", createMemoryManifest(), { singleAttemptWrites: true });
    const base = "https://services.leadconnectorhq.com";
    const res = await guard.fetch(`${base}/contacts/upsert`, { method: "POST", body: JSON.stringify({ email: "ghl-sandbox+repeat-new@example.com", locationId: "loc_sandbox" }) });
    const id = ((await res.json()) as { contact: { id: string } }).contact.id;
    await guard.fetch(`${base}/contacts/${id}/tags`, { method: "POST", body: JSON.stringify({ tags: ["sandbox-repeat"] }) });
    await assert.rejects(guard.fetch(`${base}/contacts/${id}/tags`, { method: "POST", body: JSON.stringify({ tags: ["sandbox-repeat"] }) }), /repeat/);
    assert.equal(ghl.count("POST", /\/tags$/), 1);
  });

  it("production adapter behaviour is unchanged: without the guard it still retries an idempotent PUT", async () => {
    const ghl = createFakeGhl({ knownFieldIds: Object.values(IDS) });
    ghl.fail({ method: "PUT", path: /^\/contacts\/[^/]+$/, kind: 503 });
    const client = createGhlClient({ ...config, reconcileDelayMs: 0 }, { fetch: ghl.fetch, sleep: noSleep });
    await client.syncLead({
      name: "Test Person",
      email: "prod-path@example.com",
      phone: "+14045550101",
      companyName: "Co",
      website: "co.example.com",
      source: "test",
      tags: ["t"],
      customFields: { style_interest: "a" },
      opportunityName: "Co",
      note: "n",
      reference: "ref-1",
    });
    assert.equal(ghl.count("PUT", /^\/contacts\/[^/]+$/), 2);
  });
});

describe("GHL-07: S8 proves pipeline and stage filtering", () => {
  const s8 = (run: Awaited<ReturnType<typeof runSandboxScenarios>>) => run.results.filter((r) => r.scenario.startsWith("S8"));
  const seed = (ghl: ReturnType<typeof createFakeGhl>) => {
    const other = ghl.seedContact("other@example.org", []);
    const add = (id: string, pipelineId: string, stageId: string, status = "open") => ghl.opportunities.push({ id, contactId: other.id, pipelineId, stageId, status, name: "unrelated" });
    add("op_other_stage", "pipe_sandbox", "stage_other");
    add("op_other_pipeline_a", OTHER_PIPELINE, "stage_x");
    add("op_other_pipeline_b", OTHER_PIPELINE, "stage_sandbox");
    add("op_closed", "pipe_sandbox", "stage_sandbox", "won");
  };

  it("passes on correct filtering, with absolute counts and record identities checked", async () => {
    const { ghl } = sandbox();
    seed(ghl);
    const run = await runSandboxScenarios({ config, fetch: ghl.fetch, runId: "s8ok", ...quiet, cleanup: false });
    assert.deepEqual(run.results.filter((r) => !r.pass), []);
    assert.deepEqual(run.unproven, []);
    for (const check of [
      "intake-stage count matches the records returned",
      "pipeline count matches the records returned",
      "the run's opportunity is in the intake-stage results",
      "the run's opportunity is excluded from another stage's results",
      "the run's opportunity is excluded from another pipeline's results",
      "every returned record belongs to the queried pipeline and stage",
    ]) {
      assert.ok(s8(run).some((r) => r.check === check && r.pass), check);
    }
  });

  it("fails if GHL ignores pipeline_id, even when every count delta looks right", async () => {
    const { ghl } = sandbox({ ignorePipelineFilter: true });
    const other = ghl.seedContact("other@example.org", []);
    for (let i = 0; i < 7; i++) ghl.opportunities.push({ id: `op_${i}`, contactId: other.id, pipelineId: OTHER_PIPELINE, stageId: "stage_x", status: "open", name: "unrelated" });
    const run = await runSandboxScenarios({ config, fetch: ghl.fetch, runId: "s8pipe", ...quiet, cleanup: false });
    const failed = s8(run).filter((r) => !r.pass).map((r) => r.check);
    assert.ok(failed.includes("the run's opportunity is excluded from another pipeline's results"), failed.join("; "));
    assert.ok(failed.includes("every returned record belongs to the queried pipeline and stage"), failed.join("; "));
    assert.ok(s8(run).some((r) => r.check === "pipeline count rose by exactly 1" && r.pass), "the delta alone would have passed");
  });

  it("fails if GHL ignores the stage filter", async () => {
    const { ghl } = sandbox({ ignoreStageFilter: true });
    seed(ghl);
    const run = await runSandboxScenarios({ config, fetch: ghl.fetch, runId: "s8stage", ...quiet, cleanup: false });
    const failed = s8(run).filter((r) => !r.pass).map((r) => r.check);
    assert.ok(failed.includes("the run's opportunity is excluded from another stage's results"), failed.join("; "));
  });

  it("fails if a count disagrees with the records returned", async () => {
    const { ghl } = sandbox();
    // Every intake-stage count read shows one extra record that the later list read no longer returns
    // (the index changed between reads). The delta stays exactly 1; only the absolute check can catch it.
    let reads = 0;
    const fetch: FetchLike = async (url, init) => {
      const u = new URL(url);
      const res = await ghl.fetch(url, init);
      if (u.pathname === "/opportunities/search" && u.searchParams.get("pipeline_stage_id") === "stage_sandbox" && !u.searchParams.has("contact_id")) {
        reads++;
        const isListRead = ghl.count("POST", "/opportunities/") > 0 && reads === 3;
        if (!isListRead) {
          const body = (await res.json()) as { opportunities: Array<{ id: string }>; meta: { total: number } };
          return Response.json({ opportunities: [...body.opportunities, { id: "op_flicker" }], meta: { total: body.meta.total + 1 } });
        }
      }
      return res;
    };
    const run = await runSandboxScenarios({ config, fetch, runId: "s8abs", ...quiet, cleanup: false });
    assert.ok(s8(run).some((r) => r.check === "intake-stage count rose by exactly 1" && r.pass), "the delta alone would have passed");
    assert.ok(s8(run).some((r) => r.check === "intake-stage count matches the records returned" && !r.pass), JSON.stringify(s8(run)));
  });

  it("reports pipeline exclusion as unproven, not passed, when no other pipeline exists", async () => {
    const { ghl } = sandbox();
    const manifest = createMemoryManifest();
    const run = await runSandboxScenarios({ config, fetch: ghl.fetch, runId: "s8none", manifest, ...quiet, otherPipelineId: undefined });
    assert.ok(run.unproven.some((u) => /pipeline exclusion/.test(u)), run.unproven.join("; "));
    assert.ok(!s8(run).some((r) => r.check === "the run's opportunity is excluded from another pipeline's results"), "no passing check is claimed");
    assert.ok(/pipeline exclusion/.test(JSON.stringify(manifest.log.at(-1))));
  });

  it("reports identities as unproven when GHL's records do not carry pipeline and stage ids", async () => {
    const { ghl } = sandbox();
    const fetch: FetchLike = async (url, init) => {
      const res = await ghl.fetch(url, init);
      if ((init?.method ?? "GET") === "GET" && /^\/opportunities\/op_/.test(new URL(url).pathname)) {
        const body = (await res.json()) as { opportunity: Record<string, unknown> };
        return Response.json({ opportunity: { id: body.opportunity.id, contactId: body.opportunity.contactId } });
      }
      return res;
    };
    const run = await runSandboxScenarios({ config, fetch, runId: "s8blind", ...quiet, cleanup: false });
    assert.ok(run.unproven.some((u) => /record identities/.test(u)), run.unproven.join("; "));
    assert.ok(!s8(run).some((r) => r.check === "every returned record belongs to the queried pipeline and stage" && r.pass));
  });
});

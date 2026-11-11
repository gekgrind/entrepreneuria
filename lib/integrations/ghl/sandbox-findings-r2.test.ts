/**
 * Regression tests for the second independent review of the GHL sandbox
 * harness (findings GHL-R2-01 to GHL-R2-06). In-memory fake, temporary files
 * and virtual clocks only; no network, placeholder ids.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { createFakeGhl } from "./fake-ghl.test-helper";
import { reconcileSandboxRun, runSandboxScenarios, type SandboxConfig } from "./sandbox-check";
import { createMemoryManifest, openFileManifest, parseManifest, type ManifestEntry } from "./sandbox-ledger";
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
const noSleep = async () => {};
const quiet = { reconcileDelayMs: 0, sleep: noSleep, otherStageId: "stage_other", otherPipelineId: "pipe_elsewhere", scope: "minimal" as const, cleanup: true };
const AT = "2026-11-10T00:00:00.000Z";

function sandbox() {
  const ghl = createFakeGhl({ knownFieldIds: Object.values(IDS) });
  const existing = Array.from({ length: 5 }, (_, i) => ghl.seedContact(`owner-contact-${i}@example.org`, [`original-${i}`]));
  return { ghl, existing };
}
const deletes = (ghl: ReturnType<typeof createFakeGhl>) => ghl.calls.filter((c) => c.method === "DELETE").map((c) => c.path);
const start = (runId: string, version?: number): ManifestEntry =>
  ({ t: "start", runId, locationId: "loc_sandbox", pipelineId: "pipe_sandbox", stageId: "stage_sandbox", gitSha: "-", scope: "minimal", at: AT, ...(version ? { journalVersion: version } : {}) }) as ManifestEntry;

describe("R2-01: a contact is adopted only with definite proof of ownership", () => {
  it("an upsert answering new:false is someone else's contact: never adopted or deleted, now or after a restart", async () => {
    const { ghl } = sandbox();
    let other: string | null = null;
    const fetch: FetchLike = async (url, init) => {
      if (init?.method === "POST" && new URL(url).pathname === "/contacts/upsert" && !other) {
        // Another client creates the same address between the run's lookup and its upsert.
        other = ghl.seedContact(JSON.parse(String(init.body)).email, ["theirs"]).id;
      }
      return ghl.fetch(url, init);
    };
    const manifest = createMemoryManifest();
    const run = await runSandboxScenarios({ config, fetch, runId: "unowned", manifest, ...quiet, settleAttempts: 2 });
    assert.ok(other);
    assert.ok(run.stopped);
    assert.ok(!deletes(ghl).includes(`/contacts/${other}`), "not deleted by the run");
    assert.ok(manifest.log.some((e) => (e as { t: string }).t === "unowned_match"), "the outcome is journalled");

    await reconcileSandboxRun({ config, fetch: ghl.fetch, manifest, sleep: noSleep, settleAttempts: 2 });
    assert.ok(!deletes(ghl).includes(`/contacts/${other}`), "not deleted after a restart");
    assert.ok(ghl.contacts.has(other!));
  });

  it("a contact that was in the pre-run snapshot is never adopted from a create intent", async () => {
    const { ghl, existing } = sandbox();
    const theirs = ghl.seedContact("ghl-sandbox+pre-new@example.com", []);
    const manifest = createMemoryManifest([
      start("pre", 2),
      { t: "snapshot", phase: "pre", total: 6, ids: [...existing.map((c) => c.id), theirs.id].sort() },
      { t: "intent", kind: "contact", email: theirs.email },
    ]);
    const rec = await reconcileSandboxRun({ config, fetch: ghl.fetch, manifest, sleep: noSleep, settleAttempts: 2 });
    assert.equal(rec.state, "failed");
    assert.deepEqual(deletes(ghl), []);
    assert.ok(rec.lines.some((l) => /unresolved/.test(l)), rec.lines.join("\n"));
  });

  it("without a pre-run snapshot, a contact found from an intent stays unresolved", async () => {
    const { ghl } = sandbox();
    const found = ghl.seedContact("ghl-sandbox+nopre-new@example.com", []);
    const manifest = createMemoryManifest([start("nopre", 2), { t: "intent", kind: "contact", email: found.email }]);
    const rec = await reconcileSandboxRun({ config, fetch: ghl.fetch, manifest, sleep: noSleep, settleAttempts: 2 });
    assert.equal(rec.state, "failed");
    assert.deepEqual(deletes(ghl), []);
  });

  it("control: a lost create of the run's own contact is still recovered and removed", async () => {
    const { ghl, existing } = sandbox();
    const manifest = createMemoryManifest();
    manifest.failOn = (e) => e.t === "created" && e.kind === "contact";
    await runSandboxScenarios({ config, fetch: ghl.fetch, runId: "own", manifest, ...quiet, cleanup: false });
    assert.equal(ghl.contacts.size, 6);
    const rec = await reconcileSandboxRun({ config, fetch: ghl.fetch, manifest, sleep: noSleep });
    assert.equal(rec.state, "verified", rec.lines.join("\n"));
    assert.deepEqual([...ghl.contacts.keys()].sort(), existing.map((c) => c.id).sort());
  });
});

describe("R2-02 and R2-03: journals written before this version get read-only checks only", () => {
  it("an older journal's recovered opportunity is not trusted, and nothing is deleted", async () => {
    const { ghl } = sandbox();
    const c = ghl.seedContact("ghl-sandbox+old-new@example.com", []);
    ghl.opportunities.push({ id: "op_foreign", contactId: c.id, pipelineId: "pipe_sandbox", stageId: "stage_sandbox", status: "open", name: "someone else's" });
    const manifest = createMemoryManifest([
      start("old"),
      { t: "created", kind: "contact", id: c.id, email: c.email },
      { t: "created", kind: "opportunity", id: "op_foreign", contactId: c.id, recovered: true },
    ]);
    const rec = await reconcileSandboxRun({ config, fetch: ghl.fetch, manifest, sleep: noSleep, settleAttempts: 2 });
    assert.equal(rec.state, "failed");
    assert.deepEqual(deletes(ghl), []);
    assert.ok(ghl.opportunities.some((o) => o.id === "op_foreign"));
    assert.ok(rec.lines.some((l) => l.includes("op_foreign") && /not proven/.test(l)), rec.lines.join("\n"));
  });

  it("an older journal whose DELETE threw (only `stopped` recorded) never gets a second DELETE", async () => {
    const { ghl } = sandbox();
    const c = ghl.seedContact("ghl-sandbox+threw-new@example.com", []);
    const manifest = createMemoryManifest([
      start("threw"),
      { t: "created", kind: "contact", id: c.id, email: c.email },
      { t: "stopped", reason: "cleanup: The operation was aborted." },
    ]);
    const rec = await reconcileSandboxRun({ config, fetch: ghl.fetch, manifest, sleep: noSleep, settleAttempts: 2 });
    assert.equal(rec.state, "failed");
    assert.deepEqual(deletes(ghl), []);
    assert.ok(rec.lines.some((l) => /older journal|by hand|GoHighLevel/.test(l)), rec.lines.join("\n"));
  });

  it("an older journal whose records are already gone is verified read-only", async () => {
    const { ghl, existing } = sandbox();
    const manifest = createMemoryManifest([
      start("gone"),
      { t: "snapshot", phase: "pre", total: 5, ids: existing.map((c) => c.id).sort() },
      { t: "created", kind: "contact", id: "ct_gone", email: "ghl-sandbox+gone-new@example.com" },
      { t: "created", kind: "opportunity", id: "op_gone", contactId: "ct_gone" },
    ]);
    const rec = await reconcileSandboxRun({ config, fetch: ghl.fetch, manifest, sleep: noSleep });
    assert.equal(rec.state, "verified", rec.lines.join("\n"));
    assert.deepEqual(deletes(ghl), []);
  });

  it("new journals carry their version, so these rules apply only to older ones", async () => {
    const { ghl } = sandbox();
    const manifest = createMemoryManifest();
    await runSandboxScenarios({ config, fetch: ghl.fetch, runId: "versioned", manifest, ...quiet });
    assert.equal((manifest.log[0] as { journalVersion?: number }).journalVersion, 2);
    assert.equal(deletes(ghl).length, 2, "a current-version run still cleans up normally");
  });
});

describe("R2-04: crash-safe journal persistence", () => {
  const withDir = async (fn: (dir: string) => Promise<void>) => {
    const dir = mkdtempSync(path.join(tmpdir(), "ghl-journal-"));
    try {
      await fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const line = (e: ManifestEntry) => `${JSON.stringify(e)}\n`;

  it("a torn final line is preserved in a backup and cut back to the last whole record before appending", async () => {
    await withDir(async (dir) => {
      const file = path.join(dir, "torn.jsonl");
      const good = line(start("torn", 2)) + line({ t: "created", kind: "contact", id: "ct_1", email: "ghl-sandbox+torn-new@example.com" });
      const torn = '{"t":"delete_intent","kind":"cont';
      writeFileSync(file, good + torn);
      const m = await openFileManifest(dir, "torn", { create: false });
      await m.append({ t: "delete_intent", kind: "contact", id: "ct_1" });
      const text = readFileSync(file, "utf8");
      assert.equal(text, good + line({ t: "delete_intent", kind: "contact", id: "ct_1" }));
      assert.equal(parseManifest(text).length, 3, "every line parses");
      const backups = readdirSync(dir).filter((f) => f !== "torn.jsonl");
      assert.equal(backups.length, 1);
      assert.equal(readFileSync(path.join(dir, backups[0]), "utf8"), good + torn, "the damaged original is kept");
      assert.ok(m.repaired, "the repair is reported");
    });
  });

  it("a journal damaged before its last line is refused and left untouched", async () => {
    await withDir(async (dir) => {
      const file = path.join(dir, "bad.jsonl");
      const text = line(start("bad", 2)) + "{not json\n" + line({ t: "stopped", reason: "x" });
      writeFileSync(file, text);
      await assert.rejects(openFileManifest(dir, "bad", { create: false }), /unreadable/);
      assert.equal(readFileSync(file, "utf8"), text);
      assert.deepEqual(readdirSync(dir), ["bad.jsonl"]);
    });
  });

  it("a complete journal is opened without changes or backups", async () => {
    await withDir(async (dir) => {
      const file = path.join(dir, "ok.jsonl");
      const text = line(start("ok", 2));
      writeFileSync(file, text);
      const m = await openFileManifest(dir, "ok", { create: false });
      assert.equal(m.repaired, null);
      assert.equal(readFileSync(file, "utf8"), text);
      assert.deepEqual(readdirSync(dir), ["ok.jsonl"]);
    });
  });

  it("end to end: reconcile on a torn journal repairs it, finishes, and leaves a fully parseable record", async () => {
    await withDir(async (dir) => {
      const { ghl, existing } = sandbox();
      const c = ghl.seedContact("ghl-sandbox+e2e-new@example.com", []);
      const file = path.join(dir, "e2e.jsonl");
      writeFileSync(
        file,
        line(start("e2e", 2)) +
          line({ t: "snapshot", phase: "pre", total: 5, ids: existing.map((x) => x.id).sort() }) +
          line({ t: "intent", kind: "contact", email: c.email }) +
          line({ t: "created", kind: "contact", id: c.id, email: c.email }) +
          '{"t":"sto'
      );
      const m = await openFileManifest(dir, "e2e", { create: false });
      const rec = await reconcileSandboxRun({ config, fetch: ghl.fetch, manifest: m, sleep: noSleep });
      assert.equal(rec.state, "verified", rec.lines.join("\n"));
      assert.doesNotThrow(() => parseManifest(readFileSync(file, "utf8").replace(/\n$/, "\n{")));
      assert.ok(existsSync(file));
    });
  });
});

describe("R2-05: unreadable or malformed searches fail closed", () => {
  const replaceSearch = (ghl: ReturnType<typeof createFakeGhl>, match: (u: URL) => boolean, body: unknown): FetchLike => async (url, init) => {
    const u = new URL(url);
    if ((init?.method ?? "GET") === "GET" && u.pathname === "/opportunities/search" && ghl.count("POST", "/opportunities/") && match(u)) return Response.json(body);
    return ghl.fetch(url, init);
  };
  const s8 = (run: Awaited<ReturnType<typeof runSandboxScenarios>>) => run.results.filter((r) => r.scenario.startsWith("S8"));
  const otherPipeline = (u: URL) => u.searchParams.get("pipeline_id") === "pipe_elsewhere";

  for (const [name, body] of [
    ["has no opportunities list", {}],
    ["lists a record without an id", { opportunities: [{ name: "no id" }] }],
    ["reports more records than it returned", { opportunities: [], meta: { total: 3 } }],
  ] as const) {
    it(`an other-pipeline search that ${name} is never a passing exclusion`, async () => {
      const { ghl } = sandbox();
      const run = await runSandboxScenarios({ config, fetch: replaceSearch(ghl, otherPipeline, body), runId: "s8bad", ...quiet, cleanup: false });
      assert.ok(!s8(run).some((r) => r.check === "the run's opportunity is excluded from another pipeline's results" && r.pass), JSON.stringify(s8(run)));
      assert.ok(s8(run).some((r) => !r.pass), "the run records the failure");
    });
  }

  it("a cleanup search listing a record without an id stops cleanup with nothing deleted", async () => {
    const { ghl } = sandbox();
    const fetch = replaceSearch(ghl, (u) => u.searchParams.get("status") === "all", { opportunities: [{ name: "no id" }] });
    const run = await runSandboxScenarios({ config, fetch, runId: "cleanbad", ...quiet });
    assert.equal(run.cleanup?.state, "failed");
    assert.deepEqual(deletes(ghl), []);
    assert.ok(run.cleanup?.lines.some((l) => /without an id/.test(l)), run.cleanup?.lines.join("\n"));
  });

  it("an unreadable notes list is a failed S1 check, not an empty one", async () => {
    const { ghl } = sandbox();
    const fetch: FetchLike = async (url, init) => ((init?.method ?? "GET") === "GET" && /\/notes$/.test(new URL(url).pathname) && ghl.count("POST", /\/notes$/) ? Response.json({}) : ghl.fetch(url, init));
    const run = await runSandboxScenarios({ config, fetch, runId: "notesbad", ...quiet });
    assert.ok(run.results.some((r) => !r.pass));
  });
});

describe("R2-06: the most restrictive rate-limit condition wins", () => {
  function clock() {
    let t = 1_000_000;
    return { now: () => t, sleep: async (ms: number) => void (t += ms) };
  }
  const URL_A = "https://services.leadconnectorhq.com/contacts/x";
  const answering = (c: ReturnType<typeof clock>, first: Response) => {
    const sent: number[] = [];
    const inner: FetchLike = async () => {
      sent.push(c.now());
      return sent.length === 1 ? first : Response.json({});
    };
    return { sent, inner };
  };

  it("a 429 with the daily quota exhausted and a longer burst interval closes the pacer", async () => {
    const c = clock();
    const { sent, inner } = answering(c, new Response("{}", { status: 429, headers: { "x-ratelimit-daily-remaining": "0", "x-ratelimit-daily-reset": "1000", "x-ratelimit-remaining": "0", "x-ratelimit-interval-milliseconds": "60000" } }));
    const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
    assert.equal((await paced.fetch(URL_A)).status, 429);
    assert.equal(sent.length, 1, "no retry");
    assert.match(paced.closed ?? "", /60000 ms/);
  });

  it("a 429 with a short daily reset still waits the burst interval", async () => {
    const c = clock();
    const { sent, inner } = answering(c, new Response("{}", { status: 429, headers: { "x-ratelimit-daily-remaining": "0", "x-ratelimit-daily-reset": "1000", "x-ratelimit-interval-milliseconds": "12000" } }));
    const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
    assert.equal((await paced.fetch(URL_A)).status, 200);
    assert.ok(sent[1] - sent[0] >= 12_000, `waited ${sent[1] - sent[0]} ms`);
  });

  it("a 429 whose Retry-After is longer than the interval waits for Retry-After", async () => {
    const c = clock();
    const { sent, inner } = answering(c, new Response("{}", { status: 429, headers: { "retry-after": "25", "x-ratelimit-interval-milliseconds": "10000" } }));
    const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
    await paced.fetch(URL_A);
    assert.ok(sent[1] - sent[0] >= 25_000);
  });

  it("a successful response with few requests left and a longer Retry-After waits the longer of the two", async () => {
    const c = clock();
    const { sent, inner } = answering(c, new Response("{}", { headers: { "x-ratelimit-remaining": "0", "x-ratelimit-interval-milliseconds": "20000", "retry-after": "25" } }));
    const paced = createPacedFetch(inner, { now: c.now, sleep: c.sleep });
    await paced.fetch(URL_A);
    await paced.fetch(URL_A);
    assert.ok(sent[1] - sent[0] >= 25_000);
  });
});

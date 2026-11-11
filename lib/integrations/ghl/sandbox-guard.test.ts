/**
 * GHL sandbox write-test safeguards (owner conditions 2026-11-10, acceptance
 * criteria B–I), against the in-memory fake only. Placeholder ids; no network.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { createFakeGhl } from "./fake-ghl.test-helper";
import { reconcileSandboxRun, runSandboxScenarios, type SandboxConfig } from "./sandbox-check";
import { compareSnapshots, createSandboxGuard, SandboxRefusal } from "./sandbox-guard";
import { createMemoryManifest, openFileManifest, parseManifest, type ManifestEntry } from "./sandbox-ledger";

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
const BASE = "https://services.leadconnectorhq.com";
const quiet = { reconcileDelayMs: 0, sleep: async () => {}, otherStageId: "stage_other" };

/** A sandbox with the five pre-existing contacts the owner described. */
function sandbox(opts: Parameters<typeof createFakeGhl>[0] = {}) {
  const ghl = createFakeGhl({ knownFieldIds: Object.values(IDS), ...opts });
  const existing = Array.from({ length: 5 }, (_, i) =>
    ghl.seedContact(`owner-contact-${i}@example.org`, [`original-${i}`], {}, { name: `Existing ${i}`, phone: `+1770555020${i}` })
  );
  const frozen = () => existing.map((c) => JSON.stringify({ ...c, tags: [...c.tags], customFields: [...c.customFields] }));
  const before = frozen();
  return { ghl, existing, untouched: () => assert.deepEqual(frozen(), before, "pre-existing contacts changed") };
}

const kinds = (log: ManifestEntry[]) => log.map((e) => ("kind" in e ? `${e.t}:${e.kind}` : e.t));

describe("sandbox run: manifest, cleanup and verification (criteria B–E)", () => {
  it("full fake run: every check passes, everything created is deleted and verified absent, pre-existing contacts untouched", async () => {
    const { ghl, existing, untouched } = sandbox();
    const manifest = createMemoryManifest();
    const run = await runSandboxScenarios({ config, fetch: ghl.fetch, runId: "full", manifest, cleanup: true, gitSha: "abc1234", ...quiet });
    assert.deepEqual(run.results.filter((r) => !r.pass), []);
    assert.equal(run.stopped, null);

    assert.deepEqual([...ghl.contacts.keys()].sort(), existing.map((c) => c.id).sort());
    assert.equal(ghl.opportunities.length, 0, "no opportunity left behind");
    untouched();

    const log = manifest.log;
    assert.deepEqual(log[0], { ...log[0], t: "start", runId: "full", locationId: "loc_sandbox", pipelineId: "pipe_sandbox", stageId: "stage_sandbox", gitSha: "abc1234", scope: "full" });
    assert.deepEqual(log[1], { t: "snapshot", phase: "pre", total: 5, ids: existing.map((c) => c.id).sort() });
    assert.deepEqual(log.at(-1), { ...log.at(-1), t: "end", ok: true });
    const created = log.filter((e) => e.t === "created");
    assert.equal(created.length, run.createdContactIds.length + run.createdOpportunityIds.length);
    for (const e of created) {
      assert.ok(log.some((x) => x.t === "verified_absent" && x.kind === e.kind && x.id === (e as { id: string }).id), `${e.kind} verified absent`);
    }
    // Every created contact has its intent line first, holding only the synthetic email.
    for (const e of created.filter((x) => x.t === "created" && x.kind === "contact")) {
      const email = (e as { email: string }).email;
      assert.match(email, /^ghl-sandbox\+full-[a-z-]+@example\.com$/);
      assert.ok(log.findIndex((x) => x.t === "intent" && x.kind === "contact" && x.email === email) < log.indexOf(e));
    }
    // Opportunities are deleted before their contacts.
    const firstContactDelete = log.findIndex((e) => e.t === "deleted" && e.kind === "contact");
    const lastOppDelete = log.map((e) => e.t === "deleted" && e.kind === "opportunity").lastIndexOf(true);
    assert.ok(lastOppDelete < firstContactDelete);
    assert.ok(log.some((e) => e.t === "snapshot" && e.phase === "post" && e.total === 5));
    // Nothing secret or personal in the journal.
    assert.ok(!JSON.stringify(log).includes("sandbox-token"));
    assert.ok(!/owner-contact|Existing/.test(JSON.stringify(log)));
  });

  it("minimal live scope (criterion H) is S1 plus the open-request count only", async () => {
    const { ghl, untouched } = sandbox();
    const run = await runSandboxScenarios({ config, fetch: ghl.fetch, runId: "min", scope: "minimal", cleanup: true, ...quiet });
    assert.deepEqual(run.results.filter((r) => !r.pass), []);
    const scenarios = new Set(run.results.map((r) => r.scenario.split(" ")[0]));
    assert.deepEqual([...scenarios].sort(), ["S1", "S8", "cleanup"]);
    assert.equal(run.createdContactIds.length, 1);
    assert.equal(run.createdOpportunityIds.length, 1);
    assert.equal(ghl.count("POST", "/contacts/upsert"), 1);
    assert.equal(ghl.count("POST", "/opportunities/"), 1);
    untouched();
  });

  it("S8 fails if GHL ignores the stage filter (capacity would over-count), and when no other stage exists", async () => {
    // An open opportunity in another stage makes an ignored filter visible in the counts.
    const ghl = createFakeGhl({ knownFieldIds: Object.values(IDS), ignoreStageFilter: true });
    const other = ghl.seedContact("other@example.org", []);
    ghl.opportunities.push({ id: "op_other", contactId: other.id, pipelineId: "pipe_sandbox", stageId: "stage_other", status: "open", name: "x" });
    const r2 = await runSandboxScenarios({ config, fetch: ghl.fetch, runId: "s8b", scope: "minimal", cleanup: true, ...quiet });
    const f = r2.results.filter((r) => !r.pass).map((r) => r.check);
    assert.ok(f.includes("another stage's count did not move (stage filter honoured)"), f.join("; "));
    assert.ok(ghl.opportunities.some((o) => o.id === "op_other"), "the unrelated opportunity is never touched");

    const single = sandbox();
    const r3 = await runSandboxScenarios({ config, fetch: single.ghl.fetch, runId: "s8c", scope: "minimal", cleanup: true, ...quiet, otherStageId: undefined });
    assert.ok(r3.results.some((r) => !r.pass && /add one to prove the filter/.test(r.detail ?? "")));
  });

  it("a run whose pre-existing contacts change is reported (snapshot comparison)", () => {
    assert.equal(compareSnapshots({ total: 2, ids: ["a", "b"] }, { total: 2, ids: ["a", "b"] }).ok, true);
    assert.match(compareSnapshots({ total: 2, ids: ["a", "b"] }, { total: 1, ids: ["a"] }).detail, /missing: b/);
    assert.match(compareSnapshots({ total: 2, ids: ["a", "b"] }, { total: 3, ids: ["a", "b", "c"] }).detail, /total 2 before, 3 after/);
  });

  it("a location too large to snapshot completely stops before any write", async () => {
    const ghl = createFakeGhl();
    for (let i = 0; i < 101; i++) ghl.seedContact(`bulk-${i}@example.org`, []);
    const run = await runSandboxScenarios({ config, fetch: ghl.fetch, runId: "big", cleanup: true, ...quiet });
    assert.ok(run.results.some((r) => !r.pass && /snapshot incomplete/.test(r.detail ?? "")));
    assert.equal(ghl.calls.filter((c) => c.method !== "GET").length, 0);
  });
});

describe("sandbox run: ownership boundary and stop rules (criteria A, G)", () => {
  it("refuses any write to a contact the run did not create, and stops every later write", async () => {
    const { ghl, existing, untouched } = sandbox();
    const manifest = createMemoryManifest();
    const guard = createSandboxGuard(config, ghl.fetch, "own", manifest);
    const target = existing[0].id;
    for (const [method, p, body] of [
      ["PUT", `/contacts/${target}`, { name: "Overwrite" }],
      ["POST", `/contacts/${target}/tags`, { tags: ["bad"] }],
      ["POST", `/contacts/${target}/notes`, { body: "bad" }],
      ["DELETE", `/contacts/${target}`, {}],
      ["POST", "/opportunities/", { contactId: target, locationId: "loc_sandbox", pipelineId: "pipe_sandbox", pipelineStageId: "stage_sandbox" }],
    ] as const) {
      await assert.rejects(guard.fetch(`${BASE}${p}`, { method, body: JSON.stringify(body) }), SandboxRefusal);
    }
    assert.equal(ghl.calls.filter((c) => c.method !== "GET").length, 0, "nothing reached the account");
    untouched();
    assert.ok(guard.halted);
    assert.equal(manifest.log.filter((e) => e.t === "stopped").length, 1);
    // After a stop, even a valid synthetic create is refused.
    await assert.rejects(
      guard.fetch(`${BASE}/contacts/upsert`, { method: "POST", body: JSON.stringify({ email: "ghl-sandbox+own-new@example.com", locationId: "loc_sandbox" }) }),
      /already stopped/
    );
  });

  it("refuses non-synthetic, non-email-only or wrong-location upserts, other origins and unknown mutations, before sending", async () => {
    const { ghl } = sandbox();
    const cases: Array<[string, RequestInit]> = [
      [`${BASE}/contacts/upsert`, { method: "POST", body: JSON.stringify({ email: "real.person@gmail.com", locationId: "loc_sandbox" }) }],
      [`${BASE}/contacts/upsert`, { method: "POST", body: JSON.stringify({ email: "ghl-sandbox+g-x@example.com", locationId: "loc_sandbox", name: "x" }) }],
      [`${BASE}/contacts/upsert`, { method: "POST", body: JSON.stringify({ email: "ghl-sandbox+g-x@example.com", locationId: "loc_production" }) }],
      [`${BASE}/contacts/upsert`, { method: "POST", body: JSON.stringify({ email: "ghl-sandbox+other-x@example.com", locationId: "loc_sandbox" }) }],
      ["https://evil.example.com/contacts/upsert", { method: "POST", body: "{}" }],
      [`${BASE}/locations/loc_sandbox`, { method: "PUT", body: "{}" }],
    ];
    for (const [url, init] of cases) {
      const guard = createSandboxGuard(config, ghl.fetch, "g", createMemoryManifest());
      await assert.rejects(guard.fetch(url, init), SandboxRefusal, url);
    }
    assert.equal(ghl.calls.filter((c) => c.method !== "GET").length, 0);
  });

  it("refuses an opportunity outside the configured pipeline or stage", async () => {
    const { ghl } = sandbox();
    const guard = createSandboxGuard(config, ghl.fetch, "opp", createMemoryManifest());
    const res = await guard.fetch(`${BASE}/contacts/upsert`, {
      method: "POST",
      body: JSON.stringify({ email: "ghl-sandbox+opp-new@example.com", locationId: "loc_sandbox" }),
    });
    const id = (await res.json()).contact.id;
    await assert.rejects(
      guard.fetch(`${BASE}/opportunities/`, {
        method: "POST",
        body: JSON.stringify({ contactId: id, locationId: "loc_sandbox", pipelineId: "pipe_sandbox", pipelineStageId: "stage_other" }),
      }),
      SandboxRefusal
    );
    assert.equal(ghl.opportunities.length, 0);
  });
});

describe("sandbox run: crash safety and reconcile (criteria B, F, I)", () => {
  it("crash between intent and created: the run stops; --reconcile finds the contact by its synthetic email and removes it", async () => {
    const { ghl, untouched } = sandbox();
    const manifest = createMemoryManifest();
    manifest.failOn = (e) => e.t === "created" && e.kind === "contact";
    const run = await runSandboxScenarios({ config, fetch: ghl.fetch, runId: "crash", scope: "minimal", manifest, ...quiet });
    assert.ok(run.results.some((r) => !r.pass));
    assert.equal(ghl.contacts.size, 6, "the create landed but was never confirmed");
    assert.ok(manifest.log.some((e) => e.t === "intent" && e.kind === "contact"));
    assert.ok(!manifest.log.some((e) => e.t === "created"));
    assert.equal(ghl.opportunities.length, 0, "no further writes after the stop");

    const rec = await reconcileSandboxRun({ config, fetch: ghl.fetch, manifest });
    assert.equal(rec.ok, true, rec.lines.join("\n"));
    assert.equal(ghl.contacts.size, 5);
    assert.ok(manifest.log.some((e) => e.t === "created" && e.kind === "contact" && e.recovered));
    assert.ok(manifest.log.some((e) => e.t === "verified_absent" && e.kind === "contact"));
    untouched();
  });

  it("unreadable create response: the run stops, and its own cleanup recovers the contact by email", async () => {
    const { ghl, untouched } = sandbox();
    const garbling = async (url: string, init?: RequestInit) => {
      const res = await ghl.fetch(url, init);
      return url.endsWith("/contacts/upsert") ? new Response("<html>gateway</html>", { status: 200 }) : res;
    };
    const manifest = createMemoryManifest();
    const run = await runSandboxScenarios({ config, fetch: garbling, runId: "garble", scope: "minimal", manifest, cleanup: true, ...quiet });
    assert.match(run.stopped ?? "", /unreadable/);
    assert.equal(ghl.contacts.size, 5);
    assert.equal(run.cleanup?.ok, true, run.cleanup?.lines.join("\n"));
    untouched();
  });

  it("a failed opportunity DELETE stops cleanup: not retried, its contact left in place; reconcile never repeats it and finishes once the owner removes it", async () => {
    const { ghl, untouched } = sandbox();
    ghl.fail({ method: "DELETE", path: /^\/opportunities\//, kind: 500 });
    const manifest = createMemoryManifest();
    const run = await runSandboxScenarios({ config, fetch: ghl.fetch, runId: "oppfail", scope: "minimal", manifest, cleanup: true, ...quiet });
    assert.equal(run.cleanup?.ok, false);
    assert.equal(ghl.count("DELETE", /^\/opportunities\//), 1, "never retried");
    assert.equal(ghl.count("DELETE", /^\/contacts\//), 0, "contact kept while its opportunity exists");
    assert.ok(manifest.log.some((e) => e.t === "delete_failed" && e.kind === "opportunity"));
    assert.equal(manifest.log.at(-1)?.t, "end");

    const blocked = await reconcileSandboxRun({ config, fetch: ghl.fetch, manifest, sleep: async () => {}, settleAttempts: 2 });
    assert.equal(blocked.state, "failed");
    assert.equal(ghl.count("DELETE", /^\/opportunities\//), 1, "still one attempt");

    ghl.opportunities.length = 0; // the owner removes it in GoHighLevel
    const rec = await reconcileSandboxRun({ config, fetch: ghl.fetch, manifest, sleep: async () => {} });
    assert.equal(rec.ok, true, rec.lines.join("\n"));
    assert.equal(ghl.count("DELETE", /^\/opportunities\//), 1);
    assert.equal(ghl.contacts.size, 5);
    untouched();
  });

  it("an opportunity whose create response was lost is found by contact search and deleted before its contact", async () => {
    const { ghl } = sandbox();
    const losing = async (url: string, init?: RequestInit) => {
      const res = await ghl.fetch(url, init);
      return url.endsWith("/opportunities/") && init?.method === "POST" ? new Response("", { status: 502 }) : res;
    };
    const manifest = createMemoryManifest();
    const run = await runSandboxScenarios({ config, fetch: losing, runId: "opplost", scope: "minimal", manifest, cleanup: true, ...quiet });
    assert.match(run.stopped ?? "", /opportunity create response was unreadable/);
    assert.equal(run.cleanup?.ok, true, run.cleanup?.lines.join("\n"));
    assert.ok(manifest.log.some((e) => e.t === "created" && e.kind === "opportunity" && e.recovered));
    assert.equal(ghl.opportunities.length, 0);
    assert.equal(ghl.contacts.size, 5);
  });

  it("cleanup never deletes a record whose read-back no longer matches the run (changed email)", async () => {
    const { ghl } = sandbox();
    const manifest = createMemoryManifest();
    const guard = createSandboxGuard(config, ghl.fetch, "chg", manifest);
    const res = await guard.fetch(`${BASE}/contacts/upsert`, {
      method: "POST",
      body: JSON.stringify({ email: "ghl-sandbox+chg-new@example.com", locationId: "loc_sandbox" }),
    });
    const id = (await res.json()).contact.id;
    ghl.contacts.get(id)!.email = "someone.else@example.org";
    const report = await guard.cleanup();
    assert.equal(report.ok, false);
    assert.equal(ghl.count("DELETE", /^\/contacts\//), 0);
    assert.ok(ghl.contacts.has(id));
  });

  it("a DELETE that answers success but leaves the record is caught by verification", async () => {
    const { ghl } = sandbox();
    const ignoringDeletes = async (url: string, init?: RequestInit) =>
      init?.method === "DELETE" && /\/contacts\//.test(url) ? Response.json({ succeded: true }) : ghl.fetch(url, init);
    const run = await runSandboxScenarios({ config, fetch: ignoringDeletes, runId: "ghost", scope: "minimal", cleanup: true, ...quiet });
    assert.equal(run.cleanup?.ok, false);
    assert.ok(run.cleanup?.lines.some((l) => /still present after DELETE/.test(l)), run.cleanup?.lines.join("\n"));
  });

  it("reconcile refuses a manifest for another location and deletes nothing", async () => {
    const { ghl } = sandbox();
    const manifest = createMemoryManifest([
      { t: "start", runId: "x", locationId: "loc_other", pipelineId: "pipe_sandbox", stageId: "s", gitSha: "-", scope: "minimal", at: "2026-11-10T00:00:00.000Z" },
      { t: "created", kind: "contact", id: [...ghl.contacts.keys()][0], email: "ghl-sandbox+x-new@example.com" },
    ]);
    const rec = await reconcileSandboxRun({ config, fetch: ghl.fetch, manifest });
    assert.equal(rec.ok, false);
    assert.equal(ghl.calls.filter((c) => c.method !== "GET").length, 0);
  });
});

describe("run manifest file", () => {
  it("is created exclusively, 0600, appended and fsynced line by line; a torn last line is ignored", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ghl-runs-"));
    try {
      const dir = path.join(root, "runs");
      const m = await openFileManifest(dir, "file-run", { create: true });
      await m.append({ t: "stopped", reason: "one" });
      await m.append({ t: "end", ok: false, at: "2026-11-10T00:00:00.000Z" });
      assert.deepEqual(kinds(await m.entries()), ["stopped", "end"]);
      if (process.platform !== "win32") {
        assert.equal((await stat(m.path)).mode & 0o777, 0o600);
        assert.equal((await stat(dir)).mode & 0o777, 0o700);
      }
      await assert.rejects(openFileManifest(dir, "file-run", { create: true }), /EEXIST/);
      await writeFile(m.path, (await readFile(m.path, "utf8")) + '{"t":"del');
      assert.equal((await (await openFileManifest(dir, "file-run", { create: false })).entries()).length, 2);
      assert.throws(() => parseManifest('{"t":"end"}\nnot json\n{"t":"end"}\n'), /line 2/);
      await assert.rejects(openFileManifest(dir, "../escape", { create: true }), /invalid sandbox run id/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

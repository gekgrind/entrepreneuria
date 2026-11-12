import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createFakeGhl } from "./fake-ghl.test-helper";
import { checkNoLiveWorkflows, checkSandboxEnv, runSandboxScenarios, type SandboxConfig } from "./sandbox-check";

/* Placeholder ids and tokens only; the fake never leaves the process. */
const ENV = {
  GHL_SANDBOX_TOKEN: "sandbox-token",
  GHL_SANDBOX_LOCATION_ID: "loc_sandbox",
  GHL_SANDBOX_CONFIRM_LOCATION: "loc_sandbox",
  GHL_SANDBOX_PIPELINE_ID: "pipe_sandbox",
  GHL_SANDBOX_PIPELINE_STAGE_ID: "stage_sandbox",
  GHL_SANDBOX_EXPECT_LOCATION_NAME: "Test Sandbox",
};
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

describe("GHL sandbox check: guards", () => {
  it("accepts a complete sandbox environment", () => {
    const r = checkSandboxEnv(ENV);
    assert.ok(r.ok);
    assert.equal(r.config.locationId, "loc_sandbox");
  });

  it("refuses missing settings, CI, an unconfirmed location and production look-alikes", () => {
    const cases: Array<[Record<string, string | undefined>, RegExp]> = [
      [{ ...ENV, GHL_SANDBOX_TOKEN: undefined }, /GHL_SANDBOX_TOKEN is required/],
      [{ ...ENV, CI: "true" }, /CI/],
      [{ ...ENV, GHL_SANDBOX_CONFIRM_LOCATION: "loc_other" }, /CONFIRM_LOCATION/],
      [{ ...ENV, GHL_API_TOKEN: "sandbox-token" }, /production GHL_API_TOKEN/],
      [{ ...ENV, GHL_LOCATION_ID: "loc_sandbox" }, /production GHL_LOCATION_ID/],
      [{ ...ENV, GHL_PIPELINE_ID: "pipe_sandbox" }, /production GHL_PIPELINE_ID/],
      [{ ...ENV, GHL_SANDBOX_EXPECT_LOCATION_NAME: undefined }, /EXPECT_LOCATION_NAME is required/],
      [{ ...ENV, GHL_SANDBOX_EXPECT_LOCATION_NAME: "Entrepreneuria" }, /contain "sandbox"/],
    ];
    for (const [env, msg] of cases) {
      const r = checkSandboxEnv(env);
      assert.ok(!r.ok && r.errors.some((e) => msg.test(e)), String(msg));
    }
  });

  it("never reads the production GHL_* credentials", () => {
    const r = checkSandboxEnv({ GHL_API_TOKEN: "t", GHL_LOCATION_ID: "l", GHL_PIPELINE_ID: "p", GHL_PIPELINE_STAGE_ID: "s" });
    assert.equal(r.ok, false);
  });

  it("refuses when workflows are active or the list can't be read, unless the owner attests", async () => {
    const ghl = createFakeGhl();
    assert.equal((await checkNoLiveWorkflows(config, ghl.fetch)).ok, true);
    ghl.workflows.push({ id: "wf_1", name: "Draft", status: "draft" });
    assert.equal((await checkNoLiveWorkflows(config, ghl.fetch)).ok, true);
    ghl.workflows.push({ id: "wf_2", name: "Live", status: "published" });
    assert.equal((await checkNoLiveWorkflows(config, ghl.fetch)).ok, false);

    const broken = async () => new Response("nope", { status: 401 });
    assert.equal((await checkNoLiveWorkflows(config, broken)).ok, false);
    assert.equal((await checkNoLiveWorkflows(config, broken, { ownerAttestsNoAutomations: true })).ok, true);
  });
});

describe("GHL sandbox check: scenarios against the fake", () => {
  it("every scenario passes, uses synthetic data only, and never sends the real consent tag", async () => {
    const ghl = createFakeGhl({ knownFieldIds: Object.values(IDS) });
    const run = await runSandboxScenarios({ config, fetch: ghl.fetch, runId: "test", reconcileDelayMs: 0, sleep: async () => {}, otherStageId: "stage_other" });
    const failed = run.results.filter((r) => !r.pass);
    assert.deepEqual(failed, []);
    for (const s of ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]) {
      assert.ok(run.results.some((r) => r.scenario.startsWith(s)), `${s} ran`);
    }
    for (const c of ghl.contacts.values()) assert.match(c.email, /^ghl-sandbox\+test-[a-z-]+@example\.com$/);
    const sentTags = ghl.calls.filter((c) => /\/tags$/.test(c.path)).flatMap((c) => c.body.tags as string[]);
    assert.ok(sentTags.length && sentTags.every((t) => t.startsWith("sandbox-test")), sentTags.join(","));
    assert.ok(!sentTags.includes("sms-consent"));
    assert.equal(run.createdContactIds.length, ghl.contacts.size);
  });

  it("detects an adapter that writes to existing contacts (the check can fail)", async () => {
    const ghl = createFakeGhl({ knownFieldIds: Object.values(IDS) });
    // Simulate a regression: the lookup never finds anyone and every upsert claims "new",
    // so an existing contact's details get rewritten.
    const lying = async (url: string, init?: RequestInit) => {
      if (url.includes("/contacts/search/duplicate")) return Response.json({ contact: null });
      const res = await ghl.fetch(url, init);
      if (!url.endsWith("/contacts/upsert")) return res;
      const body = await res.json();
      return Response.json({ ...body, new: true });
    };
    const run = await runSandboxScenarios({ config, fetch: lying, runId: "regress", reconcileDelayMs: 0, sleep: async () => {} });
    const failed = run.results.filter((r) => !r.pass).map((r) => `${r.scenario}: ${r.check}`);
    assert.ok(failed.includes("S2 existing contact untouched: sync stops as an existing contact"), failed.join("\n"));
    assert.ok(failed.includes("S2 existing contact untouched: name unchanged"), failed.join("\n"));
    assert.ok(failed.includes("S2 existing contact untouched: tags unchanged (none added)"), failed.join("\n"));
  });
});

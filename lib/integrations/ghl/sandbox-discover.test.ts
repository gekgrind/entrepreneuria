import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createFakeGhl, type FakeLocation } from "./fake-ghl.test-helper";
import { discoverSandbox, readOnlyFetch, verifySandboxIdentity } from "./sandbox-discover";

/* Placeholder ids only; the fake never leaves the process. */
const LOC: FakeLocation = {
  id: "loc_sandbox",
  name: "Entrepreneuria Websites Sandbox",
  pipelines: [
    { id: "pipe_other", name: "Other", stages: [{ id: "stage_other", name: "Lead" }] },
    { id: "pipe_sandbox", name: "Websites Sandbox Test Pipeline", stages: [{ id: "stage_sandbox", name: "New Website Inquiry" }] },
  ],
  customFields: [
    { id: "SandboxStyleField001", name: "style_interest", fieldKey: "contact.style_interest", dataType: "TEXT" },
    { id: "SandboxPkgField00002", name: "package_interest", fieldKey: "contact.package_interest", dataType: "TEXT" },
    { id: "UnrelatedField000003", name: "Budget", fieldKey: "contact.budget", dataType: "TEXT" },
  ],
};
const CONFIG = {
  token: "sandbox-token",
  locationId: "loc_sandbox",
  apiVersion: "2021-07-28",
  pipelineId: "pipe_sandbox",
  pipelineStageId: "stage_sandbox",
  customFieldIds: { style_interest: "SandboxStyleField001", package_interest: "SandboxPkgField00002" },
};
const NAME = "Entrepreneuria Websites Sandbox";

describe("GHL sandbox discovery", () => {
  it("refuses anything but a body-less GET before it reaches the network", async () => {
    let sent = 0;
    const f = readOnlyFetch(async () => (sent++, new Response("{}")));
    for (const method of ["POST", "PUT", "DELETE", "PATCH", "post"]) {
      await assert.rejects(f("https://x.test/contacts/upsert", { method }), /read-only/);
    }
    await assert.rejects(f("https://x.test/a", { method: "GET", body: "{}" }), /read-only/);
    assert.equal(sent, 0);
    await f("https://x.test/a");
    assert.equal(sent, 1);
  });

  it("finds the location, pipeline, stage and both fields, writing nothing", async () => {
    const ghl = createFakeGhl({ location: LOC });
    const d = await discoverSandbox({ token: "t", locationId: "loc_sandbox", fetch: ghl.fetch });
    assert.deepEqual(d.location, { id: "loc_sandbox", name: NAME });
    assert.ok(d.probes.every((p) => p.ok), JSON.stringify(d.probes));
    assert.equal(d.fields.style_interest[0].id, "SandboxStyleField001");
    assert.equal(d.fields.package_interest[0].id, "SandboxPkgField00002");
    assert.equal(d.pipelines.find((p) => p.name === "Websites Sandbox Test Pipeline")?.stages[0].id, "stage_sandbox");
    assert.deepEqual(d.workflows, { total: 0, active: 0 });
    assert.ok(ghl.calls.every((c) => c.method === "GET"));
    assert.equal(ghl.contacts.size, 0);
  });

  it("passes the identity gate only for the right sandbox", async () => {
    const ok = await verifySandboxIdentity(CONFIG, NAME, createFakeGhl({ location: LOC }).fetch);
    assert.deepEqual(ok.errors, []);

    const cases: Array<[string, Partial<FakeLocation> | null, Partial<Omit<typeof CONFIG, "customFieldIds">> & { customFieldIds?: Partial<Record<string, string>> }, string, RegExp]> = [
      ["wrong name", { name: "Entrepreneuria" }, {}, "Entrepreneuria", /does not contain "sandbox"/],
      ["name mismatch", {}, {}, "Some Other Sandbox", /expected "Some Other Sandbox"/],
      ["token for another location", null, {}, NAME, /location could not be read/],
      ["foreign pipeline", {}, { pipelineId: "pipe_prod" }, NAME, /PIPELINE_ID is not a pipeline/],
      ["stage from another pipeline", {}, { pipelineStageId: "stage_other" }, NAME, /STAGE_ID is not a stage/],
      ["field id swapped", {}, { customFieldIds: { style_interest: "SandboxPkgField00002", package_interest: "SandboxPkgField00002" } }, NAME, /style_interest is not/],
      ["field missing", {}, { customFieldIds: { style_interest: "SandboxStyleField001" } }, NAME, /has no package_interest/],
    ];
    for (const [label, loc, cfg, name, msg] of cases) {
      const ghl = createFakeGhl({ location: loc ? { ...LOC, ...loc } : { ...LOC, id: "loc_elsewhere" } });
      const r = await verifySandboxIdentity({ ...CONFIG, ...cfg }, name, ghl.fetch);
      assert.ok(!r.ok && r.errors.some((e) => msg.test(e)), `${label}: ${r.errors.join("; ")}`);
    }
  });

  it("stops when a read scope is missing or a workflow is live", async () => {
    const ghl = createFakeGhl({ location: LOC });
    const noCustomFieldScope = async (url: string, init?: RequestInit) =>
      url.includes("/customFields") ? new Response("{}", { status: 403 }) : ghl.fetch(url, init);
    const r = await verifySandboxIdentity(CONFIG, NAME, noCustomFieldScope);
    assert.ok(r.errors.some((e) => /cannot read custom fields: HTTP 403 \(token lacks locations\/customFields\.readonly/.test(e)), r.errors.join("; "));

    ghl.workflows.push({ id: "wf", name: "Live", status: "published" });
    const r2 = await verifySandboxIdentity(CONFIG, NAME, ghl.fetch);
    assert.ok(r2.errors.some((e) => /1 workflow\(s\) not in draft/.test(e)));
  });
});

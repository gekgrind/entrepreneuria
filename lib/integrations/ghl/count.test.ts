import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createGhlClient, GhlError } from "./client";

const config = {
  token: "test-token",
  locationId: "loc_test",
  pipelineId: "pipe_test",
  pipelineStageId: "stage_test",
  apiVersion: "2021-07-28",
  customFieldIds: {},
};

function clientWith(respond: (url: string) => Response | Promise<Response>) {
  const urls: string[] = [];
  const client = createGhlClient(config, {
    fetch: async (url) => {
      urls.push(url);
      return respond(url);
    },
    sleep: async () => {},
  });
  return { client, urls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("GHL countOpenOpportunities (synthetic responses only)", () => {
  it("asks only for open opportunities in the intake pipeline and location", async () => {
    const { client, urls } = clientWith(() => json({ opportunities: [{ id: "a" }, { id: "b" }], meta: { total: 2 } }));
    assert.equal(await client.countOpenOpportunities!(), 2);
    const q = new URL(urls[0]).searchParams;
    assert.equal(new URL(urls[0]).pathname, "/opportunities/search");
    assert.equal(q.get("location_id"), "loc_test");
    assert.equal(q.get("pipeline_id"), "pipe_test");
    assert.equal(q.get("status"), "open");
    assert.equal(q.get("pipeline_stage_id"), null);
  });

  it("can restrict the count to one stage", async () => {
    const { client, urls } = clientWith(() => json({ opportunities: [], meta: { total: 0 } }));
    assert.equal(await client.countOpenOpportunities!({ stageId: "stage_preview" }), 0);
    assert.equal(new URL(urls[0]).searchParams.get("pipeline_stage_id"), "stage_preview");
  });

  it("prefers GHL's total, never reports fewer than the page it saw, and falls back to the page length", async () => {
    assert.equal(await clientWith(() => json({ opportunities: [{ id: "a" }], meta: { total: 7 } })).client.countOpenOpportunities!(), 7);
    assert.equal(await clientWith(() => json({ opportunities: [{ id: "a" }, { id: "b" }], meta: { total: 1 } })).client.countOpenOpportunities!(), 2);
    assert.equal(await clientWith(() => json({ opportunities: [{ id: "a" }, { id: "b" }, { id: "c" }] })).client.countOpenOpportunities!(), 3);
    assert.equal(await clientWith(() => json({ opportunities: [{ id: "a" }], meta: { total: "5" } })).client.countOpenOpportunities!(), 1);
  });

  it("throws a GhlError when GHL errors or returns an unusable body, so capacity can fail open and alert", async () => {
    await assert.rejects(clientWith(() => json({}, 401)).client.countOpenOpportunities!(), GhlError);
    await assert.rejects(clientWith(() => json({ nope: true })).client.countOpenOpportunities!(), GhlError);
    await assert.rejects(clientWith(() => json({}, 429)).client.countOpenOpportunities!(), GhlError);
  });
});

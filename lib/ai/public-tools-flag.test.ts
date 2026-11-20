import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { publicAiToolsDisabledResponse, publicAiToolsEnabled } from "./public-tools-flag";

import { POST as businessModel } from "../../app/api/launch-pad/business-model/route";
import { POST as financialProjector } from "../../app/api/financial-projector/route";
import { POST as generate } from "../../app/api/generate/route";
import { POST as hiringAssistant } from "../../app/api/hiring-assistant/route";
import { POST as marketAnalysis } from "../../app/api/market-analysis/route";
import { POST as personaBuilder } from "../../app/api/persona-builder/route";
import { POST as pitchDeck } from "../../app/api/pitch-deck/route";

const DISABLED_MESSAGE = "This tool is temporarily unavailable.";

/* Every unauthenticated route that reaches a paid model provider. */
const ROUTES: Array<[string, (request: any) => Promise<Response>]> = [
  ["/api/generate", generate],
  ["/api/financial-projector", financialProjector],
  ["/api/market-analysis", marketAnalysis],
  ["/api/hiring-assistant", hiringAssistant],
  ["/api/persona-builder", personaBuilder],
  ["/api/pitch-deck", pitchDeck],
  ["/api/launch-pad/business-model", businessModel],
];

function postRequest(path: string) {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "section", prompt: "x", type: "revenue", businessIdea: "x", targetCustomer: "x", problem: "x" }),
  });
}

describe("publicAiToolsEnabled", () => {
  it("is off unless the flag is exactly \"true\"", () => {
    for (const value of [undefined, "", "false", "TRUE", "True", "1", "yes", " true", "true "]) {
      assert.equal(publicAiToolsEnabled({ PUBLIC_AI_TOOLS_ENABLED: value }), false, `value ${JSON.stringify(value)}`);
    }
    assert.equal(publicAiToolsEnabled({}), false);
    assert.equal(publicAiToolsEnabled({ PUBLIC_AI_TOOLS_ENABLED: "true" }), true);
  });

  it("disabled response is an uncacheable 503", async () => {
    const response = publicAiToolsDisabledResponse({});
    assert.ok(response);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { error: DISABLED_MESSAGE });
    assert.equal(publicAiToolsDisabledResponse({ PUBLIC_AI_TOOLS_ENABLED: "true" }), null);
  });
});

describe("public AI routes behind the kill switch", () => {
  const saved = {
    flag: process.env.PUBLIC_AI_TOOLS_ENABLED,
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  };
  const realFetch = globalThis.fetch;
  let providerCalls: string[] = [];

  beforeEach(() => {
    providerCalls = [];
    /* Keys present, so without the guard each route would go on to call its provider. */
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.OPENAI_API_KEY = "test-openai-key";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      providerCalls.push(String(input instanceof Request ? input.url : input));
      throw new Error("network disabled in tests");
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    for (const [key, value] of [
      ["PUBLIC_AI_TOOLS_ENABLED", saved.flag],
      ["ANTHROPIC_API_KEY", saved.anthropic],
      ["OPENAI_API_KEY", saved.openai],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  for (const [path, POST] of ROUTES) {
    it(`${path}: 503 without reading the body or calling a provider while off`, async () => {
      delete process.env.PUBLIC_AI_TOOLS_ENABLED;
      const request = postRequest(path);
      const response = await POST(request);

      assert.equal(response.status, 503);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), { error: DISABLED_MESSAGE });
      assert.equal(request.bodyUsed, false, "body must not be read");
      assert.deepEqual(providerCalls, [], "no provider request may be made");
    });

    it(`${path}: the switch is the only change — enabled requests reach the handler`, async () => {
      process.env.PUBLIC_AI_TOOLS_ENABLED = "true";
      const response = await POST(postRequest(path));
      const body = (await response.json().catch(() => ({}))) as { error?: unknown };

      assert.notEqual(body.error, DISABLED_MESSAGE);
    });
  }
});

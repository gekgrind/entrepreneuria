import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { createRateLimiter } from "../../rate-limit";

import { createAnthropicCaller, WEB_SEARCH_MAX_USES } from "./anthropic";
import {
  handlePersonaBuilderPost,
  MAX_PERSONA_BODY_BYTES,
  resetPersonaBuilderLogState,
  type PersonaBuilderLimiters,
} from "./handler";
import { buildCrossPrompt, buildPersonaPrompt, buildStrategyPrompt } from "./prompts";
import { ADDITIONAL_RESEARCH_MAX, FOUNDER_TEXT_MAX, PERSONA_LIST_MAX, PERSONA_TEXT_MAX } from "./schema";

/* Documentation-range addresses and placeholder keys only. No network. */
const URL_ = "http://localhost:3000/api/persona-builder";
const IP = "203.0.113.7";
const MARKER = "zz-submitted-marker-zz";

const founder = {
  productService: "A bookkeeping course for freelance designers",
  problemSolved: "Messy finances and tax-season panic",
  businessType: "Digital Products",
  priceRange: "$100–$299",
  customerDescription: "Freelance designers, 2–8 years in",
  customerGoal: "Feel in control of money without hiring an accountant",
  onlineChannels: "Dribbble, design Twitter, r/freelance",
  additionalResearch: "",
};

/** A persona as the page's parsePersonaText returns it: model output spread, plus defaults. */
const persona = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  archetypeTitle: "The Overwhelmed Creative",
  age: 31,
  locationType: "Urban",
  occupation: "Freelance brand designer",
  goals: ["Stop dreading taxes", "Know monthly take-home"],
  painPoints: ["Receipts everywhere"],
  motivations: ["Calm"],
  purchaseBehavior: ["Buys after a free workshop"],
  objections: ["Another course I won't finish"],
  channels: ["Instagram"],
  voiceSamples: ["I just want someone to tell me what to set aside."],
  conversionRecommendation: "Lead with a tax-set-aside calculator.",
  fitScore: 4,
  fitScoreReason: "Clear pain, budget exists.",
  ...extra,
});

/** The page's fallback when model output is not JSON. */
const fallbackPersona = (rawText: string) => ({
  name: "Persona Output",
  archetypeTitle: "Research Composite",
  age: "Unknown",
  locationType: "Unknown",
  occupation: "Unknown",
  goals: [],
  painPoints: [],
  motivations: [],
  purchaseBehavior: [],
  objections: [],
  channels: [],
  voiceSamples: [],
  conversionRecommendation: "",
  fitScore: 3,
  fitScoreReason: "Unable to parse structured fit score.",
  rawText,
});

const personaReq = (over: Record<string, unknown> = {}) => ({ mode: "persona", founderInputs: founder, personaNumber: 1, totalPersonas: 2, ...over });
const crossReq = (personas: unknown[] = [persona("Ava"), persona("Ben")]) => ({ mode: "cross", founderInputs: founder, allPersonas: personas });
const strategyReq = (personas: unknown[] = [persona("Ava"), persona("Ben")]) => ({
  mode: "strategy",
  founderInputs: founder,
  strategyPayload: { founderInputs: { ...founder, personaCount: 2 }, personas },
});

function harness(opts: { clientLimit?: number; unknownLimit?: number; budget?: number[]; fail?: boolean } = {}) {
  const calls: { prompt: string; useWebSearch: boolean }[] = [];
  const logs: string[] = [];
  const limiters: PersonaBuilderLimiters = {
    client: createRateLimiter({ limit: opts.clientLimit ?? 100, windowMs: 60_000 }),
    unknownClient: createRateLimiter({ limit: opts.unknownLimit ?? 100, windowMs: 60_000 }),
    budget: (opts.budget ?? [1_000]).map((limit) => createRateLimiter({ limit, windowMs: 60_000 })),
  };
  const post = (body: unknown, init: { headers?: Record<string, string>; raw?: string | ReadableStream<Uint8Array> } = {}) =>
    handlePersonaBuilderPost(
      new Request(URL_, {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": IP, ...init.headers },
        body: init.raw ?? JSON.stringify(body),
        duplex: "half", // Node's Request needs this for a stream body.
      } as RequestInit),
      {
        limiters,
        callAnthropic: async (prompt, useWebSearch) => {
          calls.push({ prompt, useWebSearch });
          if (opts.fail) throw new Error(`Anthropic API error (500): upstream said ${MARKER}`);
          return "MODEL TEXT";
        },
        log: (msg) => logs.push(msg),
      },
    );
  return { post, calls, logs, limiters };
}

async function expectRejected(res: Response, status: number) {
  assert.equal(res.status, status);
  const text = await res.text();
  const body = JSON.parse(text);
  assert.deepEqual(Object.keys(body), ["error"], "only a generic error is returned");
  assert.ok(!text.includes(MARKER), "submitted data is never echoed");
  assert.ok(!/issues|path|expected|received/i.test(text), "no validation details");
  assert.equal(res.headers.get("cache-control"), "no-store");
}

beforeEach(() => resetPersonaBuilderLogState());

describe("persona builder: the existing workflow still works", () => {
  it("persona mode sends the unchanged prompt with web search and returns the text", async () => {
    const h = harness();
    const res = await h.post(personaReq({ personaNumber: 2, totalPersonas: 3 }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { text: "MODEL TEXT" });
    assert.deepEqual(h.calls, [{ prompt: buildPersonaPrompt(founder, 2, 3), useWebSearch: true }]);
  });

  it("additionalResearch may be omitted and defaults to an empty string", async () => {
    const h = harness();
    const { additionalResearch: _omit, ...rest } = founder;
    const res = await h.post(personaReq({ founderInputs: rest }));
    assert.equal(res.status, 200);
    assert.equal(h.calls[0].prompt, buildPersonaPrompt(founder, 1, 2));
  });

  it("cross mode accepts personas as the page builds them, including extra model keys and the parse fallback", async () => {
    const h = harness();
    const known = persona("Ava", { voiceSamples: [{ quote: "hi", context: "forum" }] });
    const fallback = fallbackPersona("not json ".repeat(200));
    const res = await h.post(crossReq([{ ...known, extraModelKey: "dropped" }, fallback]));
    assert.equal(res.status, 200);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].useWebSearch, false);
    assert.ok(!h.calls[0].prompt.includes("extraModelKey"), "unknown persona keys never reach the prompt");
    assert.equal(h.calls[0].prompt, buildCrossPrompt(founder, [known, fallback] as never));
  });

  it("strategy mode accepts the whole form (with personaCount) and one to three personas", async () => {
    const h = harness();
    for (const n of [1, 3]) {
      const personas = Array.from({ length: n }, (_, i) => persona(`P${i}`));
      const res = await h.post(strategyReq(personas));
      assert.equal(res.status, 200, `strategy with ${n} personas`);
    }
    assert.equal(h.calls[1].prompt, buildStrategyPrompt(founder, [persona("P0"), persona("P1"), persona("P2")] as never));
  });

  it("a content type with a charset parameter is accepted", async () => {
    const h = harness();
    const res = await h.post(personaReq(), { headers: { "content-type": "application/json; charset=utf-8" } });
    assert.equal(res.status, 200);
  });
});

describe("persona builder: body size is capped before JSON parsing", () => {
  it("the cap is exactly 64 KiB", () => {
    assert.equal(MAX_PERSONA_BODY_BYTES, 65_536);
  });

  it("a declared length over 64 KiB is refused with 413 without reading or calling Anthropic", async () => {
    const h = harness();
    const res = await h.post(personaReq(), { headers: { "content-length": "65537" } });
    await expectRejected(res, 413);
    assert.equal(h.calls.length, 0);
  });

  it("an undeclared (streamed) body over 64 KiB is refused with 413", async () => {
    const h = harness();
    const big = new TextEncoder().encode(`{"mode":"persona","pad":"${"a".repeat(65_536)}"}`);
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < big.length; i += 8192) c.enqueue(big.slice(i, i + 8192));
        c.close();
      },
    });
    const res = await h.post(null, { raw: stream });
    await expectRejected(res, 413);
    assert.equal(h.calls.length, 0);
  });

  it("a malformed Content-Length is refused with 400", async () => {
    const h = harness();
    await expectRejected(await h.post(personaReq(), { headers: { "content-length": "12abc" } }), 400);
  });

  it("a legitimate maximal request fits under the cap", async () => {
    const h = harness();
    const long = (n: number) => "x".repeat(n);
    const fat = {
      ...founder,
      productService: long(FOUNDER_TEXT_MAX),
      problemSolved: long(FOUNDER_TEXT_MAX),
      additionalResearch: long(ADDITIONAL_RESEARCH_MAX),
    };
    const res = await h.post({
      mode: "strategy",
      founderInputs: fat,
      strategyPayload: { founderInputs: { ...fat, personaCount: 3 }, personas: [persona("A"), persona("B"), persona("C")] },
    });
    assert.equal(res.status, 200);
  });

  it("non-JSON content types (form posts) are refused with 415", async () => {
    const h = harness();
    await expectRejected(await h.post(null, { raw: "mode=persona", headers: { "content-type": "application/x-www-form-urlencoded" } }), 415);
    assert.equal(h.calls.length, 0);
  });

  it("invalid JSON is refused with 400", async () => {
    const h = harness();
    await expectRejected(await h.post(null, { raw: `{"mode":"persona",${MARKER}` }), 400);
  });
});

describe("persona builder: counts, ranges and shapes are validated before Anthropic", () => {
  const invalid: [string, unknown][] = [
    ["totalPersonas above 3", personaReq({ totalPersonas: 4 })],
    ["totalPersonas of a billion", personaReq({ totalPersonas: 1e9 })],
    ["totalPersonas of 0", personaReq({ totalPersonas: 0 })],
    ["fractional personaNumber", personaReq({ personaNumber: 1.5 })],
    ["personaNumber above totalPersonas", personaReq({ personaNumber: 3, totalPersonas: 2 })],
    ["persona mode missing its numbers", { mode: "persona", founderInputs: founder }],
    ["unknown mode", { ...personaReq(), mode: "other" }],
    ["unknown top-level key", personaReq({ extra: MARKER })],
    ["cross with one persona", crossReq([persona("Ava")])],
    ["cross with four personas", crossReq([persona("A"), persona("B"), persona("C"), persona("D")])],
    ["strategy with no personas", strategyReq([])],
    ["strategy with four personas", strategyReq([persona("A"), persona("B"), persona("C"), persona("D")])],
    ["strategy personaCount of 9", { ...strategyReq(), strategyPayload: { founderInputs: { ...founder, personaCount: 9 }, personas: [persona("A")] } }],
    ["founder text over its limit", personaReq({ founderInputs: { ...founder, customerGoal: MARKER + "x".repeat(FOUNDER_TEXT_MAX) } })],
    ["founder required field empty", personaReq({ founderInputs: { ...founder, productService: "" } })],
    ["founder unknown key", personaReq({ founderInputs: { ...founder, injected: MARKER } })],
    ["founder field of the wrong type", personaReq({ founderInputs: { ...founder, priceRange: { $gt: MARKER } } })],
    ["body that is an array", [personaReq()]],
    ["body that is a string", MARKER],
  ];
  for (const [name, body] of invalid) {
    it(`rejects ${name} with 400 and no Anthropic call`, async () => {
      const h = harness();
      await expectRejected(await h.post(body), 400);
      assert.equal(h.calls.length, 0);
    });
  }

  const badPersonas: [string, unknown][] = [
    ["a persona that is a string", MARKER],
    ["a persona that is null", null],
    ["a list longer than the limit", persona("A", { goals: Array.from({ length: PERSONA_LIST_MAX + 1 }, () => "g") })],
    ["a list item over the text limit", persona("A", { goals: [MARKER + "x".repeat(PERSONA_TEXT_MAX)] })],
    ["a nested list", persona("A", { painPoints: [["deep", MARKER]] })],
    ["a list item object with nested objects", persona("A", { voiceSamples: [{ quote: { nested: MARKER } }] })],
    ["a list item object with too many keys", persona("A", { channels: [Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, "v"]))] })],
    ["a name that is an object", persona("A", { name: { first: MARKER } })],
    ["a score that is a list", persona("A", { fitScore: [4, 5] })],
    ["a raw text far over its limit", fallbackPersona("x".repeat(13_000))],
  ];
  for (const [name, bad] of badPersonas) {
    it(`rejects malformed persona data: ${name}`, async () => {
      const h = harness();
      await expectRejected(await h.post(crossReq([persona("Ava"), bad])), 400);
      await expectRejected(await h.post(strategyReq([bad])), 400);
      assert.equal(h.calls.length, 0);
    });
  }

  it("a huge array is refused by the structural check, not by visiting every element", async () => {
    const h = harness();
    const raw = JSON.stringify({ mode: "cross", founderInputs: founder, allPersonas: Array.from({ length: 30_000 }, () => 0) });
    assert.ok(Buffer.byteLength(raw) < MAX_PERSONA_BODY_BYTES);
    const started = performance.now();
    await expectRejected(await h.post(null, { raw }), 400);
    assert.ok(performance.now() - started < 200, "rejected quickly");
    assert.equal(h.calls.length, 0);
  });
});

describe("persona builder: per-client rate limiting", () => {
  it("allows the limit, then answers 429 with Retry-After and no Anthropic call", async () => {
    const h = harness({ clientLimit: 3 });
    for (let i = 0; i < 3; i++) assert.equal((await h.post(personaReq())).status, 200);
    const res = await h.post(personaReq());
    await expectRejected(res, 429);
    assert.ok(Number(res.headers.get("retry-after")) > 0);
    assert.equal(h.calls.length, 3);
  });

  it("counts rejected requests too, so invalid or oversized floods are throttled", async () => {
    const h = harness({ clientLimit: 2 });
    await h.post(null, { raw: "not json" });
    await h.post(personaReq(), { headers: { "content-length": String(MAX_PERSONA_BODY_BYTES * 10) } });
    await expectRejected(await h.post(personaReq()), 429);
    assert.equal(h.calls.length, 0);
  });

  it("keys on X-Real-IP only: a spoofed X-Forwarded-For does not reset the limit", async () => {
    const h = harness({ clientLimit: 1 });
    assert.equal((await h.post(personaReq(), { headers: { "x-forwarded-for": "198.51.100.1" } })).status, 200);
    await expectRejected(await h.post(personaReq(), { headers: { "x-forwarded-for": "198.51.100.2" } }), 429);
  });

  it("separate clients have separate limits", async () => {
    const h = harness({ clientLimit: 1 });
    assert.equal((await h.post(personaReq())).status, 200);
    assert.equal((await h.post(personaReq(), { headers: { "x-real-ip": "198.51.100.9" } })).status, 200);
  });

  it("IPv6 clients in one /64 share a limit", async () => {
    const h = harness({ clientLimit: 1 });
    assert.equal((await h.post(personaReq(), { headers: { "x-real-ip": "2001:db8:1:2::a" } })).status, 200);
    await expectRejected(await h.post(personaReq(), { headers: { "x-real-ip": "2001:db8:1:2::b" } }), 429);
  });

  it("requests without a usable address share the unknown bucket, and it is logged once", async () => {
    const h = harness({ clientLimit: 100, unknownLimit: 1 });
    assert.equal((await h.post(personaReq(), { headers: { "x-real-ip": "" } })).status, 200);
    await expectRejected(await h.post(personaReq(), { headers: { "x-real-ip": "not-an-ip" } }), 429);
    assert.equal(h.logs.filter((l) => l.includes("no client address")).length, 1);
  });
});

describe("persona builder: spend budget", () => {
  it("refuses with 503 before Anthropic once any budget window is spent", async () => {
    const h = harness({ budget: [100, 2] });
    assert.equal((await h.post(personaReq())).status, 200);
    assert.equal((await h.post(crossReq())).status, 200);
    const res = await h.post(strategyReq());
    await expectRejected(res, 503);
    assert.ok(Number(res.headers.get("retry-after")) > 0);
    assert.equal(h.calls.length, 2);
  });

  it("invalid requests never consume the budget", async () => {
    const h = harness({ budget: [1] });
    for (let i = 0; i < 5; i++) await h.post(personaReq({ totalPersonas: 99 }));
    assert.equal((await h.post(personaReq())).status, 200);
    assert.equal(h.calls.length, 1);
  });
});

describe("persona builder: upstream failures", () => {
  it("answers a generic 500 without upstream text", async () => {
    const h = harness({ fail: true });
    const original = console.error;
    console.error = () => {};
    try {
      await expectRejected(await h.post(personaReq()), 500);
    } finally {
      console.error = original;
    }
  });
});

describe("persona builder: Anthropic caller", () => {
  type Captured = { url: string; init: RequestInit };
  const capture = (status = 200, payload: unknown = { content: [{ type: "text", text: "A" }, { type: "tool_use" }, { type: "text", text: "B" }] }) => {
    const seen: Captured[] = [];
    const fetch = async (url: string, init?: RequestInit) => {
      seen.push({ url, init: init ?? {} });
      return status === 200 ? Response.json(payload) : new Response("x".repeat(5_000), { status });
    };
    return { seen, fetch };
  };

  it("caps web searches per request and joins the text blocks", async () => {
    const { seen, fetch } = capture();
    const text = await createAnthropicCaller({ apiKey: "test-key", fetch })("P", true);
    assert.equal(text, "A\n\nB");
    const sent = JSON.parse(String(seen[0].init.body));
    assert.deepEqual(sent.tools, [{ type: "web_search_20250305", name: "web_search", max_uses: WEB_SEARCH_MAX_USES }]);
    assert.equal(sent.max_tokens, 2200);
  });

  it("sends no tools when web search is off", async () => {
    const { seen, fetch } = capture();
    await createAnthropicCaller({ apiKey: "test-key", fetch })("P", false);
    assert.equal(JSON.parse(String(seen[0].init.body)).tools, undefined);
  });

  it("never calls out without a key", async () => {
    const { seen, fetch } = capture();
    await assert.rejects(createAnthropicCaller({ apiKey: undefined, fetch })("P", true), /ANTHROPIC_API_KEY/);
    assert.equal(seen.length, 0);
  });

  it("truncates upstream error text in the thrown error", async () => {
    const { fetch } = capture(529);
    await assert.rejects(createAnthropicCaller({ apiKey: "test-key", fetch })("P", false), (e: Error) => e.message.length < 600);
  });
});

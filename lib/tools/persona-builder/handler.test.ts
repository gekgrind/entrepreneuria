import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { createRateLimiter } from "../../rate-limit";

import { AnthropicCallError, createAnthropicCaller, WEB_SEARCH_MAX_USES } from "./anthropic";
import {
  handlePersonaBuilderPost,
  MAX_PERSONA_BODY_BYTES,
  resetPersonaBuilderLogState,
  type PersonaBuilderLimiters,
} from "./handler";
import { buildCrossPrompt, buildPersonaPrompt, buildStrategyPrompt } from "./prompts";
import {
  ADDITIONAL_RESEARCH_MAX,
  FOUNDER_CHOICE_MAX,
  FOUNDER_MAX_BYTES,
  FOUNDER_TEXT_MAX,
  MAX_PERSONAS,
  PERSONA_LIST_MAX,
  PERSONA_LONG_TEXT_MAX,
  PERSONA_MAX_BYTES,
  PERSONA_RAW_TEXT_MAX,
  PERSONA_TEXT_MAX,
} from "./schema";

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
  strategyPayload: { personas },
});

type HarnessOptions = {
  clientLimit?: number;
  unknownLimit?: number;
  budget?: number[];
  fail?: boolean;
  /** What the model "returns" (default "MODEL TEXT"). */
  reply?: string;
  /** Replaces the stubbed caller, e.g. with the real one over a stubbed fetch. */
  callAnthropic?: (prompt: string, useWebSearch: boolean) => Promise<string>;
};

function harness(opts: HarnessOptions = {}) {
  const calls: { prompt: string; useWebSearch: boolean }[] = [];
  /** Each log line with its metadata, as it would be written. */
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
          if (opts.callAnthropic) return opts.callAnthropic(prompt, useWebSearch);
          if (opts.fail) throw new Error(`Anthropic API error (500): upstream said ${MARKER}`);
          return opts.reply ?? "MODEL TEXT";
        },
        log: (msg, meta) => logs.push(`${msg} ${JSON.stringify(meta ?? {})}`),
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

/** Every founder field at its limit in control characters, each a 6-byte JSON escape. */
function controlCharFounder() {
  const c = (n: number) => "\u0001".repeat(n);
  return {
    ...founder,
    productService: c(FOUNDER_TEXT_MAX),
    problemSolved: c(FOUNDER_TEXT_MAX),
    customerDescription: c(FOUNDER_TEXT_MAX),
    customerGoal: c(FOUNDER_TEXT_MAX),
    onlineChannels: c(FOUNDER_TEXT_MAX),
    additionalResearch: c(ADDITIONAL_RESEARCH_MAX),
  };
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

  it("strategy mode accepts one to three personas and sends founder inputs once", async () => {
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
  it("the cap is 112 KiB, derived from the founder and persona budgets", () => {
    assert.equal(MAX_PERSONA_BODY_BYTES, 114_688);
    assert.equal(MAX_PERSONA_BODY_BYTES, FOUNDER_MAX_BYTES + MAX_PERSONAS * PERSONA_MAX_BYTES + 8 * 1024);
  });

  it("a declared length over the cap is refused with 413 without reading or calling Anthropic", async () => {
    const h = harness();
    const res = await h.post(personaReq(), { headers: { "content-length": String(MAX_PERSONA_BODY_BYTES + 1) } });
    await expectRejected(res, 413);
    assert.equal(h.calls.length, 0);
  });

  it("an undeclared (streamed) body over the cap is refused with 413", async () => {
    const h = harness();
    const big = new TextEncoder().encode(`{"mode":"persona","pad":"${"a".repeat(MAX_PERSONA_BODY_BYTES)}"}`);
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
      strategyPayload: { personas: [persona("A"), persona("B"), persona("C")] },
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
    ["strategy that repeats the founder inputs", { ...strategyReq(), strategyPayload: { founderInputs: { ...founder, personaCount: 2 }, personas: [persona("A")] } }],
    ["founder inputs over their byte budget (control-character escapes)", personaReq({ founderInputs: controlCharFounder() })],
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
  it("answers a generic 500 and logs no exception text", async () => {
    const h = harness({ fail: true });
    await expectRejected(await h.post(personaReq()), 500);
    assert.deepEqual(h.logs, ['upstream call failed {"operation":"persona","category":"internal"}']);
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
    await assert.rejects(
      createAnthropicCaller({ apiKey: undefined, fetch })("P", true),
      (e: unknown) => e instanceof AnthropicCallError && e.category === "not_configured",
    );
    assert.equal(seen.length, 0);
  });

  it("an upstream error carries only its status, never the provider's body", async () => {
    const { fetch } = capture(529);
    await assert.rejects(
      createAnthropicCaller({ apiKey: "test-key", fetch })("P", false),
      (e: unknown) =>
        e instanceof AnthropicCallError &&
        e.category === "upstream_status" &&
        e.upstreamStatus === 529 &&
        !e.message.includes("xxx"),
    );
  });
});

/* ------------------------------------------------------------------ */
/* Review fixes (Codex, PR #50 at c41031b)                             */
/* ------------------------------------------------------------------ */

/**
 * Mirror of parsePersonaText in app/tools/customer-persona-builder/page.tsx:
 * how the page turns persona-mode text into the persona it sends back.
 * Kept identical on purpose; the end-to-end run uses the real page.
 */
function pageParsePersonaText(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text);
    return {
      ...parsed,
      goals: parsed.goals ?? [],
      painPoints: parsed.painPoints ?? [],
      motivations: parsed.motivations ?? [],
      purchaseBehavior: parsed.purchaseBehavior ?? [],
      objections: parsed.objections ?? [],
      channels: parsed.channels ?? [],
      voiceSamples: parsed.voiceSamples ?? [],
      fitScore: Number(parsed.fitScore ?? 3),
    };
  } catch {
    return fallbackPersona(text);
  }
}

const bytesOf = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");

/** Every founder field at its limit in 3-byte UTF-8 characters: the largest valid founder inputs. */
const multibyteFounder = (ch = "設") => ({
  productService: ch.repeat(FOUNDER_TEXT_MAX),
  problemSolved: ch.repeat(FOUNDER_TEXT_MAX),
  businessType: ch.repeat(FOUNDER_CHOICE_MAX),
  priceRange: ch.repeat(FOUNDER_CHOICE_MAX),
  customerDescription: ch.repeat(FOUNDER_TEXT_MAX),
  customerGoal: ch.repeat(FOUNDER_TEXT_MAX),
  onlineChannels: ch.repeat(FOUNDER_TEXT_MAX),
  additionalResearch: ch.repeat(ADDITIONAL_RESEARCH_MAX),
});

/** Realistic founder inputs in mixed scripts, the way someone actually fills the form. */
const realisticFounder = {
  productService: "Cours de comptabilité pour designers indépendants — 会計コース — €149, 6 modules",
  problemSolved: "Finances désordonnées, panique fiscale, 税金の不安, no idea what to set aside each month",
  businessType: "Digital Products",
  priceRange: "$100–$299",
  customerDescription: "Freelance designers in Lyon, Osaka and Austin, 2–8 years in, solo, café-based 🎨",
  customerGoal: "Savoir combien mettre de côté — 毎月の手取りを知る — without hiring an accountant",
  onlineChannels: "Dribbble, Behance, note.com, r/freelance, design Twitter",
  additionalResearch: "Interviews: « je déteste les impôts », 「領収書がどこにもない」, “I just want a number”. ".repeat(40),
};

/** Model outputs a persona step can return, from ordinary to adversarial. */
const big = (ch: string, n: number) => ch.repeat(n);
const fatRecord = Object.fromEntries(Array.from({ length: 8 }, (_, k) => [`k${k}`, big("語", PERSONA_TEXT_MAX)]));
const modelOutputs: [string, string][] = [
  ["a typical persona in mixed scripts", JSON.stringify(persona("Aiko Tanaka — 田中", { goals: ["税金を管理する", "Know take-home"], voiceSamples: ["« Je veux juste un chiffre. »"] }))],
  [
    "a JSON persona with every consumed field at its limit in 3-byte characters",
    JSON.stringify({
      name: big("名", PERSONA_TEXT_MAX),
      archetypeTitle: big("名", PERSONA_TEXT_MAX),
      age: big("名", PERSONA_TEXT_MAX),
      locationType: big("名", PERSONA_TEXT_MAX),
      occupation: big("名", PERSONA_TEXT_MAX),
      conversionRecommendation: big("名", PERSONA_LONG_TEXT_MAX),
      fitScore: big("名", PERSONA_TEXT_MAX),
      fitScoreReason: big("名", PERSONA_LONG_TEXT_MAX),
      rawText: big("名", PERSONA_RAW_TEXT_MAX),
      goals: Array.from({ length: 40 }, () => fatRecord),
      painPoints: Array.from({ length: 40 }, () => big("痛", 5_000)),
      motivations: Array.from({ length: 12 }, () => fatRecord),
      purchaseBehavior: Array.from({ length: 12 }, () => fatRecord),
      objections: Array.from({ length: 12 }, () => fatRecord),
      channels: Array.from({ length: 12 }, () => fatRecord),
      voiceSamples: Array.from({ length: 12 }, () => fatRecord),
    }),
  ],
  ["non-JSON text far over the raw limit, in 3-byte characters", big("文", 40_000)],
  ["non-JSON text of quotes and backslashes (2-byte escapes)", `"\\`.repeat(20_000)],
  ["non-JSON text of control characters (6-byte escapes)", "\u0001".repeat(20_000)],
  ["non-JSON text of emoji (surrogate pairs)", "🎨".repeat(20_000) + "x"],
  ["a JSON string literal", JSON.stringify(big("文", 20_000))],
  ["a JSON array", JSON.stringify(Array.from({ length: 5_000 }, (_, i) => i))],
  ["JSON with markdown fences (not parseable as-is)", "```json\n" + JSON.stringify(persona("Fenced")) + "\n```"],
  [
    "JSON with thousands of unknown keys and deeply nested model extras",
    JSON.stringify({
      ...persona("Extra"),
      ...Object.fromEntries(Array.from({ length: 3_000 }, (_, i) => [`extra${i}`, [i, { deep: [[i]] }]])),
      sources: Array.from({ length: 500 }, (_, i) => `https://example.com/${i}`),
      meta: JSON.parse("[".repeat(2_000) + "]".repeat(2_000)),
    }),
  ],
  [
    "a list item object with nested values and too many keys",
    JSON.stringify(persona("Nested", { channels: [{ name: "Dribbble", detail: { nested: true }, ...Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, i])) }] })),
  ],
  [
    "text that becomes a JSON object once cut to the raw limit",
    `{"name":"Cut"${" ".repeat(PERSONA_RAW_TEXT_MAX - 15)}}` + " trailing prose ".repeat(500),
  ],
];

describe("persona builder: every accepted workflow fits its cross and strategy steps (review P2)", () => {
  for (const [founderName, founderInputs] of [
    ["realistic mixed-script founder inputs", realisticFounder],
    ["founder inputs at every limit in 3-byte characters", multibyteFounder()],
  ] as const) {
    for (const [outputName, modelText] of modelOutputs) {
      it(`${founderName}; persona output: ${outputName}`, async () => {
        const h = harness({ reply: modelText });
        const personas: Record<string, unknown>[] = [];
        for (let i = 1; i <= MAX_PERSONAS; i++) {
          const body = { mode: "persona", founderInputs, personaNumber: i, totalPersonas: MAX_PERSONAS };
          assert.ok(bytesOf(body) <= MAX_PERSONA_BODY_BYTES);
          const res = await h.post(body);
          assert.equal(res.status, 200, `persona ${i}`);
          personas.push(pageParsePersonaText(((await res.json()) as { text: string }).text));
        }

        const cross = { mode: "cross", founderInputs, allPersonas: personas };
        const strategy = { mode: "strategy", founderInputs, strategyPayload: { personas } };
        assert.ok(bytesOf(strategy) <= MAX_PERSONA_BODY_BYTES, `strategy is ${bytesOf(strategy)} bytes`);
        assert.equal((await h.post(cross)).status, 200, "cross step");
        assert.equal((await h.post(strategy)).status, 200, "strategy step");
        assert.equal(h.calls.length, MAX_PERSONAS + 2);
      });
    }
  }

  it("the reviewed page shape (founder inputs sent twice) is what overflowed: it is now refused as invalid, not oversized", async () => {
    const founderInputs = multibyteFounder();
    const old = { mode: "strategy", founderInputs, strategyPayload: { founderInputs: { ...founderInputs, personaCount: 3 }, personas: [persona("A"), persona("B"), persona("C")] } };
    assert.ok(bytesOf(old) > 65_536, "the old shape exceeded the old 64 KiB cap");
    const h = harness();
    await expectRejected(await h.post({ ...old, strategyPayload: { founderInputs: founder, personas: [persona("A")] } }), 400);
    assert.equal(h.calls.length, 0);
  });

  it("founder inputs over their byte budget are refused at the first step, before anything is spent", async () => {
    const h = harness();
    await expectRejected(await h.post(personaReq({ founderInputs: controlCharFounder() })), 400);
    assert.equal(h.calls.length, 0);
  });

  it("a persona over its byte budget is refused in cross and strategy", async () => {
    const h = harness();
    const heavy = persona("Heavy", Object.fromEntries(["goals", "painPoints", "motivations"].map((k) => [k, Array.from({ length: PERSONA_LIST_MAX }, () => big("語", PERSONA_TEXT_MAX))])));
    assert.ok(bytesOf(heavy) > PERSONA_MAX_BYTES);
    await expectRejected(await h.post(crossReq([persona("Ava"), heavy])), 400);
    await expectRejected(await h.post(strategyReq([heavy])), 400);
    assert.equal(h.calls.length, 0);
  });
});

describe("persona builder: unknown model fields never break later steps (review P3)", () => {
  it("unknown arrays of any length are ignored by the structural check and stripped", async () => {
    const h = harness();
    const extra = persona("Ava", { sources: Array.from({ length: 10_000 }, (_, i) => i), [MARKER]: [MARKER] });
    const res = await h.post(crossReq([extra, persona("Ben")]));
    assert.equal(res.status, 200);
    assert.ok(!h.calls[0].prompt.includes("sources") && !h.calls[0].prompt.includes(MARKER), "unknown fields never reach the prompt");
  });

  it("unknown deeply nested fields are stripped without being traversed", async () => {
    const h = harness();
    const raw = JSON.stringify(crossReq([persona("Ava"), persona("Ben")])).replace('"name":"Ava"', `"name":"Ava","deep":${"[".repeat(20_000)}${"]".repeat(20_000)}`);
    assert.ok(Buffer.byteLength(raw) < MAX_PERSONA_BODY_BYTES);
    const res = await h.post(null, { raw });
    assert.equal(res.status, 200);
    assert.ok(!h.calls[0].prompt.includes("deep"));
  });

  it("limits on consumed fields are unchanged: an over-long consumed list or nested consumed value is still refused", async () => {
    const h = harness();
    await expectRejected(await h.post(crossReq([persona("A", { goals: Array.from({ length: PERSONA_LIST_MAX + 1 }, () => "g") }), persona("B")])), 400);
    await expectRejected(await h.post(crossReq([persona("A", { channels: [{ name: { nested: MARKER } }] }), persona("B")])), 400);
    assert.equal(h.calls.length, 0);
  });
});

describe("persona builder: provider errors never reach clients or logs (review P2)", () => {
  const SECRET = `sk-ant-${MARKER}`;
  const realCaller = (fetch: (url: string, init?: RequestInit) => Promise<Response>) =>
    createAnthropicCaller({ apiKey: "test-key", fetch });

  const cases: [string, (url: string, init?: RequestInit) => Promise<Response>, Record<string, unknown>][] = [
    [
      "an upstream 401 whose body names the key and account",
      async () =>
        new Response(JSON.stringify({ error: { message: `invalid x-api-key ${SECRET}` } }), {
          status: 401,
          headers: { "request-id": "req_011CVabc123" },
        }),
      { category: "upstream_status", upstreamStatus: 401, requestId: "req_011CVabc123" },
    ],
    [
      "an upstream 529 with a request id that is not the documented shape",
      async () => new Response(`overloaded ${SECRET}`, { status: 529, headers: { "request-id": `req_${MARKER}` } }),
      { category: "upstream_status", upstreamStatus: 529 },
    ],
    [
      "a network failure whose message carries a secret",
      async () => {
        throw new Error(`connect failed ${SECRET}`);
      },
      { category: "network" },
    ],
    [
      "a success status with a body that is not JSON",
      async () => new Response(`<html>${SECRET}</html>`, { status: 200, headers: { "request-id": "req_9" } }),
      { category: "bad_response", upstreamStatus: 200, requestId: "req_9" },
    ],
  ];

  for (const [name, fetch, expected] of cases) {
    it(`${name}: generic 500, allowlisted metadata only`, async () => {
      const printed: string[] = [];
      const original = console.error;
      console.error = (...args: unknown[]) => printed.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
      try {
        const h = harness({ callAnthropic: realCaller(fetch) });
        const res = await h.post(personaReq());
        await expectRejected(res, 500);
        assert.equal(h.logs.length, 1);
        assert.ok(h.logs[0].startsWith("upstream call failed "));
        assert.deepEqual(JSON.parse(h.logs[0].slice("upstream call failed ".length)), { operation: "persona", ...expected });
        for (const line of [...h.logs, ...printed]) assert.ok(!line.includes(MARKER), "no provider text in logs");
      } finally {
        console.error = original;
      }
    });
  }

  it("the default logger (no injected log) writes the same allowlisted metadata", async () => {
    const printed: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => printed.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    try {
      const res = await handlePersonaBuilderPost(
        new Request(URL_, { method: "POST", headers: { "content-type": "application/json", "x-real-ip": IP }, body: JSON.stringify(personaReq()) }),
        {
          limiters: { client: createRateLimiter({ limit: 9, windowMs: 60_000 }), unknownClient: createRateLimiter({ limit: 9, windowMs: 60_000 }), budget: [] },
          callAnthropic: realCaller(async () => new Response(SECRET, { status: 401 })),
        },
      );
      await expectRejected(res, 500);
      assert.equal(printed.length, 1);
      assert.ok(printed[0].includes("[persona-builder] upstream call failed") && printed[0].includes('"upstreamStatus":401'));
      assert.ok(!printed[0].includes(MARKER));
    } finally {
      console.error = original;
    }
  });
});

describe("persona builder: request-body stream failures (review P3)", () => {
  const failingStream = (afterFirstChunk: boolean) =>
    new ReadableStream<Uint8Array>({
      start(c) {
        if (afterFirstChunk) c.enqueue(new TextEncoder().encode('{"mode":"persona",'));
        c.error(new Error(`stream broke ${MARKER}`));
      },
    });

  for (const afterFirstChunk of [false, true]) {
    it(`a stream that fails ${afterFirstChunk ? "mid-body" : "immediately"} gets a safe 400 and never reaches Anthropic`, async () => {
      const unhandled: unknown[] = [];
      const onUnhandled = (reason: unknown) => unhandled.push(reason);
      process.on("unhandledRejection", onUnhandled);
      try {
        const h = harness();
        const res = await h.post(null, { raw: failingStream(afterFirstChunk) });
        await expectRejected(res, 400);
        assert.equal(h.calls.length, 0);
        assert.deepEqual(h.logs, ['request body could not be read {"category":"body_stream"}']);
        await new Promise((r) => setImmediate(r));
        assert.deepEqual(unhandled, []);
      } finally {
        process.off("unhandledRejection", onUnhandled);
      }
    });
  }
});

describe("persona builder: limits hold under concurrent requests", () => {
  it("50 simultaneous requests from one client: exactly the limit is served", async () => {
    const h = harness({ clientLimit: 10 });
    const statuses = (await Promise.all(Array.from({ length: 50 }, () => h.post(personaReq())))).map((r) => r.status);
    assert.equal(statuses.filter((s) => s === 200).length, 10);
    assert.equal(statuses.filter((s) => s === 429).length, 40);
    assert.equal(h.calls.length, 10);
  });

  it("40 simultaneous valid requests from different clients: the budget admits exactly its limit", async () => {
    const h = harness({ budget: [1_000, 7] });
    const statuses = (
      await Promise.all(Array.from({ length: 40 }, (_, i) => h.post(personaReq(), { headers: { "x-real-ip": `198.51.100.${i + 1}` } })))
    ).map((r) => r.status);
    assert.equal(statuses.filter((s) => s === 200).length, 7);
    assert.equal(statuses.filter((s) => s === 503).length, 33);
    assert.equal(h.calls.length, 7);
  });

  it("concurrent invalid and oversized requests never consume the budget", async () => {
    const h = harness({ budget: [3] });
    await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        h.post(i % 2 ? personaReq({ totalPersonas: 99 }) : personaReq(), {
          headers: { "x-real-ip": `198.51.100.${i + 1}`, ...(i % 2 ? {} : { "content-length": String(MAX_PERSONA_BODY_BYTES + 1) }) },
        }),
      ),
    );
    assert.equal(h.calls.length, 0);
    const statuses = (await Promise.all(Array.from({ length: 5 }, (_, i) => h.post(personaReq(), { headers: { "x-real-ip": `203.0.113.${i + 1}` } })))).map((r) => r.status);
    assert.deepEqual(statuses.filter((s) => s === 200).length, 3);
  });
});

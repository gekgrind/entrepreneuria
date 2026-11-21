import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { boundPersonaOutput, PERSONA_OUTPUT_MAX_BYTES, PERSONA_RAW_OUTPUT_MAX_BYTES } from "./persona-output";
import { PERSONA_LIST_FIELDS, PERSONA_LIST_MAX, PERSONA_RAW_TEXT_MAX, PERSONA_TEXT_MAX, personaSchema } from "./schema";

const bytes = (v: unknown) => Buffer.byteLength(JSON.stringify(v), "utf8");

const typical = {
  name: "Aiko Tanaka — 田中",
  archetypeTitle: "The Overwhelmed Creative",
  age: "28-35",
  locationType: "Urban",
  occupation: "Freelance brand designer",
  goals: ["税金を管理する", "Know take-home"],
  painPoints: ["Receipts everywhere"],
  motivations: ["Calm"],
  purchaseBehavior: ["Buys after a free workshop"],
  objections: ["Another course I won't finish"],
  channels: [{ platform: "Dribbble", why: "Portfolio feedback" }],
  voiceSamples: ["« Je veux juste un chiffre. »"],
  conversionRecommendation: "Lead with a tax-set-aside calculator.",
  fitScore: 4,
  fitScoreReason: "Clear pain, budget exists.",
};

describe("boundPersonaOutput", () => {
  it("keeps every consumed field of a well-formed persona unchanged", () => {
    const out = JSON.parse(boundPersonaOutput(JSON.stringify(typical, null, 2)));
    assert.deepEqual(out, typical);
  });

  it("drops unknown keys and nested values, and fills missing lists the way the page would", () => {
    const out = JSON.parse(
      boundPersonaOutput(JSON.stringify({ name: "A", sources: [1, 2], meta: { a: 1 }, channels: [{ name: "X", nested: { b: 2 } }] })),
    );
    assert.equal(out.sources, undefined);
    assert.equal(out.meta, undefined);
    assert.deepEqual(out.channels, [{ name: "X" }]);
    for (const f of PERSONA_LIST_FIELDS) assert.ok(Array.isArray(out[f]));
  });

  it("drops non-finite numbers and values of the wrong type", () => {
    const out = JSON.parse(boundPersonaOutput('{"fitScore":1e999,"age":true,"name":{"x":1},"goals":[[1],true,"ok"]}'));
    assert.equal(out.fitScore, undefined);
    assert.equal(out.age, undefined);
    assert.equal(out.name, undefined);
    assert.deepEqual(out.goals, ["ok"]);
  });

  it("cuts consumed fields to their limits and the persona to its byte budget", () => {
    const huge = {
      name: "名".repeat(5_000),
      goals: Array.from({ length: 50 }, () => "目".repeat(5_000)),
      painPoints: Array.from({ length: 50 }, () => Object.fromEntries(Array.from({ length: 20 }, (_, k) => [`k${k}`, "痛".repeat(2_000)]))),
    };
    const out = JSON.parse(boundPersonaOutput(JSON.stringify(huge)));
    assert.ok(bytes(out) <= PERSONA_OUTPUT_MAX_BYTES);
    assert.ok(out.name.length <= PERSONA_TEXT_MAX);
    assert.ok(out.goals.length <= PERSONA_LIST_MAX);
    assert.ok(personaSchema.safeParse(out).success);
  });

  it("returns short non-JSON text unchanged, so the page shows it as before", () => {
    assert.equal(boundPersonaOutput("Here is your persona: Aiko."), "Here is your persona: Aiko.");
  });

  it("cuts long non-JSON text to the raw limits without splitting a surrogate pair", () => {
    for (const text of ["文".repeat(40_000), "🎨".repeat(20_000) + "x", '"\\'.repeat(20_000), "\u0001".repeat(20_000)]) {
      const out = boundPersonaOutput(text);
      assert.ok(out.length <= PERSONA_RAW_TEXT_MAX);
      assert.ok(bytes(out) <= PERSONA_RAW_OUTPUT_MAX_BYTES);
      assert.ok(text.startsWith(out));
      const last = out.charCodeAt(out.length - 1);
      assert.ok(!(last >= 0xd800 && last <= 0xdbff), "no dangling high surrogate");
    }
  });

  it("carries non-object JSON as raw text instead of letting the page spread it", () => {
    const out = JSON.parse(boundPersonaOutput(JSON.stringify("just a string")));
    assert.equal(out.rawText, '"just a string"');
  });

  it("bounds text that only becomes a JSON object after being cut", () => {
    const text = `{"name":"Cut","extra":1${" ".repeat(PERSONA_RAW_TEXT_MAX - 25)}}` + " trailing prose".repeat(100);
    const out = JSON.parse(boundPersonaOutput(text));
    assert.equal(out.name, "Cut");
    assert.equal(out.extra, undefined);
  });
});

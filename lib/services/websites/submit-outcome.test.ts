import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifySubmitFailure, classifySubmitResponse, requestEmailHref } from "./submit-outcome";

it("distinguishes the client deadline from a network failure", () => {
  assert.deepEqual(classifySubmitFailure(true), { kind: "timeout" });
  assert.deepEqual(classifySubmitFailure(false), { kind: "failed" });
});

describe("classifySubmitResponse", () => {
  it("ok only on 2xx with ok: true", () => {
    assert.deepEqual(classifySubmitResponse(200, { ok: true }), { kind: "ok" });
    assert.deepEqual(classifySubmitResponse(200, {}), { kind: "failed" });
    assert.deepEqual(classifySubmitResponse(500, { ok: true }), { kind: "failed" });
  });

  it("field errors", () => {
    assert.deepEqual(classifySubmitResponse(400, { error: "invalid", fieldErrors: { email: ["x"] } }), { kind: "field_errors" });
  });

  it("capacity (paused or full) is its own state, not a retry", () => {
    assert.deepEqual(classifySubmitResponse(503, { ok: false, error: "capacity" }), { kind: "capacity" });
    assert.deepEqual(classifySubmitResponse(503, { ok: false, error: "unavailable" }), { kind: "failed" });
  });

  it("verification failure", () => {
    assert.deepEqual(classifySubmitResponse(400, { ok: false, error: "verification_failed" }), { kind: "verification" });
  });

  it("rate limit rounds minutes up, with a safe default", () => {
    assert.deepEqual(classifySubmitResponse(429, { retryAfterSeconds: 61 }), { kind: "rate_limited", minutes: 2 });
    assert.deepEqual(classifySubmitResponse(429, { retryAfterSeconds: 5 }), { kind: "rate_limited", minutes: 1 });
    assert.deepEqual(classifySubmitResponse(429, {}), { kind: "rate_limited", minutes: 10 });
  });

  it("delivery failure and unknown bodies are generic", () => {
    assert.deepEqual(classifySubmitResponse(502, { error: "delivery_failed" }), { kind: "failed" });
    assert.deepEqual(classifySubmitResponse(403, { error: "forbidden" }), { kind: "failed" });
  });
});

describe("requestEmailHref", () => {
  const decode = (href: string) => {
    const u = new URL(href);
    return { to: u.pathname, subject: u.searchParams.get("subject"), body: u.searchParams.get("body") ?? "" };
  };

  it("carries filled answers in order and skips blanks", () => {
    const r = decode(
      requestEmailHref("hello@example.com", [
        ["Your name", "Jo Doe"],
        ["Business name", "Doe & Sons"],
        ["Existing website", ""],
        ["Message", "Line one\nline two"],
      ])
    );
    assert.equal(r.to, "hello@example.com");
    assert.equal(r.subject, "Free website preview request");
    assert.match(r.body, /Your name: Jo Doe\nBusiness name: Doe & Sons\nMessage: Line one line two$/);
    assert.doesNotMatch(r.body, /Existing website/);
  });

  it("caps the body length", () => {
    const r = decode(requestEmailHref("a@b.co", [["Message", "x".repeat(5000)]]));
    assert.ok(r.body.length <= 1500);
  });
});

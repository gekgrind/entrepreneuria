import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isAllowedOrigin, isJsonContentType } from "./leads-guards";

const post = (headers: Record<string, string> = {}) => new Request("https://entrepreneuria.io/x", { method: "POST", body: "x", headers });

describe("leads-only request guards", () => {
  const ORIGIN = "https://entrepreneuria.io";

  it("accepts only the exact origin; a missing header fails closed", () => {
    assert.equal(isAllowedOrigin(post({ origin: ORIGIN }), ORIGIN), true);
    assert.equal(isAllowedOrigin(post({ origin: "https://evil.example" }), ORIGIN), false);
    assert.equal(isAllowedOrigin(post({ origin: "https://entrepreneuria.io.evil.example" }), ORIGIN), false);
    assert.equal(isAllowedOrigin(post({ origin: "http://entrepreneuria.io" }), ORIGIN), false);
    assert.equal(isAllowedOrigin(post(), ORIGIN), false);
  });

  it("requires application/json", () => {
    assert.equal(isJsonContentType(post({ "content-type": "application/json" })), true);
    assert.equal(isJsonContentType(post({ "content-type": "application/json; charset=utf-8" })), true);
    assert.equal(isJsonContentType(post({ "content-type": "text/plain" })), false);
    assert.equal(isJsonContentType(post({ "content-type": "application/jsonp" })), false);
    assert.equal(isJsonContentType(new Request("https://entrepreneuria.io/x", { method: "POST" })), false);
  });
});

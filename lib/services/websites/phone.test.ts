import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EMPTY_FORM, ruleFor } from "./form-rules";
import { inquiryFieldsSchema } from "./inquiry-schema";
import { normalizePhone } from "./phone";

const base = { name: "Dana Test", email: "dana@example.com", business: "Test Co", business_type: "Plumbing" };

describe("normalizePhone", () => {
  it("normalizes North American national formats to +1 E.164", () => {
    for (const v of ["404-555-0123", "(404) 555-0123", "404.555.0123", "4045550123", "1 404 555 0123", "1-404-555-0123"]) {
      assert.deepEqual(normalizePhone(v), { ok: true, e164: "+14045550123" }, v);
    }
  });

  it("keeps international numbers with an explicit country code", () => {
    assert.deepEqual(normalizePhone("+44 20 7946 0958"), { ok: true, e164: "+442079460958" });
    assert.deepEqual(normalizePhone("0044 20 7946 0958"), { ok: true, e164: "+442079460958" });
    assert.deepEqual(normalizePhone("+61 4 1234 5678"), { ok: true, e164: "+61412345678" });
    assert.deepEqual(normalizePhone("+1 (404) 555-0123"), { ok: true, e164: "+14045550123" });
  });

  it("does not assume a national number without a country code is American", () => {
    for (const v of ["020 7946 0958", "0412 345 678", "07911 123456", "123-456-7890", "4041550123", "404-911-0123", "911-555-0123"]) {
      assert.deepEqual(normalizePhone(v), { ok: false, reason: "ambiguous" }, v);
    }
  });

  it("rejects invalid input", () => {
    for (const v of ["555-0100", "404-555-0123 ext 2", "404/555/0123", "4045550123#", "call me", "+", "++44 20 7946 0958", "404+5550123"]) {
      assert.equal(normalizePhone(v).ok, false, v);
    }
    assert.deepEqual(normalizePhone("+1 123 555 0123"), { ok: false, reason: "invalid_international" });
    assert.deepEqual(normalizePhone("+44 12"), { ok: false, reason: "invalid_international" });
    assert.deepEqual(normalizePhone("+0 20 7946 0958"), { ok: false, reason: "invalid_international" });
    assert.deepEqual(normalizePhone("+1234567890123456"), { ok: false, reason: "invalid_international" });
  });
});

describe("inquiry schema phone", () => {
  it("stores the normalized number, and keeps phone optional", () => {
    assert.equal(inquiryFieldsSchema.parse({ ...base, phone: "(404) 555-0123" }).phone, "+14045550123");
    assert.equal(inquiryFieldsSchema.parse({ ...base }).phone, undefined);
    assert.equal(inquiryFieldsSchema.parse({ ...base, phone: "   " }).phone, undefined);
  });

  it("rejects ambiguous numbers with a country-code hint", () => {
    const r = inquiryFieldsSchema.safeParse({ ...base, phone: "020 7946 0958" });
    assert.equal(r.success, false);
    assert.match(JSON.stringify(r.error?.issues), /country code/);
  });

  it("a phone/text contact method still requires a valid phone", () => {
    assert.equal(inquiryFieldsSchema.safeParse({ ...base, contact_method: "phone", phone: "020 7946 0958" }).success, false);
    assert.equal(inquiryFieldsSchema.safeParse({ ...base, contact_method: "phone", phone: "+44 20 7946 0958" }).success, true);
  });
});

describe("client/server phone parity", () => {
  it("the form rule and the server schema accept and reject exactly the same inputs", () => {
    const inputs = [
      "404-555-0123", "(404) 555-0123", "+1 404.555.0123", "1 404 555 0123", "+44 20 7946 0958", "0044 20 7946 0958",
      "020 7946 0958", "555-0100", "404-555-0123 ext 2", "404/555/0123", "+1 123 555 0123", "+44 12",
      "404-911-0123", "1".repeat(40), "+" + "4".repeat(31),
    ];
    for (const phone of inputs) {
      const client = ruleFor("phone", { ...EMPTY_FORM, phone }) === "";
      const server = inquiryFieldsSchema.safeParse({ ...base, phone }).success;
      assert.equal(client, server, phone);
    }
  });

  it("over-long input gets the same message on both sides", () => {
    const phone = "4".repeat(40);
    const r = inquiryFieldsSchema.safeParse({ ...base, phone });
    assert.equal(r.success, false);
    assert.ok(JSON.stringify(r.error?.issues).includes(ruleFor("phone", { ...EMPTY_FORM, phone })));
  });
});

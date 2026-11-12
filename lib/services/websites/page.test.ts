import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { BUSINESS_TYPES, matchBusinessType } from "./content";
import { WEBSITE_DEMOS, demoForStyle } from "./demos";
import { EMPTY_FORM, toInquiryFields, utmFromSearch, validateForm, type FormValues } from "./form-rules";
import { inquiryFieldsSchema } from "./inquiry-schema";
import { entryPackage, getPackage, OFFERED_PACKAGES, WEBSITE_PACKAGES } from "./packages";
import { DESIGN_STYLES } from "./styles";

const filled: FormValues = {
  ...EMPTY_FORM,
  name: "Dana Reyes",
  business: "Reyes Plumbing",
  email: "dana@example.com",
  business_type: BUSINESS_TYPES[0],
  package_interest: "starter",
  style_interest: "neighborhood-pro",
};

describe("demo registry", () => {
  it("has one fictional demo per design style, in the approved order", () => {
    assert.deepEqual(
      WEBSITE_DEMOS.map((d) => [d.id, d.style]),
      [
        ["redclay", "local-professional"],
        ["porchlight", "neighborhood-pro"],
        ["ashford", "modern-craftsman"],
      ]
    );
    assert.equal(WEBSITE_DEMOS.length, DESIGN_STYLES.length);
    for (const d of WEBSITE_DEMOS) {
      assert.equal(d.fictional, true);
      assert.equal(demoForStyle(d.style)?.id, d.id);
    }
  });

  it("every screenshot it references exists in public/", () => {
    for (const d of WEBSITE_DEMOS) {
      for (const img of [d.desktop, d.mobile]) {
        assert.ok(existsSync(path.join(process.cwd(), "public", img.src)), img.src);
      }
      assert.equal(d.desktop.alt, "", "desktop shot is decorative (the card heading names it)");
      assert.match(d.mobile.alt, /sample website on a phone$/);
    }
  });
});

describe("form rules (approved Sprint 2 copy)", () => {
  it("lists every missing required field in visual order", () => {
    assert.deepEqual(
      validateForm(EMPTY_FORM).map(([f]) => f),
      ["name", "business", "email", "business_type", "package_interest"]
    );
    assert.deepEqual(validateForm(filled), []);
  });

  it("phone is required for phone or text contact, and must have an area code", () => {
    assert.match(validateForm({ ...filled, contact_method: "phone" })[0][1], /reach you by phone/);
    assert.match(validateForm({ ...filled, phone: "555-0100" })[0][1], /area code/);
    assert.deepEqual(validateForm({ ...filled, contact_method: "phone", phone: "478-555-0100" }), []);
  });

  it("phone rule never accepts what the server schema rejects", () => {
    for (const phone of ["404-555-0123 ext 2", "404/555/0123", "4045550123#"]) {
      assert.equal(validateForm({ ...filled, phone })[0]?.[0], "phone", phone);
      assert.equal(inquiryFieldsSchema.safeParse(toInquiryFields({ ...filled, phone }, { smsEnabled: false })).success, false);
    }
    for (const phone of ["(404) 555-0123", "+1 404.555.0123"]) {
      assert.deepEqual(validateForm({ ...filled, phone }), [], phone);
      assert.equal(inquiryFieldsSchema.safeParse(toInquiryFields({ ...filled, phone }, { smsEnabled: false })).success, true);
    }
  });

  it("rejects malformed email and website", () => {
    assert.equal(validateForm({ ...filled, email: "dana@" })[0][0], "email");
    assert.equal(validateForm({ ...filled, website: "not a site" })[0][0], "website");
    assert.deepEqual(validateForm({ ...filled, website: "reyesplumbing.com" }), []);
  });
});

describe("form → server mapping", () => {
  it("produces fields the server schema accepts, preserving style and package", () => {
    const parsed = inquiryFieldsSchema.parse(toInquiryFields(filled, { smsEnabled: false }));
    assert.equal(parsed.style_interest, "neighborhood-pro");
    assert.equal(parsed.package_interest, "starter");
    assert.equal(parsed.sms_consent, false);
    assert.equal(parsed.phone, undefined);
  });

  it("hidden packages are preserved but rejected by intake (launch: one package)", () => {
    assert.deepEqual(OFFERED_PACKAGES.map((p) => p.id), ["starter"]);
    assert.deepEqual(WEBSITE_PACKAGES.map((p) => p.id), ["starter", "growth", "business"]);
    assert.equal(getPackage("growth").monthlyPriceCents, 14_900);
    for (const hidden of ["growth", "business"]) {
      assert.equal(inquiryFieldsSchema.safeParse({ ...toInquiryFields(filled, { smsEnabled: false }), package_interest: hidden }).success, false);
    }
    assert.equal(entryPackage().id, "starter");
  });

  it("'Not sure yet' package and blank style are accepted", () => {
    const parsed = inquiryFieldsSchema.parse(
      toInquiryFields({ ...filled, package_interest: "unsure", style_interest: "" }, { smsEnabled: false })
    );
    assert.equal(parsed.package_interest, "unsure");
    assert.equal(parsed.style_interest, "");
  });

  it("never sends text contact or SMS consent while SMS is not enabled", () => {
    const f = toInquiryFields({ ...filled, contact_method: "text", sms_consent: true, phone: "478-555-0100" }, { smsEnabled: false });
    assert.equal(f.contact_method, "email");
    assert.equal(f.sms_consent, false);
  });

  it("drops an unknown style value instead of sending it", () => {
    assert.equal(toInquiryFields({ ...filled, style_interest: "brutalist" }, { smsEnabled: false }).style_interest, "");
  });

  it("collects UTM parameters only when present", () => {
    assert.equal(utmFromSearch("?package=growth"), undefined);
    assert.deepEqual(utmFromSearch("?utm_source=fb&utm_campaign=fall"), {
      source: "fb",
      medium: undefined,
      campaign: "fall",
      term: undefined,
      content: undefined,
    });
  });

  it("?type= prefill only accepts an approved business type", () => {
    assert.equal(matchBusinessType("residential cleaning"), "Residential cleaning");
    assert.equal(matchBusinessType("<script>"), "");
    assert.equal(matchBusinessType(undefined), "");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createGhlClient, createRecentOpportunities, GhlError, type CrmLead, type LeadCrm } from "../../integrations/ghl/client";
import { createFakeGhl } from "../../integrations/ghl/fake-ghl.test-helper";
import { createRateLimiter } from "../../rate-limit";
import { inquiryFieldsSchema } from "./inquiry-schema";
import { buildConsentEvidence, buildCrmLead, processInquiry, type InquiryRecord, type InquiryStore, type IntakeDeps } from "./intake";

const KEY = "3f1c6f1e-6a43-4c55-9a39-3c7b6d1f0a11";
const TOKEN = "test-turnstile-token";

function body(overrides: Record<string, unknown> = {}, fields: Record<string, unknown> = {}) {
  return {
    fields: {
      name: "Dana Reyes",
      email: "Dana@Example.com",
      business: "Reyes Plumbing",
      business_type: "Plumbing",
      package_interest: "growth",
      style_interest: "modern-craftsman",
      ...fields,
    },
    idempotency_key: KEY,
    page_url: "https://entrepreneuria.io/services/websites",
    turnstile_token: TOKEN,
    ...overrides,
  };
}

function memoryStore(): InquiryStore & { rows: InquiryRecord[] } {
  const rows: InquiryRecord[] = [];
  return {
    rows,
    async findByIdempotencyKey(k) {
      return rows.find((r) => r.idempotency_key === k) ?? null;
    },
    async insert(rec) {
      const existing = rows.find((r) => r.idempotency_key === rec.idempotency_key);
      if (existing) return { record: existing, created: false };
      const record = { ...rec, id: `inq_${rows.length + 1}` };
      rows.push(record);
      return { record, created: true };
    },
    async update(id, patch) {
      const r = rows.find((x) => x.id === id)!;
      Object.assign(r, patch);
    },
  };
}

function fakeCrm(fail = false): LeadCrm & { leads: CrmLead[] } {
  const leads: CrmLead[] = [];
  return {
    leads,
    async syncLead(lead) {
      leads.push(lead);
      if (fail) throw new GhlError("down", "opportunity", 503, true, "ct_1");
      return { contactId: "ct_1", opportunityId: "op_1", opportunityCreated: true, noteCreated: true, existingContact: false, warnings: [] };
    },
  };
}

function deps(over: Partial<IntakeDeps> = {}): IntakeDeps {
  return {
    store: memoryStore(),
    crm: fakeCrm(),
    rateLimiters: {
      ip: createRateLimiter({ limit: 5, windowMs: 60_000 }),
      email: createRateLimiter({ limit: 3, windowMs: 60_000 }),
    },
    verifyTurnstile: async (t) => t === TOKEN,
    now: () => new Date("2026-11-06T15:00:00.000Z"),
    ...over,
  };
}

const ctx = { ipHash: "iphash", userAgent: "test-agent" };

describe("inquiry schema", () => {
  it("rejects unknown style and package values and unknown keys", () => {
    assert.equal(inquiryFieldsSchema.safeParse({ ...body().fields, style_interest: "brutalist" }).success, false);
    assert.equal(inquiryFieldsSchema.safeParse({ ...body().fields, package_interest: "enterprise" }).success, false);
    assert.equal(inquiryFieldsSchema.safeParse({ ...body().fields, extra: 1 }).success, false);
  });

  it("style and SMS consent are optional and default empty/false", () => {
    const { style_interest, package_interest, ...rest } = body().fields;
    const r = inquiryFieldsSchema.parse(rest);
    assert.equal(r.style_interest, "");
    assert.equal(r.package_interest, "");
    assert.equal(r.sms_consent, false);
    assert.equal(r.email, "dana@example.com");
  });

  it("SMS consent or phone/text contact requires a phone number", () => {
    assert.equal(inquiryFieldsSchema.safeParse({ ...body().fields, sms_consent: true }).success, false);
    assert.equal(inquiryFieldsSchema.safeParse({ ...body().fields, contact_method: "text" }).success, false);
    assert.equal(inquiryFieldsSchema.safeParse({ ...body().fields, contact_method: "phone", phone: "478-555-0100" }).success, true);
  });
});

describe("processInquiry", () => {
  it("stores, syncs to CRM with style_interest preserved, and confirms", async () => {
    const d = deps();
    const res = await processInquiry(body(), ctx, d);
    assert.equal(res.status, 200);
    const store = d.store as ReturnType<typeof memoryStore>;
    const crm = d.crm as ReturnType<typeof fakeCrm>;
    assert.equal(store.rows[0].status, "crm_synced");
    assert.equal(store.rows[0].fields.style_interest, "modern-craftsman");
    assert.equal(store.rows[0].consent.sms_consent, false);
    assert.equal(store.rows[0].consent.recorded_at, "2026-11-06T15:00:00.000Z");
    assert.equal(crm.leads[0].customFields.style_interest, "modern-craftsman");
    assert.ok(crm.leads[0].tags.includes("style:modern-craftsman"));
    assert.ok(crm.leads[0].tags.includes("pkg-growth"));
  });

  it("refuses texting and SMS consent while the SMS consent wording is unapproved", async () => {
    for (const fields of [
      { sms_consent: true, phone: "478-555-0100" },
      { contact_method: "text", phone: "478-555-0100" },
    ]) {
      const d = deps();
      const res = await processInquiry(body({}, fields), ctx, d);
      assert.equal(res.status, 400);
      assert.ok(res.body.ok === false && res.body.error === "invalid" && res.body.fieldErrors.contact_method);
      assert.equal((d.crm as ReturnType<typeof fakeCrm>).leads.length, 0);
    }
  });

  it("never builds an sms-consent automation tag while SMS consent is unapproved", () => {
    const lead = buildCrmLead({
      idempotency_key: KEY,
      fields: inquiryFieldsSchema.parse({ ...body().fields, sms_consent: true, phone: "478-555-0100" }),
      consent: {
        sms_consent: true,
        recorded_at: "2026-11-06T15:00:00.000Z",
        sms_disclosure_version: "v",
        privacy_notice_version: "v",
        page_url: "https://entrepreneuria.io/services/websites",
        ip_hash: null,
        user_agent: null,
      },
      pricing_version: "p",
      utm: null,
      submitted_at: "2026-11-06T15:00:00.000Z",
    });
    assert.equal(lead.customFields.sms_consent, "yes");
    assert.ok(!lead.tags.includes("sms-consent"));
  });

  it("records 'not sure yet' package interest without a package tag", async () => {
    const d = deps();
    const res = await processInquiry(body({}, { package_interest: "unsure" }), ctx, d);
    assert.equal(res.status, 200);
    const lead = (d.crm as ReturnType<typeof fakeCrm>).leads[0];
    assert.equal(lead.customFields.package_interest, "unsure");
    assert.ok(!lead.tags.some((t) => t.startsWith("pkg-")));
    assert.match(lead.note, /Package interest: not sure yet/);
  });

  it("honeypot looks successful but has no side effects", async () => {
    const d = deps();
    const res = await processInquiry(body({ hp: "bot" }), ctx, d);
    assert.equal(res.status, 200);
    assert.equal((d.store as ReturnType<typeof memoryStore>).rows.length, 0);
    assert.equal((d.crm as ReturnType<typeof fakeCrm>).leads.length, 0);
  });

  it("returns field errors for invalid input", async () => {
    const res = await processInquiry(body({}, { email: "nope" }), ctx, deps());
    assert.equal(res.status, 400);
    assert.ok(res.body.ok === false && res.body.error === "invalid" && res.body.fieldErrors.email);
  });

  it("requires a verified Turnstile token, failing closed on a missing token, a rejection or an error", async () => {
    for (const [b, verify] of [
      [body({ turnstile_token: undefined }), async () => true],
      [body(), async () => false],
      [body(), async () => Promise.reject(new Error("network"))],
    ] as const) {
      const d = deps({ verifyTurnstile: verify });
      const res = await processInquiry(b, ctx, d);
      assert.deepEqual(res, { status: 400, body: { ok: false, error: "verification_failed" } });
      assert.equal((d.crm as ReturnType<typeof fakeCrm>).leads.length, 0);
    }
    assert.equal((await processInquiry(body(), ctx, deps())).status, 200);
  });

  it("failed verifications never use up the per-email allowance", async () => {
    const d = deps({ verifyTurnstile: async (t) => t === TOKEN });
    for (let i = 0; i < 10; i++) {
      const r = await processInquiry(
        body({ turnstile_token: "forged", idempotency_key: `3f1c6f1e-6a43-4c55-9a39-3c7b6d1f0b${String(i).padStart(2, "0")}` }),
        { ...ctx, ipHash: `other-ip-${i}` },
        d
      );
      assert.equal(r.status, 400);
    }
    const real = await processInquiry(body(), ctx, d);
    assert.equal(real.status, 200);
  });

  it("requests without a known IP share one rate-limit bucket instead of having none", async () => {
    const d = deps({ rateLimiters: { ip: createRateLimiter({ limit: 2, windowMs: 60_000 }), email: createRateLimiter({ limit: 99, windowMs: 60_000 }) } });
    const statuses = [];
    for (let i = 0; i < 3; i++) {
      const r = await processInquiry(
        body({ idempotency_key: `3f1c6f1e-6a43-4c55-9a39-3c7b6d1f0c1${i}` }, { email: `lead${i}@example.com` }),
        { ipHash: null, userAgent: null },
        d
      );
      statuses.push(r.status);
    }
    assert.deepEqual(statuses, [200, 200, 429]);
    assert.equal((d.store as ReturnType<typeof memoryStore>).rows[0].consent.ip_hash, null);
  });

  it("a failed idempotency lookup falls through to the CRM instead of failing the request", async () => {
    const logs: string[] = [];
    const store = memoryStore();
    store.findByIdempotencyKey = async () => {
      throw new Error("db unavailable");
    };
    const d = deps({ store, log: (m) => logs.push(m) });
    const res = await processInquiry(body(), ctx, d);
    assert.equal(res.status, 200);
    assert.equal((d.crm as ReturnType<typeof fakeCrm>).leads.length, 1);
    assert.ok(logs.includes("store lookup failed"));

    const noStore = deps({
      store: {
        findByIdempotencyKey: async () => Promise.reject(new Error("down")),
        insert: async () => Promise.reject(new Error("down")),
        update: async () => {},
      },
    });
    assert.equal((await processInquiry(body(), ctx, noStore)).status, 200, "lookup and insert down: the CRM still gets the lead");
    assert.equal((noStore.crm as ReturnType<typeof fakeCrm>).leads.length, 1);
  });

  it("the CRM note carries every submitted contact detail, so nothing depends on contact fields", async () => {
    const d = deps();
    await processInquiry(
      body({}, { phone: "(478) 555-0100", contact_method: "phone", website: "reyesplumbing.example.com" }),
      ctx,
      d
    );
    const { note } = (d.crm as ReturnType<typeof fakeCrm>).leads[0];
    for (const line of [/Name: Dana Reyes/, /Email: dana@example.com/, /Phone: \+14785550100/, /Business: Reyes Plumbing/, /Website: reyesplumbing.example.com/]) {
      assert.match(note, line);
    }
  });

  it("consent evidence follows what the form renders once policies are approved", () => {
    const meta = { recordedAt: "2026-11-06T15:00:00.000Z", pageUrl: "https://entrepreneuria.io/services/websites", ipHash: null, userAgent: null };
    const approved = () => true;
    const text = buildConsentEvidence({ sms_consent: true, contact_method: "text" }, meta, approved);
    assert.equal(text.consent.sms_consent, true);
    assert.ok(text.consent.sms_disclosure_version && text.consent.privacy_notice_version);
    assert.deepEqual(Object.keys(text.policyVersions).sort(), ["pricing", "privacy_notice", "sms_consent"]);

    // The SMS checkbox renders only for text contact; a consent flag without it isn't consent.
    const phone = buildConsentEvidence({ sms_consent: true, contact_method: "phone" }, meta, approved);
    assert.equal(phone.consent.sms_consent, false);
    assert.equal(phone.consent.sms_disclosure_version, null);
    assert.deepEqual(Object.keys(phone.policyVersions).sort(), ["pricing", "privacy_notice"]);
    const lead = buildCrmLead({
      idempotency_key: KEY,
      fields: inquiryFieldsSchema.parse({ ...body().fields, sms_consent: true, phone: "478-555-0100", contact_method: "phone" }),
      consent: phone.consent,
      pricing_version: "p",
      utm: null,
      submitted_at: meta.recordedAt,
    });
    assert.deepEqual(lead.consentTags, []);
    assert.equal(lead.customFields.sms_consent, "no");
  });

  it("consent evidence records only the wording that was shown", async () => {
    const d = deps();
    await processInquiry(body(), ctx, d);
    const row = (d.store as ReturnType<typeof memoryStore>).rows[0];
    // Neither the privacy sentence nor the SMS disclosure is approved, so neither is rendered.
    assert.equal(row.consent.privacy_notice_version, null);
    assert.equal(row.consent.sms_disclosure_version, null);
    assert.deepEqual(Object.keys(row.policy_versions), ["pricing"]);
    const lead = (d.crm as ReturnType<typeof fakeCrm>).leads[0];
    assert.match(lead.note, /Privacy notice version: not shown/);
    assert.match(lead.note, /SMS consent: no \(disclosure not shown,/);
    assert.equal(lead.customFields.sms_consent_version, undefined);
  });

  it("page_url must be the inquiry page on our own https origin", async () => {
    const bad = [
      "https://evil.example.com/services/websites",
      "http://entrepreneuria.io/services/websites",
      "https://entrepreneuria.io.evil.example.com/services/websites",
      "https://user:pw@entrepreneuria.io/services/websites",
      "https://entrepreneuria.io/somewhere-else",
      "javascript:alert(1)",
      "not a url",
    ];
    for (const page_url of bad) {
      const res = await processInquiry(body({ page_url }), ctx, deps());
      assert.equal(res.status, 400, page_url);
      assert.ok(res.body.ok === false && res.body.error === "invalid" && res.body.fieldErrors.page_url, page_url);
    }
    const d = deps();
    await processInquiry(body({ page_url: "https://Entrepreneuria.io/services/websites/?utm_source=x#form" }), ctx, d);
    assert.equal((d.store as ReturnType<typeof memoryStore>).rows[0].consent.page_url, "https://entrepreneuria.io/services/websites");
  });

  it("page_url accepts an allowlisted non-production host only when the route allows it", async () => {
    const page_url = "https://staging.example.com/services/websites";
    assert.equal((await processInquiry(body({ page_url }), ctx, deps())).status, 400);
    assert.equal((await processInquiry(body({ page_url }), ctx, deps({ allowedPageHosts: ["staging.example.com"] }))).status, 200);
    const local = deps({ allowedPageHosts: ["localhost:3000"] });
    assert.equal((await processInquiry(body({ page_url: "http://localhost:3000/services/websites" }), ctx, local)).status, 200);
  });

  it("rate limits per email", async () => {
    const d = deps();
    const statuses = [];
    for (let i = 0; i < 4; i++) {
      const r = await processInquiry(body({ idempotency_key: `3f1c6f1e-6a43-4c55-9a39-3c7b6d1f0a1${i}` }), ctx, d);
      statuses.push(r.status);
    }
    assert.deepEqual(statuses, [200, 200, 200, 429]);
  });

  it("a duplicate submission (same idempotency key) replays without a second CRM call", async () => {
    const d = deps();
    const a = await processInquiry(body(), ctx, d);
    const b = await processInquiry(body(), ctx, d);
    assert.deepEqual(a, b);
    assert.equal((d.crm as ReturnType<typeof fakeCrm>).leads.length, 1);
    assert.equal((d.store as ReturnType<typeof memoryStore>).rows.length, 1);
  });

  it("CRM failure keeps a recoverable record and still confirms receipt", async () => {
    const d = deps({ crm: fakeCrm(true) });
    const res = await processInquiry(body(), ctx, d);
    assert.equal(res.status, 200);
    const row = (d.store as ReturnType<typeof memoryStore>).rows[0];
    assert.equal(row.status, "crm_failed");
    assert.equal(row.last_error, "opportunity:503");
  });

  it("without a store, a CRM failure is reported as retryable, never as success", async () => {
    const res = await processInquiry(body(), ctx, deps({ store: null, crm: fakeCrm(true) }));
    assert.equal(res.status, 502);
  });

  it("with neither store nor CRM configured it is unavailable", async () => {
    const res = await processInquiry(body(), ctx, deps({ store: null, crm: null }));
    assert.equal(res.status, 503);
  });
});

/* Adapter-level GHL tests (tags, field ids, retries, duplicates, concurrency)
   live in lib/integrations/ghl/client.test.ts. These cover the intake side. */
describe("intake → CRM lead mapping", () => {
  it("stores and forwards the phone in E.164", async () => {
    const d = deps();
    const res = await processInquiry(body({}, { phone: "(478) 555-0100", contact_method: "phone" }), ctx, d);
    assert.equal(res.status, 200);
    assert.equal((d.store as ReturnType<typeof memoryStore>).rows[0].fields.phone, "+14785550100");
    assert.equal((d.crm as ReturnType<typeof fakeCrm>).leads[0].phone, "+14785550100");
  });

  it("rejects an ambiguous phone before anything is stored or sent", async () => {
    const d = deps();
    const res = await processInquiry(body({}, { phone: "020 7946 0958" }), ctx, d);
    assert.equal(res.status, 400);
    assert.ok(res.body.ok === false && res.body.error === "invalid" && res.body.fieldErrors.phone);
    assert.equal((d.store as ReturnType<typeof memoryStore>).rows.length, 0);
    assert.equal((d.crm as ReturnType<typeof fakeCrm>).leads.length, 0);
  });

  it("the lead carries the submission reference and every value the note must preserve", async () => {
    const d = deps();
    await processInquiry(body({}, { package_interest: "unsure", style_interest: "not-sure" }), ctx, d);
    const lead = (d.crm as ReturnType<typeof fakeCrm>).leads[0];
    assert.equal(lead.reference, KEY);
    for (const line of [
      /Package interest: not sure yet/,
      /Style interest: not-sure/,
      /SMS consent: no \(disclosure not shown, recorded 2026-11-06T15:00:00.000Z, page https:\/\/entrepreneuria.io\/services\/websites\)/,
      /Privacy notice version: /,
      /Pricing version: /,
    ]) {
      assert.match(lead.note, line);
    }
  });

  it("logs CRM sync warnings instead of dropping them", async () => {
    const logs: Array<[string, unknown]> = [];
    const crm: LeadCrm = {
      async syncLead() {
        return {
          contactId: "ct_1",
          opportunityId: "op_1",
          opportunityCreated: true,
          noteCreated: true,
          existingContact: false,
          warnings: ["custom_field_unmapped:style_interest:critical"],
        };
      },
    };
    const d = deps({ crm, log: (m, meta) => logs.push([m, meta]) });
    const res = await processInquiry(body(), ctx, d);
    assert.equal(res.status, 200);
    assert.equal((d.store as ReturnType<typeof memoryStore>).rows[0].status, "crm_synced");
    const w = logs.find(([m]) => m === "crm sync warnings");
    assert.ok(w && JSON.stringify(w[1]).includes("style_interest"));
  });

  it("a rate-limited CRM sync is recorded as retryable with its wait time logged", async () => {
    const logs: Array<[string, any]> = [];
    const crm: LeadCrm = {
      async syncLead() {
        throw new GhlError("GHL contact rate limited", "contact", 429, true, undefined, { outcome: "rejected", retryAfterMs: 10_000 });
      },
    };
    const d = deps({ crm, log: (m, meta) => logs.push([m, meta]) });
    const res = await processInquiry(body(), ctx, d);
    assert.equal(res.status, 200);
    const row = (d.store as ReturnType<typeof memoryStore>).rows[0];
    assert.equal(row.status, "crm_failed");
    assert.equal(row.last_error, "contact:429");
    assert.equal(logs.find(([m]) => m === "crm sync failed")![1].retryAfterMs, 10_000);
  });

  it("end to end with the real adapter: a returning contact keeps its tags and fields", async () => {
    const ghl = createFakeGhl({ knownFieldIds: ["StyleField0000000001"] });
    const existing = ghl.seedContact("dana@example.com", ["customer"], { StyleField0000000001: "local-professional" });
    const crm = createGhlClient(
      {
        token: "test-token",
        locationId: "loc_test",
        pipelineId: "pipe_test",
        pipelineStageId: "stage_new",
        apiVersion: "2021-07-28",
        reconcileDelayMs: 0,
        customFieldIds: { style_interest: "StyleField0000000001" },
      },
      { fetch: ghl.fetch, sleep: async () => {}, recentOpportunities: createRecentOpportunities() }
    );
    const d = deps({ crm });
    const res = await processInquiry(body(), ctx, d);
    assert.equal(res.status, 200);
    const tags = ghl.contacts.get(existing.id)!.tags;
    assert.deepEqual([...tags].sort(), ["customer", "web-preview-unverified-match"]);
    assert.equal(ghl.contacts.get(existing.id)!.customFields.get("StyleField0000000001"), "local-professional", "not overwritten");
    assert.match(ghl.notes.get(existing.id)![0].body, /Style interest: modern-craftsman/, "the new value arrives in the note");
    assert.equal(ghl.opportunities.length, 0, "an unverified match waits for manual review");
    const row = (d.store as ReturnType<typeof memoryStore>).rows[0];
    assert.equal(row.status, "crm_synced");
    assert.equal(row.crm_opportunity_id, null);
  });
});

describe("intake → CRM retries (CRM-only, real adapter)", () => {
  const cfg = {
    token: "test-token",
    locationId: "loc_test",
    pipelineId: "pipe_test",
    pipelineStageId: "stage_new",
    apiVersion: "2021-07-28",
    timeoutMs: 25,
    reconcileDelayMs: 0,
    customFieldIds: {},
  };

  it("a retry of the same submission a minute later completes the lead without a duplicate note", async () => {
    const ghl = createFakeGhl();
    const crm = createGhlClient(cfg, { fetch: ghl.fetch, sleep: async () => {}, recentOpportunities: createRecentOpportunities() });
    ghl.fail({ method: "POST", path: /^\/opportunities\/$/, kind: 400 });
    const first = await processInquiry(body(), ctx, deps({ store: null, crm, now: () => new Date("2026-11-06T15:00:00.000Z") }));
    assert.equal(first.status, 502, "CRM-only: the visitor is told to retry");
    const retry = await processInquiry(body(), ctx, deps({ store: null, crm, now: () => new Date("2026-11-06T15:01:00.000Z") }));
    assert.equal(retry.status, 200);
    const [contactId] = [...ghl.contacts.keys()];
    assert.equal(ghl.opportunities.length, 1);
    assert.equal(ghl.notes.get(contactId)!.length, 1);
    assert.ok(ghl.contacts.get(contactId)!.tags.has("web-preview-request"));
  });

  it("a resubmission with changed answers under the same key is held for review, not applied", async () => {
    const ghl = createFakeGhl();
    const crm = createGhlClient(cfg, { fetch: ghl.fetch, sleep: async () => {}, recentOpportunities: createRecentOpportunities() });
    await processInquiry(body(), ctx, deps({ store: null, crm }));
    const changed = await processInquiry(body({}, { package_interest: "starter" }), ctx, deps({ store: null, crm }));
    assert.equal(changed.status, 200);
    const [contactId] = [...ghl.contacts.keys()];
    assert.ok(!ghl.contacts.get(contactId)!.tags.has("pkg-starter"));
    assert.equal(ghl.notes.get(contactId)!.length, 2);
    assert.match(ghl.notes.get(contactId)![1].body, /^UNVERIFIED: /);
    assert.equal(ghl.opportunities.length, 1);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createGhlClient, createRecentOpportunities, GhlError, type CrmLead, type LeadCrm } from "../../integrations/ghl/client";
import { createFakeGhl } from "../../integrations/ghl/fake-ghl.test-helper";
import { createRateLimiter } from "../../rate-limit";
import { inquiryFieldsSchema } from "./inquiry-schema";
import { buildCrmLead, processInquiry, type InquiryRecord, type InquiryStore, type IntakeDeps } from "./intake";

const KEY = "3f1c6f1e-6a43-4c55-9a39-3c7b6d1f0a11";

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
      return { contactId: "ct_1", opportunityId: "op_1", opportunityCreated: true, noteCreated: true, warnings: [] };
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
    verifyTurnstile: null,
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

  it("fails Turnstile closed when configured", async () => {
    const res = await processInquiry(body(), ctx, deps({ verifyTurnstile: async () => false }));
    assert.equal(res.status, 400);
    const ok = await processInquiry(body({ turnstile_token: "t" }), ctx, deps({ verifyTurnstile: async (t) => t === "t" }));
    assert.equal(ok.status, 200);
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
      /SMS consent: no \(disclosure .+, recorded 2026-11-06T15:00:00.000Z, page https:\/\/entrepreneuria.io\/services\/websites\)/,
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
        return { contactId: "ct_1", opportunityId: "op_1", opportunityCreated: true, noteCreated: true, warnings: ["custom_field_unmapped:style_interest:critical"] };
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

  it("end to end with the real adapter: a returning contact keeps its tags", async () => {
    const ghl = createFakeGhl({ knownFieldIds: ["StyleField0000000001"] });
    const existing = ghl.seedContact("dana@example.com", ["customer"]);
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
    const res = await processInquiry(body(), ctx, deps({ crm }));
    assert.equal(res.status, 200);
    const tags = ghl.contacts.get(existing.id)!.tags;
    assert.ok(tags.has("customer") && tags.has("web-preview-request") && tags.has("style:modern-craftsman"));
    assert.equal(ghl.contacts.get(existing.id)!.customFields.get("StyleField0000000001"), "modern-craftsman");
    assert.equal(ghl.opportunities.length, 1);
  });
});

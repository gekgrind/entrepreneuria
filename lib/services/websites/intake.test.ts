import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createGhlClient, createRecentOpportunities, GhlError, type CrmLead, type LeadCrm } from "../../integrations/ghl/client";
import { createFakeGhl } from "../../integrations/ghl/fake-ghl.test-helper";
import { createRateLimiter } from "../../rate-limit";
import { inquiryFieldsSchema } from "./inquiry-schema";
import { buildCrmLead, processInquiry, type InquiryRecord, type InquiryStore, type IntakeDeps } from "./intake";

const KEY = "3f1c6f1e-6a43-4c55-9a39-3c7b6d1f0a11";
const TOKEN = "valid-test-token";

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
    verifyTurnstile: async (t) => t === TOKEN,
    now: () => new Date("2026-11-06T15:00:00.000Z"),
    ...over,
  };
}

const ctx = { ipHash: "iphash", ipBucket: "ipbucket", userAgent: "test-agent", pageOrigin: "https://entrepreneuria.io" };

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
    assert.deepEqual(lead.newContactTags, []);
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

  it("fails Turnstile closed: a rejected, missing or erroring verification stops the submission", async () => {
    for (const [b, verify] of [
      [body(), async () => false],
      [body({ turnstile_token: undefined }), async () => true],
      [body(), async () => Promise.reject(new Error("network"))],
    ] as const) {
      const d = deps({ verifyTurnstile: verify });
      const res = await processInquiry(b, ctx, d);
      assert.equal(res.status, 400);
      assert.ok(res.body.ok === false && res.body.error === "verification_failed");
      assert.equal((d.crm as ReturnType<typeof fakeCrm>).leads.length, 0);
    }
    const ok = await processInquiry(body(), ctx, deps());
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

  it("end to end with the real adapter: a returning contact keeps its tags and fields", async () => {
    const ghl = createFakeGhl({ knownFieldIds: ["StyleField0000000001"] });
    const existing = ghl.seedContact("dana@example.com", ["customer"], { StyleField0000000001: "local-professional" }, { name: "Dana R." });
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
    assert.equal(ghl.contacts.get(existing.id)!.customFields.get("StyleField0000000001"), "local-professional", "not overwritten");
    assert.equal(ghl.contacts.get(existing.id)!.name, "Dana R.", "not overwritten");
    const [note] = ghl.notes.get(existing.id)!;
    assert.match(note.body, /Style interest: modern-craftsman/);
    assert.match(note.body, /Name: Dana Reyes/);
    assert.equal(ghl.opportunities.length, 1);
  });

  it("end to end with the real adapter: a new contact gets its details and fields", async () => {
    const ghl = createFakeGhl({ knownFieldIds: ["StyleField0000000001"] });
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
    const [contact] = [...ghl.contacts.values()];
    assert.equal(contact.name, "Dana Reyes");
    assert.equal(contact.companyName, "Reyes Plumbing");
    assert.equal(contact.customFields.get("StyleField0000000001"), "modern-craftsman");
  });
});

describe("intake hardening", () => {
  const tokenOnly = (t: string) => async (x: string) => x === t;

  it("unverified submissions never use up an email's allowance", async () => {
    const d = deps({ verifyTurnstile: tokenOnly(TOKEN) });
    // Many unverified attempts for one email, each from a different address.
    for (let i = 0; i < 10; i++) {
      const r = await processInquiry(body({ turnstile_token: "forged" }), { ...ctx, ipHash: `other-${i}`, ipBucket: `other-${i}` }, d);
      assert.equal(r.status, 400);
    }
    const real = await processInquiry(body(), ctx, d);
    assert.equal(real.status, 200);
  });

  it("verified submissions are still limited per email", async () => {
    const d = deps();
    const statuses = [];
    for (let i = 0; i < 4; i++) {
      const r = await processInquiry(
        body({ idempotency_key: `3f1c6f1e-6a43-4c55-9a39-3c7b6d1f0a2${i}` }),
        { ...ctx, ipHash: `ip-${i}`, ipBucket: `ip-${i}` },
        d
      );
      statuses.push(r.status);
    }
    assert.deepEqual(statuses, [200, 200, 200, 429]);
  });

  it("requests without a known client address share one rate-limit bucket", async () => {
    const d = deps({
      rateLimiters: {
        ip: createRateLimiter({ limit: 2, windowMs: 60_000 }),
        email: createRateLimiter({ limit: 100, windowMs: 60_000 }),
      },
    });
    const statuses = [];
    for (let i = 0; i < 3; i++) {
      const r = await processInquiry(
        body({ idempotency_key: `3f1c6f1e-6a43-4c55-9a39-3c7b6d1f0a3${i}` }, { email: `lead${i}@example.com` }),
        { ...ctx, ipHash: null, ipBucket: null },
        d
      );
      statuses.push(r.status);
    }
    assert.deepEqual(statuses, [200, 200, 429]);
  });

  it("unverified requests never use up the shared unknown-address bucket", async () => {
    const d = deps({
      rateLimiters: {
        ip: createRateLimiter({ limit: 1, windowMs: 60_000 }),
        email: createRateLimiter({ limit: 100, windowMs: 60_000 }),
      },
    });
    const unknown = { ...ctx, ipHash: null, ipBucket: null };
    for (let i = 0; i < 5; i++) {
      assert.equal((await processInquiry(body({ turnstile_token: "forged" }), unknown, d)).status, 400);
    }
    assert.equal((await processInquiry(body(), unknown, d)).status, 200);
  });

  it("a honeypot hit looks successful even with an off-origin page_url", async () => {
    const d = deps();
    const res = await processInquiry(body({ hp: "bot", page_url: "https://evil.example.com/" }), ctx, d);
    assert.equal(res.status, 200);
    assert.equal((d.crm as ReturnType<typeof fakeCrm>).leads.length, 0);
  });

  it("the per-IP limit applies before verification is attempted", async () => {
    let verifications = 0;
    const d = deps({
      verifyTurnstile: async () => (verifications++, true),
      rateLimiters: {
        ip: createRateLimiter({ limit: 1, windowMs: 60_000 }),
        email: createRateLimiter({ limit: 100, windowMs: 60_000 }),
      },
    });
    await processInquiry(body(), ctx, d);
    const second = await processInquiry(body({ idempotency_key: "3f1c6f1e-6a43-4c55-9a39-3c7b6d1f0a40" }), ctx, d);
    assert.equal(second.status, 429);
    assert.equal(verifications, 1);
  });

  it("a failed idempotency lookup falls through to the insert and the CRM", async () => {
    const store = memoryStore();
    const logs: string[] = [];
    store.findByIdempotencyKey = async () => {
      throw new Error("store unavailable");
    };
    const d = deps({ store, log: (m) => logs.push(m) });
    const res = await processInquiry(body(), ctx, d);
    assert.equal(res.status, 200);
    assert.equal((d.crm as ReturnType<typeof fakeCrm>).leads.length, 1);
    assert.equal(store.rows[0].status, "crm_synced");
    assert.ok(logs.includes("store lookup failed"));
  });

  it("a failed lookup and a failed insert still deliver to the CRM", async () => {
    const store = memoryStore();
    store.findByIdempotencyKey = async () => {
      throw new Error("store unavailable");
    };
    store.insert = async () => {
      throw new Error("store unavailable");
    };
    const d = deps({ store });
    const res = await processInquiry(body(), ctx, d);
    assert.equal(res.status, 200);
    assert.equal((d.crm as ReturnType<typeof fakeCrm>).leads.length, 1);
  });

  it("page_url must be on the serving origin", async () => {
    for (const page_url of [
      "https://evil.example.com/services/websites",
      "http://entrepreneuria.io/services/websites",
      "https://entrepreneuria.io.example.com/services/websites",
      "https://user:pw@entrepreneuria.io/services/websites",
      "javascript:alert(1)",
      "data:text/html,hi",
      "not a url",
      "",
      "x".repeat(600),
    ]) {
      const d = deps();
      const res = await processInquiry(body({ page_url }), ctx, d);
      assert.equal(res.status, 400, page_url);
      assert.ok(res.body.ok === false && res.body.error === "invalid", page_url);
      assert.equal((d.crm as ReturnType<typeof fakeCrm>).leads.length, 0, page_url);
    }
  });

  it("an allowlisted nonproduction origin is accepted, and page_url is stored without query or fragment", async () => {
    const staging = { ...ctx, pageOrigin: "https://staging.example.com" };
    const d = deps();
    const res = await processInquiry(body({ page_url: "https://staging.example.com/services/websites?x=1#f" }), staging, d);
    assert.equal(res.status, 200);
    assert.equal((d.store as ReturnType<typeof memoryStore>).rows[0].consent.page_url, "https://staging.example.com/services/websites");

    const local = await processInquiry(
      body({ page_url: "http://localhost:3000/services/websites" }),
      { ...ctx, pageOrigin: "http://localhost:3000" },
      deps()
    );
    assert.equal(local.status, 200);
  });

  it("consent evidence records only policy text that was shown", async () => {
    const d = deps();
    await processInquiry(body(), ctx, d);
    const row = (d.store as ReturnType<typeof memoryStore>).rows[0];
    // Neither wording is approved, so the page does not render either one.
    assert.equal(row.consent.privacy_notice_version, null);
    assert.equal(row.consent.sms_disclosure_version, null);
    assert.deepEqual(Object.keys(row.policy_versions), ["pricing"]);
    const lead = (d.crm as ReturnType<typeof fakeCrm>).leads[0];
    assert.match(lead.note, /Privacy notice version: not shown/);
    assert.match(lead.note, /disclosure not shown/);
    assert.equal(lead.customFields.sms_consent_version, undefined);
  });
});

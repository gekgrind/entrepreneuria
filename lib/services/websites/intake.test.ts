import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createGhlClient, GhlError, type CrmLead, type LeadCrm } from "../../integrations/ghl/client";
import { createRateLimiter } from "../../rate-limit";
import { inquiryFieldsSchema } from "./inquiry-schema";
import { processInquiry, type InquiryRecord, type InquiryStore, type IntakeDeps } from "./intake";

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
      return { contactId: "ct_1", opportunityId: "op_1", opportunityCreated: true };
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
    assert.equal(inquiryFieldsSchema.safeParse({ ...body().fields, contact_method: "text", phone: "478-555-0100" }).success, true);
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

  it("never adds the sms-consent automation tag while SMS consent is unapproved", async () => {
    const d = deps();
    await processInquiry(body({}, { sms_consent: true, phone: "478-555-0100" }), ctx, d);
    const crm = d.crm as ReturnType<typeof fakeCrm>;
    assert.equal(crm.leads[0].customFields.sms_consent, "yes");
    assert.ok(!crm.leads[0].tags.includes("sms-consent"));
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

describe("GHL client", () => {
  const config = {
    token: "t",
    locationId: "loc",
    pipelineId: "pipe",
    pipelineStageId: "stage",
    apiVersion: "2021-07-28",
    customFieldKeys: { style_interest: "contact.style_interest" },
  };
  const lead: CrmLead = {
    name: "Dana",
    email: "dana@example.com",
    companyName: "Reyes Plumbing",
    source: "website-services",
    tags: ["web-preview-request"],
    customFields: { style_interest: "neighborhood-pro", business_type: "Plumbing" },
    opportunityName: "Reyes Plumbing — website preview",
    note: "n",
  };

  function recorder(routes: Array<(url: string, init?: RequestInit) => Response | undefined>) {
    const calls: Array<{ url: string; method: string; body: any; headers: any }> = [];
    let i = 0;
    const fetch = async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null, headers: init?.headers });
      const r = routes[i++]?.(url, init);
      if (!r) throw new Error(`unexpected call ${url}`);
      return r;
    };
    return { calls, fetch };
  }
  const json = (status: number, b: unknown) => new Response(JSON.stringify(b), { status });

  it("upserts contact, creates an opportunity when none is open, adds note", async () => {
    const r = recorder([
      () => json(200, { contact: { id: "ct_9" } }),
      () => json(200, { opportunities: [] }),
      () => json(201, { opportunity: { id: "op_9" } }),
      () => json(201, {}),
    ]);
    const res = await createGhlClient(config, { fetch: r.fetch, sleep: async () => {} }).syncLead(lead);
    assert.deepEqual(res, { contactId: "ct_9", opportunityId: "op_9", opportunityCreated: true });
    assert.equal(r.calls[0].headers.Version, "2021-07-28");
    assert.deepEqual(r.calls[0].body.customFields, [{ key: "contact.style_interest", field_value: "neighborhood-pro" }]);
    assert.ok(r.calls[1].url.includes("contact_id=ct_9"));
  });

  it("reuses an open opportunity instead of creating a duplicate", async () => {
    const r = recorder([
      () => json(200, { contact: { id: "ct_9" } }),
      () => json(200, { opportunities: [{ id: "op_existing" }] }),
      () => json(201, {}),
    ]);
    const res = await createGhlClient(config, { fetch: r.fetch, sleep: async () => {} }).syncLead(lead);
    assert.equal(res.opportunityId, "op_existing");
    assert.equal(res.opportunityCreated, false);
    assert.equal(r.calls.filter((c) => c.method === "POST" && c.url.endsWith("/opportunities/")).length, 0);
  });

  it("retries once on 429, then surfaces a retryable error with the contact id", async () => {
    const r = recorder([
      () => json(429, {}),
      () => json(200, { contact: { id: "ct_9" } }),
      () => json(500, {}),
      () => json(500, {}),
    ]);
    await assert.rejects(
      createGhlClient(config, { fetch: r.fetch, sleep: async () => {} }).syncLead(lead),
      (e: unknown) => e instanceof GhlError && e.step === "opportunity" && e.retryable && e.contactId === "ct_9"
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createGhlClient,
  createKeyedLock,
  createRecentOpportunities,
  GhlError,
  rateLimitWaitMs,
  type CrmLead,
  type GhlConfig,
  type KeyedLock,
} from "./client";
import { parseCustomFieldIds } from "./config";
import { createFakeGhl } from "./fake-ghl.test-helper";

/* Synthetic test identities only (example.com, 555-01xx). Nothing leaves the process. */
const IDS = {
  style_interest: "StyleField0000000001",
  package_interest: "PkgField000000000002",
  sms_consent: "SmsField000000000003",
};

const config: GhlConfig = {
  token: "test-token",
  locationId: "loc_test",
  pipelineId: "pipe_test",
  pipelineStageId: "stage_new",
  apiVersion: "2021-07-28",
  timeoutMs: 25,
  reconcileDelayMs: 0,
  customFieldIds: IDS,
};

function lead(over: Partial<CrmLead> = {}): CrmLead {
  return {
    name: "Dana Test",
    email: "dana@example.com",
    phone: "+14045550123",
    companyName: "Test Plumbing",
    source: "website-services",
    tags: ["web-preview-request", "pkg-growth", "style:modern-craftsman"],
    customFields: { style_interest: "modern-craftsman", package_interest: "growth", sms_consent: "no" },
    opportunityName: "Test Plumbing — website preview",
    note: "Website preview request\nStyle interest: modern-craftsman",
    reference: "11111111-1111-4111-8111-111111111111",
    ...over,
  };
}

const noSleep = async () => {};
const noLock: KeyedLock = { run: (_k, fn) => fn(), size: () => 0 };

function setup(opts: Parameters<typeof createFakeGhl>[0] = { knownFieldIds: Object.values(IDS) }, cfg: Partial<GhlConfig> = {}) {
  const ghl = createFakeGhl(opts);
  const client = createGhlClient({ ...config, ...cfg }, { fetch: ghl.fetch, sleep: noSleep, recentOpportunities: createRecentOpportunities() });
  return { ghl, client };
}

describe("GHL adapter: contact and tags", () => {
  it("creates a new contact without sending tags on upsert, then adds tags additively", async () => {
    const { ghl, client } = setup();
    const res = await client.syncLead(lead());

    const upsert = ghl.calls.find((c) => c.path === "/contacts/upsert")!;
    assert.equal(upsert.headers.Version, "2021-07-28");
    assert.equal("tags" in upsert.body, false, "upsert must never carry tags (they overwrite)");
    assert.deepEqual(
      [...ghl.contacts.get(res.contactId)!.tags].sort(),
      ["pkg-growth", "style:modern-craftsman", "web-preview-request"]
    );
    assert.equal(ghl.count("POST", /\/tags$/), 1);
    assert.equal(res.opportunityCreated, true);
    assert.equal(res.noteCreated, true);
    assert.deepEqual(res.warnings, []);
  });

  it("preserves a returning contact's existing tags", async () => {
    const { ghl, client } = setup();
    const existing = ghl.seedContact("dana@example.com", ["customer", "vip", "newsletter"]);
    const res = await client.syncLead(lead());
    assert.equal(res.contactId, existing.id);
    const tags = ghl.contacts.get(existing.id)!.tags;
    for (const t of ["customer", "vip", "newsletter", "web-preview-request", "pkg-growth", "style:modern-craftsman"]) {
      assert.ok(tags.has(t), `missing tag ${t}`);
    }
  });

  it("repeated sync of the same submission converges: tags kept, one opportunity, one note", async () => {
    const { ghl, client } = setup();
    ghl.seedContact("dana@example.com", ["customer"]);
    const a = await client.syncLead(lead());
    const b = await client.syncLead(lead());
    assert.equal(a.contactId, b.contactId);
    assert.equal(b.opportunityId, a.opportunityId);
    assert.equal(b.opportunityCreated, false);
    assert.equal(b.noteCreated, false);
    assert.equal(ghl.opportunities.length, 1);
    assert.equal(ghl.notes.get(a.contactId)!.length, 1);
    assert.ok(ghl.contacts.get(a.contactId)!.tags.has("customer"));
    assert.equal(ghl.contacts.size, 1);
  });

  it("a returning lead's new submission reuses the open opportunity and adds one new note", async () => {
    const { ghl, client } = setup();
    const a = await client.syncLead(lead());
    const b = await client.syncLead(lead({ reference: "22222222-2222-4222-8222-222222222222", tags: ["web-preview-request", "pkg-business"] }));
    assert.equal(b.opportunityId, a.opportunityId);
    assert.equal(ghl.opportunities.length, 1);
    assert.equal(ghl.notes.get(a.contactId)!.length, 2);
    const tags = ghl.contacts.get(a.contactId)!.tags;
    assert.ok(tags.has("pkg-growth") && tags.has("pkg-business"), "earlier and new tags both kept");
  });

  it("the note carries the submission reference so a retry can detect it", async () => {
    const { ghl, client } = setup();
    const res = await client.syncLead(lead());
    const [note] = ghl.notes.get(res.contactId)!;
    assert.match(note.body, /Style interest: modern-craftsman/);
    assert.match(note.body, /Reference: 11111111-1111-4111-8111-111111111111$/);
  });
});

describe("GHL adapter: existing contacts get additive data only", () => {
  it("the upsert carries only the location and email", async () => {
    const { ghl, client } = setup();
    await client.syncLead(lead());
    const upsert = ghl.calls.find((c) => c.path === "/contacts/upsert")!;
    assert.deepEqual(Object.keys(upsert.body).sort(), ["email", "locationId"]);
  });

  it("never overwrites an existing contact's details, phone or consent fields", async () => {
    const { ghl, client } = setup();
    const existing = ghl.seedContact(
      "dana@example.com",
      ["customer"],
      { [IDS.sms_consent]: "yes", [IDS.package_interest]: "starter" },
      { name: "Dana Original", phone: "+14045550100", companyName: "Original Co", website: "original.example.com" }
    );
    const res = await client.syncLead(lead({ website: "other.example.com", customFields: { sms_consent: "no", package_interest: "growth" } }));
    const c = ghl.contacts.get(existing.id)!;
    assert.equal(c.name, "Dana Original");
    assert.equal(c.phone, "+14045550100");
    assert.equal(c.companyName, "Original Co");
    assert.equal(c.website, "original.example.com");
    assert.equal(c.customFields.get(IDS.sms_consent), "yes");
    assert.equal(c.customFields.get(IDS.package_interest), "starter");
    assert.equal(ghl.count("PUT", /^\/contacts\//), 0);
    assert.ok(res.warnings.includes("existing_contact_details_not_updated"));
    // Additive data still lands: tags, one note with the submitted details, an opportunity.
    assert.ok(c.tags.has("customer") && c.tags.has("web-preview-request"));
    const [note] = ghl.notes.get(existing.id)!;
    assert.match(note.body, /Submitted details \(not applied to this existing contact\)/);
    assert.match(note.body, /Name: Dana Test/);
    assert.match(note.body, /Phone: \+14045550123/);
    assert.match(note.body, /Website: other.example.com/);
    assert.equal(ghl.opportunities.length, 1);
  });

  it("treats a contact as existing when the upsert response has no `new` flag", async () => {
    const { ghl } = setup();
    const noFlag = async (url: string, init?: RequestInit) => {
      const res = await ghl.fetch(url, init);
      if (!url.endsWith("/contacts/upsert")) return res;
      const { new: _drop, ...rest } = await res.json();
      return new Response(JSON.stringify(rest), { status: 200 });
    };
    const c = createGhlClient(config, { fetch: noFlag, sleep: noSleep, recentOpportunities: createRecentOpportunities() });
    const res = await c.syncLead(lead());
    assert.equal(ghl.count("PUT", /^\/contacts\//), 0);
    assert.ok(res.warnings.includes("existing_contact_details_not_updated"));
  });

  it("a new contact whose details are rejected outright is kept, with the lead in the note", async () => {
    const { ghl, client } = setup();
    for (let i = 0; i < 4; i++) ghl.fail({ method: "PUT", path: /^\/contacts\/[^/]+$/, kind: 422 });
    const res = await client.syncLead(lead());
    assert.ok(res.warnings.includes("contact_details_rejected:422"));
    assert.equal(ghl.contacts.size, 1);
    assert.equal(ghl.notes.get(res.contactId)!.length, 1);
    assert.equal(ghl.opportunities.length, 1);
  });

  it("a retry after the contact was created treats it as existing and stays duplicate-free", async () => {
    const { ghl, client } = setup();
    ghl.fail({ method: "PUT", path: /^\/contacts\/[^/]+$/, kind: 401 });
    await assert.rejects(client.syncLead(lead()), (e: unknown) => e instanceof GhlError && e.step === "contact");
    const res = await client.syncLead(lead());
    assert.equal(ghl.contacts.size, 1);
    assert.equal(ghl.notes.get(res.contactId)!.length, 1);
    assert.equal(ghl.opportunities.length, 1);
    assert.ok(res.warnings.includes("existing_contact_details_not_updated"));
  });
});

describe("GHL adapter: custom fields by id", () => {
  it("sends custom fields by id with field_value", async () => {
    const { ghl, client } = setup();
    await client.syncLead(lead());
    const upsert = ghl.calls.find((c) => c.method === "PUT" && c.path.startsWith("/contacts/"))!;
    assert.deepEqual(upsert.body.customFields, [
      { id: IDS.style_interest, field_value: "modern-craftsman" },
      { id: IDS.package_interest, field_value: "growth" },
      { id: IDS.sms_consent, field_value: "no" },
    ]);
    assert.equal(upsert.body.customFields.some((f: any) => "key" in f), false);
  });

  it("an unmapped field is reported (critical ones flagged) and nothing else is lost", async () => {
    const { ghl, client } = setup({ knownFieldIds: Object.values(IDS) }, { customFieldIds: { package_interest: IDS.package_interest } });
    const res = await client.syncLead(lead({ customFields: { style_interest: "not-sure", package_interest: "unsure", business_type: "Plumbing" } }));
    assert.ok(res.warnings.includes("custom_field_unmapped:style_interest:critical"));
    assert.ok(res.warnings.includes("custom_field_unmapped:business_type"));
    const upsert = ghl.calls.find((c) => c.method === "PUT")!;
    assert.deepEqual(upsert.body.customFields, [{ id: IDS.package_interest, field_value: "unsure" }]);
    assert.equal(ghl.notes.get(res.contactId)!.length, 1, "note still written: it holds every value");
  });

  it("an invalid field id rejected with 422 falls back to an update without custom fields", async () => {
    const { ghl, client } = setup({ knownFieldIds: [IDS.package_interest], strictFields: true });
    const res = await client.syncLead(lead());
    assert.ok(res.warnings.includes("custom_fields_rejected:422"));
    const upserts = ghl.calls.filter((c) => c.method === "PUT");
    assert.equal(upserts.length, 2);
    assert.equal("customFields" in upserts[1].body, false);
    assert.equal(ghl.contacts.size, 1);
    assert.equal(ghl.opportunities.length, 1);
    assert.equal(ghl.notes.get(res.contactId)!.length, 1);
  });

  it("a mismatched id that GHL silently ignores is reported as not applied", async () => {
    const { client } = setup({ knownFieldIds: [IDS.style_interest, IDS.sms_consent] });
    const res = await client.syncLead(lead());
    assert.deepEqual(res.warnings, ["custom_field_not_applied:package_interest:critical"]);
  });

  it("a value GHL echoes back differently is reported as not applied", async () => {
    const { ghl } = setup();
    const wrapped = async (url: string, init?: RequestInit) => {
      const res = await ghl.fetch(url, init);
      if (init?.method !== "PUT") return res;
      const data = await res.json();
      data.contact.customFields = data.contact.customFields.map((f: any) => (f.id === IDS.package_interest ? { ...f, value: "starter" } : f));
      return new Response(JSON.stringify(data), { status: 200 });
    };
    const c = createGhlClient(config, { fetch: wrapped, sleep: noSleep, recentOpportunities: createRecentOpportunities() });
    const res = await c.syncLead(lead());
    assert.deepEqual(res.warnings, ["custom_field_not_applied:package_interest:critical"]);
  });

  it("a non-422 rejection does not trigger the custom-field fallback", async () => {
    const { ghl, client } = setup();
    ghl.fail({ method: "POST", path: /^\/contacts\/upsert$/, kind: 401 });
    await assert.rejects(client.syncLead(lead()), (e: unknown) => e instanceof GhlError && e.status === 401 && !e.retryable);
    assert.equal(ghl.count("POST", "/contacts/upsert"), 1);
  });
});

describe("GHL adapter: phone", () => {
  it("passes E.164 through and omits (with a warning) anything else", async () => {
    const details = (g: ReturnType<typeof createFakeGhl>) => g.calls.find((c) => c.method === "PUT")!.body;
    const ok = setup();
    await ok.client.syncLead(lead({ phone: "+442079460958" }));
    assert.equal(details(ok.ghl).phone, "+442079460958");

    const bad = setup();
    const res = await bad.client.syncLead(lead({ phone: "(404) 555-0123" }));
    assert.equal("phone" in details(bad.ghl), false);
    assert.ok(res.warnings.includes("phone_not_e164_omitted"));

    const none = setup();
    await none.client.syncLead(lead({ phone: undefined }));
    assert.equal("phone" in details(none.ghl), false);
  });
});

describe("GHL adapter: rate limits and retries", () => {
  it("never retries a 429 inline and reports the burst wait from the headers", async () => {
    const { ghl, client } = setup();
    ghl.fail({
      method: "POST",
      path: /^\/contacts\/upsert$/,
      kind: 429,
      headers: { "X-RateLimit-Remaining": "0", "X-RateLimit-Interval-Milliseconds": "10000", "X-RateLimit-Daily-Remaining": "150000" },
    });
    await assert.rejects(
      client.syncLead(lead()),
      (e: unknown) => e instanceof GhlError && e.status === 429 && e.retryable && e.outcome === "rejected" && e.retryAfterMs === 10_000
    );
    assert.equal(ghl.count("POST", "/contacts/upsert"), 1);
  });

  it("uses the daily reset when the daily limit is exhausted, and keeps the contact id", async () => {
    const { ghl, client } = setup();
    ghl.fail({
      method: "GET",
      path: /^\/opportunities\/search$/,
      kind: 429,
      headers: { "X-RateLimit-Daily-Remaining": "0", "X-RateLimit-Daily-Reset": "52341000" },
    });
    await assert.rejects(
      client.syncLead(lead()),
      (e: unknown) => e instanceof GhlError && e.step === "opportunity" && e.retryAfterMs === 52_341_000 && Boolean(e.contactId)
    );
  });

  it("rateLimitWaitMs defaults to the documented 10 s window", () => {
    assert.equal(rateLimitWaitMs(new Headers()), 10_000);
    assert.equal(rateLimitWaitMs(new Headers({ "retry-after": "30" })), 30_000);
  });

  it("retries an idempotent call once after a 5xx", async () => {
    const { ghl, client } = setup();
    ghl.fail({ method: "POST", path: /^\/contacts\/upsert$/, kind: 503 });
    const res = await client.syncLead(lead());
    assert.equal(ghl.count("POST", "/contacts/upsert"), 2);
    assert.equal(ghl.contacts.size, 1);
    assert.ok(res.contactId);
  });

  it("retries an idempotent call once after a timeout, then gives up as retryable/unknown", async () => {
    const { ghl, client } = setup();
    ghl.fail({ method: "POST", path: /\/tags$/, kind: "timeout" }, { method: "POST", path: /\/tags$/, kind: "timeout" });
    await assert.rejects(
      client.syncLead(lead()),
      (e: unknown) => e instanceof GhlError && e.step === "tags" && e.status === null && e.retryable && e.outcome === "unknown"
    );
    assert.equal(ghl.count("POST", /\/tags$/), 2);
  });
});

describe("GHL adapter: duplicate prevention after ambiguous failures", () => {
  it("opportunity create applied but answered 500: re-searches, never re-posts", async () => {
    const { ghl, client } = setup();
    ghl.fail({ method: "POST", path: /^\/opportunities\/$/, kind: "applied-500" });
    const res = await client.syncLead(lead());
    assert.equal(ghl.count("POST", "/opportunities/"), 1);
    assert.equal(ghl.opportunities.length, 1);
    assert.equal(res.opportunityId, ghl.opportunities[0].id);
    assert.ok(res.warnings.includes("opportunity_reconciled_after_ambiguous_create"));
  });

  it("opportunity create timed out and not applied: throws retryable, and a later retry creates exactly one", async () => {
    const { ghl, client } = setup();
    ghl.fail({ method: "POST", path: /^\/opportunities\/$/, kind: "timeout" });
    await assert.rejects(
      client.syncLead(lead()),
      (e: unknown) => e instanceof GhlError && e.step === "opportunity" && e.outcome === "unknown" && e.retryable
    );
    assert.equal(ghl.count("POST", "/opportunities/"), 1, "no second create inside one sync");
    assert.equal(ghl.opportunities.length, 0);

    await client.syncLead(lead()); // what the queue retry does
    assert.equal(ghl.opportunities.length, 1);
    assert.equal(ghl.notes.get([...ghl.contacts.keys()][0])!.length, 1);
  });

  it("opportunity create rejected (400) is not retried and not reconciled", async () => {
    const { ghl, client } = setup();
    ghl.fail({ method: "POST", path: /^\/opportunities\/$/, kind: 400 });
    await assert.rejects(client.syncLead(lead()), (e: unknown) => e instanceof GhlError && e.status === 400 && !e.retryable);
    assert.equal(ghl.count("GET", "/opportunities/search"), 1);
  });

  it("note applied but the response never arrives: detected on re-read, no duplicate", async () => {
    const { ghl, client } = setup();
    ghl.fail({ method: "POST", path: /\/notes$/, kind: "applied-hang" });
    const res = await client.syncLead(lead());
    assert.equal(ghl.notes.get(res.contactId)!.length, 1);
    assert.equal(ghl.count("POST", /\/notes$/), 1);
    assert.ok(res.warnings.includes("note_reconciled_after_ambiguous_create"));
  });

  it("note failed with 500 and not applied: retryable; re-running the whole sync is duplicate-free", async () => {
    const { ghl, client } = setup();
    ghl.fail({ method: "POST", path: /\/notes$/, kind: 500 });
    await assert.rejects(client.syncLead(lead()), (e: unknown) => e instanceof GhlError && e.step === "note" && e.retryable);
    const again = await client.syncLead(lead());
    assert.equal(ghl.contacts.size, 1);
    assert.equal(ghl.opportunities.length, 1);
    assert.equal(ghl.notes.get(again.contactId)!.length, 1);
  });
});

describe("GHL adapter: concurrent submissions", () => {
  it("two simultaneous submissions for one email (separate clients, as per request) make one opportunity", async () => {
    const ghl = createFakeGhl({ knownFieldIds: Object.values(IDS) });
    const recentOpportunities = createRecentOpportunities();
    const c1 = createGhlClient(config, { fetch: ghl.fetch, sleep: noSleep, recentOpportunities });
    const c2 = createGhlClient(config, { fetch: ghl.fetch, sleep: noSleep, recentOpportunities });
    const [a, b] = await Promise.all([
      c1.syncLead(lead()),
      c2.syncLead(lead({ reference: "33333333-3333-4333-8333-333333333333" })),
    ]);
    assert.equal(a.contactId, b.contactId);
    assert.equal(ghl.opportunities.length, 1);
    assert.equal(a.opportunityId, b.opportunityId);
    assert.equal(ghl.notes.get(a.contactId)!.length, 2);
  });

  it("control: without the lock the same race creates duplicate opportunities", async () => {
    const ghl = createFakeGhl({ knownFieldIds: Object.values(IDS) });
    const mk = () => createGhlClient(config, { fetch: ghl.fetch, sleep: noSleep, lock: noLock, recentOpportunities: createRecentOpportunities() });
    await Promise.all([mk().syncLead(lead()), mk().syncLead(lead({ reference: "44444444-4444-4444-8444-444444444444" }))]);
    assert.equal(ghl.opportunities.length, 2, "proves the concurrency test can detect the race");
  });

  it("different emails are not serialized behind each other", async () => {
    const ghl = createFakeGhl({ knownFieldIds: Object.values(IDS) });
    const c = createGhlClient(config, { fetch: ghl.fetch, sleep: noSleep, recentOpportunities: createRecentOpportunities() });
    await Promise.all([c.syncLead(lead()), c.syncLead(lead({ email: "lee@example.com", reference: "55555555-5555-4555-8555-555555555555" }))]);
    assert.equal(ghl.contacts.size, 2);
    assert.equal(ghl.opportunities.length, 2);
  });
});

describe("keyed lock", () => {
  it("serializes per key, releases after a failure, and cleans up", async () => {
    const lock = createKeyedLock();
    const order: string[] = [];
    const slow = (tag: string, fail = false) => async () => {
      order.push(`${tag}:start`);
      await new Promise((r) => setTimeout(r, 5));
      order.push(`${tag}:end`);
      if (fail) throw new Error("boom");
      return tag;
    };
    const results = await Promise.allSettled([lock.run("k", slow("a", true)), lock.run("k", slow("b"))]);
    assert.deepEqual(order, ["a:start", "a:end", "b:start", "b:end"]);
    assert.equal(results[0].status, "rejected");
    assert.equal(results[1].status, "fulfilled");
    assert.equal(lock.size(), 0);
  });
});

describe("custom field config", () => {
  it("accepts valid ids for known logical fields", () => {
    const r = parseCustomFieldIds(JSON.stringify({ style_interest: "ExampleFieldId000001", package_interest: "ExampleFieldId000002" }));
    assert.deepEqual(r.ids, { style_interest: "ExampleFieldId000001", package_interest: "ExampleFieldId000002" });
    assert.ok(r.problems.some((p) => p.includes('"sms_consent" is not mapped')));
    assert.ok(!r.problems.some((p) => p.includes('"style_interest" is not mapped')));
  });

  it("rejects malformed ids, keys, unknown names and duplicates, and flags the legacy key variable", () => {
    const r = parseCustomFieldIds(
      JSON.stringify({
        style_interest: "contact.style_interest",
        package_interest: "DupField000000000001",
        sms_consent: "DupField000000000001",
        favourite_colour: "Abcdefghijkl12345678",
        pricing_version: 42,
      }),
      '{"style_interest":"contact.style_interest"}'
    );
    assert.deepEqual(r.ids, {});
    const all = r.problems.join("\n");
    assert.match(all, /GHL_CUSTOM_FIELD_KEYS is no longer supported/);
    assert.match(all, /"style_interest" is not a valid GHL field id/);
    assert.match(all, /DupField000000000001 is mapped to package_interest, sms_consent/);
    assert.match(all, /unknown field "favourite_colour"/);
    assert.match(all, /"pricing_version" is not a valid GHL field id/);
  });

  it("survives invalid JSON and non-objects without throwing", () => {
    assert.match(parseCustomFieldIds("{nope").problems.join(), /not valid JSON/);
    assert.match(parseCustomFieldIds("[1,2]").problems.join(), /must be a JSON object/);
    assert.deepEqual(parseCustomFieldIds(undefined).ids, {});
  });
});

describe("GHL adapter: review hardening", () => {
  it("an unreadable 200 from search is never read as 'no opportunity'", async () => {
    const { ghl, client } = setup();
    ghl.fail(
      { method: "GET", path: /^\/opportunities\/search$/, kind: "garbage-200" },
      { method: "GET", path: /^\/opportunities\/search$/, kind: "garbage-200" }
    );
    await assert.rejects(
      client.syncLead(lead()),
      (e: unknown) => e instanceof GhlError && e.step === "opportunity" && e.outcome === "unknown" && e.retryable
    );
    assert.equal(ghl.count("POST", "/opportunities/"), 0);
  });

  it("an unreadable 200 from the notes list is retried, and never causes a duplicate note", async () => {
    const { ghl, client } = setup();
    await client.syncLead(lead());
    ghl.fail({ method: "GET", path: /\/notes$/, kind: "garbage-200" });
    const again = await client.syncLead(lead());
    assert.equal(ghl.notes.get(again.contactId)!.length, 1);
    assert.equal(again.noteCreated, false);
  });

  it("an unreadable 200 from opportunity create is reconciled, not re-posted", async () => {
    const { ghl, client } = setup();
    ghl.fail({ method: "POST", path: /^\/opportunities\/$/, kind: "garbage-200" });
    await assert.rejects(client.syncLead(lead()), (e: unknown) => e instanceof GhlError && e.outcome === "unknown");
    assert.equal(ghl.count("POST", "/opportunities/"), 1);
  });

  it("a stalled response body times out instead of hanging, and frees the per-email lock", async () => {
    const { ghl, client } = setup();
    ghl.fail(
      { method: "GET", path: /^\/opportunities\/search$/, kind: "stall-body" },
      { method: "GET", path: /^\/opportunities\/search$/, kind: "stall-body" }
    );
    await assert.rejects(client.syncLead(lead()), (e: unknown) => e instanceof GhlError && e.step === "opportunity" && e.status === 200);
    const next = await client.syncLead(lead({ reference: "66666666-6666-4666-8666-666666666666" }));
    assert.equal(ghl.opportunities.length, 1);
    assert.ok(next.opportunityCreated);
  });

  it("the overall sync budget stops further calls", async () => {
    const { ghl, client } = setup(undefined, { timeoutMs: 20, syncBudgetMs: 30 });
    ghl.fail(
      { method: "POST", path: /^\/contacts\/upsert$/, kind: "timeout" },
      { method: "POST", path: /^\/contacts\/upsert$/, kind: "timeout" }
    );
    const started = Date.now();
    await assert.rejects(client.syncLead(lead()), (e: unknown) => e instanceof GhlError && e.outcome === "unknown" && e.retryable);
    assert.ok(Date.now() - started < 1000);
    assert.equal(ghl.count("GET", "/opportunities/search"), 0);
  });

  it("a lagging search index doesn't cause a second opportunity for back-to-back submissions", async () => {
    const { ghl, client } = setup({ knownFieldIds: Object.values(IDS), searchLag: 5 });
    await client.syncLead(lead());
    const b = await client.syncLead(lead({ reference: "77777777-7777-4777-8777-777777777777" }));
    assert.equal(ghl.opportunities.length, 1);
    assert.equal(b.opportunityCreated, false);
  });

  it("control: separate processes (no shared memory) still race on a lagging index; needs the async worker", async () => {
    const ghl = createFakeGhl({ knownFieldIds: Object.values(IDS), searchLag: 5 });
    const proc = () =>
      createGhlClient(config, { fetch: ghl.fetch, sleep: noSleep, lock: createKeyedLock(), recentOpportunities: createRecentOpportunities() });
    await proc().syncLead(lead());
    await proc().syncLead(lead({ reference: "88888888-8888-4888-8888-888888888888" }));
    assert.equal(ghl.opportunities.length, 2);
  });

  it("a phone GHL rejects is dropped (custom fields kept) instead of losing the lead", async () => {
    const { ghl, client } = setup({ knownFieldIds: Object.values(IDS), rejectPhones: true });
    const res = await client.syncLead(lead({ phone: "+442079460958" }));
    assert.deepEqual(res.warnings, ["phone_rejected:400"]);
    const c = ghl.contacts.get(res.contactId)!;
    assert.equal(c.phone, undefined);
    assert.equal(c.customFields.get(IDS.style_interest), "modern-craftsman");
  });

  it("the note is written even when the opportunity step is rejected", async () => {
    const { ghl, client } = setup();
    ghl.fail({ method: "POST", path: /^\/opportunities\/$/, kind: 400 });
    await assert.rejects(client.syncLead(lead()), (e: unknown) => e instanceof GhlError && e.step === "opportunity");
    const [contactId] = [...ghl.contacts.keys()];
    assert.equal(ghl.notes.get(contactId)!.length, 1);
  });

  it("recent-opportunity memory expires", () => {
    let t = 0;
    const r = createRecentOpportunities(1000, () => t);
    r.set("k", "op_1");
    assert.equal(r.get("k"), "op_1");
    t = 1001;
    assert.equal(r.get("k"), undefined);
  });
});

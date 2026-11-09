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

  it("preserves a returning contact's existing tags and adds only the unverified-match tag", async () => {
    const { ghl, client } = setup();
    const existing = ghl.seedContact("dana@example.com", ["customer", "vip", "newsletter"]);
    const res = await client.syncLead(lead({ existingContactTags: ["web-preview-unverified-match"] }));
    assert.equal(res.contactId, existing.id);
    assert.deepEqual([...ghl.contacts.get(existing.id)!.tags].sort(), ["customer", "newsletter", "vip", "web-preview-unverified-match"]);
  });

  it("repeated sync of the same submission converges: one opportunity, one note", async () => {
    const { ghl, client } = setup();
    const a = await client.syncLead(lead());
    const b = await client.syncLead(lead());
    assert.equal(a.contactId, b.contactId);
    assert.equal(b.opportunityId, a.opportunityId);
    assert.equal(b.opportunityCreated, false);
    assert.equal(b.noteCreated, false);
    assert.ok(b.warnings.includes("resumed_own_contact"));
    assert.equal(ghl.opportunities.length, 1);
    assert.equal(ghl.notes.get(a.contactId)!.length, 1);
    assert.equal(ghl.contacts.size, 1);
  });

  it("repeated sync of a submission that matched an existing contact stays unverified and creates nothing new", async () => {
    const { ghl, client } = setup();
    ghl.seedContact("dana@example.com", ["customer"]);
    const a = await client.syncLead(lead());
    const b = await client.syncLead(lead());
    assert.equal(a.contactId, b.contactId);
    assert.equal(b.existingContact, true);
    assert.equal(b.opportunityId, null);
    assert.equal(ghl.opportunities.length, 0);
    assert.equal(ghl.notes.get(a.contactId)!.length, 1);
    assert.ok(ghl.contacts.get(a.contactId)!.tags.has("customer"));
  });

  it("a returning lead's new submission is an unverified match: one new note, no new or reused opportunity", async () => {
    const { ghl, client } = setup();
    const a = await client.syncLead(lead());
    const b = await client.syncLead(
      lead({ reference: "22222222-2222-4222-8222-222222222222", tags: ["web-preview-request", "pkg-business"], existingContactTags: ["unverified"] })
    );
    assert.equal(b.opportunityId, null);
    assert.equal(ghl.opportunities.length, 1, "only the first submission's opportunity");
    assert.equal(ghl.notes.get(a.contactId)!.length, 2);
    const tags = ghl.contacts.get(a.contactId)!.tags;
    assert.ok(tags.has("pkg-growth"), "earlier tags kept");
    assert.ok(!tags.has("pkg-business") && tags.has("unverified"), "a matched contact gets only the unverified tag");
    assert.match(ghl.notes.get(a.contactId)![1].body, /^UNVERIFIED: /);
  });

  it("the note carries the submission reference so a retry can detect it", async () => {
    const { ghl, client } = setup();
    const res = await client.syncLead(lead());
    const [note] = ghl.notes.get(res.contactId)!;
    assert.match(note.body, /Style interest: modern-craftsman/);
    assert.match(note.body, /Reference: 11111111-1111-4111-8111-111111111111$/);
  });
});

describe("GHL adapter: custom fields by id", () => {
  it("sends custom fields by id with field_value", async () => {
    const { ghl, client } = setup();
    await client.syncLead(lead());
    const upsert = ghl.calls.find((c) => c.path === "/contacts/upsert")!;
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
    const upsert = ghl.calls.find((c) => c.path === "/contacts/upsert")!;
    assert.deepEqual(upsert.body.customFields, [{ id: IDS.package_interest, field_value: "unsure" }]);
    assert.equal(ghl.notes.get(res.contactId)!.length, 1, "note still written: it holds every value");
  });

  it("an invalid field id rejected with 422 falls back to an upsert without custom fields", async () => {
    const { ghl, client } = setup({ knownFieldIds: [IDS.package_interest], strictFields: true });
    const res = await client.syncLead(lead());
    assert.ok(res.warnings.includes("custom_fields_rejected:422"));
    const upserts = ghl.calls.filter((c) => c.path === "/contacts/upsert");
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

  it("a returning contact's custom fields are never overwritten", async () => {
    const { ghl, client } = setup();
    const existing = ghl.seedContact("dana@example.com", [], { [IDS.package_interest]: "starter" });
    const res = await client.syncLead(lead());
    assert.deepEqual(res.warnings, ["existing_contact_not_modified", "opportunity_skipped_unverified_match"]);
    assert.equal(ghl.count("POST", "/contacts/upsert"), 0);
    assert.equal(ghl.contacts.get(existing.id)!.customFields.get(IDS.package_interest), "starter");
    assert.equal(ghl.contacts.get(existing.id)!.customFields.has(IDS.style_interest), false);
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
    const upsertOf = (g: ReturnType<typeof createFakeGhl>) => g.calls.find((c) => c.path === "/contacts/upsert")!.body;
    const ok = setup();
    await ok.client.syncLead(lead({ phone: "+442079460958" }));
    assert.equal(upsertOf(ok.ghl).phone, "+442079460958");

    const bad = setup();
    const res = await bad.client.syncLead(lead({ phone: "(404) 555-0123" }));
    assert.equal("phone" in upsertOf(bad.ghl), false);
    assert.ok(res.warnings.includes("phone_not_e164_omitted"));

    const none = setup();
    await none.client.syncLead(lead({ phone: undefined }));
    assert.equal("phone" in upsertOf(none.ghl), false);
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
    assert.equal(b.opportunityId, null, "the second submission is an unverified match");
    assert.equal(ghl.count("POST", "/contacts/upsert"), 1, "the lock lets the second see the first's contact");
    assert.equal(ghl.notes.get(a.contactId)!.length, 2);
  });

  it("control: without the lock both submissions miss the lookup and upsert the same email", async () => {
    const ghl = createFakeGhl({ knownFieldIds: Object.values(IDS) });
    const mk = () => createGhlClient(config, { fetch: ghl.fetch, sleep: noSleep, lock: noLock, recentOpportunities: createRecentOpportunities() });
    const results = await Promise.all([mk().syncLead(lead()), mk().syncLead(lead({ reference: "44444444-4444-4444-8444-444444444444" }))]);
    assert.equal(ghl.count("POST", "/contacts/upsert"), 2, "proves the concurrency test can detect the race");
    assert.equal(ghl.contacts.size, 1);
    // The second upsert is detected afterwards and handled as unverified (the documented known gap).
    assert.equal(results.filter((r) => r.warnings.includes("upsert_matched_existing_contact")).length, 1);
    assert.equal(ghl.opportunities.length, 1);
  });

  it("different emails are not serialized behind each other", async () => {
    const ghl = createFakeGhl({ knownFieldIds: Object.values(IDS) });
    const c = createGhlClient(config, { fetch: ghl.fetch, sleep: noSleep, recentOpportunities: createRecentOpportunities() });
    await Promise.all([
      c.syncLead(lead()),
      c.syncLead(lead({ email: "lee@example.com", phone: "+14045550199", reference: "55555555-5555-4555-8555-555555555555" })),
    ]);
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
    const next = await client.syncLead(lead()); // the same submission, retried
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

  it("control: a retry served by another process (no shared memory) still races on a lagging index; needs the async worker", async () => {
    const ghl = createFakeGhl({ knownFieldIds: Object.values(IDS), searchLag: 5 });
    const proc = () =>
      createGhlClient(config, { fetch: ghl.fetch, sleep: noSleep, lock: createKeyedLock(), recentOpportunities: createRecentOpportunities() });
    await proc().syncLead(lead());
    const retry = await proc().syncLead(lead()); // same submission, other process: recognised by its note
    assert.ok(retry.warnings.includes("resumed_own_contact"));
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

describe("GHL adapter: an anonymous submission never changes an existing contact", () => {
  it("existing email: no upsert; name, company, phone, website, source and fields stay; only additive data is written", async () => {
    const { ghl, client } = setup();
    const before = { name: "Original Name", companyName: "Original Co", website: "https://original.example.com", source: "referral" };
    const existing = ghl.seedContact("dana@example.com", ["customer"], { [IDS.sms_consent]: "no" }, { phone: "+14045550100", fields: before });
    const res = await client.syncLead(
      lead({ consentTags: ["sms-consent"], existingContactTags: ["web-preview-unverified-match"], customFields: { sms_consent: "yes", style_interest: "modern-craftsman" } })
    );

    assert.equal(res.contactId, existing.id);
    assert.equal(res.existingContact, true);
    assert.equal(ghl.count("POST", "/contacts/upsert"), 0);
    const c = ghl.contacts.get(existing.id)!;
    assert.deepEqual(c.fields, before);
    assert.equal(c.phone, "+14045550100");
    assert.equal(c.customFields.get(IDS.sms_consent), "no", "consent field untouched");
    assert.equal(c.customFields.size, 1);
    assert.ok(!c.tags.has("sms-consent"), "no consent tag on an existing contact");
    assert.deepEqual([...c.tags].sort(), ["customer", "web-preview-unverified-match"], "no automation-triggering tags");
    const [note] = ghl.notes.get(existing.id)!;
    assert.match(note.body, /^UNVERIFIED: this web form submission matched an existing contact by email only/);
    assert.match(note.body, /Style interest: modern-craftsman/, "the submission still arrives in full as a note");
    assert.match(note.body, /no opportunity was created/);
    assert.equal(ghl.opportunities.length, 0, "no pipeline entry for an unverified match");
    assert.equal(ghl.count("GET", "/opportunities/search"), 0);
    assert.equal(res.opportunityId, null);
    assert.deepEqual(res.warnings, [
      "existing_contact_not_modified",
      "consent_tags_skipped_existing_contact",
      "opportunity_skipped_unverified_match",
    ]);
  });

  it("new email whose phone belongs to another contact: creates a new contact without the phone, other contact untouched", async () => {
    const { ghl, client } = setup();
    const other = ghl.seedContact("someone@example.com", ["customer"], {}, { phone: "+14045550123", fields: { name: "Someone" } });
    const res = await client.syncLead(lead());
    assert.notEqual(res.contactId, other.id);
    assert.equal(res.existingContact, false);
    const upsert = ghl.calls.find((c) => c.path === "/contacts/upsert")!;
    assert.equal("phone" in upsert.body, false);
    assert.ok(res.warnings.includes("phone_matches_existing_contact_omitted"));
    assert.deepEqual(ghl.contacts.get(other.id)!.fields, { name: "Someone" });
    assert.equal(ghl.contacts.get(other.id)!.email, "someone@example.com");
    assert.equal(ghl.notes.get(other.id), undefined);
    assert.match(ghl.notes.get(res.contactId)![0].body, /^The submitted phone number already belongs to another contact/);
    assert.ok(!ghl.notes.get(res.contactId)![0].body.includes("UNVERIFIED"), "the new contact itself is not an unverified match");
  });

  it("a new contact gets consent tags; one GHL matched anyway (new: false) does not", async () => {
    const fresh = setup();
    const a = await fresh.client.syncLead(lead({ consentTags: ["sms-consent"] }));
    assert.ok(fresh.ghl.contacts.get(a.contactId)!.tags.has("sms-consent"));

    const raced = setup();
    // The email lookup misses, but by upsert time a contact with that email exists.
    const realFetch = raced.ghl.fetch;
    let seeded = false;
    const client = createGhlClient(config, {
      fetch: async (url, init) => {
        if (!seeded && String(url).includes("/contacts/upsert")) {
          seeded = true;
          raced.ghl.seedContact("dana@example.com", []);
        }
        return realFetch(url, init);
      },
      sleep: noSleep,
      recentOpportunities: createRecentOpportunities(),
    });
    const b = await client.syncLead(lead({ consentTags: ["sms-consent"], phone: undefined }));
    assert.equal(b.existingContact, true);
    assert.ok(b.warnings.includes("upsert_matched_existing_contact"));
    assert.ok(b.warnings.includes("consent_tags_skipped_existing_contact"));
    assert.ok(!raced.ghl.contacts.get(b.contactId)!.tags.has("sms-consent"));
  });

  it("an unreadable or unexpected (no `contact` field) duplicate-search response is an error, never 'no contact'", async () => {
    for (const kind of ["garbage-200", 200] as const) {
      const { ghl, client } = setup();
      ghl.seedContact("dana@example.com", ["customer"]);
      ghl.fail(
        { method: "GET", path: /^\/contacts\/search\/duplicate$/, kind },
        { method: "GET", path: /^\/contacts\/search\/duplicate$/, kind }
      );
      await assert.rejects(client.syncLead(lead()), (e: unknown) => e instanceof GhlError && e.step === "contact" && e.retryable);
      assert.equal(ghl.count("POST", "/contacts/upsert"), 0, String(kind));
    }
  });
});

describe("GHL adapter: retries of the same submission", () => {
  it("a retry after the note failed is still recognised in the same process, and completes the lead", async () => {
    const { ghl, client } = setup();
    ghl.fail({ method: "POST", path: /\/notes$/, kind: 400 });
    await assert.rejects(client.syncLead(lead()), (e: unknown) => e instanceof GhlError && e.step === "note");
    const retry = await client.syncLead(lead());
    assert.equal(retry.existingContact, false);
    assert.ok(retry.warnings.includes("resumed_own_contact"));
    assert.ok(retry.opportunityId);
    assert.ok(!ghl.notes.get(retry.contactId)![0].body.startsWith("UNVERIFIED"));
  });

  it("another submission can't pass as the creator: a different reference on that contact is unverified", async () => {
    const { ghl, client } = setup();
    const first = await client.syncLead(lead());
    const other = await client.syncLead(lead({ reference: "99999999-9999-4999-8999-999999999999" }));
    assert.equal(other.contactId, first.contactId);
    assert.equal(other.existingContact, true);
    assert.equal(other.opportunityId, null);
  });

  it("a note with this reference that was written as unverified never upgrades the match", async () => {
    const { ghl, client } = setup();
    const existing = ghl.seedContact("dana@example.com", []);
    await client.syncLead(lead());
    const again = createGhlClient(config, { fetch: ghl.fetch, sleep: noSleep, recentOpportunities: createRecentOpportunities() });
    const res = await again.syncLead(lead());
    assert.equal(res.contactId, existing.id);
    assert.equal(res.existingContact, true);
    assert.equal(ghl.opportunities.length, 0);
  });
});

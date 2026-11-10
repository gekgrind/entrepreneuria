/**
 * Returning GoHighLevel contacts in leads mode (owner decision, 2026-11-09):
 * no CRM write of any kind, a durable review record outside the CRM, a
 * reference-only owner notice, no capacity slot, and fail-safe handling of
 * lookups that fail or can't be read. Runs through the real route handler.
 */
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { GhlError } from "../../integrations/ghl/client";

import { fakeCrm, harness, payload, req, validLeadsEnv } from "./leads.test-helper";
import { createFileReviewStore, createMemoryReviewStore, REVIEW_REF, type ReviewRecord } from "./review-store";

const EXISTING = "returning@example.com";

function alertEvents(h: ReturnType<typeof harness>) {
  return h.alerts.map((a) => JSON.parse(a.body) as { event: string; step: string; status: string });
}

function returningHarness(over: Parameters<typeof harness>[0] = {}) {
  const crm = fakeCrm();
  crm.existing.set(EXISTING, "ct_existing");
  return harness({ crm, ...over });
}

describe("returning contact: no CRM writes, durable review record, safe notice", () => {
  it("an existing contact is never synced; the inquiry is stored for review and the owner is notified by reference only", async () => {
    const h = returningHarness();
    const p = payload({}, { email: EXISTING, message: "Please call me about my site" });
    const res = await h.send(req(p));
    await h.flush();

    assert.equal(res.status, 200);
    assert.equal(h.crm.leads.length, 0, "syncLead never called: no upsert, tags, note or opportunity");
    assert.deepEqual(h.crm.lookups, [EXISTING]);

    const [record] = await h.reviews.list();
    assert.equal(record.reason, "existing_contact");
    assert.equal(record.crm_contact_id, "ct_existing");
    assert.equal(record.submission.fields.email, EXISTING);
    assert.equal(record.submission.fields.message, "Please call me about my site");
    assert.equal(record.submission.idempotency_key, p.idempotency_key);
    assert.match(record.ref, REVIEW_REF);
    assert.ok(record.notified_at, "marked notified once the receiver accepted the notice");

    const notices = alertEvents(h).filter((e) => e.event === "returning_contact_review");
    assert.deepEqual(notices, [notices[0]]);
    assert.equal(notices[0].status, record.ref);
    const raw = h.alerts.map((a) => a.body).join("\n");
    for (const pii of [EXISTING, "Dana", "Reyes", "Please call me"]) assert.ok(!raw.includes(pii), `notice leaked ${pii}`);
  });

  it("the response is identical for new and returning contacts (no CRM membership probe)", async () => {
    const h = returningHarness();
    const returning = await h.send(req(payload({}, { email: EXISTING })));
    const fresh = await h.send(req(payload()));
    assert.equal(returning.status, fresh.status);
    assert.deepEqual(returning.body, fresh.body);
    assert.deepEqual(returning.body, { ok: true, state: "received", reference: null });
  });

  it("a new contact follows the approved new-lead sync and creates no review record", async () => {
    const h = returningHarness();
    const res = await h.send(req(payload()));
    assert.equal(res.status, 200);
    assert.equal(h.crm.leads.length, 1);
    assert.equal((await h.reviews.list()).length, 0);
  });

  it("a lookup that fails is never treated as new: stored for review, owner alerted, no sync", async () => {
    const h = returningHarness();
    h.crm.lookupFailWith = new GhlError("GHL duplicate search response had no contact field", "contact", 200, true, undefined, { outcome: "unknown" });
    const res = await h.send(req(payload()));
    await h.flush();
    assert.equal(res.status, 200);
    assert.equal(h.crm.leads.length, 0);
    const [record] = await h.reviews.list();
    assert.equal(record.reason, "lookup_failed");
    assert.equal(record.crm_contact_id, null);
    const events = alertEvents(h).map((e) => `${e.event}:${e.step}`);
    assert.ok(events.includes("delivery_failed:lookup"), events.join(","));
    assert.ok(events.includes("returning_contact_review:review"), events.join(","));
  });

  it("a lookup that times out or errors (network) is also held for review", async () => {
    const h = returningHarness();
    h.crm.lookupFailWith = new GhlError("GHL contact request failed: timed out", "contact", null, true, undefined, { outcome: "unknown" });
    assert.equal((await h.send(req(payload()))).status, 200);
    assert.equal(h.crm.leads.length, 0);
    assert.equal((await h.reviews.list())[0].reason, "lookup_failed");
  });

  it("a review record that cannot be written is a retryable error, never a silent success", async () => {
    const reviews = createMemoryReviewStore();
    reviews.failSave = true;
    const h = returningHarness({ reviews });
    const res = await h.send(req(payload({}, { email: EXISTING })));
    await h.flush();
    assert.equal(res.status, 502);
    assert.deepEqual(res.body, { ok: false, error: "delivery_failed", retryable: true });
    assert.ok(alertEvents(h).some((e) => e.step === "review_store"));
    assert.equal(h.crm.leads.length, 0);
  });
});

describe("returning contact: capacity", () => {
  it("when intake is full, a returning contact is still recorded but gets the same response as a new lead (no membership probe)", async () => {
    const h = returningHarness();
    h.crm.open = 5; // WEBSITES_PREVIEW_MAX_OPEN_REQUESTS=5 in the test env
    const returning = await h.send(req(payload({}, { email: EXISTING })));
    const fresh = await h.send(req(payload(), { "x-real-ip": "198.51.100.40" }));
    await h.flush();
    assert.equal(returning.status, fresh.status);
    assert.deepEqual(returning.body, fresh.body);
    assert.deepEqual(fresh.body, { ok: false, error: "capacity", reason: "full" });
    const [record] = await h.reviews.list();
    assert.equal(record.reason, "existing_contact", "the returning inquiry is kept and the owner notified");
    assert.ok(record.notified_at);
    assert.equal(h.crm.leads.length, 0);
  });

  it("the capacity peek for a returning contact takes no slot and raises no capacity alert", async () => {
    const h = returningHarness({ env: validLeadsEnv() });
    h.crm.open = 3; // limit 5: two slots left
    for (const message of ["one", "two", "three"]) {
      assert.equal((await h.send(req(payload({}, { email: EXISTING, message }), { "x-real-ip": `198.51.100.${message.length}` }))).status, 200);
    }
    await h.flush();
    assert.ok(!alertEvents(h).some((e) => e.event.startsWith("capacity_")), "peeks raised a capacity alert");
    assert.equal((await h.send(req(payload()))).status, 200);
  });

  it("a failed lookup while intake is full is recorded and answered like a new lead", async () => {
    const h = returningHarness();
    h.crm.open = 5;
    h.crm.lookupFailWith = new GhlError("GHL contact request failed: timed out", "contact", null, true, undefined, { outcome: "unknown" });
    const res = await h.send(req(payload()));
    assert.deepEqual(res.body, { ok: false, error: "capacity", reason: "full" });
    assert.equal((await h.reviews.list())[0].reason, "lookup_failed");
  });

  it("returning contacts don't consume the optimistic count: with 4 open, a new lead is still admitted after several returning ones", async () => {
    const h = returningHarness({ env: validLeadsEnv() });
    h.crm.open = 4;
    for (const message of ["one", "two", "three"]) {
      assert.equal((await h.send(req(payload({}, { email: EXISTING, message }), { "x-real-ip": `198.51.100.${message.length}` }))).status, 200);
    }
    assert.equal((await h.send(req(payload()))).status, 200);
    assert.equal(h.crm.leads.length, 1);
  });

  it("paused intake answers new and returning contacts alike, and still records the returning one for review", async () => {
    const h = returningHarness({ env: validLeadsEnv({ WEBSITES_PREVIEW_INTAKE: "paused" }) });
    const returning = await h.send(req(payload({}, { email: EXISTING })));
    const fresh = await h.send(req(payload()));
    assert.equal(returning.status, 503);
    assert.deepEqual(returning.body, fresh.body);
    assert.deepEqual(fresh.body, { ok: false, error: "capacity", reason: "paused" });
    assert.equal((await h.reviews.list()).length, 1);
    assert.equal(h.crm.countCalls, 0, "paused never calls GHL for a count");
  });
});

describe("returning contact: duplicates and concurrency", () => {
  it("the same submission sent twice yields one review record and one notice", async () => {
    const h = returningHarness();
    const p = payload({}, { email: EXISTING });
    await h.send(req(p));
    await h.send(req({ ...p, idempotency_key: crypto.randomUUID() })); // double-click with a fresh key, same content
    await h.flush();
    assert.equal((await h.reviews.list()).length, 1);
    assert.equal(alertEvents(h).filter((e) => e.event === "returning_contact_review").length, 1);
  });

  it("changed content from the same returning contact is a second review record", async () => {
    const h = returningHarness();
    await h.send(req(payload({}, { email: EXISTING, message: "first" })));
    await h.send(req(payload({}, { email: EXISTING, message: "second" }), { "x-real-ip": "198.51.100.9" }));
    assert.equal((await h.reviews.list()).length, 2);
  });

  it("concurrent identical submissions from a returning contact make one record", async () => {
    const h = returningHarness();
    const p = payload({}, { email: EXISTING });
    const results = await Promise.all([h.send(req(p)), h.send(req(p)), h.send(req(p))]);
    assert.ok(results.every((r) => r.status === 200));
    assert.equal((await h.reviews.list()).length, 1);
  });

  it("concurrent submissions for one NEW email: one is synced, the other becomes a returning contact (no second sync)", async () => {
    const h = returningHarness();
    const email = "brand-new@example.com";
    const [a, b] = await Promise.all([
      h.send(req(payload({}, { email, message: "a" }))),
      h.send(req(payload({}, { email, message: "b" }), { "x-real-ip": "198.51.100.8" })),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(h.crm.leads.length, 1, "serialized per email: exactly one new-lead sync");
    assert.equal((await h.reviews.list()).length, 1);
  });

  it("an identical resubmission of a NEW lead within minutes is not synced twice", async () => {
    const crm = fakeCrm();
    const h = harness({ crm });
    const p = payload();
    await h.send(req(p));
    // GHL would now report the contact as existing; the in-process memory answers first.
    await h.send(req({ ...p, idempotency_key: crypto.randomUUID() }));
    assert.equal(crm.leads.length, 1);
    assert.equal((await h.reviews.list()).length, 0, "not mistaken for a returning contact");
  });
});

describe("returning contact: notice delivery failure and recovery", () => {
  it("a failed notice leaves the record pending; after a restart the next request re-sends it and marks it notified", async () => {
    const reviews = createMemoryReviewStore();
    const down = returningHarness({ reviews, alertStatus: 503 });
    assert.equal((await down.send(req(payload({}, { email: EXISTING })))).status, 200);
    await down.flush();
    const [pending] = await reviews.list();
    assert.equal(pending.notified_at, null, "not marked notified when the receiver refused it");

    // New process (fresh runtime), receiver back up, same durable store.
    const up = harness({ reviews, crm: fakeCrm() });
    await up.send(req(payload()));
    await up.flush();
    const notices = alertEvents(up).filter((e) => e.event === "returning_contact_review");
    assert.deepEqual(notices.map((n) => n.status), [pending.ref]);
    assert.ok((await reviews.get(pending.ref))!.notified_at);
  });

  it("resolved records are not re-sent", async () => {
    const reviews = createMemoryReviewStore();
    const down = returningHarness({ reviews, alertStatus: 503 });
    await down.send(req(payload({}, { email: EXISTING })));
    await down.flush();
    const [r] = await reviews.list();
    await reviews.markResolved(r.ref, new Date().toISOString());
    const up = harness({ reviews, crm: fakeCrm() });
    await up.send(req(payload()));
    await up.flush();
    assert.equal(alertEvents(up).filter((e) => e.event === "returning_contact_review").length, 0);
  });
});

describe("review store on disk", () => {
  const record = (ref: string): ReviewRecord => ({
    ref,
    reason: "existing_contact",
    crm_contact_id: "ct_1",
    received_at: "2026-11-09T12:00:00.000Z",
    notified_at: null,
    resolved_at: null,
    submission: {
      idempotency_key: "11111111-1111-4111-8111-111111111111",
      fields: { name: "Synthetic", email: "synthetic@example.com" } as never,
      consent: {},
      page_url: "https://entrepreneuria.io/services/websites",
      utm: null,
      pricing_version: "v",
    },
  });

  async function withDir(fn: (dir: string) => Promise<void>) {
    const root = await mkdtemp(path.join(tmpdir(), "review-"));
    try {
      await fn(path.join(root, "store"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  it("creates the directory 0700 and records 0600, and survives a new instance (restart)", () =>
    withDir(async (dir) => {
      const a = createFileReviewStore(dir);
      assert.deepEqual((await a.save(record("r-0123456789abcdef"))).created, true);
      // POSIX permission bits do not exist on Windows; Linux CI enforces them.
      if (process.platform !== "win32") {
        assert.equal((await stat(dir)).mode & 0o777, 0o700);
        assert.equal((await stat(path.join(dir, "r-0123456789abcdef.json"))).mode & 0o777, 0o600);
      }
      const b = createFileReviewStore(dir);
      assert.equal((await b.get("r-0123456789abcdef"))!.crm_contact_id, "ct_1");
      assert.equal((await b.list()).length, 1);
    }));

  it("exclusive create: concurrent saves of one reference make one file; no temp files left", () =>
    withDir(async (dir) => {
      const s = createFileReviewStore(dir);
      const results = await Promise.all(Array.from({ length: 8 }, () => s.save(record("r-aaaaaaaaaaaaaaaa"))));
      assert.equal(results.filter((r) => r.created).length, 1);
      assert.deepEqual(await readdir(dir), ["r-aaaaaaaaaaaaaaaa.json"]);
    }));

  it("updates are atomic replacements and keep the record", () =>
    withDir(async (dir) => {
      const s = createFileReviewStore(dir);
      await s.save(record("r-bbbbbbbbbbbbbbbb"));
      await s.markNotified("r-bbbbbbbbbbbbbbbb", "2026-11-09T12:01:00.000Z");
      await s.markResolved("r-bbbbbbbbbbbbbbbb", "2026-11-09T13:00:00.000Z");
      const r = (await s.get("r-bbbbbbbbbbbbbbbb"))!;
      assert.equal(r.notified_at, "2026-11-09T12:01:00.000Z");
      assert.equal(r.resolved_at, "2026-11-09T13:00:00.000Z");
      assert.equal(r.submission.fields.email, "synthetic@example.com");
      assert.deepEqual(await readdir(dir), ["r-bbbbbbbbbbbbbbbb.json"]);
    }));

  it("rejects references that could escape the directory, and relative directories", async () => {
    const s = createMemoryReviewStore();
    await assert.rejects(s.save(record("../../etc/passwd")));
    await withDir(async (dir) => {
      const f = createFileReviewStore(dir);
      await assert.rejects(f.get("../r-0123456789abcdef"));
      await assert.rejects(f.save(record("r-../../x")));
    });
    assert.throws(() => createFileReviewStore("relative/dir"));
  });
});

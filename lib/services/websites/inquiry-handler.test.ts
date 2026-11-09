import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GhlError } from "../../integrations/ghl/client";

import { verifyAlertSignature, type AlertPayload } from "./alerts";
import { handleInquiry, MAX_BODY_BYTES } from "./inquiry-handler";
import { fakeCrm, harness, ORIGIN, payload, req, SECRET, validLeadsEnv } from "./leads.test-helper";

const ok = (r: { status: number }) => assert.equal(r.status, 200);

describe("leads intake: happy path", () => {
  it("accepts a valid request, syncs once to the CRM and records the canonical page URL", async () => {
    const h = harness();
    const res = await handleInquiry(req(payload({ page_url: "https://evil.example/forged" })), h.deps);
    await h.flush();
    ok(res);
    assert.deepEqual(res.body, { ok: true, state: "received", reference: null });
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.equal(h.crm.leads.length, 1);
    // The client-supplied page_url is ignored; evidence is server-owned.
    assert.equal(h.crm.leads[0].customFields.consent_page_url, `${ORIGIN}/services/websites`);
    assert.ok(!JSON.stringify(h.crm.leads[0]).includes("evil.example"));
  });

  it("no SMS: the consent tag is never added and text requests are refused", async () => {
    const h = harness();
    const text = await handleInquiry(req(payload({}, { contact_method: "text", phone: "404-555-0100" })), h.deps);
    assert.equal(text.status, 400);
    const consent = await handleInquiry(req(payload({}, { sms_consent: true, phone: "404-555-0100" })), h.deps);
    assert.equal(consent.status, 400);
    assert.equal(h.crm.leads.length, 0);

    const normal = await handleInquiry(req(payload()), h.deps);
    ok(normal);
    assert.ok(!h.crm.leads[0].tags.includes("sms-consent"));
  });

  it("no payment surface: nothing in the request or response involves billing", async () => {
    const h = harness({ env: validLeadsEnv({ WEBSITES_PAYMENTS_MODE: "sandbox" }) });
    const res = await handleInquiry(req(payload()), h.deps);
    ok(res);
    assert.ok(!/stripe|invoice|checkout|payment/i.test(JSON.stringify(res.body)));
  });
});

describe("leads intake: request validation and abuse protection", () => {
  it("refuses a wrong, missing or look-alike Origin with 403 and does nothing", async () => {
    const h = harness();
    for (const origin of ["https://evil.example", "https://entrepreneuria.io.evil.example", "http://entrepreneuria.io"]) {
      const res = await handleInquiry(req(payload(), { origin }), h.deps);
      assert.equal(res.status, 403);
    }
    const noOrigin = new Request(`${ORIGIN}/api/services/websites/inquiry`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.7" },
      body: JSON.stringify(payload()),
    });
    assert.equal((await handleInquiry(noOrigin, h.deps)).status, 403);
    assert.equal(h.crm.leads.length, 0);
  });

  it("refuses a non-JSON content type with 415", async () => {
    const h = harness();
    const res = await handleInquiry(req(payload(), { "content-type": "text/plain" }), h.deps);
    assert.equal(res.status, 415);
    assert.equal(h.crm.leads.length, 0);
  });

  it("refuses an oversized body with 413 before parsing, declared or streamed", async () => {
    const h = harness();
    const big = JSON.stringify(payload({}, { message: "x".repeat(MAX_BODY_BYTES) }));
    const declared = await handleInquiry(req(null, { "content-length": String(big.length) }, { raw: big }), h.deps);
    assert.equal(declared.status, 413);

    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        c.enqueue(new TextEncoder().encode("x".repeat(4096)));
      },
    });
    const streamed = new Request(`${ORIGIN}/api/services/websites/inquiry`, {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": "198.51.100.7" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    assert.equal((await handleInquiry(streamed, h.deps)).status, 413);
    assert.equal(h.crm.leads.length, 0);
  });

  it("refuses malformed JSON, unknown keys and invalid fields with 400", async () => {
    const h = harness();
    assert.equal((await handleInquiry(req(null, {}, { raw: "{not json" }), h.deps)).status, 400);
    assert.equal((await handleInquiry(req({ ...payload(), extra: 1 }), h.deps)).status, 400);
    assert.equal((await handleInquiry(req(payload({}, { email: "not-an-email" })), h.deps)).status, 400);
    assert.equal((await handleInquiry(req(payload({}, { style_interest: "brutalist" })), h.deps)).status, 400);
    assert.equal(h.crm.leads.length, 0);
  });

  it("Turnstile is mandatory: a missing, wrong or erroring token is refused, never waved through", async () => {
    const h = harness();
    const none = await handleInquiry(req(payload({ turnstile_token: undefined })), h.deps);
    assert.deepEqual(none.body, { ok: false, error: "verification_failed" });
    const wrong = await handleInquiry(req(payload({ turnstile_token: "bad" })), h.deps);
    assert.equal(wrong.status, 400);
    assert.equal(h.crm.leads.length, 0);

    const broken = harness({
      turnstile: async () => {
        throw new Error("siteverify unreachable");
      },
    });
    const res = await handleInquiry(req(payload()), broken.deps);
    assert.equal(res.status, 400);
    assert.equal(broken.crm.leads.length, 0);
  });

  it("alerts after repeated Turnstile service failures, not for ordinary failed challenges", async () => {
    const h = harness({
      turnstile: async () => {
        throw new Error("siteverify unreachable");
      },
    });
    for (let i = 0; i < 3; i++) await handleInquiry(req(payload(), { "x-forwarded-for": `198.51.100.${10 + i}` }), h.deps);
    await h.flush();
    assert.equal(h.alerts.length, 1);
    assert.equal((JSON.parse(h.alerts[0].body) as AlertPayload).event, "turnstile_unavailable");

    const plain = harness();
    for (let i = 0; i < 4; i++) await handleInquiry(req(payload({ turnstile_token: "bad" }), { "x-forwarded-for": `198.51.100.${20 + i}` }), plain.deps);
    await plain.flush();
    assert.equal(plain.alerts.length, 0);
  });

  it("honeypot hits look successful and do nothing", async () => {
    const h = harness();
    const res = await handleInquiry(req(payload({ hp: "gotcha" })), h.deps);
    ok(res);
    assert.equal(h.crm.leads.length, 0);
    assert.equal(h.crm.countCalls, 0);
  });

  it("rate limits per client IP: the sixth request in the window gets 429 with Retry-After", async () => {
    const h = harness();
    for (let i = 0; i < 5; i++) ok(await handleInquiry(req(payload()), h.deps));
    const sixth = await handleInquiry(req(payload()), h.deps);
    assert.equal(sixth.status, 429);
    assert.ok(Number(sixth.headers["Retry-After"]) > 0);
  });

  it("a spoofed leftmost X-Forwarded-For cannot evade the per-IP limit", async () => {
    const h = harness();
    for (let i = 0; i < 5; i++) {
      ok(await handleInquiry(req(payload(), { "x-forwarded-for": `10.0.0.${i}, 198.51.100.7` }), h.deps));
    }
    const sixth = await handleInquiry(req(payload(), { "x-forwarded-for": "10.9.9.9, 198.51.100.7" }), h.deps);
    assert.equal(sixth.status, 429);
  });

  it("different real IPs get separate budgets", async () => {
    const h = harness({ env: validLeadsEnv({ WEBSITES_PREVIEW_MAX_OPEN_REQUESTS: "100" }) });
    for (let i = 0; i < 5; i++) ok(await handleInquiry(req(payload()), h.deps));
    ok(await handleInquiry(req(payload(), { "x-forwarded-for": "203.0.113.50" }), h.deps));
  });

  it("rate limits per email: the fourth request with one address gets 429", async () => {
    const h = harness();
    const email = "same@example.com";
    for (let i = 0; i < 3; i++) ok(await handleInquiry(req(payload({}, { email }), { "x-forwarded-for": `203.0.113.${i + 1}` }), h.deps));
    assert.equal((await handleInquiry(req(payload({}, { email }), { "x-forwarded-for": "203.0.113.99" }), h.deps)).status, 429);
  });

  it("an unresolvable client IP shares one rate-limit bucket (fail closed) and raises a config alert", async () => {
    const h = harness();
    const noIp = () => new Request(`${ORIGIN}/api/services/websites/inquiry`, {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify(payload()),
    });
    for (let i = 0; i < 5; i++) ok(await handleInquiry(noIp(), h.deps));
    assert.equal((await handleInquiry(noIp(), h.deps)).status, 429);
    await h.flush();
    assert.ok(h.alerts.some((a) => (JSON.parse(a.body) as AlertPayload).event === "config_invalid"));
  });

  it("a global ceiling stops a distributed flood that passed the bot check", async () => {
    const h = harness({ env: validLeadsEnv({ WEBSITES_PREVIEW_MAX_OPEN_REQUESTS: "100" }) });
    let blocked = 0;
    for (let i = 0; i < 45; i++) {
      const r = await handleInquiry(req(payload(), { "x-forwarded-for": `203.0.${Math.floor(i / 200)}.${(i % 200) + 1}` }), h.deps);
      if (r.status === 429) blocked += 1;
    }
    assert.equal(blocked, 5);
    assert.equal(h.crm.leads.length, 40);
  });

  it("the global ceiling is not spent by requests that fail Turnstile", async () => {
    const h = harness();
    for (let i = 0; i < 60; i++) {
      await handleInquiry(req(payload({ turnstile_token: "bad" }), { "x-forwarded-for": `198.18.${Math.floor(i / 200)}.${(i % 200) + 1}` }), h.deps);
    }
    ok(await handleInquiry(req(payload(), { "x-forwarded-for": "203.0.113.200" }), h.deps));
  });
});

describe("leads intake: capacity and paused state", () => {
  it("at the limit of five open requests the sixth is refused honestly and nothing reaches the CRM", async () => {
    const crm = fakeCrm();
    crm.open = 5;
    const h = harness({ crm });
    const res = await handleInquiry(req(payload()), h.deps);
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { ok: false, error: "capacity", reason: "full" });
    assert.equal(crm.leads.length, 0);
  });

  it("below the limit requests are accepted until the optimistic count reaches it", async () => {
    const crm = fakeCrm();
    crm.open = 3;
    const h = harness({ crm });
    ok(await handleInquiry(req(payload()), h.deps));
    ok(await handleInquiry(req(payload(), { "x-forwarded-for": "203.0.113.2" }), h.deps));
    const third = await handleInquiry(req(payload(), { "x-forwarded-for": "203.0.113.3" }), h.deps);
    assert.equal(third.status, 503);
    assert.equal(crm.leads.length, 2);
  });

  it("paused refuses everything without counting or syncing", async () => {
    const h = harness({ env: validLeadsEnv({ WEBSITES_PREVIEW_INTAKE: "paused" }) });
    const res = await handleInquiry(req(payload()), h.deps);
    assert.deepEqual(res.body, { ok: false, error: "capacity", reason: "paused" });
    assert.equal(h.crm.countCalls, 0);
    assert.equal(h.crm.leads.length, 0);
  });

  it("the limit is configurable without a code change", async () => {
    const crm = fakeCrm();
    crm.open = 5;
    const h = harness({ crm, env: validLeadsEnv({ WEBSITES_PREVIEW_MAX_OPEN_REQUESTS: "8" }) });
    ok(await handleInquiry(req(payload()), h.deps));
  });

  it("bots do not consume capacity: a failed challenge never reaches the count", async () => {
    const h = harness();
    await handleInquiry(req(payload({ turnstile_token: "bad" })), h.deps);
    assert.equal(h.crm.countCalls, 0);
  });

  it("when the count is unavailable the lead is accepted and an alert is raised", async () => {
    const crm = fakeCrm();
    crm.countFails = true;
    const h = harness({ crm });
    const res = await handleInquiry(req(payload()), h.deps);
    await h.flush();
    ok(res);
    assert.equal(crm.leads.length, 1);
    assert.equal(h.alerts.length, 1);
    assert.equal((JSON.parse(h.alerts[0].body) as AlertPayload).event, "capacity_count_unavailable");
  });
});

describe("leads intake: failures are visible and alerted", () => {
  it("a CRM failure returns a retryable 502 and sends one signed alert with no personal data", async () => {
    const crm = fakeCrm();
    crm.failWith = new GhlError("down", "opportunity", 503, true, "ct_secret_id");
    const h = harness({ crm });
    const email = "private.person@example.com";
    const res = await handleInquiry(req(payload({}, { email, name: "Private Person", message: "my secret message" })), h.deps);
    await h.flush();
    assert.equal(res.status, 502);
    assert.deepEqual(res.body, { ok: false, error: "delivery_failed", retryable: true });

    assert.equal(h.alerts.length, 1);
    const { body, headers, url } = h.alerts[0];
    assert.equal(url, "https://alerts.example.test/hook");
    const p = JSON.parse(body) as AlertPayload;
    assert.equal(p.event, "delivery_failed");
    assert.equal(p.step, "opportunity");
    assert.equal(p.status, "503");
    assert.ok(!/private|secret|example\.com|ct_secret_id|Person/i.test(body), "alert must not carry personal data or ids");
    assert.equal(
      verifyAlertSignature({
        body,
        timestamp: headers["x-websites-alert-timestamp"],
        signature: headers["x-websites-alert-signature"],
        secret: SECRET,
        nowMs: Date.parse("2026-11-09T12:00:00.000Z"),
      }),
      true
    );
  });

  it("GHL 401 and 403 alert immediately as auth failures", async () => {
    for (const status of [401, 403]) {
      const crm = fakeCrm();
      crm.failWith = new GhlError("denied", "contact", status, false, undefined, { outcome: "rejected" });
      const h = harness({ crm });
      await handleInquiry(req(payload()), h.deps);
      await h.flush();
      assert.equal(h.alerts.length, 1);
      assert.equal((JSON.parse(h.alerts[0].body) as AlertPayload).event, "ghl_auth_failed");
    }
  });

  it("repeated GHL 429s alert only after the threshold", async () => {
    const crm = fakeCrm();
    crm.failWith = new GhlError("limited", "contact", 429, true, undefined, { outcome: "rejected" });
    const h = harness({ crm });
    for (let i = 0; i < 2; i++) await handleInquiry(req(payload(), { "x-forwarded-for": `203.0.113.${i + 1}` }), h.deps);
    await h.flush();
    assert.equal(h.alerts.length, 0);
    await handleInquiry(req(payload(), { "x-forwarded-for": "203.0.113.9" }), h.deps);
    await h.flush();
    assert.equal(h.alerts.length, 1);
  });

  it("a receiver outage never changes the visitor's result", async () => {
    const crm = fakeCrm();
    crm.failWith = new GhlError("down", "note", 503, true);
    const h = harness({ crm, alertStatus: 500 });
    const res = await handleInquiry(req(payload()), h.deps);
    await h.flush();
    assert.equal(res.status, 502);
  });

  it("no CRM adapter while the mode is on is an explicit 503 plus an alert, not a silent success", async () => {
    const h = harness({ crm: null });
    const res = await handleInquiry(req(payload()), h.deps);
    await h.flush();
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { ok: false, error: "unavailable" });
    assert.equal((JSON.parse(h.alerts[0].body) as AlertPayload).event, "unavailable");
  });

  it("alert delivery is scheduled after the response, not awaited inside it", async () => {
    const crm = fakeCrm();
    crm.failWith = new GhlError("down", "note", 503, true);
    const h = harness({ crm });
    await handleInquiry(req(payload()), h.deps);
    assert.ok(h.pending.length >= 1);
  });
});

describe("existing modes are unchanged", () => {
  const legacyEnv = { WEBSITES_SERVICES_MODE: "nonproduction" };

  it("nonproduction needs no Origin, uses the store hook and the pre-existing limiter", async () => {
    const h = harness({ env: legacyEnv });
    let storeAsked = 0;
    h.deps.getStore = () => {
      storeAsked += 1;
      return null;
    };
    const noOrigin = new Request(`${ORIGIN}/api/services/websites/inquiry`, {
      method: "POST",
      headers: { "x-forwarded-for": "198.51.100.7" },
      body: JSON.stringify(payload({ turnstile_token: undefined })),
    });
    const res = await handleInquiry(noOrigin, h.deps);
    ok(res);
    assert.equal(storeAsked, 1);
    assert.equal(h.crm.leads.length, 1);
    // No capacity count, no leads alerting, page_url is the client's own value as before.
    assert.equal(h.crm.countCalls, 0);
    assert.equal(h.crm.leads[0].customFields.consent_page_url, "https://evil.example/not-our-page");
  });

  it("nonproduction still returns 413 for a body over the cap", async () => {
    const h = harness({ env: legacyEnv });
    const res = await handleInquiry(req(null, {}, { raw: "x".repeat(MAX_BODY_BYTES + 1) }), h.deps);
    assert.equal(res.status, 413);
  });

  it("production with closed gates is refused (404), exactly as before", async () => {
    const h = harness({ env: { WEBSITES_SERVICES_MODE: "production", WEBSITES_OWNER_RELEASE_AUTHORIZED: "true" } });
    assert.equal((await handleInquiry(req(payload()), h.deps)).status, 404);
  });
});

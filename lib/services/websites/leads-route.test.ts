import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GhlError } from "../../integrations/ghl/client";

import { verifyAlertSignature, type AlertPayload } from "./alerts";
import { MAX_INQUIRY_BODY_BYTES } from "./inquiry-route";
import { fakeCrm, harness, HOST, NOW, ORIGIN, payload, req, SECRET, STAGING, stagingReq, validLeadsEnv } from "./leads.test-helper";
import { createTurnstileVerifier } from "./turnstile";

const ok = (r: { status: number }) => assert.equal(r.status, 200);
const events = (h: { alerts: Array<{ body: string }> }) => h.alerts.map((a) => (JSON.parse(a.body) as AlertPayload).event);

describe("leads intake: happy path", () => {
  it("accepts a valid request and syncs once to the CRM", async () => {
    const h = harness();
    const res = await h.send(req(payload()));
    await h.flush();
    ok(res);
    assert.deepEqual(res.body, { ok: true, state: "received", reference: null });
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(h.crm.leads.length, 1);
    assert.equal(h.crm.leads[0].customFields.consent_page_url, `${ORIGIN}/services/websites`);
    assert.equal(h.alerts.length, 0, "no alert on success");
  });

  it("no SMS: text requests and SMS consent are refused and the consent tag is never added", async () => {
    const h = harness();
    assert.equal((await h.send(req(payload({}, { contact_method: "text", phone: "404-555-0100" })))).status, 400);
    assert.equal((await h.send(req(payload({}, { sms_consent: true, phone: "404-555-0100" })))).status, 400);
    assert.equal(h.crm.leads.length, 0);

    ok(await h.send(req(payload())));
    assert.ok(!h.crm.leads[0].tags.includes("sms-consent"));
    assert.deepEqual(h.crm.leads[0].newContactTags, []);
  });

  it("no payment surface: nothing in the response involves billing, even with sandbox payments requested", async () => {
    const h = harness({ env: validLeadsEnv({ WEBSITES_PAYMENTS_MODE: "sandbox" }) });
    const res = await h.send(req(payload()));
    ok(res);
    assert.ok(!/stripe|invoice|checkout|payment/i.test(JSON.stringify(res.body)));
  });
});

describe("leads intake: request validation and abuse protection", () => {
  it("refuses a wrong, missing or look-alike Origin with 403 and does nothing", async () => {
    const h = harness();
    for (const origin of ["https://evil.example", `https://${HOST}.evil.example`, `http://${HOST}`]) {
      assert.equal((await h.send(req(payload(), { origin }))).status, 403);
    }
    const noOrigin = new Request(`${ORIGIN}/api/services/websites/inquiry`, {
      method: "POST",
      headers: { host: HOST, "content-type": "application/json", "x-real-ip": "198.51.100.7" },
      body: JSON.stringify(payload()),
    });
    assert.equal((await h.send(noOrigin)).status, 403);
    assert.equal(h.crm.leads.length, 0);
    assert.equal(h.siteverify.calls, 0);
  });

  it("refuses a non-JSON content type with 415", async () => {
    const h = harness();
    assert.equal((await h.send(req(payload(), { "content-type": "text/plain" }))).status, 415);
    assert.equal(h.crm.leads.length, 0);
  });

  it("refuses an oversized body with 413, declared or streamed, before parsing", async () => {
    const h = harness();
    const big = JSON.stringify(payload({}, { message: "x".repeat(MAX_INQUIRY_BODY_BYTES) }));
    assert.equal((await h.send(req(null, { "content-length": String(big.length) }, { raw: big }))).status, 413);

    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        c.enqueue(new TextEncoder().encode("x".repeat(4096)));
      },
    });
    const streamed = new Request(`${ORIGIN}/api/services/websites/inquiry`, {
      method: "POST",
      headers: { host: HOST, origin: ORIGIN, "content-type": "application/json", "x-real-ip": "198.51.100.7" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    assert.equal((await h.send(streamed)).status, 413);
    assert.equal(h.crm.leads.length, 0);
  });

  it("refuses malformed JSON, unknown keys, invalid fields and a forged page_url with 400", async () => {
    const h = harness();
    assert.equal((await h.send(req(null, {}, { raw: "{not json" }))).status, 400);
    assert.equal((await h.send(req({ ...payload(), extra: 1 }))).status, 400);
    assert.equal((await h.send(req(payload({}, { email: "not-an-email" })))).status, 400);
    assert.equal((await h.send(req(payload({}, { style_interest: "brutalist" })))).status, 400);
    const forged = await h.send(req(payload({ page_url: "https://evil.example/services/websites" })));
    assert.equal(forged.status, 400);
    assert.deepEqual(forged.body.fieldErrors, { page_url: ["Invalid page address."] });
    assert.equal(h.crm.leads.length, 0);
  });

  it("Turnstile is mandatory: a missing, wrong or unreachable check is refused, never waved through", async () => {
    const h = harness();
    const none = await h.send(req(payload({ turnstile_token: undefined })));
    assert.deepEqual(none.body, { ok: false, error: "verification_failed" });
    assert.equal((await h.send(req(payload({ turnstile_token: "bad" })))).status, 400);
    h.siteverify.failing = true;
    assert.equal((await h.send(req(payload()))).status, 400);
    assert.equal(h.crm.leads.length, 0);
  });

  it("a token issued for another host is refused", async () => {
    const h = harness();
    h.siteverify.hostname = "evil.example";
    assert.equal((await h.send(req(payload()))).status, 400);
    assert.equal(h.crm.leads.length, 0);
  });

  it("alerts after repeated Turnstile service failures, not for ordinary failed challenges", async () => {
    const down = harness();
    down.siteverify.failing = true;
    for (let i = 0; i < 3; i++) await down.send(req(payload(), { "x-real-ip": `198.51.100.${10 + i}` }));
    await down.flush();
    assert.deepEqual(events(down), ["turnstile_unavailable"]);

    const plain = harness();
    for (let i = 0; i < 4; i++) await plain.send(req(payload({ turnstile_token: "bad" }), { "x-real-ip": `198.51.100.${20 + i}` }));
    await plain.flush();
    assert.equal(plain.alerts.length, 0);
  });

  it("the Turnstile verifier reports a service error exactly when the service fails", async () => {
    let errors = 0;
    const make = (fetch: (url: string, init?: RequestInit) => Promise<Response>) =>
      createTurnstileVerifier({ secret: "s", expectedHostname: HOST, fetch, onServiceError: () => errors++ });
    assert.equal(await make(async () => { throw new Error("down"); })("t"), false);
    assert.equal(await make(async () => new Response("", { status: 502 }))("t"), false);
    assert.equal(errors, 2);
    assert.equal(await make(async () => Response.json({ success: false }))("t"), false);
    assert.equal(errors, 2, "a failed challenge is not a service error");
  });

  it("honeypot hits look successful and do nothing", async () => {
    const h = harness();
    ok(await h.send(req(payload({ hp: "gotcha" }))));
    assert.equal(h.crm.leads.length, 0);
    assert.equal(h.crm.countCalls, 0);
    assert.equal(h.siteverify.calls, 0);
  });

  it("rate limits per client address: the sixth request in the window gets 429 with Retry-After", async () => {
    const h = harness();
    for (let i = 0; i < 5; i++) ok(await h.send(req(payload())));
    const sixth = await h.send(req(payload()));
    assert.equal(sixth.status, 429);
    assert.ok(Number(sixth.headers.get("retry-after")) > 0);
  });

  it("a spoofed X-Forwarded-For cannot evade the per-address limit (only the proxy's X-Real-IP counts)", async () => {
    const h = harness();
    for (let i = 0; i < 5; i++) ok(await h.send(req(payload(), { "x-forwarded-for": `10.0.0.${i}, 198.51.100.7` })));
    assert.equal((await h.send(req(payload(), { "x-forwarded-for": "10.9.9.9" }))).status, 429);
  });

  it("different real addresses get separate budgets", async () => {
    const h = harness({ env: validLeadsEnv({ WEBSITES_PREVIEW_MAX_OPEN_REQUESTS: "100" }) });
    for (let i = 0; i < 5; i++) ok(await h.send(req(payload())));
    ok(await h.send(req(payload(), { "x-real-ip": "203.0.113.50" })));
  });

  it("rate limits per email: the fourth request with one address gets 429", async () => {
    const h = harness();
    const email = "same@example.com";
    for (let i = 0; i < 3; i++) ok(await h.send(req(payload({}, { email }), { "x-real-ip": `203.0.113.${i + 1}` })));
    assert.equal((await h.send(req(payload({}, { email }), { "x-real-ip": "203.0.113.99" }))).status, 429);
  });

  it("an unresolvable client address shares one bucket (fail closed) and raises a config alert", async () => {
    const h = harness();
    const noIp = () => req(payload(), { "x-real-ip": "" });
    for (let i = 0; i < 5; i++) ok(await h.send(noIp()));
    assert.equal((await h.send(noIp())).status, 429);
    await h.flush();
    assert.ok(events(h).includes("config_invalid"));
  });

  it("a global ceiling stops a distributed flood that passed the bot check", async () => {
    const h = harness({ env: validLeadsEnv({ WEBSITES_PREVIEW_MAX_OPEN_REQUESTS: "100" }) });
    let blocked = 0;
    for (let i = 0; i < 45; i++) {
      const r = await h.send(req(payload(), { "x-real-ip": `203.0.${Math.floor(i / 200)}.${(i % 200) + 1}` }));
      if (r.status === 429) blocked += 1;
    }
    assert.equal(blocked, 5);
    assert.equal(h.crm.leads.length, 40);
  });

  it("the global ceiling is not spent by requests that fail Turnstile", async () => {
    const h = harness();
    for (let i = 0; i < 60; i++) {
      await h.send(req(payload({ turnstile_token: "bad" }), { "x-real-ip": `198.18.${Math.floor(i / 200)}.${(i % 200) + 1}` }));
    }
    ok(await h.send(req(payload(), { "x-real-ip": "203.0.113.200" })));
  });
});

describe("leads intake: capacity and paused state", () => {
  it("at the limit of five open requests the sixth is refused honestly and nothing reaches the CRM", async () => {
    const crm = fakeCrm();
    crm.open = 5;
    const h = harness({ crm });
    const res = await h.send(req(payload()));
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { ok: false, error: "capacity", reason: "full" });
    assert.equal(crm.leads.length, 0);
  });

  it("below the limit requests are accepted until the optimistic count reaches it", async () => {
    const crm = fakeCrm();
    crm.open = 3;
    const h = harness({ crm });
    ok(await h.send(req(payload())));
    ok(await h.send(req(payload(), { "x-real-ip": "203.0.113.2" })));
    assert.equal((await h.send(req(payload(), { "x-real-ip": "203.0.113.3" }))).status, 503);
    assert.equal(crm.leads.length, 2);
  });

  it("paused refuses everything without counting or syncing", async () => {
    const h = harness({ env: validLeadsEnv({ WEBSITES_PREVIEW_INTAKE: "paused" }) });
    const res = await h.send(req(payload()));
    assert.deepEqual(res.body, { ok: false, error: "capacity", reason: "paused" });
    assert.equal(h.crm.countCalls, 0);
    assert.equal(h.crm.leads.length, 0);
  });

  it("the limit is configurable without a code change", async () => {
    const crm = fakeCrm();
    crm.open = 5;
    ok(await harness({ crm, env: validLeadsEnv({ WEBSITES_PREVIEW_MAX_OPEN_REQUESTS: "8" }) }).send(req(payload())));
  });

  it("bots do not consume capacity: a failed challenge never reaches the count", async () => {
    const h = harness();
    await h.send(req(payload({ turnstile_token: "bad" })));
    assert.equal(h.crm.countCalls, 0);
  });

  it("when the count is unavailable the lead is accepted and an alert is raised", async () => {
    const crm = fakeCrm();
    crm.countFails = true;
    const h = harness({ crm });
    const res = await h.send(req(payload()));
    await h.flush();
    ok(res);
    assert.equal(crm.leads.length, 1);
    assert.deepEqual(events(h), ["capacity_count_unavailable"]);
  });
});

describe("leads intake: failures are visible and alerted", () => {
  it("a CRM failure returns a retryable 502 and sends one signed alert with no personal data", async () => {
    const crm = fakeCrm();
    crm.failWith = new GhlError("down", "opportunity", 503, true, "ct_secret_id");
    const h = harness({ crm });
    const res = await h.send(req(payload({}, { email: "private.person@example.com", name: "Private Person", message: "my secret message" })));
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
        nowMs: NOW.getTime(),
      }),
      true
    );
  });

  it("GHL 401 and 403 alert immediately as auth failures", async () => {
    for (const status of [401, 403]) {
      const crm = fakeCrm();
      crm.failWith = new GhlError("denied", "contact", status, false, undefined, { outcome: "rejected" });
      const h = harness({ crm });
      await h.send(req(payload()));
      await h.flush();
      assert.deepEqual(events(h), ["ghl_auth_failed"]);
    }
  });

  it("repeated GHL 429s alert only after the threshold", async () => {
    const crm = fakeCrm();
    crm.failWith = new GhlError("limited", "contact", 429, true, undefined, { outcome: "rejected" });
    const h = harness({ crm });
    for (let i = 0; i < 2; i++) await h.send(req(payload(), { "x-real-ip": `203.0.113.${i + 1}` }));
    await h.flush();
    assert.equal(h.alerts.length, 0);
    await h.send(req(payload(), { "x-real-ip": "203.0.113.9" }));
    await h.flush();
    assert.deepEqual(events(h), ["ghl_rate_limited"]);
  });

  it("a receiver outage never changes the visitor's result", async () => {
    const crm = fakeCrm();
    crm.failWith = new GhlError("down", "note", 503, true);
    const h = harness({ crm, alertStatus: 500 });
    const res = await h.send(req(payload()));
    await h.flush();
    assert.equal(res.status, 502);
  });

  it("no CRM adapter while the mode is on is an explicit 503 plus an alert, not a silent success", async () => {
    const h = harness({ crm: null });
    const res = await h.send(req(payload()));
    await h.flush();
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { ok: false, error: "unavailable" });
    assert.deepEqual(events(h), ["unavailable"]);
  });

  it("alert delivery is scheduled after the response, not awaited inside it", async () => {
    const crm = fakeCrm();
    crm.failWith = new GhlError("down", "note", 503, true);
    const h = harness({ crm });
    await h.send(req(payload()));
    assert.ok(h.pending.length >= 1);
  });

  it("a missing alert receiver would keep the mode off, so no lead path exists without a way to hear about failures", async () => {
    const h = harness({ env: validLeadsEnv({ WEBSITES_ALERT_WEBHOOK_SECRET: undefined }) });
    assert.equal((await h.send(req(payload()))).status, 404);
  });
});

describe("existing modes are unchanged", () => {
  const legacyEnv = { ...validLeadsEnv(), WEBSITES_SERVICES_MODE: "nonproduction", WEBSITES_NONPRODUCTION_HOSTS: STAGING };
  const legacyPayload = () => payload({ page_url: `https://${STAGING}/services/websites` });

  it("nonproduction needs no Origin and still takes the pre-existing path (store consulted, no leads checks)", async () => {
    const h = harness({ env: legacyEnv });
    let storeAsked = 0;
    h.deps.getStore = () => {
      storeAsked += 1;
      return null;
    };
    // No Origin header and a non-JSON content type: both would be refused in leads mode.
    const res = await h.send(stagingReq(legacyPayload(), { "content-type": "text/plain" }, { noOrigin: true }));
    ok(res);
    assert.equal(storeAsked, 1);
    assert.equal(h.crm.leads.length, 1);
    assert.equal(h.crm.countCalls, 0, "no capacity count outside leads mode");
    assert.equal(h.alerts.length, 0, "no leads alerting outside leads mode");
  });

  it("nonproduction still returns 413 for a body over the cap", async () => {
    const h = harness({ env: legacyEnv });
    const res = await h.send(stagingReq(null, {}, { raw: "x".repeat(MAX_INQUIRY_BODY_BYTES + 1) }));
    assert.equal(res.status, 413);
  });

  it("production with closed gates is refused (404), exactly as before", async () => {
    const h = harness({ env: { ...validLeadsEnv(), WEBSITES_SERVICES_MODE: "production", WEBSITES_OWNER_RELEASE_AUTHORIZED: "true" } });
    assert.equal((await h.send(req(payload()))).status, 404);
  });
});

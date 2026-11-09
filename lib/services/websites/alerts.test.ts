import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALERT_SIGNATURE_HEADER,
  ALERT_TIMESTAMP_HEADER,
  buildAlertPayload,
  createAlerter,
  signAlert,
  verifyAlertSignature,
  type AlertPayload,
} from "./alerts";

const SECRET = "k".repeat(40);

function rig(over: { status?: number | (() => number); fail?: boolean; dedupeWindowMs?: number } = {}) {
  let t = Date.parse("2026-11-09T12:00:00.000Z");
  const sent: Array<{ headers: Record<string, string>; body: string }> = [];
  let attempts = 0;
  const alerter = createAlerter({
    url: "https://alerts.example.test/hook",
    secret: SECRET,
    environment: "test",
    now: () => new Date(t),
    sleep: async () => {},
    dedupeWindowMs: over.dedupeWindowMs,
    log: () => {},
    fetch: async (_url, init) => {
      attempts += 1;
      if (over.fail) throw new Error("network down");
      const status = typeof over.status === "function" ? over.status() : (over.status ?? 200);
      sent.push({ headers: init!.headers as Record<string, string>, body: String(init!.body) });
      return new Response("", { status });
    },
  });
  return { alerter, sent, attempts: () => attempts, advance: (ms: number) => (t += ms), nowMs: () => t };
}

describe("alert payload allowlist", () => {
  const meta = { count: 2, environment: "test", firstSeen: new Date("2026-11-09T12:00:00Z"), lastSeen: new Date("2026-11-09T12:01:00Z") };

  it("contains exactly the allowlisted keys", () => {
    const p = buildAlertPayload({ event: "delivery_failed", step: "opportunity", status: 503 }, meta);
    assert.deepEqual(Object.keys(p).sort(), ["count", "environment", "event", "first_seen", "last_seen", "status", "step"]);
    assert.equal(p.step, "opportunity");
    assert.equal(p.status, "503");
  });

  it("drops anything that could carry personal data, even if a caller passes it", () => {
    const p = buildAlertPayload(
      { event: "delivery_failed", step: "dana@example.com", status: "GHL 400: phone +14045550100 rejected for Dana Reyes" },
      meta
    );
    const text = JSON.stringify(p);
    assert.equal(p.step, "none");
    assert.equal(p.status, "none");
    assert.ok(!/example\.com|Dana|Reyes|\+1404/.test(text));
  });
});

describe("signing and verification", () => {
  const body = JSON.stringify({ event: "test" });
  const ts = 1_800_000_000;
  const sig = signAlert(body, SECRET, ts);
  const nowMs = ts * 1000 + 1000;

  it("a correct signature within the window verifies", () => {
    assert.ok(sig.startsWith("v1="));
    assert.equal(verifyAlertSignature({ body, timestamp: String(ts), signature: sig, secret: SECRET, nowMs }), true);
  });

  it("rejects a tampered body, a wrong secret, a bad signature and missing headers", () => {
    assert.equal(verifyAlertSignature({ body: body + " ", timestamp: String(ts), signature: sig, secret: SECRET, nowMs }), false);
    assert.equal(verifyAlertSignature({ body, timestamp: String(ts), signature: sig, secret: "z".repeat(40), nowMs }), false);
    assert.equal(verifyAlertSignature({ body, timestamp: String(ts), signature: "v1=00", secret: SECRET, nowMs }), false);
    assert.equal(verifyAlertSignature({ body, timestamp: null, signature: sig, secret: SECRET, nowMs }), false);
    assert.equal(verifyAlertSignature({ body, timestamp: String(ts), signature: null, secret: SECRET, nowMs }), false);
  });

  it("rejects a stale or future timestamp, and a replay with a changed timestamp", () => {
    assert.equal(verifyAlertSignature({ body, timestamp: String(ts), signature: sig, secret: SECRET, nowMs: ts * 1000 + 301_000 }), false);
    assert.equal(verifyAlertSignature({ body, timestamp: String(ts), signature: sig, secret: SECRET, nowMs: ts * 1000 - 301_000 }), false);
    assert.equal(verifyAlertSignature({ body, timestamp: String(ts + 10), signature: sig, secret: SECRET, nowMs }), false);
    assert.equal(verifyAlertSignature({ body, timestamp: "12abc", signature: sig, secret: SECRET, nowMs }), false);
  });
});

describe("alerter delivery", () => {
  it("sends a signed alert that the receiver can verify, with the documented headers", async () => {
    const r = rig();
    r.alerter.raise({ event: "ghl_auth_failed", step: "contact", status: 401 });
    await r.alerter.settled();
    assert.equal(r.sent.length, 1);
    const { headers, body } = r.sent[0];
    const payload = JSON.parse(body) as AlertPayload;
    assert.equal(payload.event, "ghl_auth_failed");
    assert.equal(payload.count, 1);
    assert.equal(payload.environment, "test");
    assert.equal(
      verifyAlertSignature({
        body,
        timestamp: headers[ALERT_TIMESTAMP_HEADER],
        signature: headers[ALERT_SIGNATURE_HEADER],
        secret: SECRET,
        nowMs: r.nowMs(),
      }),
      true
    );
  });

  it("deduplicates repeats inside the window, then reports the accumulated count after it", async () => {
    const r = rig({ dedupeWindowMs: 60_000 });
    for (let i = 0; i < 4; i++) r.alerter.raise({ event: "delivery_failed", step: "note", status: 502 });
    await r.alerter.settled();
    assert.equal(r.sent.length, 1);
    r.advance(61_000);
    r.alerter.raise({ event: "delivery_failed", step: "note", status: 502 });
    await r.alerter.settled();
    assert.equal(r.sent.length, 2);
    assert.equal((JSON.parse(r.sent[1].body) as AlertPayload).count, 4);
  });

  it("a different step or status is a different alert", async () => {
    const r = rig();
    r.alerter.raise({ event: "delivery_failed", step: "note", status: 502 });
    r.alerter.raise({ event: "delivery_failed", step: "contact", status: 502 });
    await r.alerter.settled();
    assert.equal(r.sent.length, 2);
  });

  it("noisy events need a threshold of three before the first send", async () => {
    const r = rig();
    r.alerter.raise({ event: "ghl_rate_limited", step: "contact", status: 429 });
    r.alerter.raise({ event: "ghl_rate_limited", step: "contact", status: 429 });
    await r.alerter.settled();
    assert.equal(r.sent.length, 0);
    r.alerter.raise({ event: "ghl_rate_limited", step: "contact", status: 429 });
    await r.alerter.settled();
    assert.equal(r.sent.length, 1);
    assert.equal((JSON.parse(r.sent[0].body) as AlertPayload).count, 3);
  });

  it("retries a 5xx a bounded number of times, then gives up quietly", async () => {
    const r = rig({ status: 503 });
    r.alerter.raise({ event: "unavailable" });
    await r.alerter.settled();
    assert.equal(r.attempts(), 3); // one try plus two retries
  });

  it("does not retry a 4xx", async () => {
    const r = rig({ status: 400 });
    r.alerter.raise({ event: "unavailable" });
    await r.alerter.settled();
    assert.equal(r.attempts(), 1);
  });

  it("never throws or rejects when the receiver is unreachable", async () => {
    const r = rig({ fail: true });
    assert.doesNotThrow(() => r.alerter.raise({ event: "unavailable" }));
    await assert.doesNotReject(r.alerter.settled());
    assert.equal(r.attempts(), 3);
  });

  it("raise returns immediately, before delivery finishes", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let delivered = false;
    const alerter = createAlerter({
      url: "https://alerts.example.test/hook",
      secret: SECRET,
      environment: "test",
      fetch: async () => {
        await gate;
        delivered = true;
        return new Response("", { status: 200 });
      },
    });
    alerter.raise({ event: "unavailable" });
    assert.equal(delivered, false);
    release();
    await alerter.settled();
    assert.equal(delivered, true);
  });
});

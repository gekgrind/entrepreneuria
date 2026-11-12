import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALERT_SIGNATURE_HEADER,
  ALERT_TIMESTAMP_HEADER,
  buildAlertPayload,
  createAlerter,
  createReceiverProbe,
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

  it("deduplicates repeats inside the window, then reports the accumulated count once eligible (window + margin)", async () => {
    const r = rig({ dedupeWindowMs: 60_000 });
    for (let i = 0; i < 4; i++) r.alerter.raise({ event: "delivery_failed", step: "note", status: 502 });
    await r.alerter.settled();
    assert.equal(r.sent.length, 1);
    r.advance(60_000 + 60_000 + 1_000);
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

describe("alert receiver readiness probe", () => {
  function probeRig(answer: () => Response | Promise<Response>) {
    let t = 1_000_000;
    const urls: string[] = [];
    const logs: string[] = [];
    const probe = createReceiverProbe({
      alertUrl: "http://127.0.0.1:3105/alerts?x=1",
      nowMs: () => t,
      fetch: async (u) => {
        urls.push(u);
        return answer();
      },
      log: (m) => logs.push(m),
    });
    return { probe, urls, logs, advance: (ms: number) => (t += ms) };
  }

  it("probes GET /health on the receiver's origin and trusts a healthy answer for a minute", async () => {
    const r = probeRig(() => Response.json({ ok: true }));
    assert.equal(await r.probe(), true);
    assert.equal(await r.probe(), true);
    assert.deepEqual(r.urls, ["http://127.0.0.1:3105/health"]);
    r.advance(60_000);
    assert.equal(await r.probe(), true);
    assert.equal(r.urls.length, 2);
  });

  it("an error status, a non-JSON 200, a network error or a timeout all count as not ready", async () => {
    for (const answer of [
      () => new Response("", { status: 503 }),
      () => new Response("<html>ok</html>", { status: 200 }),
      () => Response.json({ ok: false }),
      () => Promise.reject(new TypeError("fetch failed")),
      () => Promise.reject(Object.assign(new Error("timed out"), { name: "TimeoutError" })),
    ]) {
      assert.equal(await probeRig(answer).probe(), false);
    }
  });

  it("re-checks a down receiver after 10 seconds, and logs the transitions without detail", async () => {
    let up = false;
    const r = probeRig(() => (up ? Response.json({ ok: true }) : new Response("", { status: 503 })));
    assert.equal(await r.probe(), false);
    up = true;
    r.advance(5_000);
    assert.equal(await r.probe(), false, "still within the down window");
    r.advance(5_000);
    assert.equal(await r.probe(), true);
    assert.deepEqual(r.logs, ["alert receiver unreachable", "alert receiver reachable again"]);
  });

  it("concurrent callers share one probe", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const r = probeRig(async () => {
      await gate;
      return Response.json({ ok: true });
    });
    const both = Promise.all([r.probe(), r.probe(), r.probe()]);
    release();
    assert.deepEqual(await both, [true, true, true]);
    assert.equal(r.urls.length, 1);
  });
});

describe("alert dedupe trailing flush (P2-6: a repeat is never silently dropped)", () => {
  const W = 15 * 60_000;
  const M = 60_000;
  const EV = { event: "ghl_auth_failed", step: "contact", status: 401 } as const;

  /** Virtual clock, captured timers, and a receiver stub whose "email" takes `latencyMs` of clock time. */
  function flushRig(over: { latencyMs?: number; fail?: boolean } = {}) {
    let t = Date.parse("2026-11-10T12:00:00.000Z");
    const timers: Array<{ fn: () => void; at: number; fired: boolean }> = [];
    const sent: AlertPayload[] = [];
    const logs: Array<[string, Record<string, unknown> | undefined]> = [];
    let hold: Promise<void> | null = null;
    const alerter = createAlerter({
      url: "https://alerts.example.test/hook",
      secret: SECRET,
      environment: "test",
      now: () => new Date(t),
      sleep: async () => {},
      log: (m, meta) => logs.push([m, meta]),
      setTimer: (fn, ms) => timers.push({ fn, at: t + ms, fired: false }),
      fetch: async (_url, init) => {
        if (hold) await hold;
        if (over.fail) throw new Error("network down");
        t += over.latencyMs ?? 0;
        sent.push(JSON.parse(String(init!.body)) as AlertPayload);
        return new Response("", { status: 200 });
      },
    });
    const pending = () => timers.filter((x) => !x.fired);
    return {
      alerter,
      sent,
      logs,
      timers,
      pending,
      now: () => t,
      advance: (ms: number) => (t += ms),
      /** Moves the clock to the earliest pending timer and runs it. */
      async fireNext() {
        const next = pending().sort((a, b) => a.at - b.at)[0];
        assert.ok(next, "a timer is armed");
        t = Math.max(t, next.at);
        next.fired = true;
        next.fn();
        await alerter.settled();
      },
      holdDeliveries() {
        let release!: () => void;
        hold = new Promise<void>((r) => (release = r));
        return () => {
          hold = null;
          release();
        };
      },
    };
  }

  it("a repeat inside the window with no later raise is sent by the timer, with its own count and times", async () => {
    const r = flushRig();
    r.alerter.raise(EV);
    await r.alerter.settled();
    r.advance(5 * 60_000);
    const repeatAt = new Date(r.now()).toISOString();
    r.alerter.raise(EV);
    await r.alerter.settled();
    assert.equal(r.sent.length, 1);
    assert.equal(r.pending().length, 1);
    await r.fireNext();
    assert.equal(r.sent.length, 2);
    assert.equal(r.sent[1].count, 1);
    assert.equal(r.sent[1].first_seen, repeatAt);
    assert.equal(r.sent[1].last_seen, repeatAt);
  });

  it("many suppressed repeats arm one timer and are sent as one batch", async () => {
    const r = flushRig();
    r.alerter.raise(EV);
    await r.alerter.settled();
    for (let i = 0; i < 5; i++) {
      r.advance(60_000);
      r.alerter.raise(EV);
    }
    assert.equal(r.timers.length, 1);
    await r.fireNext();
    assert.equal(r.sent.length, 2);
    assert.equal(r.sent[1].count, 5);
  });

  it("eligibility counts from when the previous delivery FINISHED (email latency), plus the margin", async () => {
    const r = flushRig({ latencyMs: 2_000 });
    const t0 = r.now();
    r.alerter.raise(EV);
    await r.alerter.settled(); // finished at t0 + 2s
    r.advance(60_000);
    r.alerter.raise(EV);
    assert.equal(r.pending()[0].at, t0 + 2_000 + W + M);
  });

  it("a raise after the window but before eligibility waits (receiver cooldown); one after eligibility sends at once", async () => {
    const r = flushRig({ latencyMs: 2_000 });
    const t0 = r.now();
    r.alerter.raise(EV);
    await r.alerter.settled();
    r.advance(W + 500 - 2_000); // t0 + 900.5s: past the app window, inside the receiver cooldown
    r.alerter.raise(EV);
    await r.alerter.settled();
    assert.equal(r.sent.length, 1, "not sent inside the receiver cooldown");
    await r.fireNext();
    assert.equal(r.sent.length, 2);
    assert.ok(r.now() >= t0 + 2_000 + W + M);

    r.advance(W + M + 1);
    r.alerter.raise(EV);
    await r.alerter.settled();
    assert.equal(r.sent.length, 3, "eligible raise sends immediately");
  });

  it("an eligible raise sends the batch and the old timer then finds nothing to send", async () => {
    const r = flushRig();
    r.alerter.raise(EV);
    await r.alerter.settled();
    r.advance(60_000);
    r.alerter.raise(EV); // suppressed, timer armed
    r.advance(W + M); // now eligible
    r.alerter.raise(EV); // sends count 2
    await r.alerter.settled();
    assert.equal(r.sent.length, 2);
    assert.equal(r.sent[1].count, 2);
    await r.fireNext();
    assert.equal(r.sent.length, 2, "no duplicate");
    assert.equal(r.pending().length, 0);
  });

  it("R1 regression: a stale timer re-arms for a newer suppressed repeat instead of stranding it", async () => {
    const r = flushRig();
    r.alerter.raise(EV); // t=0 sent
    await r.alerter.settled();
    r.advance(5 * 60_000);
    r.alerter.raise(EV); // suppressed, timer at 16 min
    const stale = r.pending()[0];
    r.advance(W + M - 5 * 60_000); // t = 16 min: eligible
    r.alerter.raise(EV); // sends the batch before the stale timer fires
    await r.alerter.settled();
    assert.equal(r.sent.length, 2);
    r.advance(1_000);
    r.alerter.raise(EV); // suppressed again; the stale timer is still armed, so no new one
    assert.equal(r.pending().length, 1);
    await r.fireNext(); // stale timer fires early
    assert.equal(r.sent.length, 2, "not eligible yet");
    assert.ok(stale.fired);
    assert.equal(r.pending().length, 1, "re-armed for the current deadline");
    await r.fireNext();
    assert.equal(r.sent.length, 3);
    assert.equal(r.sent[2].count, 1);
  });

  it("an occurrence raised while a delivery is in flight is kept and sent at the next eligibility", async () => {
    const r = flushRig();
    const release = r.holdDeliveries();
    r.alerter.raise(EV);
    r.alerter.raise(EV); // in flight: kept, a timer is armed
    release();
    await r.alerter.settled();
    assert.equal(r.sent.length, 1);
    assert.equal(r.sent[0].count, 1);
    while (r.sent.length < 2 && r.pending().length) await r.fireNext();
    assert.equal(r.sent.length, 2);
    assert.equal(r.sent[1].count, 1);
  });

  it("threshold events: a below-threshold repeat is kept, not flushed; once it reaches 3 it is sent when eligible", async () => {
    const r = flushRig();
    const RL = { event: "ghl_rate_limited", step: "contact", status: 429 } as const;
    for (let i = 0; i < 3; i++) r.alerter.raise(RL);
    await r.alerter.settled();
    assert.equal(r.sent.length, 1);
    r.advance(60_000);
    r.alerter.raise(RL);
    assert.equal(r.pending().length, 0, "below threshold: no timer");
    r.alerter.raise(RL);
    r.alerter.raise(RL);
    assert.equal(r.pending().length, 1);
    await r.fireNext();
    assert.equal(r.sent.length, 2);
    assert.equal(r.sent[1].count, 3);
  });

  it("a failed trailing delivery is logged like any other (event and status only) and never throws", async () => {
    const r = flushRig({ fail: true });
    r.alerter.raise(EV);
    await r.alerter.settled();
    r.alerter.raise(EV);
    await r.fireNext();
    const failures = r.logs.filter(([m]) => m === "alert delivery failed");
    assert.equal(failures.length, 2);
    assert.deepEqual(failures[1][1], { event: "ghl_auth_failed", status: "network" });
  });

  it("the default timer is unref'd so it never keeps the process alive", async (t) => {
    const handles: Array<{ hasRef(): boolean }> = [];
    const real = globalThis.setTimeout;
    t.mock.method(globalThis, "setTimeout", ((fn: () => void, ms: number) => {
      const h = real(fn, ms);
      handles.push(h);
      return h;
    }) as typeof setTimeout);
    const a = createAlerter({
      url: "https://alerts.example.test/hook",
      secret: SECRET,
      environment: "test",
      sleep: async () => {},
      fetch: async () => new Response("", { status: 200 }),
    });
    a.raise(EV);
    await a.settled();
    const before = handles.length;
    a.raise(EV);
    const flushTimer = handles.slice(before).find((h) => !h.hasRef());
    assert.ok(flushTimer, "an unref'd flush timer was created");
    for (const h of handles) clearTimeout(h as unknown as NodeJS.Timeout);
  });
});

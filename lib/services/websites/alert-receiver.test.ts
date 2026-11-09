import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALERT_PATH,
  createMemoryStore,
  handleAlertRequest,
  MAX_BODY_BYTES,
  RECEIVER_EVENTS,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  validateAlert,
  type OutboundEmail,
} from "./alert-receiver";
import { ALERT_EVENTS, ALERT_SIGNATURE_HEADER, ALERT_TIMESTAMP_HEADER, buildAlertPayload, signAlert, type AlertEvent } from "./alerts";

const SECRET = "s".repeat(40);
const NOW = Date.UTC(2026, 10, 9, 22, 0, 0);
const URL_ = `https://hooks.example.test${ALERT_PATH}`;

/** A request exactly as the app's alerter (alerts.ts) would sign it. */
function signed(
  over: { event?: string; step?: string; status?: string; environment?: string; tsOffset?: number; secret?: string; body?: string } = {}
) {
  const payload = buildAlertPayload(
    { event: (over.event ?? "delivery_failed") as AlertEvent, step: over.step ?? "contact", status: over.status ?? "500" },
    { count: 1, environment: over.environment ?? "production", firstSeen: new Date(NOW - 1000), lastSeen: new Date(NOW) }
  );
  const body = over.body ?? JSON.stringify(payload);
  const ts = Math.floor(NOW / 1000) + (over.tsOffset ?? 0);
  return new Request(URL_, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [ALERT_TIMESTAMP_HEADER]: String(ts),
      [ALERT_SIGNATURE_HEADER]: signAlert(body, over.secret ?? SECRET, ts),
    },
    body,
  });
}

function rig(opts: { failSend?: boolean; cap?: number } = {}) {
  let now = NOW;
  const mode = { fail: opts.failSend ?? false };
  const sent: OutboundEmail[] = [];
  const logs: Array<[string, Record<string, unknown> | undefined]> = [];
  const store = createMemoryStore(() => now);
  const handle = (req: Request) =>
    handleAlertRequest(req, {
      config: { secret: SECRET, to: "owner@example.test", from: "alerts@alerts.example.test", hourlyEmailCap: opts.cap },
      store,
      mailer: {
        async send(m) {
          if (mode.fail) throw new Error("smtp down");
          sent.push(m);
        },
      },
      nowMs: () => now,
      log: (msg, meta) => logs.push([msg, meta]),
    });
  return { handle, sent, logs, mode, advance: (ms: number) => (now += ms) };
}

describe("alert receiver: contract with the app's sender", () => {
  it("header names match alerts.ts", () => {
    assert.equal(TIMESTAMP_HEADER, ALERT_TIMESTAMP_HEADER);
    assert.equal(SIGNATURE_HEADER, ALERT_SIGNATURE_HEADER);
  });

  it("accepts every event the sender can raise", async () => {
    for (const event of ALERT_EVENTS) assert.ok((RECEIVER_EVENTS as readonly string[]).includes(event), event);
    const r = rig({ cap: 100 });
    for (const event of ALERT_EVENTS) assert.equal((await r.handle(signed({ event }))).status, 200, event);
    assert.equal(r.sent.length, ALERT_EVENTS.length);
  });

  it("handles the capacity events added with PR #34", async () => {
    const r = rig();
    assert.equal((await r.handle(signed({ event: "capacity_near", step: "capacity", status: "4:5" }))).status, 200);
    assert.equal((await r.handle(signed({ event: "capacity_full", step: "capacity", status: "5:5" }))).status, 200);
    assert.match(r.sent[0].subject, /1 slot left \(4 of 5 open\)/);
    assert.match(r.sent[1].subject, /ACTION: Preview intake is full \(5 of 5\)/);
  });
});

describe("alert receiver: rejects before doing any work", () => {
  it("wrong path 404, wrong method 405", async () => {
    const r = rig();
    assert.equal((await r.handle(new Request("https://hooks.example.test/other", { method: "POST", body: "{}" }))).status, 404);
    assert.equal((await r.handle(new Request(URL_))).status, 405);
  });

  it("oversized body 413 (declared or actual)", async () => {
    const r = rig();
    const big = "x".repeat(MAX_BODY_BYTES + 1);
    assert.equal((await r.handle(new Request(URL_, { method: "POST", body: big }))).status, 413);
  });

  it("bad, missing, wrong-secret, stale or future signatures are 401 and send nothing", async () => {
    const r = rig();
    const noSig = new Request(URL_, { method: "POST", body: "{}" });
    for (const req of [noSig, signed({ secret: "w".repeat(40) }), signed({ tsOffset: -301 }), signed({ tsOffset: 301 })]) {
      assert.equal((await r.handle(req)).status, 401);
    }
    const tampered = signed();
    const body = (await tampered.clone().text()).replace("contact", "opport");
    const forged = new Request(URL_, { method: "POST", headers: tampered.headers, body });
    assert.equal((await r.handle(forged)).status, 401);
    assert.equal(r.sent.length, 0);
    assert.ok(r.logs.every(([, m]) => JSON.stringify(m) === JSON.stringify({ reason: "signature" })));
  });

  it("a validly signed but malformed payload is 400", async () => {
    const r = rig();
    for (const body of ["not json", "[]", JSON.stringify({ event: "test" }), JSON.stringify({ event: "delivery_failed", step: "x", status: "y", count: 1, environment: "p", first_seen: "2026-11-09T22:00:00.000Z", last_seen: "2026-11-09T22:00:00.000Z", email: "a@b.c" })]) {
      assert.equal((await r.handle(signed({ body }))).status, 400, body);
    }
    assert.equal(r.sent.length, 0);
  });
});

describe("alert receiver: no personal data", () => {
  it("rejects payload fields outside the allowlist and values outside the token rule", () => {
    const base = { event: "delivery_failed", step: "contact", status: "500", count: 1, environment: "production", first_seen: "2026-11-09T22:00:00.000Z", last_seen: "2026-11-09T22:00:00.000Z" };
    assert.ok(validateAlert(base));
    assert.equal(validateAlert({ ...base, name: "Dana Reyes" }), null);
    assert.equal(validateAlert({ ...base, step: "dana@example.com" }), null);
    assert.equal(validateAlert({ ...base, status: "Dana Reyes" }), null);
    assert.equal(validateAlert({ ...base, event: "lead_details" }), null);
  });

  it("the email is built only from validated tokens", async () => {
    const r = rig();
    await r.handle(signed());
    const [m] = r.sent;
    assert.equal(m.to, "owner@example.test");
    assert.match(m.subject, /^\[Entrepreneuria Websites\] ACTION: /);
    assert.match(m.text, /never contains visitor details/);
    assert.doesNotMatch(m.text, /@/);
  });

  it("non-production alerts are labelled", async () => {
    const r = rig();
    await r.handle(signed({ event: "test", environment: "staging" }));
    assert.match(r.sent[0].subject, /^\[Entrepreneuria Websites\] \[staging\] Test alert$/);
  });
});

describe("alert receiver: duplicates and abuse", () => {
  it("an identical request replayed inside the window sends once", async () => {
    const r = rig();
    const req = signed();
    assert.equal((await r.handle(req.clone())).status, 200);
    const again = await r.handle(req);
    assert.deepEqual(await again.json(), { ok: true, duplicate: true });
    assert.equal(r.sent.length, 1);
  });

  it("the same alert re-signed later is suppressed for 15 minutes, then sends again", async () => {
    const r = rig();
    await r.handle(signed());
    r.advance(60_000);
    const res = await r.handle(signed({ tsOffset: 60 }));
    assert.deepEqual(await res.json(), { ok: true, suppressed: "cooldown" });
    r.advance(15 * 60_000);
    await r.handle(signed({ tsOffset: 16 * 60 }));
    assert.equal(r.sent.length, 2);
  });

  it("a different status is a different alert", async () => {
    const r = rig();
    await r.handle(signed({ event: "capacity_near", step: "capacity", status: "4:5" }));
    await r.handle(signed({ event: "capacity_full", step: "capacity", status: "5:5" }));
    assert.equal(r.sent.length, 2);
  });

  it("the hourly cap bounds email volume even with valid, distinct alerts", async () => {
    const r = rig({ cap: 3 });
    for (let i = 0; i < 6; i++) await r.handle(signed({ status: String(500 + i) }));
    assert.equal(r.sent.length, 3);
    r.advance(3_600_000);
    await r.handle(signed({ status: "599", tsOffset: 3600 }));
    assert.equal(r.sent.length, 4);
  });

  it("an email failure returns 502 so the sender retries, and the retry sends", async () => {
    const r = rig({ failSend: true });
    const req = signed();
    assert.equal((await r.handle(req.clone())).status, 502);
    assert.ok(r.logs.some(([m, meta]) => m === "email failed" && JSON.stringify(meta) === JSON.stringify({ event: "delivery_failed", error: "Error" })));
    r.mode.fail = false;
    // The sender's retry may carry the same signature (same second) or a new one; both must get through.
    assert.equal((await r.handle(req)).status, 200);
    assert.equal(r.sent.length, 1);
  });
});

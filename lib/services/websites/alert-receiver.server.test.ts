/**
 * End to end with synthetic events, all on loopback:
 *   app alerter (alerts.ts) → HTTP receiver (alert-receiver-server.ts)
 *   → handler (alert-receiver.ts) → SMTP client (smtp-mailer.ts)
 *   → fake SMTP server. No external network.
 */
import assert from "node:assert/strict";
import net from "node:net";
import { after, before, describe, it } from "node:test";

import type { Server } from "node:http";

import { createAlertReceiverServer } from "./alert-receiver-server";
import { ALERT_SIGNATURE_HEADER, ALERT_TIMESTAMP_HEADER, buildAlertPayload, createAlerter, createReceiverProbe, signAlert, type AlertEvent } from "./alerts";
import { parseAlertWebhookUrl } from "./leads-config";
import { createSmtpMailer } from "./smtp-mailer";

const SECRET = "k".repeat(48);

/** Minimal SMTP sink: accepts everything, records decoded messages. */
function smtpSink() {
  const messages: Array<{ subject: string; body: string }> = [];
  let failNext = 0;
  const server = net.createServer((sock) => {
    let buf = "";
    let data: string | null = null;
    const say = (s: string) => sock.write(`${s}\r\n`);
    say("220 sink");
    sock.on("data", (c) => {
      buf += c.toString();
      let i: number;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (data !== null) {
          if (line === ".") {
            const [head, body] = data.split("\r\n\r\n");
            messages.push({
              subject: /^Subject: (.*)$/m.exec(head)![1].replace(/\r$/, ""),
              body: Buffer.from(body.replace(/\r\n/g, ""), "base64").toString(),
            });
            data = null;
            say("250 ok");
          } else data += `${line}\r\n`;
          continue;
        }
        const up = line.toUpperCase();
        if (up.startsWith("EHLO")) say("250-sink\r\n250 AUTH PLAIN");
        else if (up.startsWith("AUTH")) {
          if (failNext > 0) {
            failNext--;
            say("454 try later");
          } else say("235 ok");
        } else if (up === "DATA") {
          data = "";
          say("354 go");
        } else if (up === "QUIT") {
          say("221 bye");
          sock.end();
        } else say("250 ok");
      }
    });
    sock.on("error", () => {});
  });
  return {
    messages,
    failAuth: (n: number) => (failNext = n),
    start: () => new Promise<number>((r) => server.listen(0, "127.0.0.1", () => r((server.address() as net.AddressInfo).port))),
    stop: () => new Promise<void>((r) => server.close(() => r())),
  };
}

const sink = smtpSink();
let receiver: Server;
let url = "";
let smtpPort = 0;

before(async () => {
  smtpPort = await sink.start();
  receiver = createAlertReceiverServer({
    port: 0,
    config: { secret: SECRET, to: "owner@example.test", from: "owner@example.test", hourlyEmailCap: 50 },
    mailer: createSmtpMailer({ host: "127.0.0.1", port: smtpPort, security: "none", auth: "password", user: "owner@example.test", pass: "app-pass" }),
  });
  await new Promise<void>((r) => receiver.once("listening", () => r()));
  url = `http://127.0.0.1:${(receiver.address() as net.AddressInfo).port}/alerts`;
});
after(async () => {
  await new Promise<void>((r) => receiver.close(() => r()));
  await sink.stop();
});

const alerter = (secret = SECRET) => createAlerter({ url, secret, environment: "production", sleep: async () => {} });

/** A review notice exactly as the app sends it (returning-contacts PR: alerter.notify), signed with alerts.ts. */
async function postReviewNotice(ref: string): Promise<number> {
  const t = new Date();
  const body = JSON.stringify(
    buildAlertPayload({ event: "returning_contact_review" as AlertEvent, step: "review", status: ref }, { count: 1, environment: "production", firstSeen: t, lastSeen: t })
  );
  const ts = Math.floor(t.getTime() / 1000);
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", [ALERT_TIMESTAMP_HEADER]: String(ts), [ALERT_SIGNATURE_HEADER]: signAlert(body, SECRET, ts) },
    body,
  });
  return res.status;
}

describe("alert pipeline over loopback HTTP and SMTP (synthetic events)", () => {
  it("the app accepts a loopback http receiver URL, and only loopback", () => {
    assert.ok(parseAlertWebhookUrl(url));
    assert.equal(parseAlertWebhookUrl("http://hooks.example.test/alerts"), null);
    assert.equal(parseAlertWebhookUrl("http://user:pw@127.0.0.1:3105/alerts"), null);
    assert.ok(parseAlertWebhookUrl("https://hooks.example.test/alerts"));
  });

  it("delivers lead-intake failures, capacity warnings and a returning-contact notice as emails", async () => {
    const before = sink.messages.length;
    const a = alerter();
    a.raise({ event: "delivery_failed", step: "opportunity", status: 502 });
    a.raise({ event: "ghl_auth_failed", step: "contact", status: 401 });
    a.raise({ event: "capacity_near" as AlertEvent, step: "capacity", status: "4:5" });
    a.raise({ event: "capacity_full" as AlertEvent, step: "capacity", status: "5:5" });
    const reviewStatus = await postReviewNotice("r-0123456789abcdef");
    await a.settled();
    assert.equal(reviewStatus, 200, "accepted: the app marks the record notified");
    const subjects = sink.messages.slice(before).map((m) => m.subject).sort();
    assert.deepEqual(subjects, [
      "[Entrepreneuria Websites] ACTION: A preview request could not be delivered to GoHighLevel",
      "[Entrepreneuria Websites] ACTION: GoHighLevel rejected the API credentials: preview requests are failing",
      "[Entrepreneuria Websites] ACTION: Preview intake is full (5 of 5)",
      "[Entrepreneuria Websites] ACTION: Preview request needs manual review (r-0123456789abcdef)",
      "[Entrepreneuria Websites] Preview intake: 1 slot left (4 of 5 open)",
    ]);
    for (const m of sink.messages.slice(before)) assert.match(m.body, /never contains visitor details/);
  });

  it("a wrong secret is refused and nothing is emailed", async () => {
    const before = sink.messages.length;
    const rogue = alerter("x".repeat(48));
    rogue.raise({ event: "test" });
    await rogue.settled();
    assert.equal(sink.messages.length, before);
  });

  it("an SMTP failure makes the receiver answer 5xx, the app retries, and the retry is delivered once", async () => {
    const before = sink.messages.length;
    sink.failAuth(1);
    const a = alerter();
    a.raise({ event: "unavailable", step: "config", status: "smtp-retry" });
    await a.settled();
    assert.equal(sink.messages.length - before, 1);
  });

  it("a review notice that can't be emailed gets a 5xx (the app keeps the record pending and re-sends)", async () => {
    sink.failAuth(1);
    assert.equal(await postReviewNotice("r-ffffffffffffffff"), 502);
    assert.equal(await postReviewNotice("r-ffffffffffffffff"), 200, "the re-send goes through");
  });

  it("only POST /alerts and GET /health are served", async () => {
    assert.equal((await fetch(url.replace("/alerts", "/other"), { method: "POST", body: "{}" })).status, 404);
    assert.equal((await fetch(url)).status, 405);
    const health = await fetch(url.replace("/alerts", "/health"));
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });
    assert.equal((await fetch(url.replace("/alerts", "/health"), { method: "POST", body: "{}" })).status, 404);
  });

  it("P2-6: a repeat raised inside the receiver's cooldown is emailed later as one batch, never cooldown-suppressed (real receiver, 2 s email latency)", async () => {
    let vt = Date.now(); // one virtual clock for app and receiver (same server in production)
    const receiverLogs: string[] = [];
    const smtp = createSmtpMailer({ host: "127.0.0.1", port: smtpPort, security: "none", auth: "password", user: "owner@example.test", pass: "app-pass" });
    const slowMailer: typeof smtp = {
      ...smtp,
      send: async (m) => {
        vt += 2_000; // the email takes 2 s, so the receiver's cooldown starts after the app's raise
        return smtp.send(m);
      },
    };
    const srv = createAlertReceiverServer({
      port: 0,
      config: { secret: SECRET, to: "owner@example.test", from: "owner@example.test", hourlyEmailCap: 50 },
      mailer: slowMailer,
      nowMs: () => vt,
      log: (m, meta) => receiverLogs.push(`${m}:${String(meta?.reason ?? "")}`),
    });
    await new Promise<void>((r) => srv.once("listening", () => r()));
    try {
      const timers: Array<{ fn: () => void; at: number }> = [];
      const a = createAlerter({
        url: `http://127.0.0.1:${(srv.address() as net.AddressInfo).port}/alerts`,
        secret: SECRET,
        environment: "production",
        now: () => new Date(vt),
        sleep: async () => {},
        setTimer: (fn, ms) => timers.push({ fn, at: vt + ms }),
      });
      const signal = { event: "ghl_auth_failed" as AlertEvent, step: "contact", status: "p26-batch" };
      const start = sink.messages.length;
      const t0 = vt;

      a.raise(signal); // emailed; receiver cooldown runs to t0 + 2 s + 900 s
      await a.settled();
      assert.equal(sink.messages.length - start, 1);

      vt = t0 + 300_000;
      a.raise(signal); // suppressed by the app
      vt = t0 + 900_500; // past the app window, still inside the receiver cooldown
      a.raise(signal);
      await a.settled();
      assert.equal(sink.messages.length - start, 1, "nothing sent inside the receiver cooldown");
      assert.equal(timers.length, 1);

      vt = Math.max(vt, timers[0].at);
      timers[0].fn();
      await a.settled();
      const sent = sink.messages.slice(start);
      assert.equal(sent.length, 2, "the batch was emailed");
      assert.match(sent[1].body, /Occurrences: 2/);
      assert.ok(!receiverLogs.includes("suppressed:cooldown"), receiverLogs.join(","));
    } finally {
      await new Promise<void>((r) => srv.close(() => r()));
    }
  });

  it("the app's readiness probe sees the running receiver as ready, and a stopped one (closed port) as not", async () => {
    assert.equal(await createReceiverProbe({ alertUrl: url })(), true);
    const spare = net.createServer();
    const port = await new Promise<number>((r) => spare.listen(0, "127.0.0.1", () => r((spare.address() as net.AddressInfo).port)));
    await new Promise<void>((r) => spare.close(() => r()));
    assert.equal(await createReceiverProbe({ alertUrl: `http://127.0.0.1:${port}/alerts` })(), false);
  });

  it("refuses to bind anywhere but loopback", () => {
    assert.throws(() =>
      createAlertReceiverServer({
        port: 0,
        host: "0.0.0.0" as "127.0.0.1",
        config: { secret: SECRET, to: "a@example.test", from: "a@example.test" },
        mailer: { send: async () => {} },
      })
    );
  });
});

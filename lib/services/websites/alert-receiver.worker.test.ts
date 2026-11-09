/**
 * End to end with synthetic events: the app's real alerter (alerts.ts) posts
 * to the Worker entry (workers/websites-alerts/index.ts), which emails through
 * a fake send_email binding. No network, no Cloudflare account.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import worker, { type Env } from "../../../workers/websites-alerts/index";
import type { OutboundEmail } from "./alert-receiver";
import { createAlerter, type AlertEvent } from "./alerts";

const SECRET = "k".repeat(48);

function envWith(sent: OutboundEmail[], over: Partial<Env> = {}): Env {
  const kv = new Map<string, string>();
  return {
    ALERT_WEBHOOK_SECRET: SECRET,
    ALERT_EMAIL_TO: "owner@example.test",
    ALERT_EMAIL_FROM: "alerts@alerts.example.test",
    ALERT_EMAIL: {
      async send(m) {
        sent.push(m);
        return { messageId: `m${sent.length}` };
      },
    },
    ALERT_DEDUPE: {
      async get(k) {
        return kv.get(k) ?? null;
      },
      async put(k, v) {
        kv.set(k, v);
      },
    },
    ...over,
  };
}

function alerterInto(env: Env) {
  return createAlerter({
    url: "https://hooks.example.test/alerts",
    secret: SECRET,
    environment: "production",
    fetch: (url, init) => worker.fetch(new Request(url, init), env),
    sleep: async () => {},
  });
}

describe("alert pipeline: app alerter → Worker → email (synthetic events)", () => {
  it("delivers a lead-intake failure and the capacity warnings, one email each", async () => {
    const sent: OutboundEmail[] = [];
    const alerter = alerterInto(envWith(sent));
    alerter.raise({ event: "delivery_failed", step: "opportunity", status: 502 });
    alerter.raise({ event: "capacity_near" as AlertEvent, step: "capacity", status: "4:5" });
    alerter.raise({ event: "capacity_full" as AlertEvent, step: "capacity", status: "5:5" });
    alerter.raise({ event: "delivery_failed", step: "opportunity", status: 502 }); // deduped by the sender
    await alerter.settled();
    // Deliveries run concurrently, so arrival order is not guaranteed.
    assert.deepEqual(
      sent.map((m) => m.subject).sort(),
      [
        "[Entrepreneuria Websites] ACTION: A preview request could not be delivered to GoHighLevel",
        "[Entrepreneuria Websites] Preview intake: 1 slot left (4 of 5 open)",
        "[Entrepreneuria Websites] ACTION: Preview intake is full (5 of 5)",
      ].sort()
    );
    assert.ok(sent.every((m) => m.to === "owner@example.test" && m.from === "alerts@alerts.example.test"));
  });

  it("a sender with the wrong secret is refused and nothing is emailed", async () => {
    const sent: OutboundEmail[] = [];
    const env = envWith(sent);
    const rogue = createAlerter({
      url: "https://hooks.example.test/alerts",
      secret: "x".repeat(48),
      environment: "production",
      fetch: (url, init) => worker.fetch(new Request(url, init), env),
      sleep: async () => {},
    });
    rogue.raise({ event: "test" });
    await rogue.settled();
    assert.equal(sent.length, 0);
  });

  it("a misconfigured Worker refuses all traffic", async () => {
    const sent: OutboundEmail[] = [];
    for (const over of [{ ALERT_WEBHOOK_SECRET: "short" }, { ALERT_EMAIL_TO: "" }, { ALERT_EMAIL_FROM: "" }]) {
      const res = await worker.fetch(new Request("https://hooks.example.test/alerts", { method: "POST", body: "{}" }), envWith(sent, over));
      assert.equal(res.status, 503);
    }
    assert.equal(sent.length, 0);
  });

  it("works without a KV namespace (per-isolate dedupe)", async () => {
    const sent: OutboundEmail[] = [];
    const alerter = alerterInto(envWith(sent, { ALERT_DEDUPE: undefined }));
    alerter.raise({ event: "test" });
    await alerter.settled();
    assert.equal(sent.length, 1);
  });
});

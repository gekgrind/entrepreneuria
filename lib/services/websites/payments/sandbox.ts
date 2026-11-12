/**
 * In-memory sandbox payment provider for nonproduction and tests.
 * Moves no money and calls no network. Honors idempotency keys and refuses
 * a second active subscription per project, mirroring what a real adapter
 * must guarantee.
 */
import { timingSafeEqual } from "node:crypto";

import { addMonthsUtc, signSandboxWebhook } from "../billing";
import type {
  ChargeResult,
  PaymentProvider,
  SubscriptionRecord,
  WebhookEvent,
} from "./provider";

export function createSandboxProvider(opts: {
  webhookSecret: string;
  now?: () => Date;
  /** Test hook: customerRefs whose setup charge should fail. */
  failingCustomers?: Set<string>;
}): PaymentProvider & { readonly charges: ReadonlyMap<string, ChargeResult>; readonly subscriptions: ReadonlyMap<string, SubscriptionRecord> } {
  const now = opts.now ?? (() => new Date());
  const charges = new Map<string, ChargeResult>();
  const subscriptions = new Map<string, SubscriptionRecord>();
  const byKey = new Map<string, string>();
  let seq = 0;
  const id = (prefix: string) => `${prefix}_sbx_${++seq}`;

  return {
    mode: "sandbox",
    charges,
    subscriptions,

    async createSetupCharge(req) {
      const prior = byKey.get(req.idempotencyKey);
      if (prior) return charges.get(prior)!;
      if (!Number.isInteger(req.amountCents) || req.amountCents <= 0) throw new Error("invalid amount");
      const failed = opts.failingCustomers?.has(req.customerRef) ?? false;
      const charge: ChargeResult = {
        id: id("ch"),
        status: failed ? "failed" : "succeeded",
        amountCents: req.amountCents,
        failureReason: failed ? "card_declined" : undefined,
      };
      charges.set(charge.id, charge);
      // A failed attempt must not pin the key, or a retry could never succeed.
      if (!failed) byKey.set(req.idempotencyKey, charge.id);
      return charge;
    },

    async createSubscription(req) {
      const prior = byKey.get(req.idempotencyKey);
      if (prior) return subscriptions.get(prior)!;
      for (const s of subscriptions.values()) {
        if (s.projectId === req.projectId && s.status !== "canceled") {
          throw new Error("duplicate subscription for project");
        }
      }
      if (req.anchorAt.getTime() > now().getTime() + 60_000) throw new Error("anchor in the future");
      const sub: SubscriptionRecord = {
        id: id("sub"),
        projectId: req.projectId,
        status: "active",
        amountCents: req.amountCents,
        anchorAt: req.anchorAt,
        currentPeriodStart: req.anchorAt,
        currentPeriodEnd: addMonthsUtc(req.anchorAt, 1),
      };
      subscriptions.set(sub.id, sub);
      byKey.set(req.idempotencyKey, sub.id);
      return sub;
    },

    async getActiveSubscription(projectId) {
      for (const s of subscriptions.values()) {
        if (s.projectId === projectId && s.status !== "canceled") return s;
      }
      return null;
    },

    async cancelAtPeriodEnd(subscriptionId) {
      const s = subscriptions.get(subscriptionId);
      if (!s) throw new Error("unknown subscription");
      const updated = { ...s, status: "cancel_at_period_end" as const };
      subscriptions.set(s.id, updated);
      return updated;
    },

    async verifyWebhook(rawBody, signature) {
      if (!signature) return null;
      const expected = Buffer.from(signSandboxWebhook(rawBody, opts.webhookSecret), "hex");
      const given = Buffer.from(signature, "hex");
      if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
      try {
        const parsed = JSON.parse(rawBody) as WebhookEvent;
        return typeof parsed.id === "string" && typeof parsed.type === "string" ? parsed : null;
      } catch {
        return null;
      }
    },
  };
}

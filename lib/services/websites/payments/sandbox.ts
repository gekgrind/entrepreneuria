/**
 * In-memory sandbox payment provider for nonproduction and tests.
 * Moves no money, calls no network and never returns a payment link.
 * Honors idempotency keys and refuses a second active subscription per
 * project, mirroring what a real adapter must guarantee.
 *
 * `simulateSetupPayment` stands in for the customer paying the GHL-hosted
 * request: it returns the signed provider event a real adapter would
 * deliver by webhook.
 */
import { timingSafeEqual } from "node:crypto";

import { addMonthsUtc, signSandboxWebhook } from "../billing";
import type {
  ChargeResult,
  PaymentProvider,
  SetupPaymentRequest,
  SubscriptionRecord,
  WebhookEvent,
} from "./provider";

export interface SandboxProvider extends PaymentProvider {
  readonly requests: ReadonlyMap<string, SetupPaymentRequest>;
  readonly charges: ReadonlyMap<string, ChargeResult>;
  readonly subscriptions: ReadonlyMap<string, SubscriptionRecord>;
  /** Sandbox only: the customer pays (or fails to pay) the hosted request. */
  simulateSetupPayment(requestId: string): { charge: ChargeResult; event: WebhookEvent; rawBody: string; signature: string };
  /** Sandbox only: the signed provider event for a subscription that exists here. */
  simulateSubscriptionEvent(
    subscriptionId: string,
    type: "subscription.activated" | "subscription.payment_failed" | "subscription.payment_recovered"
  ): { event: WebhookEvent; rawBody: string; signature: string };
}

export function createSandboxProvider(opts: {
  webhookSecret: string;
  now?: () => Date;
  /** Test hook: customerRefs whose setup payment should fail. */
  failingCustomers?: Set<string>;
}): SandboxProvider {
  const now = opts.now ?? (() => new Date());
  const requests = new Map<string, SetupPaymentRequest>();
  const requestCustomer = new Map<string, string>();
  const charges = new Map<string, ChargeResult>();
  const subscriptions = new Map<string, SubscriptionRecord>();
  const byKey = new Map<string, string>();
  let seq = 0;
  const id = (prefix: string) => `${prefix}_sbx_${++seq}`;

  return {
    mode: "sandbox",
    requests,
    charges,
    subscriptions,

    async createSetupPaymentRequest(req) {
      const prior = byKey.get(req.idempotencyKey);
      if (prior) return requests.get(prior)!;
      if (!Number.isInteger(req.amountCents) || req.amountCents <= 0) throw new Error("invalid amount");
      if (req.currency !== "USD") throw new Error("unsupported currency");
      const request: SetupPaymentRequest = { id: id("preq"), projectId: req.projectId, status: "open", amountCents: req.amountCents, hostedUrl: null };
      requests.set(request.id, request);
      requestCustomer.set(request.id, req.customerRef);
      byKey.set(req.idempotencyKey, request.id);
      return request;
    },

    simulateSetupPayment(requestId) {
      const request = requests.get(requestId);
      if (!request) throw new Error("unknown payment request");
      if (request.status !== "open") throw new Error(`payment request is ${request.status}`);
      const failed = opts.failingCustomers?.has(requestCustomer.get(requestId) ?? "") ?? false;
      const charge: ChargeResult = {
        id: id("ch"),
        requestId,
        status: failed ? "failed" : "succeeded",
        amountCents: request.amountCents,
        failureReason: failed ? "card_declined" : undefined,
      };
      charges.set(charge.id, charge);
      requests.set(requestId, { ...request, status: failed ? "failed" : "paid" });
      const event: WebhookEvent = {
        id: id("evt"),
        type: failed ? "setup_payment.failed" : "setup_payment.succeeded",
        payload: { projectId: request.projectId, requestId, chargeId: charge.id, amountCents: charge.amountCents, reason: charge.failureReason },
      };
      const rawBody = JSON.stringify(event);
      return { charge, event, rawBody, signature: signSandboxWebhook(rawBody, opts.webhookSecret) };
    },

    simulateSubscriptionEvent(subscriptionId, type) {
      const sub = subscriptions.get(subscriptionId);
      if (!sub) throw new Error("unknown subscription");
      const event: WebhookEvent = {
        id: id("evt"),
        type,
        payload: { projectId: sub.projectId, subscriptionId, amountCents: sub.amountCents, reason: type === "subscription.payment_failed" ? "card_declined" : undefined },
      };
      const rawBody = JSON.stringify(event);
      return { event, rawBody, signature: signSandboxWebhook(rawBody, opts.webhookSecret) };
    },

    async createSubscription(req) {
      const prior = byKey.get(req.idempotencyKey);
      if (prior) return subscriptions.get(prior)!;
      if (req.currency !== "USD") throw new Error("unsupported currency");
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

/**
 * Payment provider boundary (spec §10C).
 *
 * Provider is VERIFY — not selected. Only a sandbox implementation exists;
 * a real adapter (Stripe, GHL Payments, …) implements this interface after
 * the provider audit. There is deliberately no live factory.
 */

export interface SetupChargeRequest {
  projectId: string;
  customerRef: string;
  amountCents: number;
  description: string;
  idempotencyKey: string;
}

export interface SubscriptionRequest {
  projectId: string;
  customerRef: string;
  amountCents: number;
  interval: "month";
  /** Billing anchor = actual launch timestamp. */
  anchorAt: Date;
  idempotencyKey: string;
}

export interface ChargeResult {
  id: string;
  status: "succeeded" | "failed";
  amountCents: number;
  failureReason?: string;
}

export interface SubscriptionRecord {
  id: string;
  projectId: string;
  status: "active" | "past_due" | "cancel_at_period_end" | "canceled";
  amountCents: number;
  anchorAt: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

export interface WebhookEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly mode: "sandbox";
  createSetupCharge(req: SetupChargeRequest): Promise<ChargeResult>;
  createSubscription(req: SubscriptionRequest): Promise<SubscriptionRecord>;
  getActiveSubscription(projectId: string): Promise<SubscriptionRecord | null>;
  cancelAtPeriodEnd(subscriptionId: string): Promise<SubscriptionRecord>;
  /** Signature verification; returns null for an invalid/unsigned payload. */
  verifyWebhook(rawBody: string, signature: string | null): Promise<WebhookEvent | null>;
}

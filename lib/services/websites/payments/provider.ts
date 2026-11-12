/**
 * Payment provider boundary (spec §10C).
 *
 * Owner decision: payments use GHL-hosted functionality — no custom
 * checkout. The setup fee is therefore a *payment request* (a GHL-hosted
 * invoice or order page the customer pays there), confirmed later by a
 * signed provider event; the server never charges a card itself.
 *
 * Provider is VERIFY (D-07). Only a sandbox implementation exists; a GHL
 * adapter implements this interface after the provider audit and Gate B.
 * There is deliberately no live factory.
 */

export interface SetupPaymentRequestInput {
  projectId: string;
  customerRef: string;
  amountCents: number;
  currency: "USD";
  description: string;
  idempotencyKey: string;
}

export interface SetupPaymentRequest {
  id: string;
  projectId: string;
  status: "open" | "paid" | "failed";
  amountCents: number;
  /**
   * Customer-facing hosted payment page. ALWAYS null in sandbox: no payment
   * link is ever created before Gate B is open in production.
   */
  hostedUrl: string | null;
}

export interface SubscriptionRequest {
  projectId: string;
  customerRef: string;
  amountCents: number;
  currency: "USD";
  interval: "month";
  /** Billing anchor = actual launch timestamp. */
  anchorAt: Date;
  idempotencyKey: string;
}

export interface ChargeResult {
  id: string;
  requestId: string;
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
  createSetupPaymentRequest(req: SetupPaymentRequestInput): Promise<SetupPaymentRequest>;
  createSubscription(req: SubscriptionRequest): Promise<SubscriptionRecord>;
  getActiveSubscription(projectId: string): Promise<SubscriptionRecord | null>;
  cancelAtPeriodEnd(subscriptionId: string): Promise<SubscriptionRecord>;
  /** Signature verification; returns null for an invalid/unsigned payload. */
  verifyWebhook(rawBody: string, signature: string | null): Promise<WebhookEvent | null>;
}

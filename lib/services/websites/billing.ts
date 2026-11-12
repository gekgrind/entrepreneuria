/**
 * Billing rules (spec §2 billing structure, §3, §10C).
 *
 *   - Setup fee: requested once per attempt as a GHL-hosted payment request
 *     (no custom checkout, no server-side charge) after preview approval
 *     and agreement acceptance, behind Gate B. Amount is the ACCEPTED
 *     price; idempotency key derived from the project id and attempt.
 *     Payment is confirmed only by a verified provider event.
 *   - Subscription: created only when the project is `live` with a
 *     recorded `launchedAt` and an owner-verified launch, behind Gate C;
 *     anchored to the launch timestamp; never twice.
 *   - Cancellation (PROPOSED policy): effective at the end of the current
 *     paid period, never before the one-month minimum. Usable only when the
 *     policy is approved or the proposed flow is flagged on in nonproduction.
 */
import { createHmac } from "node:crypto";

import { assertClearance, type GateClearance } from "./activation-gates";
import { getPackage } from "./packages";
import { getPolicy, isPublishable } from "./policies";
import type { WebsiteProject } from "./lifecycle";
import type { PaymentProvider, SetupPaymentRequest, SubscriptionRecord } from "./payments/provider";

export class BillingGuardError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "BillingGuardError";
  }
}

/** Adds calendar months in UTC, clamping to the last day (Jan 31 + 1 → Feb 28/29). */
export function addMonthsUtc(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      Math.min(date.getUTCDate(), lastDay),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    )
  );
}

export function setupPaymentIdempotencyKey(projectId: string, attempt: number) {
  return `websites:setup:${projectId}:${attempt}`;
}

export function subscriptionIdempotencyKey(projectId: string) {
  return `websites:subscription:${projectId}`;
}

function checkClearance(project: WebsiteProject, clearance: GateClearance, gate: GateClearance["gate"]) {
  try {
    assertClearance(clearance, { gate, projectId: project.id, mode: project.mode });
  } catch (err) {
    throw new BillingGuardError("gate_closed", (err as Error).message);
  }
}

function checkProviderMode(project: WebsiteProject, provider: PaymentProvider) {
  // A sandbox provider can never serve a production project, and there is no live provider.
  if (provider.mode !== "sandbox" || project.mode !== "sandbox") {
    throw new BillingGuardError("mode_mismatch", `No ${project.mode} payment provider is available`);
  }
}

/**
 * Issues the GHL-hosted setup payment request (Gate B). Returns the request;
 * the caller records it with the `request_setup_payment` event. Sandbox
 * requests carry no payment link.
 */
export async function requestSetupPayment(
  project: WebsiteProject,
  provider: PaymentProvider,
  customerRef: string,
  clearance: GateClearance
): Promise<SetupPaymentRequest> {
  checkClearance(project, clearance, "setup_payment");
  checkProviderMode(project, provider);
  if (project.state !== "approved" && project.state !== "setup_payment_failed") {
    throw new BillingGuardError("not_approved", `Setup payment can only be requested after agreement acceptance (state: ${project.state})`);
  }
  if (!project.previewApproval) throw new BillingGuardError("no_preview_approval", "Preview approval not recorded");
  if (!project.packageId || !project.acceptance) {
    throw new BillingGuardError("no_acceptance", "Setup payment requires a recorded agreement acceptance");
  }
  if (project.setupChargeId) throw new BillingGuardError("already_paid", "Setup fee already recorded");
  const pkg = getPackage(project.packageId);
  // Request what the customer accepted, not whatever the registry says today (D-16).
  if (project.acceptance.setupPriceCents !== pkg.setupPriceCents) {
    throw new BillingGuardError("price_changed", "Accepted setup price differs from current registry; re-approval required");
  }
  return provider.createSetupPaymentRequest({
    projectId: project.id,
    customerRef,
    amountCents: project.acceptance.setupPriceCents,
    description: `${pkg.displayName} setup`,
    idempotencyKey: setupPaymentIdempotencyKey(project.id, project.setupPaymentAttempts + 1),
  });
}

/** Throws unless a subscription may be created for this project right now. */
export function assertCanActivateSubscription(project: WebsiteProject, existing: SubscriptionRecord | null): void {
  if (project.state !== "live") {
    throw new BillingGuardError("not_live", `Recurring billing cannot start before launch (state: ${project.state})`);
  }
  if (!project.launchedAt) throw new BillingGuardError("no_launch_date", "Launch timestamp not recorded");
  if (!project.launchVerification) throw new BillingGuardError("launch_unverified", "Launch not verified");
  if (!project.setupPaidAt) throw new BillingGuardError("setup_unpaid", "Setup fee not paid");
  if (!project.launchApprovedAt) throw new BillingGuardError("no_launch_approval", "Customer launch approval not recorded");
  if (!project.acceptance || !project.packageId) throw new BillingGuardError("no_acceptance", "No accepted package");
  if (project.subscriptionId || (existing && existing.status !== "canceled")) {
    throw new BillingGuardError("duplicate", "A subscription already exists for this project");
  }
}

export async function activateSubscriptionAtLaunch(
  project: WebsiteProject,
  provider: PaymentProvider,
  customerRef: string,
  clearance: GateClearance
): Promise<SubscriptionRecord> {
  checkClearance(project, clearance, "subscription");
  checkProviderMode(project, provider);
  const existing = await provider.getActiveSubscription(project.id);
  assertCanActivateSubscription(project, existing);
  return provider.createSubscription({
    projectId: project.id,
    customerRef,
    amountCents: project.acceptance!.monthlyPriceCents,
    interval: "month",
    anchorAt: new Date(project.launchedAt!),
    idempotencyKey: subscriptionIdempotencyKey(project.id),
  });
}

export interface CancellationQuote {
  nextBillingDate: string;
  effectiveAt: string;
  remainingChargesCents: number;
  policyVersion: string;
  policyStatus: string;
}

/**
 * What the cancellation screen must disclose before confirmation (spec §3).
 * `allowProposed` is the caller's flag check (isProposedFlowEnabled).
 */
export function quoteCancellation(
  input: { launchedAt: Date; currentPeriodEnd: Date; monthlyPriceCents: number; minimumTermMonths: number },
  allowProposed: boolean
): CancellationQuote {
  const policy = getPolicy("cancellation");
  if (!isPublishable("cancellation") && !allowProposed) {
    throw new BillingGuardError("policy_unapproved", "Cancellation policy is not approved");
  }
  const minimumEnd = addMonthsUtc(input.launchedAt, input.minimumTermMonths);
  const effective = input.currentPeriodEnd > minimumEnd ? input.currentPeriodEnd : minimumEnd;
  // Periods are paid in advance; any minimum-term months beyond the paid period are still owed.
  let remaining = 0;
  let cursor = input.currentPeriodEnd;
  while (cursor < effective) {
    remaining += input.monthlyPriceCents;
    cursor = addMonthsUtc(cursor, 1);
  }
  return {
    nextBillingDate: input.currentPeriodEnd.toISOString(),
    effectiveAt: effective.toISOString(),
    remainingChargesCents: remaining,
    policyVersion: policy.version,
    policyStatus: policy.status,
  };
}

/** Webhook replay guard: process each provider event id once. */
export interface ProcessedEventLedger {
  /** Returns false when the id was already recorded. */
  record(eventId: string): Promise<boolean>;
}

export function createMemoryEventLedger(): ProcessedEventLedger {
  const seen = new Set<string>();
  return {
    async record(id) {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    },
  };
}

export function signSandboxWebhook(rawBody: string, secret: string) {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

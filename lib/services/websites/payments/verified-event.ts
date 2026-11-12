/**
 * Verified provider callbacks: the only way a payment fact enters the lifecycle.
 *
 * `verifyProviderCallback` checks the provider's signature on the raw body
 * (`PaymentProvider.verifyWebhook`), then maps the provider event to the
 * lifecycle facts it attests. It returns a frozen object that only this
 * module can issue. `applyLifecycleEvent` refuses every payment event that
 * does not carry one, and refuses one whose event id, project, type or
 * attested fields differ from what the provider signed.
 *
 * A caller cannot assert provider provenance by setting `actor.kind`:
 * without a verified callback, a payment event is rejected.
 */
import type { ProjectEventType } from "../lifecycle";
import type { PaymentProvider, WebhookEvent } from "./provider";

/** Lifecycle events that must come from a verified provider callback. */
export const PROVIDER_ATTESTED_EVENTS = [
  "setup_payment_succeeded",
  "setup_payment_failed",
  "subscription_activated",
  "subscription_payment_failed",
  "subscription_payment_recovered",
] as const satisfies readonly ProjectEventType[];
export type ProviderAttestedEvent = (typeof PROVIDER_ATTESTED_EVENTS)[number];

const ATTESTED = new Set<string>(PROVIDER_ATTESTED_EVENTS);
export const isProviderAttested = (type: string): type is ProviderAttestedEvent => ATTESTED.has(type);

export interface VerifiedProviderEvent {
  /** The provider's own event id. Must be used as the envelope `eventId`. */
  readonly providerEventId: string;
  /** Mode of the provider that verified the signature. Must match the project's mode. */
  readonly mode: string;
  readonly projectId: string;
  readonly type: ProviderAttestedEvent;
  /** Facts the provider signed. The lifecycle event must carry exactly these values. */
  readonly attested: Readonly<Record<string, string | number>>;
  /** Informational, not attested (e.g. a decline reason). */
  readonly reason?: string;
}

const issued = new WeakSet<object>();

export function isVerifiedProviderEvent(v: unknown): v is VerifiedProviderEvent {
  return typeof v === "object" && v !== null && issued.has(v);
}

const str = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 200;
const cents = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

function mapEvent(evt: WebhookEvent): Omit<VerifiedProviderEvent, "providerEventId" | "mode"> | null {
  const p = evt.payload ?? {};
  if (!str(p.projectId)) return null;
  const reason = typeof p.reason === "string" ? p.reason.slice(0, 200) : undefined;
  switch (evt.type) {
    case "setup_payment.succeeded":
      if (!str(p.requestId) || !str(p.chargeId) || !cents(p.amountCents)) return null;
      return { projectId: p.projectId, type: "setup_payment_succeeded", attested: { requestId: p.requestId, chargeId: p.chargeId, amountCents: p.amountCents } };
    case "setup_payment.failed":
      if (!str(p.requestId)) return null;
      return { projectId: p.projectId, type: "setup_payment_failed", attested: { requestId: p.requestId }, reason };
    case "subscription.activated":
      if (!str(p.subscriptionId)) return null;
      return { projectId: p.projectId, type: "subscription_activated", attested: { subscriptionId: p.subscriptionId } };
    case "subscription.payment_failed":
      return { projectId: p.projectId, type: "subscription_payment_failed", attested: {}, reason };
    case "subscription.payment_recovered":
      return { projectId: p.projectId, type: "subscription_payment_recovered", attested: {} };
    default:
      return null;
  }
}

/**
 * Verify a raw provider callback. Returns null for a missing or invalid
 * signature, an unknown event type, or a malformed payload.
 */
export async function verifyProviderCallback(
  provider: PaymentProvider,
  rawBody: string,
  signature: string | null
): Promise<VerifiedProviderEvent | null> {
  const evt = await provider.verifyWebhook(rawBody, signature);
  if (!evt || !str(evt.id)) return null;
  const mapped = mapEvent(evt);
  if (!mapped) return null;
  const verified: VerifiedProviderEvent = Object.freeze({
    ...mapped,
    attested: Object.freeze({ ...mapped.attested }),
    providerEventId: evt.id,
    mode: provider.mode,
  });
  issued.add(verified);
  return verified;
}

/**
 * Why a lifecycle event may not be applied with this provenance, or null
 * when it may. Non-payment events need no provenance.
 */
export function provenanceProblem(input: {
  eventId: string;
  projectId: string;
  projectMode: string;
  event: { type: string } & Record<string, unknown>;
  provenance: unknown;
}): string | null {
  if (!isProviderAttested(input.event.type)) return null;
  const v = input.provenance;
  if (!isVerifiedProviderEvent(v)) return `${input.event.type} requires a verified provider callback`;
  if (v.providerEventId !== input.eventId) return "eventId must be the verified provider event id";
  if (v.projectId !== input.projectId) return "verified callback is for a different project";
  if (v.mode !== input.projectMode) return `verified callback is from a ${v.mode} provider; project mode is ${input.projectMode}`;
  if (v.type !== input.event.type) return `verified callback is ${v.type}, not ${input.event.type}`;
  for (const [field, value] of Object.entries(v.attested)) {
    if (input.event[field] !== value) return `${field} differs from the verified callback`;
  }
  return null;
}

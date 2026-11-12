/**
 * PROPOSED failed-payment recovery schedule (decision register D-15).
 *
 *   Day 0   recurring charge fails → project moves to `past_due`
 *   Day 1, 3, 7   three automatic retries (the seven-day retry window)
 *   Day 7 → 14    additional seven-day grace period; service continues
 *   Day 14        suspension becomes *eligible* — NOT performed
 *
 * Suspension is never activated by this code: `suspensionEnabled` is false
 * and `isSuspensionAllowed` stays false until the owner approves the
 * `payment_recovery` policy AND a suspension rule is explicitly enabled.
 */
import { isPublishable } from "./policies";

const DAY_MS = 24 * 60 * 60 * 1000;

export const PROPOSED_PAYMENT_RECOVERY = {
  retryOffsetsDays: [1, 3, 7] as const,
  retryWindowDays: 7,
  gracePeriodDays: 7,
  suspensionEnabled: false,
} as const;

export interface RecoverySchedule {
  failedAt: string;
  retryAt: string[];
  retryWindowEndsAt: string;
  graceEndsAt: string;
  suspensionEligibleAt: string;
  policyStatus: "proposed" | "approved";
}

export function paymentRecoverySchedule(failedAt: Date): RecoverySchedule {
  const plus = (days: number) => new Date(failedAt.getTime() + days * DAY_MS).toISOString();
  const { retryOffsetsDays, retryWindowDays, gracePeriodDays } = PROPOSED_PAYMENT_RECOVERY;
  const graceEnd = retryWindowDays + gracePeriodDays;
  return {
    failedAt: failedAt.toISOString(),
    retryAt: retryOffsetsDays.map(plus),
    retryWindowEndsAt: plus(retryWindowDays),
    graceEndsAt: plus(graceEnd),
    suspensionEligibleAt: plus(graceEnd),
    policyStatus: isPublishable("payment_recovery") ? "approved" : "proposed",
  };
}

/** Always false today. Requires an approved policy AND an explicitly enabled rule. */
export function isSuspensionAllowed(schedule: RecoverySchedule, now: Date): boolean {
  if (!PROPOSED_PAYMENT_RECOVERY.suspensionEnabled) return false;
  if (!isPublishable("payment_recovery")) return false;
  return now.getTime() >= Date.parse(schedule.suspensionEligibleAt);
}

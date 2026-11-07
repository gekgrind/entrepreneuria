/**
 * Production launch acceptance criteria (spec v1.0 §11).
 *
 * A gate flips to `passed: true` only with an evidence reference (PR,
 * test run, signed approval). Production mode stays off while any gate is
 * open — see flags.ts.
 */

export interface ReleaseGate {
  id: string;
  criterion: string;
  owner: "engineering" | "owner" | "legal";
  passed: boolean;
  evidence?: string;
}

export const RELEASE_GATES: readonly ReleaseGate[] = [
  { id: "prices-display", criterion: "All three approved prices display correctly", owner: "engineering", passed: false },
  { id: "setup-fee-flow", criterion: "Setup fees are collected only through the approved payment flow", owner: "engineering", passed: false },
  { id: "no-prelaunch-billing", criterion: "Recurring billing cannot start before launch", owner: "engineering", passed: false },
  { id: "terms-disclosed", criterion: "One-month minimum and cancellation terms are correctly disclosed", owner: "owner", passed: false },
  { id: "policy-acceptance", criterion: "Customers explicitly accept the applicable agreement and policy versions", owner: "engineering", passed: false },
  { id: "preview-free", criterion: "Free previews do not trigger charges", owner: "engineering", passed: false },
  { id: "style-to-crm", criterion: "Style selection persists into CRM lead records", owner: "engineering", passed: false },
  { id: "form-states", criterion: "Forms handle success, failure, spam, and duplicate submissions", owner: "engineering", passed: false },
  /* D-04 conditional approval (2026-11-06): acknowledging stored-but-unsynced inquiries is allowed only once this passes. */
  { id: "crm-sync-recovery", criterion: "Stored inquiries pending GHL sync are retried, monitored, and alert the owner", owner: "engineering", passed: false },
  { id: "features-verified", criterion: "Package features match verified GoHighLevel capabilities", owner: "owner", passed: false },
  { id: "ownership-disclosed", criterion: "Customer-owned domain and content rights are accurately disclosed", owner: "legal", passed: false },
  { id: "cancellation-works", criterion: "Subscription cancellation works as documented", owner: "engineering", passed: false },
  { id: "legal-approved", criterion: "Legal disclosures have been approved", owner: "legal", passed: false },
  { id: "session-reliability", criterion: "Authentication, website assets, and checkout remain reliable under realistic browser-session conditions", owner: "engineering", passed: false },
  { id: "owner-release", criterion: "Owner authorizes production release", owner: "owner", passed: false },
];

export function openReleaseGates(): ReleaseGate[] {
  return RELEASE_GATES.filter((g) => !g.passed);
}

export function allReleaseGatesPassed(): boolean {
  return RELEASE_GATES.every((g) => g.passed && Boolean(g.evidence));
}

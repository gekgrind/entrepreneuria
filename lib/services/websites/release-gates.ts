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

/**
 * Leads-only release gates. A separate, narrower list for the mode that
 * accepts free-preview requests and nothing else (no payment, no store).
 * Passing these opens the form only; it never clears the full-production
 * gates above, which stay exactly as they are.
 *
 * Every gate starts closed. A gate flips only with an evidence reference
 * (PR, test run, signed approval) and, where the owner is named, written
 * owner approval. Do not edit `passed` without that approval.
 */
export const LEADS_RELEASE_GATES: readonly ReleaseGate[] = [
  { id: "leads-prices", criterion: "The offered package's approved price displays correctly (launch: Website Starter only)", owner: "engineering", passed: false },
  { id: "leads-preview-free", criterion: "A preview request cannot create a charge in leads mode", owner: "engineering", passed: false },
  { id: "leads-intake-hardened", criterion: "Client-IP handling, rate limits, Turnstile, body cap, page_url, IP-hash salt and store isolation are closed and tested", owner: "engineering", passed: false },
  { id: "leads-crm-delivery", criterion: "Synthetic submissions reach a GHL test location: contact, tags, style and package fields, note, one opportunity, no duplicate on resubmission", owner: "engineering", passed: false },
  { id: "leads-failure-visible", criterion: "Every failure shows the visitor an honest error, keeps their entries and shows the email fallback; success only on a real ok", owner: "engineering", passed: false },
  { id: "leads-failure-alerts", criterion: "Delivery failures, GHL 401/403 and misconfiguration send a signed, deduplicated, personal-data-free alert whose delivery is verified end to end", owner: "engineering", passed: false },
  { id: "leads-spam", criterion: "Honeypot, real Turnstile and rate limits work on the deployed host", owner: "engineering", passed: false },
  { id: "leads-session-reliability", criterion: "The session test matrix passes for anonymous and signed-in visitors, including oversized cookies, repeated by an independent tester", owner: "engineering", passed: false },
  { id: "leads-notification", criterion: "The owner is notified of new and returning leads", owner: "owner", passed: false },
  { id: "leads-privacy", criterion: "Privacy notice and subprocessor list cover lead data and GHL; the form's privacy wording is approved by counsel", owner: "legal", passed: false },
  { id: "leads-offer-copy", criterion: "Owner rulings on descriptive copy, revision wording and the public inbox", owner: "owner", passed: false },
  { id: "leads-capacity", criterion: "Preview playbook approved; the intake limit and paused state are configurable and behaviour at the limit is tested", owner: "owner", passed: false },
  { id: "leads-owner-release", criterion: "Owner authorizes leads-only activation", owner: "owner", passed: false },
];

export const MANUAL_LEADS_RELEASE_GATES: readonly ReleaseGate[] = LEADS_RELEASE_GATES.map((crmGate) => {
  const gate = { ...crmGate, passed: false, evidence: undefined };
  if (gate.id === "leads-crm-delivery") return { ...gate, id: "leads-manual-delivery", criterion: "Preview requests are durably queued before acknowledgment, deduplicated and recoverable without any CRM access" };
  if (gate.id === "leads-privacy") return { ...gate, criterion: "Approved form notice and disclosures cover lead data, local storage, retention and notification processing" };
  if (gate.id === "leads-failure-alerts") return { ...gate, criterion: "Failed intake alerts and reference-only notices reach the owner; queue review covers a receiver outage" };
  if (gate.id === "leads-notification") return { ...gate, criterion: "The owner receives each lead notice and monitors the queue independently of incoming traffic" };
  return gate;
});

export function openLeadsGates(gates: readonly ReleaseGate[] = LEADS_RELEASE_GATES): ReleaseGate[] {
  return gates.filter((g) => !g.passed || !g.evidence?.trim());
}

/** True only when every leads gate passed WITH evidence. An empty list never passes. */
export function allLeadsGatesPassed(gates: readonly ReleaseGate[] = LEADS_RELEASE_GATES): boolean {
  return gates.length > 0 && gates.every((g) => g.passed && Boolean(g.evidence?.trim()));
}

export function openReleaseGates(): ReleaseGate[] {
  return RELEASE_GATES.filter((g) => !g.passed);
}

export function allReleaseGatesPassed(): boolean {
  return RELEASE_GATES.every((g) => g.passed && Boolean(g.evidence));
}

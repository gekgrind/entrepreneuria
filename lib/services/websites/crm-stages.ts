/**
 * Lifecycle state → GHL opportunity stage (logical names).
 *
 * GHL stays the owner's working CRM; this app does not become a second one.
 * Intake already creates one opportunity per new lead in the pipeline stage
 * GHL_PIPELINE_STAGE_ID (client.ts). This mapping says which stage that
 * opportunity should sit in as the lifecycle advances. Stage ids are NOT
 * configured or verified (D-10): no code moves opportunities yet, and any
 * future sync goes through the existing sandbox guard first.
 */
import type { CloseReason, ProjectState } from "./lifecycle";

export const CRM_STAGES = [
  "new_request",
  "qualifying",
  "preview",
  "preview_approved",
  "proposal",
  "awaiting_setup_payment",
  "build",
  "live",
  "lost",
  "canceled",
] as const;
export type CrmStageKey = (typeof CRM_STAGES)[number];

export interface CrmStage {
  stage: CrmStageKey;
  /** GHL opportunity status. Won once the setup fee is confirmed. */
  status: "open" | "won" | "lost" | "abandoned";
}

const STAGE: Readonly<Record<ProjectState, CrmStage>> = {
  preview_requested: { stage: "new_request", status: "open" },
  qualification_pending: { stage: "qualifying", status: "open" },
  qualified: { stage: "qualifying", status: "open" },
  preview_in_progress: { stage: "preview", status: "open" },
  preview_sent: { stage: "preview", status: "open" },
  revision_requested: { stage: "preview", status: "open" },
  preview_approved: { stage: "preview_approved", status: "open" },
  proposal_sent: { stage: "proposal", status: "open" },
  proposal_expired: { stage: "proposal", status: "open" },
  approved: { stage: "awaiting_setup_payment", status: "open" },
  setup_payment_pending: { stage: "awaiting_setup_payment", status: "open" },
  setup_payment_failed: { stage: "awaiting_setup_payment", status: "open" },
  setup_paid: { stage: "build", status: "won" },
  in_progress: { stage: "build", status: "won" },
  customer_delay: { stage: "build", status: "won" },
  customer_review: { stage: "build", status: "won" },
  launch_approved: { stage: "build", status: "won" },
  launch_failed: { stage: "build", status: "won" },
  live: { stage: "live", status: "won" },
  past_due: { stage: "live", status: "won" },
  cancellation_pending: { stage: "live", status: "won" },
  canceled: { stage: "canceled", status: "lost" },
  closed: { stage: "lost", status: "lost" },
};

export function crmStageFor(state: ProjectState, closedReason?: CloseReason | null): CrmStage {
  if (state === "closed" && closedReason === "abandoned") return { stage: "lost", status: "abandoned" };
  return STAGE[state];
}

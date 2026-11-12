/**
 * Customer communication templates for the preview → payment lifecycle.
 *
 * The wording lives in docs/websites/WEBSITES_CUSTOMER_COMMUNICATION_TEMPLATES.md
 * and is sent from GHL, not from this app. This registry only ties each
 * template to the lifecycle event that calls for it, so every transition
 * produces an auditable *intent* ("this message is due"), never a send.
 *
 * Nothing here sends anything. `isTemplateSendable` is the single check a
 * future sender must pass; today it is false for every template in every
 * mode: sandbox never messages real people, and production needs an
 * approved template plus Gate D (and Gate A/B/C for legal and payment
 * templates).
 */
import { evaluateProductionGate, type GateId } from "./activation-gates";
import type { Env } from "./flags";
import type { ProjectEventType, WebsiteProject } from "./lifecycle";

export type TemplateStatus = "draft" | "approved";
export type TemplateKind = "operational" | "legal" | "payment";

export interface CommunicationTemplate {
  id: string;
  title: string;
  kind: TemplateKind;
  status: TemplateStatus;
  /** Lifecycle event whose transition calls for this message. */
  trigger: ProjectEventType;
  /** Additional gate a legal or payment template needs before it may be sent. */
  requiresGate?: GateId;
}

export const COMMUNICATION_TEMPLATES = [
  { id: "request_acknowledgment", title: "Request acknowledgment", kind: "operational", status: "draft", trigger: "acknowledge_request" },
  { id: "preview_delivery", title: "Preview delivery", kind: "operational", status: "draft", trigger: "deliver_preview" },
  { id: "preview_feedback", title: "Preview feedback received", kind: "operational", status: "draft", trigger: "request_revision" },
  { id: "preview_approval_confirmation", title: "Preview approval confirmation", kind: "operational", status: "draft", trigger: "approve_preview" },
  { id: "proposal_introduction", title: "Proposal introduction", kind: "legal", status: "draft", trigger: "send_proposal", requiresGate: "agreement_acceptance" },
  { id: "agreement_acceptance_instructions", title: "Agreement acceptance instructions", kind: "legal", status: "draft", trigger: "send_proposal", requiresGate: "agreement_acceptance" },
  { id: "setup_payment_instructions", title: "Setup payment instructions", kind: "payment", status: "draft", trigger: "request_setup_payment", requiresGate: "setup_payment" },
  { id: "build_kickoff", title: "Build kickoff", kind: "operational", status: "draft", trigger: "start_implementation" },
  { id: "launch_approval_request", title: "Launch approval request", kind: "operational", status: "draft", trigger: "submit_for_review" },
  { id: "launch_confirmation", title: "Launch confirmation", kind: "operational", status: "draft", trigger: "verify_launch" },
  { id: "subscription_start_notification", title: "Monthly subscription start", kind: "payment", status: "draft", trigger: "subscription_activated", requiresGate: "subscription" },
] as const satisfies readonly CommunicationTemplate[];

export type TemplateId = (typeof COMMUNICATION_TEMPLATES)[number]["id"];

export interface CommunicationIntent {
  templateId: TemplateId;
  projectId: string;
  mode: WebsiteProject["mode"];
  dueAt: string;
  /** Always "not_sent": the app records intents; GHL (once authorized) sends. */
  delivery: "not_sent";
}

export function getTemplate(id: TemplateId): CommunicationTemplate {
  const t = COMMUNICATION_TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown template: ${id}`);
  return t;
}

export function intentsFor(event: ProjectEventType, project: WebsiteProject, at: string): CommunicationIntent[] {
  return COMMUNICATION_TEMPLATES.filter((t) => t.trigger === event).map((t) => ({
    templateId: t.id,
    projectId: project.id,
    mode: project.mode,
    dueAt: at,
    delivery: "not_sent" as const,
  }));
}

/** Every reason a template may not be sent to this project's customer. Empty = sendable. */
export function templateSendBlockers(id: TemplateId, project: WebsiteProject, env: Env): string[] {
  const t = getTemplate(id);
  const blockers: string[] = [];
  if (project.mode === "sandbox") blockers.push("sandbox_never_sends");
  if (t.status !== "approved") blockers.push(`template_${t.status}`);
  for (const u of evaluateProductionGate(env).unmet) blockers.push(u);
  if (t.requiresGate) blockers.push(`requires_gate:${t.requiresGate}`);
  return blockers;
}

export function isTemplateSendable(id: TemplateId, project: WebsiteProject, env: Env): boolean {
  return templateSendBlockers(id, project, env).length === 0;
}

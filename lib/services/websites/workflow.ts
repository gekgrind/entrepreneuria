/**
 * Lifecycle event processing: the only entry point that should apply
 * events to stored projects.
 *
 *   - Idempotent: each event carries an `eventId` (a provider event id, or
 *     an owner action id). Replaying an id returns the original outcome and
 *     changes nothing.
 *   - Semantic duplicates (the same preview approval, payment, launch or
 *     subscription delivered under a new id) are recognised and become
 *     no-ops; a CONFLICTING duplicate (a second, different setup charge) is
 *     rejected and recorded for owner review, never silently absorbed.
 *   - Actor rules: owner-controlled steps must come from the owner.
 *     Verifying who the owner is stays with the caller (D-12 allowlist).
 *   - Payment provenance: payment and subscription facts are accepted only
 *     from the provider, with a callback whose signature was verified by
 *     `verifyProviderCallback` and whose event id, project, mode and signed
 *     fields match the event. Declaring `actor.kind: "provider"` is not enough,
 *     and the owner cannot record a payment by hand.
 *   - Optimistic concurrency with bounded retry; a failed commit leaves the
 *     store unchanged, so the caller may retry with the same eventId.
 *   - Every applied event yields an audit entry, the communication intents
 *     it calls for (never sends), and the CRM stage to mirror in GHL.
 *     Every rejection is recorded.
 */
import { intentsFor, type CommunicationIntent } from "./communications";
import { crmStageFor, type CrmStage } from "./crm-stages";
import {
  transition,
  TransitionError,
  type AuditEntry,
  type ProjectEvent,
  type ProjectEventType,
  type WebsiteProject,
} from "./lifecycle";
import { provenanceProblem, type VerifiedProviderEvent } from "./payments/verified-event";

export type ActorKind = "owner" | "customer" | "provider" | "system";
export interface Actor {
  kind: ActorKind;
  /** Opaque id: owner user id, provider name, job name. Never an email or name. */
  id: string;
}

const OWNER: readonly ActorKind[] = ["owner"];
const CUSTOMER_DECISION: readonly ActorKind[] = ["owner", "customer", "provider"];
/** Payment facts: provider only, and only with a verified callback (see `provenanceProblem`). */
const PAYMENT: readonly ActorKind[] = ["provider"];
const OWNER_OR_SYSTEM: readonly ActorKind[] = ["owner", "system"];

/** Who may originate each event. Customer decisions arrive via GHL or are recorded by the owner with evidence. */
export const ACTOR_RULES: Readonly<Record<ProjectEventType, readonly ActorKind[]>> = {
  acknowledge_request: OWNER,
  qualify: OWNER,
  start_preview: OWNER,
  deliver_preview: OWNER,
  request_revision: CUSTOMER_DECISION,
  approve_preview: CUSTOMER_DECISION,
  send_proposal: OWNER,
  expire_proposal: OWNER_OR_SYSTEM,
  close_inquiry: OWNER,
  approve: CUSTOMER_DECISION,
  request_setup_payment: OWNER,
  setup_payment_succeeded: PAYMENT,
  setup_payment_failed: PAYMENT,
  start_implementation: OWNER,
  flag_customer_delay: OWNER,
  resolve_customer_delay: OWNER,
  submit_for_review: OWNER,
  request_changes: CUSTOMER_DECISION,
  approve_launch: CUSTOMER_DECISION,
  deployment_succeeded: OWNER_OR_SYSTEM,
  deployment_failed: OWNER_OR_SYSTEM,
  verify_launch: OWNER,
  subscription_activated: PAYMENT,
  subscription_payment_failed: PAYMENT,
  subscription_payment_recovered: PAYMENT,
  request_cancellation: OWNER,
  withdraw_cancellation: OWNER,
  cancellation_effective: OWNER_OR_SYSTEM,
  cancel_before_launch: OWNER,
};

export interface EventEnvelope {
  eventId: string;
  projectId: string;
  event: ProjectEvent;
  actor: Actor;
  at: Date;
  /** Required for payment and subscription facts: the result of `verifyProviderCallback`. */
  provenance?: VerifiedProviderEvent;
}

export type RejectionCode =
  | "invalid_envelope"
  | "unknown_project"
  | "actor_not_permitted"
  | "unverified_provenance"
  | "invalid_transition"
  | "possible_double_payment"
  | "conflicting_duplicate";

export type Outcome =
  | { status: "applied"; project: WebsiteProject; audit: AuditEntry; intents: CommunicationIntent[]; crmStage: CrmStage }
  | { status: "duplicate"; project: WebsiteProject; reason: "event_id_replayed" | "already_recorded" }
  | { status: "rejected"; code: RejectionCode; reason: string; project: WebsiteProject | null };

export interface Rejection {
  eventId: string;
  projectId: string;
  event: ProjectEventType;
  actor: string;
  at: string;
  code: RejectionCode;
  reason: string;
}

export interface StoredProject {
  project: WebsiteProject;
  version: number;
}

/**
 * Persistence boundary. `commit` must be atomic: project row, audit row and
 * processed event id together, or nothing (DB: one transaction, unique
 * (project_id, event_id), `version` compare-and-set).
 */
export interface LifecycleStore {
  load(projectId: string): Promise<StoredProject | null>;
  hasEvent(projectId: string, eventId: string): Promise<boolean>;
  commit(input: {
    project: WebsiteProject;
    expectedVersion: number;
    eventId: string;
    audit: AuditEntry;
    intents: CommunicationIntent[];
  }): Promise<"committed" | "version_conflict" | "event_exists">;
  recordRejection(r: Rejection): Promise<void>;
}

/**
 * How far an envelope's `at` may differ from the server clock. Expiry, minimum
 * term and cancellation dates are all judged against `at`, so a caller (or a
 * replayed request) must not be able to pick it freely.
 */
export const MAX_EVENT_SKEW_MS = 5 * 60 * 1000;

export class LifecycleConcurrencyError extends Error {
  constructor(projectId: string) {
    super(`Project ${projectId} kept changing during the update; retry with the same eventId`);
    this.name = "LifecycleConcurrencyError";
  }
}

/**
 * Same fact, new id → no-op. Contradicting fact → reject for owner review.
 * Returns null when the event should go through normal transition rules.
 */
function semanticDuplicate(p: WebsiteProject, e: ProjectEvent): { duplicate: true } | { conflict: RejectionCode; reason: string } | null {
  switch (e.type) {
    case "acknowledge_request":
      return p.acknowledgedAt ? { duplicate: true } : null;
    case "approve_preview":
      if (!p.previewApproval) return null;
      return p.previewApproval.revision === e.revision
        ? { duplicate: true }
        : { conflict: "conflicting_duplicate", reason: `preview already approved at revision ${p.previewApproval.revision}` };
    case "approve":
      return p.acceptance && p.approvedAt ? { duplicate: true } : null;
    case "setup_payment_succeeded":
      if (!p.setupChargeId) return null;
      return p.setupChargeId === e.chargeId
        ? { duplicate: true }
        : { conflict: "possible_double_payment", reason: `setup fee already paid by ${p.setupChargeId}; ${e.chargeId} needs owner review and possible refund` };
    case "setup_payment_failed":
      // A late failure for a request that has since been paid changes nothing.
      return p.setupChargeId ? { duplicate: true } : null;
    case "deployment_succeeded":
      return p.launchedAt ? { duplicate: true } : null;
    case "verify_launch":
      return p.launchVerification ? { duplicate: true } : null;
    case "subscription_activated":
      if (!p.subscriptionId) return null;
      return p.subscriptionId === e.subscriptionId
        ? { duplicate: true }
        : { conflict: "conflicting_duplicate", reason: `subscription ${p.subscriptionId} already recorded; ${e.subscriptionId} needs owner review` };
    default:
      return null;
  }
}

const isNonEmpty = (v: unknown) => typeof v === "string" && v.trim().length > 0 && v.length <= 200;

/** Rejection rows hold caller-supplied text: cap it so a hostile envelope cannot flood logs or storage. */
const clip = (v: unknown, max = 200) => String(v).slice(0, max);

export async function applyLifecycleEvent(
  store: LifecycleStore,
  env: EventEnvelope,
  opts: { maxAttempts?: number; /** Server clock. Tests inject one; production uses the real clock. */ now?: () => Date } = {}
): Promise<Outcome> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const actorLabel = clip(`${env.actor?.kind}:${env.actor?.id}`);

  const reject = async (code: RejectionCode, reason: string, project: WebsiteProject | null): Promise<Outcome> => {
    await store.recordRejection({
      eventId: clip(env.eventId),
      projectId: clip(env.projectId),
      event: clip(env.event?.type) as ProjectEventType,
      actor: actorLabel,
      at: env.at instanceof Date && !Number.isNaN(env.at.getTime()) ? env.at.toISOString() : "invalid",
      code,
      reason: clip(reason, 300),
    });
    return { status: "rejected", code, reason, project };
  };

  if (!isNonEmpty(env.eventId) || !isNonEmpty(env.projectId) || !env.event?.type || !env.actor || !isNonEmpty(env.actor.id)) {
    return reject("invalid_envelope", "eventId, projectId, event and actor are required", null);
  }
  if (!(env.at instanceof Date) || Number.isNaN(env.at.getTime())) return reject("invalid_envelope", "invalid event time", null);
  if (Math.abs(env.at.getTime() - (opts.now ?? (() => new Date()))().getTime()) > MAX_EVENT_SKEW_MS) {
    return reject("invalid_envelope", "event time differs from the server clock", null);
  }
  const allowed = ACTOR_RULES[env.event.type];
  if (!allowed) return reject("invalid_envelope", `unknown event "${env.event.type}"`, null);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const stored = await store.load(env.projectId);
    if (!stored) return reject("unknown_project", `no project ${env.projectId}`, null);
    const { project, version } = stored;

    if (await store.hasEvent(project.id, env.eventId)) return { status: "duplicate", project, reason: "event_id_replayed" };
    if (!allowed.includes(env.actor.kind)) {
      return reject("actor_not_permitted", `${env.actor.kind} may not ${env.event.type}`, project);
    }
    const unverified = provenanceProblem({
      eventId: env.eventId,
      projectId: env.projectId,
      projectMode: project.mode,
      event: env.event as unknown as { type: string } & Record<string, unknown>,
      provenance: env.provenance,
    });
    if (unverified) return reject("unverified_provenance", unverified, project);

    const dup = semanticDuplicate(project, env.event);
    if (dup && "duplicate" in dup) return { status: "duplicate", project, reason: "already_recorded" };
    if (dup) return reject(dup.conflict, dup.reason, project);

    let result: ReturnType<typeof transition>;
    try {
      result = transition(project, env.event, { at: env.at, actor: actorLabel });
    } catch (err) {
      if (err instanceof TransitionError) return reject("invalid_transition", err.message, project);
      throw err;
    }

    const intents = intentsFor(env.event.type, result.project, result.audit.at);
    const committed = await store.commit({ project: result.project, expectedVersion: version, eventId: env.eventId, audit: result.audit, intents });
    if (committed === "committed") {
      return { status: "applied", project: result.project, audit: result.audit, intents, crmStage: crmStageFor(result.project.state, result.project.closedReason) };
    }
    if (committed === "event_exists") {
      const latest = await store.load(env.projectId);
      return { status: "duplicate", project: latest?.project ?? project, reason: "event_id_replayed" };
    }
    // version_conflict: another event landed first; reload and re-evaluate.
  }
  throw new LifecycleConcurrencyError(env.projectId);
}

/** In-memory store for tests and sandbox runs. Atomic per commit. */
export function createMemoryLifecycleStore(seed: WebsiteProject[] = []) {
  const projects = new Map<string, StoredProject>(seed.map((p) => [p.id, { project: p, version: 0 }]));
  const events = new Map<string, Set<string>>();
  const audit: AuditEntry[] = [];
  const intents: CommunicationIntent[] = [];
  const rejections: Rejection[] = [];
  let failNextCommits = 0;

  return {
    audit: audit as readonly AuditEntry[],
    intents: intents as readonly CommunicationIntent[],
    rejections: rejections as readonly Rejection[],
    /** Test hook: make the next n commits throw before writing anything. */
    failNextCommits(n = 1) {
      failNextCommits = n;
    },
    /** Test hook: simulate a concurrent writer bumping the version. */
    bumpVersion(projectId: string) {
      const s = projects.get(projectId);
      if (s) projects.set(projectId, { ...s, version: s.version + 1 });
    },
    create(p: WebsiteProject) {
      if (projects.has(p.id)) throw new Error(`project ${p.id} exists`);
      projects.set(p.id, { project: p, version: 0 });
    },
    async load(id: string) {
      return projects.get(id) ?? null;
    },
    async hasEvent(projectId: string, eventId: string) {
      return events.get(projectId)?.has(eventId) ?? false;
    },
    async commit(input: Parameters<LifecycleStore["commit"]>[0]) {
      if (failNextCommits > 0) {
        failNextCommits--;
        throw new Error("simulated store failure");
      }
      const current = projects.get(input.project.id);
      if (!current) throw new Error("unknown project");
      const seen = events.get(input.project.id) ?? new Set<string>();
      if (seen.has(input.eventId)) return "event_exists" as const;
      if (current.version !== input.expectedVersion) return "version_conflict" as const;
      projects.set(input.project.id, { project: input.project, version: current.version + 1 });
      seen.add(input.eventId);
      events.set(input.project.id, seen);
      audit.push(input.audit);
      intents.push(...input.intents);
      return "committed" as const;
    },
    async recordRejection(r: Rejection) {
      rejections.push(r);
    },
  } satisfies LifecycleStore & Record<string, unknown>;
}

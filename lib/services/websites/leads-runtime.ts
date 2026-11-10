/**
 * Process-lifetime state for the leads-only intake: rate limiters, the
 * capacity check and the alerter. Built once per distinct configuration so
 * limiter windows, the capacity cache and alert dedupe survive across
 * requests. Pure factory: every side effect is injected.
 */
import { createHmac } from "node:crypto";

import { createRateLimiter, type RateLimiter } from "../../rate-limit";
import type { LeadCrm } from "../../integrations/ghl/client";

import { createAlerter, type Alerter } from "./alerts";
import { createAdmission, type Admission } from "./capacity";
import type { InquiryFields } from "./inquiry-schema";
import type { ReturningContactDeps } from "./intake";
import type { LeadsConfig } from "./leads-config";
import { createFileReviewStore, type ReviewStore } from "./review-store";

export interface LeadsRuntime {
  alerter: Alerter;
  /** Returning-contact handling for the intake (review store, notices, serialization). */
  returning: ReturningContactDeps;
  /**
   * Re-sends review notices that never reached the owner (receiver down,
   * process restarted). Bounded and throttled; call it on each request.
   */
  retryPendingReviews(): Promise<void>;
  admission: () => Promise<Admission>;
  rateLimiters: { ip: RateLimiter; email: RateLimiter; global: RateLimiter };
}

export function createLeadsRuntime(
  config: LeadsConfig,
  io: {
    getCrm: () => LeadCrm | null;
    environment: string;
    fetch?: (input: string, init?: RequestInit) => Promise<Response>;
    now?: () => Date;
    log?: (msg: string, meta?: Record<string, unknown>) => void;
    sleep?: (ms: number) => Promise<void>;
    /** Test seam; production uses the file store in config.reviewDir. */
    reviewStore?: ReviewStore;
  }
): LeadsRuntime {
  const alerter = createAlerter({
    url: config.alertWebhookUrl,
    secret: config.alertWebhookSecret,
    environment: io.environment,
    fetch: io.fetch,
    now: io.now,
    log: io.log,
    sleep: io.sleep,
  });

  const admission = createAdmission({
    intake: config.previewIntake,
    maxOpen: config.maxOpenRequests,
    count: async () => {
      const crm = io.getCrm();
      if (!crm?.countOpenOpportunities) throw new Error("capacity count not supported by the CRM adapter");
      return crm.countOpenOpportunities({ stageId: config.countStageId });
    },
    onCountUnavailable: () => alerter.raise({ event: "capacity_count_unavailable" }),
    // Counts only (e.g. "4:5"); never lead data.
    onLevel: (level, open, max) =>
      alerter.raise({ event: level === "full" ? "capacity_full" : "capacity_near", step: "capacity", status: `${open}:${max}` }),
  });

  const reviewStore = io.reviewStore ?? createFileReviewStore(config.reviewDir);
  const nowMs = () => (io.now ? io.now().getTime() : Date.now());
  const log = io.log ?? (() => {});

  /* Last notice attempt per reference, so retries are throttled (in memory; a restart retries once). */
  const lastAttempt = new Map<string, number>();
  const RETRY_EVERY_MS = 10 * 60_000;
  const MAX_RETRIES_PER_CALL = 5;

  async function sendNotice(ref: string): Promise<void> {
    lastAttempt.set(ref, nowMs());
    const delivered = await alerter.notify({ event: "returning_contact_review", step: "review", status: ref });
    if (!delivered) return; // stays pending; retryPendingReviews tries again
    await reviewStore.markNotified(ref, new Date(nowMs()).toISOString()).catch((err) =>
      log("review notified flag not saved", { ref, error: (err as Error).name })
    );
  }

  /* Per-key promise chain: same email → one submission at a time in this process. */
  const chains = new Map<string, Promise<unknown>>();
  function serialize<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = chains.get(key) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    const tail = run.then(
      () => {},
      () => {}
    );
    chains.set(key, tail);
    void tail.then(() => {
      if (chains.get(key) === tail) chains.delete(key);
    });
    return run;
  }

  /* References of new leads synced in the last 10 minutes. */
  const synced = new Map<string, number>();
  const SYNC_MEMORY_MS = 10 * 60_000;

  const returning: ReturningContactDeps = {
    reviewStore,
    reference: (fields: InquiryFields) => {
      const content = [
        fields.email.trim().toLowerCase(),
        fields.name.trim(),
        fields.business.trim(),
        fields.phone ?? "",
        fields.business_type,
        fields.website ?? "",
        fields.package_interest,
        fields.style_interest,
        fields.contact_method,
        fields.message ?? "",
      ].join("\u0000");
      return `r-${createHmac("sha256", config.referenceKey).update(content).digest("hex").slice(0, 16)}`;
    },
    notify: (ref) => {
      void sendNotice(ref).catch((err) => log("review notice failed", { ref, error: (err as Error).name }));
    },
    serialize,
    recentlySynced: {
      has: (ref) => {
        const at = synced.get(ref);
        return at !== undefined && nowMs() - at < SYNC_MEMORY_MS;
      },
      add: (ref) => {
        synced.set(ref, nowMs());
        if (synced.size > 1000) for (const [k, at] of synced) if (nowMs() - at >= SYNC_MEMORY_MS) synced.delete(k);
      },
    },
  };

  async function retryPendingReviews(): Promise<void> {
    try {
      const pending = (await reviewStore.list()).filter((r) => !r.notified_at && !r.resolved_at);
      let sent = 0;
      for (const r of pending) {
        if (sent >= MAX_RETRIES_PER_CALL) break;
        const last = lastAttempt.get(r.ref);
        if (last !== undefined && nowMs() - last < RETRY_EVERY_MS) continue;
        sent += 1;
        await sendNotice(r.ref);
      }
    } catch (err) {
      log("pending review retry failed", { error: (err as Error).name });
    }
  }

  return {
    alerter,
    returning,
    retryPendingReviews,
    admission,
    // Per process; fine for the single pm2 instance only (lib/rate-limit.ts).
    rateLimiters: {
      ip: createRateLimiter({ limit: 5, windowMs: 10 * 60_000 }),
      email: createRateLimiter({ limit: 3, windowMs: 60 * 60_000 }),
      global: createRateLimiter({ limit: 40, windowMs: 60 * 60_000 }),
    },
  };
}

/**
 * Process-lifetime state for the leads-only intake: rate limiters, the
 * capacity check and the alerter. Built once per distinct configuration so
 * limiter windows, the capacity cache and alert dedupe survive across
 * requests. Pure factory: every side effect is injected.
 */
import { createRateLimiter, type RateLimiter } from "../../rate-limit";
import type { LeadCrm } from "../../integrations/ghl/client";

import { createAlerter, type Alerter } from "./alerts";
import { createAdmission, type Admission } from "./capacity";
import type { LeadsConfig } from "./leads-config";

export interface LeadsRuntime {
  alerter: Alerter;
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
  });

  return {
    alerter,
    admission,
    // Per process; fine for the single pm2 instance only (lib/rate-limit.ts).
    rateLimiters: {
      ip: createRateLimiter({ limit: 5, windowMs: 10 * 60_000 }),
      email: createRateLimiter({ limit: 3, windowMs: 60 * 60_000 }),
      global: createRateLimiter({ limit: 40, windowMs: 60 * 60_000 }),
    },
  };
}

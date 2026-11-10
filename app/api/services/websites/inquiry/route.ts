import { after } from "next/server";

import { getGhlClient } from "@/lib/integrations/ghl/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { handleInquiryPost } from "@/lib/services/websites/inquiry-route";
import { getSupabaseInquiryStore } from "@/lib/services/websites/inquiry-store-supabase";
import type { LeadsConfig } from "@/lib/services/websites/leads-config";
import { createLeadsRuntime, type LeadsRuntime } from "@/lib/services/websites/leads-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Per-process limits; see lib/rate-limit.ts for the multi-instance caveat. */
const rateLimiters = {
  ip: createRateLimiter({ limit: 5, windowMs: 10 * 60_000 }),
  email: createRateLimiter({ limit: 3, windowMs: 60 * 60_000 }),
};

/* Leads-mode state (limiters, capacity cache, alert dedupe) lives for the process, per distinct configuration. */
let leads: { key: string; value: LeadsRuntime } | null = null;
function getLeadsRuntime(config: LeadsConfig): LeadsRuntime {
  const key = JSON.stringify(config);
  if (!leads || leads.key !== key) {
    leads = {
      key,
      value: createLeadsRuntime(config, {
        getCrm: config.delivery === "manual" ? () => null : getGhlClient,
        environment: process.env.NODE_ENV ?? "unknown",
        log: (msg, meta) => console.error(`[websites-alert] ${msg}`, meta ?? ""),
      }),
    };
  }
  return leads.value;
}

export function POST(request: Request) {
  return handleInquiryPost(request, {
    getStore: getSupabaseInquiryStore,
    getCrm: getGhlClient,
    rateLimiters,
    leadsRuntime: getLeadsRuntime,
    schedule: (work) => after(work),
  });
}

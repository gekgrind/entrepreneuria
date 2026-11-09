import { NextResponse, after } from "next/server";

import { getGhlClient } from "@/lib/integrations/ghl/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/auth/verify-turnstile";
import { handleInquiry } from "@/lib/services/websites/inquiry-handler";
import { getSupabaseInquiryStore } from "@/lib/services/websites/inquiry-store-supabase";
import type { LeadsConfig } from "@/lib/services/websites/leads-config";
import { createLeadsRuntime, type LeadsRuntime } from "@/lib/services/websites/leads-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Per-process limits; see lib/rate-limit.ts for the multi-instance caveat. */
const legacyRateLimiters = {
  ip: createRateLimiter({ limit: 5, windowMs: 10 * 60_000 }),
  email: createRateLimiter({ limit: 3, windowMs: 60 * 60_000 }),
};

/* Leads-mode state (limiters, capacity cache, alert dedupe) lives for the process, per distinct configuration. */
let leadsRuntime: { key: string; value: LeadsRuntime } | null = null;
function getLeadsRuntime(config: LeadsConfig): LeadsRuntime {
  const key = JSON.stringify(config);
  if (!leadsRuntime || leadsRuntime.key !== key) {
    leadsRuntime = {
      key,
      value: createLeadsRuntime(config, {
        getCrm: getGhlClient,
        verifyTurnstileToken,
        environment: process.env.NODE_ENV ?? "unknown",
        log: (msg, meta) => console.error(`[websites-alert] ${msg}`, meta ?? ""),
      }),
    };
  }
  return leadsRuntime.value;
}

export async function POST(request: Request) {
  const r = await handleInquiry(request, {
    env: process.env,
    now: () => new Date(),
    log: (msg, meta) => console.error(`[websites-inquiry] ${msg}`, meta ?? ""),
    getStore: getSupabaseInquiryStore,
    getCrm: getGhlClient,
    legacy: {
      rateLimiters: legacyRateLimiters,
      verifyTurnstile: process.env.TURNSTILE_SECRET_KEY ? verifyTurnstileToken : null,
    },
    leadsRuntime: getLeadsRuntime,
    schedule: (work) => after(work),
  });
  return NextResponse.json(r.body, { status: r.status, headers: r.headers });
}

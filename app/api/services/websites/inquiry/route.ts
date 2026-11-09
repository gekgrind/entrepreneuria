import { getGhlClient } from "@/lib/integrations/ghl/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { handleInquiryPost } from "@/lib/services/websites/inquiry-route";
import { getSupabaseInquiryStore } from "@/lib/services/websites/inquiry-store-supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Per-process limits; see lib/rate-limit.ts for the multi-instance caveat. */
const rateLimiters = {
  ip: createRateLimiter({ limit: 5, windowMs: 10 * 60_000 }),
  email: createRateLimiter({ limit: 3, windowMs: 60 * 60_000 }),
};

export function POST(request: Request) {
  return handleInquiryPost(request, { getStore: getSupabaseInquiryStore, getCrm: getGhlClient, rateLimiters });
}

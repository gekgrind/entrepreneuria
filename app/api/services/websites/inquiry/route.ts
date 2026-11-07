import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { getGhlClient } from "@/lib/integrations/ghl/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/auth/verify-turnstile";
import { resolveServicesMode } from "@/lib/services/websites/flags";
import { processInquiry } from "@/lib/services/websites/intake";
import { getSupabaseInquiryStore } from "@/lib/services/websites/inquiry-store-supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Per-process limits; see lib/rate-limit.ts for the multi-instance caveat. */
const rateLimiters = {
  ip: createRateLimiter({ limit: 5, windowMs: 10 * 60_000 }),
  email: createRateLimiter({ limit: 3, windowMs: 60 * 60_000 }),
};

const MAX_BODY_BYTES = 16_384;

function clientIpHash(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip");
  if (!ip) return null;
  const salt = process.env.WEBSITES_IP_HASH_SALT ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export async function POST(request: Request) {
  if (resolveServicesMode() === "off") {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "invalid", fieldErrors: { form: ["Request too large."] } }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid", fieldErrors: { form: ["Malformed request."] } }, { status: 400 });
  }

  const result = await processInquiry(
    body,
    { ipHash: clientIpHash(request), userAgent: request.headers.get("user-agent") },
    {
      store: getSupabaseInquiryStore(),
      crm: getGhlClient(),
      rateLimiters,
      verifyTurnstile: process.env.TURNSTILE_SECRET_KEY ? verifyTurnstileToken : null,
      now: () => new Date(),
      log: (msg, meta) => console.error(`[websites-inquiry] ${msg}`, meta ?? ""),
    }
  );

  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (result.status === 429) headers["Retry-After"] = String(result.body.retryAfterSeconds);
  return NextResponse.json(result.body, { status: result.status, headers });
}

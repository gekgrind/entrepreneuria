import { NextResponse } from "next/server";

import { getGhlClient } from "@/lib/integrations/ghl/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { reportClosedGate, resolveWebsitesGate } from "@/lib/services/websites/gate";
import { processInquiry } from "@/lib/services/websites/intake";
import { getSupabaseInquiryStore } from "@/lib/services/websites/inquiry-store-supabase";
import { hashClientIp, proxyClientIp, readBodyCapped } from "@/lib/services/websites/request-guards";
import { createTurnstileVerifier } from "@/lib/services/websites/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Per-process limits; see lib/rate-limit.ts for the multi-instance caveat. */
const rateLimiters = {
  ip: createRateLimiter({ limit: 5, windowMs: 10 * 60_000 }),
  email: createRateLimiter({ limit: 3, windowMs: 60 * 60_000 }),
};

const MAX_BODY_BYTES = 16_384;

let reportedMissingIp = false;

const invalid = (status: 400 | 413, message: string) =>
  NextResponse.json({ ok: false, error: "invalid", fieldErrors: { form: [message] } }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  // Release gate (mode, host allowlist, required secrets). Fails closed.
  const gate = resolveWebsitesGate(request.headers);
  if (!gate.enabled) {
    reportClosedGate(gate);
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const read = await readBodyCapped(request, MAX_BODY_BYTES);
  if (!read.ok) return read.reason === "too_large" ? invalid(413, "Request too large.") : invalid(400, "Malformed request.");
  let body: unknown;
  try {
    body = JSON.parse(read.text);
  } catch {
    return invalid(400, "Malformed request.");
  }

  const ip = proxyClientIp(request.headers);
  if (!ip && !reportedMissingIp) {
    reportedMissingIp = true;
    console.error("[websites-inquiry] no client address from the proxy; requests share one rate-limit bucket");
  }

  const result = await processInquiry(
    body,
    {
      ipHash: ip ? hashClientIp(ip, gate.ipHashSalt) : null,
      userAgent: request.headers.get("user-agent"),
      pageOrigin: gate.origin,
    },
    {
      store: getSupabaseInquiryStore(),
      crm: getGhlClient(),
      rateLimiters,
      verifyTurnstile: createTurnstileVerifier({ secret: gate.turnstileSecret, expectedHostname: gate.hostname }),
      now: () => new Date(),
      log: (msg, meta) => console.error(`[websites-inquiry] ${msg}`, meta ?? ""),
    }
  );

  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (result.status === 429) headers["Retry-After"] = String(result.body.retryAfterSeconds);
  return NextResponse.json(result.body, { status: result.status, headers });
}

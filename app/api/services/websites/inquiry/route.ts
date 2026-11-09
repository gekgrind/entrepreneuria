import { NextResponse } from "next/server";

import { getGhlClient } from "@/lib/integrations/ghl/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { reportGateRefusal, resolveRequestServicesGate } from "@/lib/services/websites/flags";
import { hostnameOf } from "@/lib/services/websites/hosts";
import { processInquiry } from "@/lib/services/websites/intake";
import { getSupabaseInquiryStore } from "@/lib/services/websites/inquiry-store-supabase";
import { clientIpHash, readBodyCapped } from "@/lib/services/websites/request";
import { createTurnstileVerifier, WEBSITES_TURNSTILE_ACTION } from "@/lib/services/websites/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Per-process limits; see lib/rate-limit.ts for the multi-instance caveat. */
const rateLimiters = {
  ip: createRateLimiter({ limit: 5, windowMs: 10 * 60_000 }),
  email: createRateLimiter({ limit: 3, windowMs: 60 * 60_000 }),
};

const MAX_BODY_BYTES = 16_384;

let reportedMissingIp = false;

const invalid = (status: number, message: string) =>
  NextResponse.json({ ok: false, error: "invalid", fieldErrors: { form: [message] } }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  // Release gate: mode on, allowed host, intake fully configured (flags.ts). Otherwise 404.
  const gate = resolveRequestServicesGate(request.headers.get("host"));
  if (gate.mode === "off" || !gate.host) {
    reportGateRefusal(gate);
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const read = await readBodyCapped(request, MAX_BODY_BYTES);
  if (!read.ok) {
    return read.reason === "too_large" ? invalid(413, "Request too large.") : invalid(400, "Malformed request.");
  }
  let body: unknown;
  try {
    body = JSON.parse(read.text);
  } catch {
    return invalid(400, "Malformed request.");
  }

  // The gate guarantees the salt and the Turnstile secret are present.
  const salt = process.env.WEBSITES_IP_HASH_SALT as string;
  const ipHash = clientIpHash(request.headers, salt);
  if (!ipHash && !reportedMissingIp) {
    reportedMissingIp = true;
    console.error("[websites-inquiry] no usable client IP from the proxy; requests share one rate-limit bucket");
  }
  const result = await processInquiry(
    body,
    { ipHash, userAgent: request.headers.get("user-agent") },
    {
      store: getSupabaseInquiryStore(),
      crm: getGhlClient(),
      rateLimiters,
      verifyTurnstile: createTurnstileVerifier({
        secret: process.env.TURNSTILE_SECRET_KEY as string,
        expectedHostname: hostnameOf(gate.host),
        expectedAction: WEBSITES_TURNSTILE_ACTION,
      }),
      allowedPageHosts: [gate.host],
      now: () => new Date(),
      log: (msg, meta) => console.error(`[websites-inquiry] ${msg}`, meta ?? ""),
    }
  );

  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (result.status === 429) headers["Retry-After"] = String(result.body.retryAfterSeconds);
  return NextResponse.json(result.body, { status: result.status, headers });
}

/**
 * POST /api/services/websites/inquiry, with its server-only dependencies
 * injected so the whole request path (gate, body cap, client address,
 * Turnstile wiring) is unit-tested. app/api/services/websites/inquiry
 * supplies the real store and CRM.
 */
import type { LeadCrm } from "../../integrations/ghl/client";
import type { RateLimiter } from "../../rate-limit";

import { reportClosedGate, resolveWebsitesGate } from "./gate";
import { processInquiry, type InquiryStore } from "./intake";
import { hashClientIp, proxyClientIp, rateLimitAddress, readBodyCapped } from "./request-guards";
import { createTurnstileVerifier } from "./turnstile";

export const MAX_INQUIRY_BODY_BYTES = 16_384;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface InquiryRouteDeps {
  env?: Record<string, string | undefined>;
  getStore: () => InquiryStore | null;
  getCrm: () => LeadCrm | null;
  rateLimiters: { ip: RateLimiter; email: RateLimiter };
  /** Used for Turnstile siteverify. */
  fetch?: FetchLike;
  now?: () => Date;
  log?: (msg: string, meta?: Record<string, unknown>) => void;
}

let reportedMissingIp = false;

const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });

const invalid = (status: 400 | 413, message: string) =>
  json({ ok: false, error: "invalid", fieldErrors: { form: [message] } }, status);

export async function handleInquiryPost(request: Request, deps: InquiryRouteDeps): Promise<Response> {
  const env = deps.env ?? process.env;
  const log = deps.log ?? ((msg, meta) => console.error(`[websites-inquiry] ${msg}`, meta ?? ""));

  // Release gate (mode, host allowlist, required secrets). Fails closed.
  const gate = resolveWebsitesGate(request.headers, env);
  if (!gate.enabled) {
    reportClosedGate(gate);
    return json({ ok: false, error: "not_found" }, 404);
  }

  const read = await readBodyCapped(request, MAX_INQUIRY_BODY_BYTES);
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
    log("no client address from the proxy; verified requests share one rate-limit bucket");
  }

  const result = await processInquiry(
    body,
    {
      ipHash: ip ? hashClientIp(ip, gate.ipHashSalt) : null,
      ipBucket: ip ? hashClientIp(rateLimitAddress(ip), gate.ipHashSalt) : null,
      userAgent: request.headers.get("user-agent"),
      pageOrigin: gate.origin,
    },
    {
      store: deps.getStore(),
      crm: deps.getCrm(),
      rateLimiters: deps.rateLimiters,
      verifyTurnstile: createTurnstileVerifier({ secret: gate.turnstileSecret, expectedHostname: gate.hostname, fetch: deps.fetch }),
      now: deps.now ?? (() => new Date()),
      log,
    }
  );

  return json(result.body, result.status, result.status === 429 ? { "Retry-After": String(result.body.retryAfterSeconds) } : {});
}

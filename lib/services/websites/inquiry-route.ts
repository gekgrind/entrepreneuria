/**
 * POST /api/services/websites/inquiry, with its server-only dependencies
 * injected so the whole request path (gate, body cap, client address,
 * Turnstile wiring) is unit-tested. app/api/services/websites/inquiry
 * supplies the real store and CRM.
 */
import type { LeadCrm } from "../../integrations/ghl/client";
import type { CrmContext } from "../../integrations/ghl/crm-boundary";
import type { RateLimiter } from "../../rate-limit";

import type { AlertSignal } from "./alerts";
import { reportClosedGate, resolveWebsitesGate } from "./gate";
import { processInquiry, type InquiryStore, type IntakeEvent } from "./intake";
import { isAllowedOrigin, isJsonContentType } from "./leads-guards";
import { readLeadsConfig, type LeadsConfig } from "./leads-config";
import type { LeadsRuntime } from "./leads-runtime";
import type { ReleaseGate } from "./release-gates";
import { hashClientIp, proxyClientIp, rateLimitAddress, readBodyCapped } from "./request-guards";
import { createTurnstileVerifier } from "./turnstile";

export const MAX_INQUIRY_BODY_BYTES = 16_384;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface InquiryRouteDeps {
  env?: Record<string, string | undefined>;
  getStore: () => InquiryStore | null;
  /** Receives what the release gate resolved (mode and host) so it can pick the sandbox or production CRM. */
  getCrm: (ctx: CrmContext) => LeadCrm | null;
  rateLimiters: { ip: RateLimiter; email: RateLimiter };
  /** Used for Turnstile siteverify. */
  fetch?: FetchLike;
  now?: () => Date;
  log?: (msg: string, meta?: Record<string, unknown>) => void;
  /** Leads mode only: process-lifetime limiters, capacity check and alerter. */
  leadsRuntime?: (config: LeadsConfig, ctx: CrmContext) => LeadsRuntime;
  /** Test seam; production uses the real leads gate list. */
  leadsGates?: readonly ReleaseGate[];
  /** Keeps alert delivery alive after the response (Next `after()`). */
  schedule?: (work: Promise<unknown>) => void;
}

let reportedMissingIp = false;

const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });

const invalid = (status: 400 | 413, message: string) =>
  json({ ok: false, error: "invalid", fieldErrors: { form: [message] } }, status);

function toAlert(e: IntakeEvent): AlertSignal {
  if (e.kind === "unavailable") return { event: "unavailable" };
  if (e.status === 401 || e.status === 403) return { event: "ghl_auth_failed", step: e.step, status: e.status };
  if (e.status === 429) return { event: "ghl_rate_limited", step: e.step, status: e.status };
  return { event: "delivery_failed", step: e.step, status: e.status };
}

export async function handleInquiryPost(request: Request, deps: InquiryRouteDeps): Promise<Response> {
  const env = deps.env ?? process.env;
  const log = deps.log ?? ((msg, meta) => console.error(`[websites-inquiry] ${msg}`, meta ?? ""));

  // Release gate (mode, host allowlist, required secrets). Fails closed.
  const gate = resolveWebsitesGate(request.headers, env, deps.leadsGates);
  if (!gate.enabled) {
    reportClosedGate(gate);
    return json({ ok: false, error: "not_found" }, 404);
  }

  // Leads-only mode: its extra configuration (alert receiver, CRM, capacity) must be complete.
  let rt: LeadsRuntime | null = null;
  let manual: Pick<LeadsConfig, "previewIntake" | "maxOpenRequests"> | undefined;
  if (gate.mode === "leads") {
    const { config, problems } = readLeadsConfig(env);
    if (!config || !deps.leadsRuntime) {
      log("leads mode refused: required configuration missing", { missing: problems });
      return json({ ok: false, error: "unavailable" }, 503);
    }
    rt = deps.leadsRuntime(config, { mode: gate.mode, host: gate.host });
    manual = config.delivery === "manual" ? config : undefined;
  }
  /** Alert delivery runs after the response is sent; it never delays or changes it. */
  const finish = (res: Response) => {
    if (rt) deps.schedule?.(rt.alerter.settled());
    return res;
  };

  if (rt) {
    if (!isAllowedOrigin(request, gate.origin)) return finish(json({ ok: false, error: "forbidden" }, 403));
    if (!isJsonContentType(request)) {
      return finish(json({ ok: false, error: "invalid", fieldErrors: { form: ["Unsupported request."] } }, 415));
    }
    // No lead path without a working failure channel: while the alert receiver is down,
    // visitors get the email fallback instead of a form whose failures nobody would hear about.
    if (!(await rt.receiverReady())) {
      log("leads intake closed: alert receiver not answering its health check");
      return finish(json({ ok: false, error: "unavailable" }, 503));
    }
  }

  const read = await readBodyCapped(request, MAX_INQUIRY_BODY_BYTES);
  if (!read.ok) return finish(read.reason === "too_large" ? invalid(413, "Request too large.") : invalid(400, "Malformed request."));
  let body: unknown;
  try {
    body = JSON.parse(read.text);
  } catch {
    return finish(invalid(400, "Malformed request."));
  }

  const ip = proxyClientIp(request.headers);
  if (!ip && !reportedMissingIp) {
    reportedMissingIp = true;
    log("no client address from the proxy; verified requests share one rate-limit bucket");
  }
  // A proxy that stops sending X-Real-IP is a misconfiguration worth an alert in leads mode.
  if (!ip && rt) rt.alerter.raise({ event: "config_invalid", step: "client_ip" });

  const verifyToken = createTurnstileVerifier({
    secret: gate.turnstileSecret,
    expectedHostname: gate.hostname,
    fetch: deps.fetch,
    onServiceError: rt ? () => rt.alerter.raise({ event: "turnstile_unavailable" }) : undefined,
  });
  /* A honeypot hit answers 200 without verification, so a 200 alone doesn't prove a real visitor. */
  let verified = false;

  const result = await processInquiry(
    body,
    {
      ipHash: ip ? hashClientIp(ip, gate.ipHashSalt) : null,
      ipBucket: ip ? hashClientIp(rateLimitAddress(ip), gate.ipHashSalt) : null,
      userAgent: request.headers.get("user-agent"),
      pageOrigin: gate.origin,
    },
    {
      // Never the unprovisioned Supabase store on the leads path.
      store: rt ? null : deps.getStore(),
      crm: manual ? null : deps.getCrm({ mode: gate.mode, host: gate.host }),
      rateLimiters: rt ? rt.rateLimiters : deps.rateLimiters,
      verifyTurnstile: async (token) => {
        const ok = await verifyToken(token);
        verified ||= ok;
        return ok;
      },
      now: deps.now ?? (() => new Date()),
      log,
      admission: rt?.admission,
      returning: rt?.returning,
      manual,
      onEvent: rt ? (e) => rt.alerter.raise(toAlert(e)) : undefined,
    }
  );

  // Re-send notices that never reached the owner. Only verified, accepted requests may trigger the scan.
  if (rt && verified && result.status === 200) deps.schedule?.(rt.retryPendingReviews());
  return finish(json(result.body, result.status, result.status === 429 ? { "Retry-After": String(result.body.retryAfterSeconds) } : {}));
}

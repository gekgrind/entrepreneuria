/**
 * Inquiry request handler: mode dispatch plus the guards that differ by mode.
 *
 * The route file only wires real dependencies into this function, so every
 * branch is testable with fakes.
 *
 *   off            404, nothing runs (this is also the rollback state)
 *   nonproduction  the pre-existing behaviour, unchanged
 *   production     same pre-existing behaviour (the mode itself is gated)
 *   leads          origin, content-type and bounded-body checks, trusted
 *                  client IP, mandatory Turnstile, the capacity check and
 *                  signed alerts. The Supabase store is never consulted.
 */
import { createHash } from "node:crypto";

import type { LeadCrm } from "../../integrations/ghl/client";
import type { RateLimiter } from "../../rate-limit";

import type { AlertSignal } from "./alerts";
import { resolveServicesMode, type Env } from "./flags";
import { processInquiry, type InquiryStore, type IntakeEvent } from "./intake";
import { readLeadsConfig, type LeadsConfig } from "./leads-config";
import type { LeadsRuntime } from "./leads-runtime";
import type { ReleaseGate } from "./release-gates";
import { hashClientIp, isAllowedOrigin, isJsonContentType, readBodyCapped, resolveClientIp, UNRESOLVED_IP_MARKER } from "./request-guards";

export const MAX_BODY_BYTES = 16_384;

export interface HandlerResult {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

export interface HandlerDeps {
  env: Env;
  now: () => Date;
  log: (msg: string, meta?: Record<string, unknown>) => void;
  /** Never called in leads mode. */
  getStore: () => InquiryStore | null;
  getCrm: () => LeadCrm | null;
  /** Pre-existing path: per-process limiters and optional Turnstile (only when its secret is set). */
  legacy: {
    rateLimiters: { ip: RateLimiter; email: RateLimiter };
    verifyTurnstile: ((token: string) => Promise<boolean>) | null;
  };
  leadsRuntime: (config: LeadsConfig) => LeadsRuntime;
  /** Test seam; production uses the real leads gate list. */
  leadsGates?: readonly ReleaseGate[];
  /** Keeps alert delivery alive after the response (Next `after()`). */
  schedule?: (work: Promise<unknown>) => void;
}

const NO_STORE = "no-store";

function result(status: number, body: unknown, extra: Record<string, string> = {}): HandlerResult {
  return { status, body, headers: { "Cache-Control": NO_STORE, ...extra } };
}

const invalid = (status: number, message: string) =>
  result(status, { ok: false, error: "invalid", fieldErrors: { form: [message] } });

function withRetryAfter(status: number, body: { retryAfterSeconds?: number }, headers: Record<string, string>) {
  if (status === 429 && typeof body.retryAfterSeconds === "number") headers["Retry-After"] = String(body.retryAfterSeconds);
  return headers;
}

function toAlert(e: IntakeEvent): AlertSignal {
  switch (e.kind) {
    case "crm_failed":
      if (e.status === 401 || e.status === 403) return { event: "ghl_auth_failed", step: e.step, status: e.status };
      if (e.status === 429) return { event: "ghl_rate_limited", step: e.step, status: e.status };
      return { event: "delivery_failed", step: e.step, status: e.status };
    case "turnstile_unavailable":
      return { event: "turnstile_unavailable" };
    case "unavailable":
      return { event: "unavailable" };
  }
}

export async function handleInquiry(request: Request, deps: HandlerDeps): Promise<HandlerResult> {
  const mode = resolveServicesMode(deps.env, deps.leadsGates);
  if (mode === "off") return result(404, { ok: false, error: "not_found" });
  if (mode === "leads") return handleLeads(request, deps);
  return handleExisting(request, deps);
}

/** The behaviour that existed before leads mode, kept byte-for-byte in effect. */
async function handleExisting(request: Request, deps: HandlerDeps): Promise<HandlerResult> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return invalid(413, "Request too large.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return invalid(400, "Malformed request.");
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip");
  const salt = deps.env.WEBSITES_IP_HASH_SALT ?? "";
  const ipHash = ip ? createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32) : null;

  const r = await processInquiry(
    body,
    { ipHash, userAgent: request.headers.get("user-agent") },
    {
      store: deps.getStore(),
      crm: deps.getCrm(),
      rateLimiters: deps.legacy.rateLimiters,
      verifyTurnstile: deps.legacy.verifyTurnstile,
      now: deps.now,
      log: deps.log,
    }
  );
  return result(r.status, r.body, withRetryAfter(r.status, r.body as { retryAfterSeconds?: number }, {}));
}

async function handleLeads(request: Request, deps: HandlerDeps): Promise<HandlerResult> {
  // Explicit failure when required security configuration is absent. flags.ts already
  // resolves the mode to `off` in that case; this re-check keeps the handler safe on its own.
  const { config, problems } = readLeadsConfig(deps.env);
  if (!config) {
    deps.log("leads mode refused: required configuration missing", { missing: problems });
    return result(503, { ok: false, error: "unavailable" });
  }
  const rt = deps.leadsRuntime(config);
  const done = (status: number, body: unknown, headers: Record<string, string> = {}): HandlerResult => {
    deps.schedule?.(rt.alerter.settled());
    return result(status, body, headers);
  };

  if (!isAllowedOrigin(request, config.publicOrigin)) return done(403, { ok: false, error: "forbidden" });
  if (!isJsonContentType(request)) return done(415, { ok: false, error: "invalid", fieldErrors: { form: ["Unsupported request."] } });

  const read = await readBodyCapped(request, MAX_BODY_BYTES);
  if (!read.ok) {
    return read.reason === "too_large"
      ? done(413, { ok: false, error: "invalid", fieldErrors: { form: ["Request too large."] } })
      : done(400, { ok: false, error: "invalid", fieldErrors: { form: ["Malformed request."] } });
  }
  let body: unknown;
  try {
    body = JSON.parse(read.text);
  } catch {
    return done(400, { ok: false, error: "invalid", fieldErrors: { form: ["Malformed request."] } });
  }

  // Trusted client IP only. If it cannot be resolved, every such request shares one
  // rate-limit bucket (fail closed) and the misconfiguration is alerted.
  const ip = resolveClientIp(request.headers, config.clientIpSource);
  if (!ip) {
    deps.log("client ip unresolved from the configured trusted source");
    rt.alerter.raise({ event: "config_invalid", step: "client_ip" });
  }
  const ipHash = ip ? hashClientIp(ip, config.ipHashSalt) : UNRESOLVED_IP_MARKER;

  const r = await processInquiry(
    body,
    { ipHash, userAgent: request.headers.get("user-agent") },
    {
      store: null, // never the unprovisioned Supabase store
      crm: deps.getCrm(),
      rateLimiters: rt.rateLimiters,
      verifyTurnstile: rt.verifyTurnstile, // mandatory in leads mode
      now: deps.now,
      log: deps.log,
      admission: rt.admission,
      canonicalPageUrl: `${config.publicOrigin}/services/websites`,
      onEvent: (e) => rt.alerter.raise(toAlert(e)),
    }
  );
  return done(r.status, r.body, withRetryAfter(r.status, r.body as { retryAfterSeconds?: number }, {}));
}

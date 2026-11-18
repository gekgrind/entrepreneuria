/**
 * POST /api/persona-builder with its dependencies injected, so the whole
 * request path is unit-tested. app/api/persona-builder/route.ts supplies the
 * real limiters and Anthropic caller.
 *
 * Order matters: everything cheap and every rejection happens before the
 * Anthropic call, and nothing a client sent is echoed back.
 *   1. per-client rate limit (counts every request)
 *   2. JSON content type
 *   3. body cap, before JSON parsing
 *   4. structural limits, then the bounded per-mode schema
 *   5. spend budget (counts only requests about to call Anthropic)
 *   6. the Anthropic call
 */
import type { RateLimiter } from "../../rate-limit";
import { proxyClientIp, rateLimitAddress, readBodyCapped } from "../../services/websites/request-guards";

import type { AnthropicCaller } from "./anthropic";
import { buildCrossPrompt, buildPersonaPrompt, buildStrategyPrompt } from "./prompts";
import { personaRequestSchema, withinStructuralLimits } from "./schema";

/** Largest legitimate request (strategy mode, three personas) is well under this. */
export const MAX_PERSONA_BODY_BYTES = 64 * 1024;

export interface PersonaBuilderLimiters {
  /** Per client address (X-Real-IP, IPv6 grouped by /64). */
  client: RateLimiter;
  /** Requests without a usable client address share this bucket. */
  unknownClient: RateLimiter;
  /** Spend budget: every limiter here must allow a request before Anthropic is called. */
  budget: readonly RateLimiter[];
}

export interface PersonaBuilderDeps {
  limiters: PersonaBuilderLimiters;
  callAnthropic: AnthropicCaller;
  log?: (msg: string, meta?: Record<string, unknown>) => void;
}

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

const INVALID = "Invalid request payload.";

let reportedMissingIp = false;

function isJson(request: Request): boolean {
  const type = request.headers.get("content-type");
  return !!type && type.split(";")[0].trim().toLowerCase() === "application/json";
}

export async function handlePersonaBuilderPost(request: Request, deps: PersonaBuilderDeps): Promise<Response> {
  const log = deps.log ?? ((msg, meta) => console.error(`[persona-builder] ${msg}`, meta ?? ""));

  const ip = proxyClientIp(request.headers);
  if (!ip && !reportedMissingIp) {
    reportedMissingIp = true;
    log("no client address from the proxy (X-Real-IP); those requests share one rate-limit bucket");
  }
  const limit = ip ? deps.limiters.client.check(`ip:${rateLimitAddress(ip)}`) : deps.limiters.unknownClient.check("ip:unknown");
  if (!limit.allowed) {
    return json(
      { error: "Too many requests. Please wait a few minutes and try again." },
      429,
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  }

  if (!isJson(request)) return json({ error: INVALID }, 415);

  const read = await readBodyCapped(request, MAX_PERSONA_BODY_BYTES);
  if (!read.ok) {
    return read.reason === "too_large" ? json({ error: "Request too large." }, 413) : json({ error: INVALID }, 400);
  }

  let body: unknown;
  try {
    body = JSON.parse(read.text);
  } catch {
    return json({ error: INVALID }, 400);
  }

  if (!withinStructuralLimits(body)) return json({ error: INVALID }, 400);

  const parsed = personaRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: INVALID }, 400);
  const payload = parsed.data;

  for (const budget of deps.limiters.budget) {
    const spend = budget.check("anthropic");
    if (!spend.allowed) {
      log("spend budget reached; request refused before calling Anthropic", { retryAfterSeconds: spend.retryAfterSeconds });
      return json(
        { error: "The persona builder is busy right now. Please try again later." },
        503,
        { "Retry-After": String(spend.retryAfterSeconds) },
      );
    }
  }

  try {
    let text: string;
    if (payload.mode === "persona") {
      text = await deps.callAnthropic(
        buildPersonaPrompt(payload.founderInputs, payload.personaNumber, payload.totalPersonas),
        true,
      );
    } else if (payload.mode === "cross") {
      text = await deps.callAnthropic(buildCrossPrompt(payload.founderInputs, payload.allPersonas), false);
    } else {
      text = await deps.callAnthropic(buildStrategyPrompt(payload.founderInputs, payload.strategyPayload.personas), false);
    }
    return json({ text }, 200);
  } catch (error) {
    console.error("Persona builder API error:", error);
    return json({ error: "Failed to process request. Please try again." }, 500);
  }
}

/** Test seam: forget that the missing-address warning was logged. */
export function resetPersonaBuilderLogState(): void {
  reportedMissingIp = false;
}

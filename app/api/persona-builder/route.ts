import { publicAiToolsDisabledResponse } from "@/lib/ai/public-tools-flag";
import { createRateLimiter } from "@/lib/rate-limit";
import { createAnthropicCaller } from "@/lib/tools/persona-builder/anthropic";
import { handlePersonaBuilderPost, type PersonaBuilderLimiters } from "@/lib/tools/persona-builder/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Per-process limits (see lib/rate-limit.ts). Production runs one pm2
 * process, so these are shared by all visitors there, but they reset on
 * restart and are not shared between instances anywhere else (preview
 * hosts, or pm2 scaled out).
 *
 * One full run of the tool is at most 5 calls: up to 3 personas, the
 * cross-persona read and the strategy report.
 */
const limiters: PersonaBuilderLimiters = {
  client: createRateLimiter({ limit: 15, windowMs: 10 * 60_000 }),
  unknownClient: createRateLimiter({ limit: 60, windowMs: 10 * 60_000 }),
  budget: [
    createRateLimiter({ limit: 120, windowMs: 60 * 60_000 }),
    createRateLimiter({ limit: 600, windowMs: 24 * 60 * 60_000 }),
  ],
};

export async function POST(request: Request) {
  // Kill switch first (PR #51): fail closed before rate limiting, body parsing or any provider call.
  const disabled = publicAiToolsDisabledResponse();
  if (disabled) return disabled;

  return handlePersonaBuilderPost(request, {
    limiters,
    callAnthropic: createAnthropicCaller({ apiKey: process.env.ANTHROPIC_API_KEY }),
  });
}

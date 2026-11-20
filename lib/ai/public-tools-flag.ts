/**
 * Kill switch for the public, unauthenticated AI tools (/tools/* and their
 * /api routes). Each request reaches a paid model provider with no sign-in,
 * so they stay off until they are deliberately re-enabled.
 *
 *   PUBLIC_AI_TOOLS_ENABLED
 *     unset / anything else   (default) API routes answer 503 before reading
 *                             the body or calling a provider; tool pages 404
 *     "true"                  previous behavior, unchanged
 *
 * Read per request on the server, so it is a runtime switch, not a build-time
 * one. Fail-closed: only the exact string "true" enables the tools.
 */

type Env = Record<string, string | undefined>;

export function publicAiToolsEnabled(env: Env = process.env): boolean {
  return env.PUBLIC_AI_TOOLS_ENABLED === "true";
}

/**
 * For the top of each AI route handler: a 503 response while the tools are
 * disabled, or null to continue with the normal handler.
 */
export function publicAiToolsDisabledResponse(env: Env = process.env): Response | null {
  if (publicAiToolsEnabled(env)) return null;
  return Response.json(
    { error: "This tool is temporarily unavailable." },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * The persona builder's Anthropic Messages call, moved from
 * app/api/persona-builder/route.ts with its fetch and key injected.
 */

export const PERSONA_MODEL = "claude-sonnet-4-20250514";

/** Web searches one persona request may run. Bounds per-request spend; the model usually needs fewer. */
export const WEB_SEARCH_MAX_USES = 5;

/** Upstream error text kept in the thrown message (server log only). */
const UPSTREAM_ERROR_LOG_MAX = 500;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type AnthropicCaller = (prompt: string, useWebSearch: boolean) => Promise<string>;

export function createAnthropicCaller(opts: { apiKey: string | undefined; fetch?: FetchLike }): AnthropicCaller {
  const doFetch = opts.fetch ?? fetch;

  return async function callAnthropic(prompt, useWebSearch) {
    const apiKey = opts.apiKey;

    if (!apiKey) {
      throw new Error("Missing ANTHROPIC_API_KEY environment variable");
    }

    const body = {
      model: PERSONA_MODEL,
      max_tokens: 2200,
      tools: useWebSearch
        ? [{ type: "web_search_20250305", name: "web_search", max_uses: WEB_SEARCH_MAX_USES }]
        : undefined,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    };

    const response = await doFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${text.slice(0, UPSTREAM_ERROR_LOG_MAX)}`);
    }

    const data = await response.json();

    const textBlocks: string[] = (data.content ?? [])
      .filter((item: { type?: string }) => item.type === "text")
      .map((item: { text?: string }) => item.text ?? "");

    return textBlocks.join("\n\n").trim();
  };
}

/**
 * The persona builder's Anthropic Messages call, moved from
 * app/api/persona-builder/route.ts with its fetch and key injected.
 */

export const PERSONA_MODEL = "claude-sonnet-4-20250514";

/** Web searches one persona request may run. Bounds per-request spend; the model usually needs fewer. */
export const WEB_SEARCH_MAX_USES = 5;

/**
 * What a failed call reports. Deliberately metadata only: no provider
 * response body, no exception text, nothing from the prompt.
 */
export type AnthropicFailureCategory = "not_configured" | "network" | "upstream_status" | "bad_response";

export class AnthropicCallError extends Error {
  constructor(
    readonly category: AnthropicFailureCategory,
    readonly upstreamStatus?: number,
    readonly requestId?: string,
  ) {
    super(`Anthropic call failed: ${category}`);
    this.name = "AnthropicCallError";
  }
}

/** Anthropic's request-id header, kept only when it has the documented shape. */
function safeRequestId(value: string | null): string | undefined {
  return value && /^req_[A-Za-z0-9]{1,128}$/.test(value) ? value : undefined;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type AnthropicCaller = (prompt: string, useWebSearch: boolean) => Promise<string>;

export function createAnthropicCaller(opts: { apiKey: string | undefined; fetch?: FetchLike }): AnthropicCaller {
  const doFetch = opts.fetch ?? fetch;

  return async function callAnthropic(prompt, useWebSearch) {
    const apiKey = opts.apiKey;

    if (!apiKey) {
      throw new AnthropicCallError("not_configured");
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

    let response: Response;
    try {
      response = await doFetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new AnthropicCallError("network");
    }

    const requestId = safeRequestId(response.headers.get("request-id"));
    if (!response.ok) {
      // The body is never read: it can carry account or request details.
      await response.body?.cancel().catch(() => {});
      throw new AnthropicCallError("upstream_status", response.status, requestId);
    }

    let data: { content?: unknown } | null;
    try {
      data = await response.json();
    } catch {
      throw new AnthropicCallError("bad_response", response.status, requestId);
    }

    const content = Array.isArray(data?.content) ? data.content : [];
    const textBlocks: string[] = content
      .filter((item: { type?: string }) => item.type === "text")
      .map((item: { text?: string }) => item.text ?? "");

    return textBlocks.join("\n\n").trim();
  };
}

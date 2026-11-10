/**
 * Maps an inquiry-route response to what the preview form shows, and builds
 * the prefilled email fallback. Pure (no DOM, no imports) so it is
 * unit-tested; the form owns the copy and rendering.
 *
 * The route's failure contract is `IntakeResult` in intake.ts. Anything not
 * recognised here is treated as a generic, retryable failure.
 */

export type SubmitOutcome =
  | { kind: "ok" }
  | { kind: "field_errors" }
  /** Leads mode: intake paused or at the open-request limit. Retrying will not help. */
  | { kind: "capacity" }
  /** Rate limited; minutes is rounded up, at least 1. */
  | { kind: "rate_limited"; minutes: number }
  /** Turnstile rejected or expired the token. */
  | { kind: "verification" }
  /** Client-side only: the Turnstile widget could not load or errored. Never returned by classifySubmitResponse. */
  | { kind: "verification_unavailable" }
  /** Client deadline expired; the server might still have received the request. */
  | { kind: "timeout" }
  /** Network, 5xx, delivery failure, unexpected body. */
  | { kind: "failed" };

export interface RouteBody {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  retryAfterSeconds?: number;
}

export function classifySubmitResponse(status: number, body: RouteBody): SubmitOutcome {
  if (status >= 200 && status < 300 && body.ok === true) return { kind: "ok" };
  if (status === 400 && body.error === "invalid" && body.fieldErrors) return { kind: "field_errors" };
  if (status === 400 && body.error === "verification_failed") return { kind: "verification" };
  if (status === 503 && body.error === "capacity") return { kind: "capacity" };
  if (status === 429) {
    const secs = typeof body.retryAfterSeconds === "number" && body.retryAfterSeconds > 0 ? body.retryAfterSeconds : 600;
    return { kind: "rate_limited", minutes: Math.max(1, Math.ceil(secs / 60)) };
  }
  return { kind: "failed" };
}

export function classifySubmitFailure(deadlineReached: boolean): SubmitOutcome {
  return { kind: deadlineReached ? "timeout" : "failed" };
}

/** Labelled lines in visual form order; blank values are skipped. */
export type EmailLine = readonly [label: string, value: string];

const SUBJECT = "Free website preview request";
/* Keeps the mailto URL well under common client limits (~2,000 chars). */
const MAX_BODY_CHARS = 1500;

/**
 * A mailto: link that carries the visitor's answers, so a lead is never lost
 * when the form cannot accept it. The visitor sends it from their own email
 * app; nothing is transmitted by the page.
 */
export function requestEmailHref(to: string, lines: readonly EmailLine[]): string {
  const filled = lines
    .map(([label, value]) => [label, value.replace(/\s+/g, " ").trim()] as const)
    .filter(([, value]) => value.length > 0);
  let body = ["Hi, I'd like a free website preview.", "", ...filled.map(([l, v]) => `${l}: ${v}`)].join("\n");
  if (body.length > MAX_BODY_CHARS) body = `${body.slice(0, MAX_BODY_CHARS - 1)}…`;
  return `mailto:${to}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(body)}`;
}

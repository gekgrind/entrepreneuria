/**
 * Request pacing for the GHL sandbox harness. Every network call a live run,
 * reconcile or discovery makes goes through one `createPacedFetch`, underneath
 * the safety guard, so the guard still decides what may be sent.
 *
 *   - Requests are spaced evenly at a limit below the 25 per 10 seconds GHL
 *     reported for a sandbox token (X-RateLimit-Max), so a run cannot burst.
 *   - X-RateLimit-* and Retry-After (seconds or an HTTP date) are honoured, on
 *     every response. A server-directed wait is never shortened.
 *   - A 429 on a GET is retried a bounded number of times with backoff.
 *   - A 429 on anything else is returned as it is. Writes and deletes are
 *     never re-sent from here.
 *   - A wait longer than the backoff bound (a daily limit, a long Retry-After)
 *     closes the pacer: nothing further is sent, and callers see a 429.
 *
 * The pacer owns the per-attempt timeout and drops the caller's signal. That
 * signal's clock started before the request queued for a slot, so honouring
 * it would abort requests that were only waiting, and a create aborted before
 * it was sent would be misread as an ambiguous outcome.
 */
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const WINDOW_MS = 10_000;
/** Exact spacing fits one request too many in a window once timers jitter by a millisecond. */
const SPACING_MARGIN_MS = 25;
/** Highest allowed setting, kept below the observed limit of 25 per 10 seconds. */
export const MAX_RATE_PER_10S = 20;
export const DEFAULT_RATE_PER_10S = 15;
const MAX_SETTLE_ATTEMPTS = 20;
const MAX_SETTLE_DELAY_MS = 60_000;

export type PacerEvent =
  | { type: "retry"; method: string; path: string; attempt: number; waitMs: number }
  | { type: "not_retried"; method: string; path: string; reason: string }
  | { type: "closed"; reason: string };

export interface PacerOptions {
  ratePer10s?: number;
  /** Retries of a GET after its first 429. */
  maxReadRetries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  requestTimeoutMs?: number;
  /** Pause for one window when the server reports this many requests or fewer remaining. */
  remainingReserve?: number;
  /** Monotonic clock for spacing and waits. Defaults to performance.now(). */
  now?: () => number;
  /** Wall clock, used only to read a Retry-After HTTP date. Defaults to `now` when that is given, else Date.now. */
  wallNow?: () => number;
  sleep?: (ms: number) => Promise<void>;
  onEvent?: (event: PacerEvent) => void;
}

export function createPacedFetch(inner: FetchLike, opts: PacerOptions = {}) {
  const rate = opts.ratePer10s ?? DEFAULT_RATE_PER_10S;
  if (!Number.isInteger(rate) || rate < 1 || rate > MAX_RATE_PER_10S) {
    throw new Error(`sandbox rate must be a whole number from 1 to ${MAX_RATE_PER_10S} per 10 seconds`);
  }
  const spacingMs = Math.ceil(WINDOW_MS / rate) + SPACING_MARGIN_MS;
  const maxReadRetries = opts.maxReadRetries ?? 3;
  const baseBackoffMs = opts.baseBackoffMs ?? 2_000;
  const maxBackoffMs = opts.maxBackoffMs ?? 30_000;
  const requestTimeoutMs = opts.requestTimeoutMs ?? 10_000;
  const remainingReserve = opts.remainingReserve ?? 3;
  // Monotonic: a wall-clock step (NTP, a coarse Windows tick) must never let two requests through early.
  const now = opts.now ?? (() => performance.now());
  const wallNow = opts.wallNow ?? opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const emit = opts.onEvent ?? (() => {});

  let nextAt = 0;
  let blockedUntil = 0;
  let closed: string | null = null;
  let sent = 0;
  let throttled = 0;
  let retries = 0;

  /** Waits for the next slot. False means the pacer closed, and the request must not be sent. */
  async function acquire(): Promise<boolean> {
    for (;;) {
      if (closed) return false;
      const t = now();
      const at = Math.max(t, nextAt, blockedUntil);
      if (at <= t) {
        nextAt = t + spacingMs;
        return true;
      }
      await sleep(at - t);
    }
  }

  /** Retry-After as seconds or an HTTP date. Anything else, or a date in the past, is no wait. */
  function retryAfterMs(headers: Headers): number {
    const raw = headers.get("retry-after")?.trim();
    if (!raw) return 0;
    if (/^\d+$/.test(raw)) return Number(raw) * 1000;
    if (!/[a-z]/i.test(raw)) return 0;
    const at = Date.parse(raw);
    return Number.isFinite(at) ? Math.max(0, at - wallNow()) : 0;
  }

  /** Waits within the bound block later requests in full; a longer one closes the pacer. Returns false if closed. */
  function honour(waitMs: number): boolean {
    if (waitMs > maxBackoffMs) {
      if (!closed) {
        closed = `GHL asked for a wait of ${waitMs} ms, over the ${maxBackoffMs} ms bound`;
        emit({ type: "closed", reason: closed });
      }
      return false;
    }
    blockedUntil = Math.max(blockedUntil, now() + waitMs);
    return true;
  }

  /**
   * The longest wait any header asks for: Retry-After, an exhausted daily quota
   * (its reset, or a day if none is given) and the burst interval (on a 429, or
   * when few requests remain). Each is read on its own, so one never hides another.
   */
  function serverWaitMs(headers: Headers, throttled: boolean): number {
    const positive = (name: string) => {
      const v = Number(headers.get(name));
      return Number.isFinite(v) && v > 0 ? v : null;
    };
    let wait = retryAfterMs(headers);
    if (headers.get("x-ratelimit-daily-remaining")?.trim() === "0") wait = Math.max(wait, positive("x-ratelimit-daily-reset") ?? 24 * 60 * 60 * 1000);
    const raw = headers.get("x-ratelimit-remaining");
    const remaining = raw === null || raw.trim() === "" ? NaN : Number(raw);
    if (throttled || (Number.isFinite(remaining) && remaining <= remainingReserve)) {
      wait = Math.max(wait, positive("x-ratelimit-interval-milliseconds") ?? WINDOW_MS);
    }
    return wait;
  }

  const closedResponse = () =>
    new Response(JSON.stringify({ message: `not sent: ${closed}` }), {
      status: 429,
      headers: { "content-type": "application/json", "x-sandbox-pacer": "closed" },
    });

  const fetch: FetchLike = async (url, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const path = new URL(url).pathname;

    for (let attempt = 0; ; attempt++) {
      if (!(await acquire())) return closedResponse();
      sent++;
      const res = await inner(url, { ...init, signal: AbortSignal.timeout(requestTimeoutMs) });
      if (res.status !== 429) {
        const wait = serverWaitMs(res.headers, false);
        if (wait > 0) honour(wait);
        return res;
      }

      throttled++;
      const serverWait = serverWaitMs(res.headers, true);
      if (!honour(serverWait)) return res;
      const waitMs = Math.min(maxBackoffMs, Math.max(serverWait, baseBackoffMs * 2 ** attempt));
      honour(waitMs);
      if (method !== "GET") {
        emit({ type: "not_retried", method, path, reason: "only GET requests are retried" });
        return res;
      }
      if (attempt >= maxReadRetries) {
        emit({ type: "not_retried", method, path, reason: `still rate limited after ${maxReadRetries} retries` });
        return res;
      }
      retries++;
      emit({ type: "retry", method, path, attempt: attempt + 1, waitMs });
      await res.body?.cancel().catch(() => {});
    }
  };

  return {
    fetch,
    spacingMs,
    get closed() {
      return closed;
    },
    stats: () => ({ sent, throttled, retries }),
  };
}

export interface HarnessSettings {
  ratePer10s: number;
  settleAttempts?: number;
  settleDelayMs?: number;
}

/** Reads the harness settings. An invalid value refuses the run; it is never adjusted silently. */
export function parseHarnessEnv(env: Record<string, string | undefined>): { ok: true; settings: HarnessSettings } | { ok: false; error: string } {
  const whole = (name: string, min: number, max: number): number | undefined | null => {
    const raw = env[name]?.trim();
    if (!raw) return undefined;
    const n = Number(raw);
    return /^\d+$/.test(raw) && n >= min && n <= max ? n : null;
  };
  const rate = whole("GHL_SANDBOX_RATE_PER_10S", 1, MAX_RATE_PER_10S);
  if (rate === null) return { ok: false, error: `GHL_SANDBOX_RATE_PER_10S must be a whole number from 1 to ${MAX_RATE_PER_10S}` };
  const settleAttempts = whole("GHL_SANDBOX_SETTLE_ATTEMPTS", 1, MAX_SETTLE_ATTEMPTS);
  if (settleAttempts === null) return { ok: false, error: `GHL_SANDBOX_SETTLE_ATTEMPTS must be a whole number from 1 to ${MAX_SETTLE_ATTEMPTS}` };
  const settleDelayMs = whole("GHL_SANDBOX_SETTLE_DELAY_MS", 0, MAX_SETTLE_DELAY_MS);
  if (settleDelayMs === null) return { ok: false, error: `GHL_SANDBOX_SETTLE_DELAY_MS must be a whole number from 0 to ${MAX_SETTLE_DELAY_MS}` };
  return { ok: true, settings: { ratePer10s: rate ?? DEFAULT_RATE_PER_10S, settleAttempts, settleDelayMs } };
}

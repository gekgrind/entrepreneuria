/**
 * Signed operational alerts for the leads-only intake.
 *
 * With no durable store, a silent delivery failure loses a lead, so failures
 * raise a signed webhook alert. Design constraints:
 *
 *  - Payload is built from an explicit allowlist: event, step, status,
 *    count, environment, first_seen, last_seen. Never names, emails, phones,
 *    messages, IP hashes, tokens or URLs.
 *  - HMAC-SHA256 over `${timestamp}.${body}`; the receiver rejects a bad
 *    signature or a stale timestamp (verifyAlertSignature).
 *  - Deduplicated in-process (fine for the single pm2 instance); noisy
 *    events need a threshold before the first send.
 *  - Never throws, never delays the visitor's response, short timeout,
 *    bounded retries. A failed delivery is logged without personal data.
 *  - GHL is not the alert channel: it is the system being monitored.
 *
 * The receiver is configured by env and unset until the owner approves one;
 * an unset receiver keeps the whole mode off (leads-config.ts).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const ALERT_EVENTS = [
  "delivery_failed",
  /** A returning contact (or an unverifiable lookup) is waiting in the review store. status = its opaque reference. */
  "returning_contact_review",
  "ghl_auth_failed",
  "ghl_rate_limited",
  "unavailable",
  "turnstile_unavailable",
  "config_invalid",
  "capacity_count_unavailable",
  /** Owner workload signals, not failures: one open slot left, and no slots left. */
  "capacity_near",
  "capacity_full",
  "test",
] as const;
export type AlertEvent = (typeof ALERT_EVENTS)[number];

export interface AlertSignal {
  event: AlertEvent;
  step?: string;
  status?: number | string | null;
}

export interface AlertPayload {
  event: AlertEvent;
  step: string;
  status: string;
  count: number;
  environment: string;
  first_seen: string;
  last_seen: string;
}

export const ALERT_TIMESTAMP_HEADER = "x-websites-alert-timestamp";
export const ALERT_SIGNATURE_HEADER = "x-websites-alert-signature";

/** Occurrences within the dedupe window needed before the first send. */
const THRESHOLDS: Partial<Record<AlertEvent, number>> = { ghl_rate_limited: 3, turnstile_unavailable: 3 };

const safeToken = (v: unknown, fallback: string) => {
  const s = v === undefined || v === null ? "" : String(v);
  return /^[A-Za-z0-9_:.-]{1,32}$/.test(s) ? s : fallback;
};

export function buildAlertPayload(
  signal: AlertSignal,
  meta: { count: number; environment: string; firstSeen: Date; lastSeen: Date }
): AlertPayload {
  return {
    event: signal.event,
    step: safeToken(signal.step, "none"),
    status: safeToken(signal.status, "none"),
    count: meta.count,
    environment: safeToken(meta.environment, "unknown"),
    first_seen: meta.firstSeen.toISOString(),
    last_seen: meta.lastSeen.toISOString(),
  };
}

export function signAlert(body: string, secret: string, timestampSeconds: number): string {
  return `v1=${createHmac("sha256", secret).update(`${timestampSeconds}.${body}`).digest("hex")}`;
}

/** For the receiver (and tests): constant-time signature check plus a freshness window. */
export function verifyAlertSignature(input: {
  body: string;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  nowMs: number;
  toleranceSeconds?: number;
}): boolean {
  const { body, timestamp, signature, secret, nowMs, toleranceSeconds = 300 } = input;
  if (!timestamp || !signature || !/^\d{1,12}$/.test(timestamp)) return false;
  const ts = Number(timestamp);
  if (Math.abs(nowMs / 1000 - ts) > toleranceSeconds) return false;
  const expected = Buffer.from(signAlert(body, secret, ts));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface Alerter {
  /** Records an occurrence; may send. Never throws. */
  raise(signal: AlertSignal): void;
  /** Resolves when every in-flight delivery attempt has finished. Never rejects. */
  settled(): Promise<void>;
  /**
   * Sends one alert now, bypassing dedupe, and resolves true only when the
   * receiver accepted it (2xx). For notices whose delivery is tracked by the
   * caller (review records). Never rejects.
   */
  notify(signal: AlertSignal): Promise<boolean>;
}

export function createAlerter(opts: {
  url: string;
  secret: string;
  environment: string;
  fetch?: FetchLike;
  now?: () => Date;
  log?: (msg: string, meta?: Record<string, unknown>) => void;
  /** Must be ≥ the receiver's cooldown (both default to 15 min), or a repeat can be cooldown-suppressed there. */
  dedupeWindowMs?: number;
  /** Extra wait after the window before a repeat batch is sent; absorbs receiver-side email latency. */
  trailingMarginMs?: number;
  timeoutMs?: number;
  retryDelaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  /** Test seam for the trailing-flush timer. Default: an unref'd setTimeout. */
  setTimer?: (fn: () => void, ms: number) => void;
}): Alerter {
  const doFetch = opts.fetch ?? ((i, init) => fetch(i, init));
  const now = opts.now ?? (() => new Date());
  const log = opts.log ?? (() => {});
  const windowMs = opts.dedupeWindowMs ?? 15 * 60_000;
  const marginMs = opts.trailingMarginMs ?? 60_000;
  const timeoutMs = opts.timeoutMs ?? 3000;
  const retryDelays = opts.retryDelaysMs ?? [250, 1000];
  const sleep = opts.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const setTimer =
    opts.setTimer ??
    ((fn: () => void, ms: number) => {
      setTimeout(fn, ms).unref?.();
    });

  /*
   * Dedupe with a trailing flush (launch P2-6). Per key:
   *  - the first occurrence (once the event's threshold is met) sends at once;
   *  - later occurrences accumulate until the key is eligible again:
   *    eligibleAt = lastDeliveredAt + window + margin, where lastDeliveredAt is
   *    when the previous delivery attempt FINISHED. The receiver writes its
   *    own cooldown before answering, on the same clock, so a batch sent at
   *    eligibleAt lands after that cooldown and is emailed, not suppressed;
   *  - nothing is eligible while a delivery for the key is in flight;
   *  - one timer per key sends the batch at eligibleAt without needing a later
   *    raise. A timer that fires early (a send moved the deadline) re-arms
   *    instead of giving up, so occurrences are never stranded.
   * A batch below the event's threshold is kept, not sent (as before).
   */
  interface Entry {
    signal: AlertSignal;
    count: number;
    firstSeen: Date;
    lastSeen: Date;
    lastDeliveredAt: number | null;
    inFlight: boolean;
    timerArmed: boolean;
  }
  const entries = new Map<string, Entry>();
  const inflight = new Set<Promise<void>>();

  async function deliver(signal: AlertSignal, payload: AlertPayload): Promise<boolean> {
    const body = JSON.stringify(payload);
    let lastStatus: number | string = "none";
    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      if (attempt > 0) await sleep(retryDelays[attempt - 1]);
      const ts = Math.floor(now().getTime() / 1000);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await doFetch(opts.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [ALERT_TIMESTAMP_HEADER]: String(ts),
            [ALERT_SIGNATURE_HEADER]: signAlert(body, opts.secret, ts),
            "User-Agent": "entrepreneuria-websites-alert/1",
          },
          body,
          cache: "no-store",
          signal: controller.signal,
        });
        if (res.ok) return true;
        lastStatus = res.status;
        if (res.status < 500) break; // a 4xx will not improve on retry
      } catch {
        lastStatus = controller.signal.aborted ? "timeout" : "network";
      } finally {
        clearTimeout(timer);
      }
    }
    // Logged without personal data: event name and delivery status only.
    log("alert delivery failed", { event: signal.event, status: lastStatus });
    return false;
  }

  const eligibleAt = (e: Entry) => (e.lastDeliveredAt === null ? -Infinity : e.lastDeliveredAt + windowMs + marginMs);

  function arm(e: Entry) {
    if (e.timerArmed) return;
    e.timerArmed = true;
    const delay = e.inFlight ? windowMs + marginMs : Math.max(0, eligibleAt(e) - now().getTime());
    setTimer(() => {
      e.timerArmed = false;
      trySend(e);
    }, delay);
  }

  function trySend(e: Entry) {
    try {
      if (e.count < 1 || e.count < (THRESHOLDS[e.signal.event] ?? 1)) return;
      if (e.inFlight || now().getTime() < eligibleAt(e)) {
        arm(e);
        return;
      }
      const payload = buildAlertPayload(e.signal, { count: e.count, environment: opts.environment, firstSeen: e.firstSeen, lastSeen: e.lastSeen });
      e.count = 0;
      e.inFlight = true;
      const p: Promise<void> = deliver(e.signal, payload)
        .then(
          () => {},
          () => {}
        )
        .finally(() => {
          e.lastDeliveredAt = now().getTime();
          e.inFlight = false;
          inflight.delete(p);
          if (e.count > 0) trySend(e); // occurrences raised during the delivery wait for eligibility
        });
      inflight.add(p);
    } catch (err) {
      log("alert flush failed", { error: (err as Error).name });
    }
  }

  return {
    raise(signal) {
      try {
        const t = now();
        const key = `${signal.event}|${safeToken(signal.step, "none")}|${safeToken(signal.status, "none")}`;
        let e = entries.get(key);
        if (!e) {
          e = { signal, count: 0, firstSeen: t, lastSeen: t, lastDeliveredAt: null, inFlight: false, timerArmed: false };
          entries.set(key, e);
        }
        e.count += 1;
        if (e.count === 1) e.firstSeen = t;
        e.lastSeen = t;
        trySend(e);
      } catch (err) {
        log("alert raise failed", { error: (err as Error).name });
      }
    },
    async settled() {
      await Promise.allSettled([...inflight]);
    },
    notify(signal) {
      const t = now();
      const payload = buildAlertPayload(signal, { count: 1, environment: opts.environment, firstSeen: t, lastSeen: t });
      const p = deliver(signal, payload).catch(() => false);
      const tracked = p.then(() => {}).finally(() => inflight.delete(tracked));
      inflight.add(tracked);
      return p;
    },
  };
}

/**
 * Readiness probe for the alert receiver (launch P0-3). Leads intake answers
 * "unavailable" (the form's email fallback) while the receiver is not
 * answering, so no lead path runs without a working failure channel: a
 * stopped receiver turns visitors to the email option instead of silently
 * dropping the alerts about their requests.
 *
 * GET <receiver origin>/health with a short timeout. A healthy answer is
 * trusted for `okForMs`; an unhealthy one only for `downForMs`, so recovery is
 * noticed quickly. Concurrent callers share one probe. Never throws.
 * Transitions are logged (no personal data).
 */
export function receiverHealthUrl(alertUrl: string): string {
  const u = new URL(alertUrl);
  u.pathname = "/health";
  u.search = "";
  u.hash = "";
  return u.toString();
}

export function createReceiverProbe(opts: {
  alertUrl: string;
  fetch?: FetchLike;
  nowMs?: () => number;
  okForMs?: number;
  downForMs?: number;
  timeoutMs?: number;
  log?: (msg: string, meta?: Record<string, unknown>) => void;
}): () => Promise<boolean> {
  const doFetch = opts.fetch ?? ((i, init) => fetch(i, init));
  const now = opts.nowMs ?? Date.now;
  const okFor = opts.okForMs ?? 60_000;
  const downFor = opts.downForMs ?? 10_000;
  const timeoutMs = opts.timeoutMs ?? 1500;
  const url = receiverHealthUrl(opts.alertUrl);
  let last: { ok: boolean; at: number } | null = null;
  let inflight: Promise<boolean> | null = null;

  async function probe(): Promise<boolean> {
    let ok = false;
    let status: number | string = "none";
    try {
      const res = await doFetch(url, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
      status = res.status;
      const body = res.ok ? await res.json().catch(() => null) : null;
      ok = body?.ok === true;
    } catch (err) {
      status = (err as Error).name === "TimeoutError" ? "timeout" : "network";
    }
    if (last && last.ok !== ok) opts.log?.(ok ? "alert receiver reachable again" : "alert receiver unreachable", { status });
    if (!last && !ok) opts.log?.("alert receiver unreachable", { status });
    last = { ok, at: now() };
    return ok;
  }

  return async () => {
    if (last && now() - last.at < (last.ok ? okFor : downFor)) return last.ok;
    inflight ??= probe().finally(() => {
      inflight = null;
    });
    return inflight;
  };
}

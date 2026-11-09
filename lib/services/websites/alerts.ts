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
  "ghl_auth_failed",
  "ghl_rate_limited",
  "unavailable",
  "turnstile_unavailable",
  "config_invalid",
  "capacity_count_unavailable",
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
}

export function createAlerter(opts: {
  url: string;
  secret: string;
  environment: string;
  fetch?: FetchLike;
  now?: () => Date;
  log?: (msg: string, meta?: Record<string, unknown>) => void;
  dedupeWindowMs?: number;
  timeoutMs?: number;
  retryDelaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
}): Alerter {
  const doFetch = opts.fetch ?? ((i, init) => fetch(i, init));
  const now = opts.now ?? (() => new Date());
  const log = opts.log ?? (() => {});
  const windowMs = opts.dedupeWindowMs ?? 15 * 60_000;
  const timeoutMs = opts.timeoutMs ?? 3000;
  const retryDelays = opts.retryDelaysMs ?? [250, 1000];
  const sleep = opts.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));

  const entries = new Map<string, { count: number; firstSeen: Date; lastSeen: Date; lastSentAt: number | null }>();
  const inflight = new Set<Promise<void>>();

  async function deliver(signal: AlertSignal, payload: AlertPayload) {
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
        if (res.ok) return;
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
  }

  return {
    raise(signal) {
      try {
        const t = now();
        const key = `${signal.event}|${safeToken(signal.step, "none")}|${safeToken(signal.status, "none")}`;
        let e = entries.get(key);
        if (!e) {
          e = { count: 0, firstSeen: t, lastSeen: t, lastSentAt: null };
          entries.set(key, e);
        }
        e.count += 1;
        if (e.count === 1) e.firstSeen = t;
        e.lastSeen = t;
        const inWindow = e.lastSentAt !== null && t.getTime() - e.lastSentAt < windowMs;
        if (inWindow) return;
        if (e.count < (THRESHOLDS[signal.event] ?? 1)) return;

        const payload = buildAlertPayload(signal, { count: e.count, environment: opts.environment, firstSeen: e.firstSeen, lastSeen: e.lastSeen });
        e.lastSentAt = t.getTime();
        e.count = 0;
        const p = deliver(signal, payload)
          .catch(() => {})
          .finally(() => inflight.delete(p));
        inflight.add(p);
      } catch (err) {
        log("alert raise failed", { error: (err as Error).name });
      }
    },
    async settled() {
      await Promise.allSettled([...inflight]);
    },
  };
}

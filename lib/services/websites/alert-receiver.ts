/**
 * Alert receiver for the leads-only intake: verifies a signed alert from
 * alerts.ts and emails the owner a short, personal-data-free notice.
 *
 * Runs as a small Node process on the app server, bound to loopback
 * (alert-receiver-server.ts, scripts/websites-alert-receiver.mts), and
 * sends through the owner's existing mailbox over SMTP (smtp-mailer.ts).
 * This module uses only standard Web APIs (Request, Response,
 * crypto.subtle), so it is host-neutral and unit-tested.
 *
 * Order of checks (cheapest and safest first; nothing is parsed or stored
 * before the signature is verified):
 *   1. path and method              → 404 / 405
 *   2. size (declared and actual)   → 413
 *   3. timestamp window + HMAC      → 401 (no detail returned)
 *   4. replay (same signature)      → 200 after completion; 503 while in flight
 *   5. strict payload validation    → 400
 *   6. per-alert cooldown           → 200 suppressed, no email
 *   7. hourly email cap             → 200 suppressed, no email (429 for a
 *                                      review notice, so the app keeps it
 *                                      pending and re-sends it later)
 *   8. send email                   → 200, or 502 so the sender retries
 *
 * Personal data: the sender's payload is an allowlist (event, step, status,
 * count, environment, first_seen, last_seen). This receiver re-validates
 * every field against the same character rules and builds the email only
 * from validated values, never from the raw body.
 */

/** Must match ALERT_EVENTS in alerts.ts (including capacity events added with PR #34). */
export const RECEIVER_EVENTS = [
  "delivery_failed",
  "returning_contact_review",
  "ghl_auth_failed",
  "ghl_rate_limited",
  "unavailable",
  "turnstile_unavailable",
  "config_invalid",
  "capacity_count_unavailable",
  "capacity_near",
  "capacity_full",
  "test",
] as const;
export type ReceiverEvent = (typeof RECEIVER_EVENTS)[number];

export const TIMESTAMP_HEADER = "x-websites-alert-timestamp";
export const SIGNATURE_HEADER = "x-websites-alert-signature";
export const ALERT_PATH = "/alerts";
export const MAX_BODY_BYTES = 4096;

export interface ReceiverConfig {
  /** Same value as the app's WEBSITES_ALERT_WEBHOOK_SECRET (32+ characters). */
  secret: string;
  /** Verified destination, e.g. the owner's monitored inbox. */
  to: string;
  /** Sender on a domain onboarded to Email Sending, e.g. alerts@alerts.entrepreneuria.io. */
  from: string;
  toleranceSeconds?: number;
  /** One email per distinct alert (event, step, status, environment) per window. */
  cooldownSeconds?: number;
  /** Hard ceiling on emails per clock hour, whatever arrives. */
  hourlyEmailCap?: number;
}

/** Small key-value store with expiry (in-memory per receiver process). */
export interface DedupeStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export interface OutboundEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: OutboundEmail): Promise<void>;
}

export interface ReceiverDeps {
  config: ReceiverConfig;
  store: DedupeStore;
  mailer: Mailer;
  nowMs?: () => number;
  /** Reason codes and event names only; never payload values beyond validated tokens. */
  log?: (msg: string, meta?: Record<string, unknown>) => void;
}

export interface ValidAlert {
  event: ReceiverEvent;
  step: string;
  status: string;
  count: number;
  environment: string;
  first_seen: string;
  last_seen: string;
}

const TOKEN = /^[A-Za-z0-9_:.-]{1,32}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const PAYLOAD_KEYS = ["count", "environment", "event", "first_seen", "last_seen", "status", "step"];

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const encoder = new TextEncoder();

/* Returns a plain ArrayBuffer: valid as BufferSource across TypeScript 5.x lib versions. */
function hexToBytes(hex: string): ArrayBuffer | null {
  if (!/^[0-9a-f]{64}$/.test(hex)) return null;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out.buffer as ArrayBuffer;
}

/** HMAC-SHA256 over `${timestamp}.${body}`, header `v1=<hex>`. crypto.subtle.verify compares in constant time. */
export async function verifySignature(input: {
  body: string;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  nowMs: number;
  toleranceSeconds: number;
}): Promise<boolean> {
  const { body, timestamp, signature, secret, nowMs, toleranceSeconds } = input;
  if (!timestamp || !signature || !/^\d{1,12}$/.test(timestamp) || !signature.startsWith("v1=")) return false;
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > toleranceSeconds) return false;
  const sig = hexToBytes(signature.slice(3));
  if (!sig) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, sig, encoder.encode(`${timestamp}.${body}`));
}

export function validateAlert(raw: unknown): ValidAlert | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  if (keys.length !== PAYLOAD_KEYS.length || keys.some((k, i) => k !== PAYLOAD_KEYS[i])) return null;
  if (!(RECEIVER_EVENTS as readonly string[]).includes(o.event as string)) return null;
  for (const k of ["step", "status", "environment"]) if (typeof o[k] !== "string" || !TOKEN.test(o[k] as string)) return null;
  if (typeof o.count !== "number" || !Number.isInteger(o.count) || o.count < 1 || o.count > 1_000_000) return null;
  for (const k of ["first_seen", "last_seen"]) if (typeof o[k] !== "string" || !ISO.test(o[k] as string)) return null;
  return o as unknown as ValidAlert;
}

/** "4:5" → { open: 4, max: 5 } */
function capacityCounts(status: string): { open: number; max: number } | null {
  const m = /^(\d{1,3}):(\d{1,3})$/.exec(status);
  return m ? { open: Number(m[1]), max: Number(m[2]) } : null;
}

const COPY: Record<ReceiverEvent, { subject: (a: ValidAlert) => string; body: (a: ValidAlert) => string; urgent: boolean }> = {
  returning_contact_review: {
    urgent: true,
    subject: (a) => `Preview request needs manual review (${a.status})`,
    body: (a) =>
      `A preview request is stored on the server for manual review.\n\nTo review it, on the server run:\n  WEBSITES_REVIEW_DIR=... npx tsx scripts/websites-review.mts show ${a.status}\nWhen handled:\n  ... websites-review.mts resolve ${a.status}`,
  },
  capacity_near: {
    urgent: false,
    subject: (a) => {
      const c = capacityCounts(a.status);
      return c ? `Preview intake: 1 slot left (${c.open} of ${c.max} open)` : "Preview intake: 1 slot left";
    },
    body: () =>
      "One more preview request will fill the intake limit. After that, new visitors see a message asking them to email instead of using the form.\n\nTo free slots, move finished previews out of the intake pipeline stage in GoHighLevel. To stop new requests now, set WEBSITES_PREVIEW_INTAKE=paused and restart the app.",
  },
  capacity_full: {
    urgent: true,
    subject: (a) => {
      const c = capacityCounts(a.status);
      return c ? `Preview intake is full (${c.open} of ${c.max})` : "Preview intake is full";
    },
    body: () =>
      "The open-request limit is reached. New visitors now see the capacity message with an option to email their request to the services inbox, so watch that inbox.\n\nIntake reopens automatically when an open preview leaves the intake pipeline stage in GoHighLevel.",
  },
  delivery_failed: {
    urgent: true,
    subject: () => "A preview request could not be delivered to GoHighLevel",
    body: () =>
      "A visitor's request did not reach GoHighLevel. In leads mode the request was saved on the server for manual review, and a separate review notice gives its reference. Otherwise the visitor was shown an error, their answers were kept, and they were offered the email option.\n\nCheck GoHighLevel, the review list and the services inbox. Repeated alerts mean the integration is down.",
  },
  ghl_auth_failed: {
    urgent: true,
    subject: () => "GoHighLevel rejected the API credentials: preview requests are failing",
    body: () =>
      "GoHighLevel answered 401 or 403. Every preview request will fail until this is fixed.\n\nCheck the private integration token and its scopes, then consider pausing intake (WEBSITES_PREVIEW_INTAKE=paused) until it is resolved.",
  },
  ghl_rate_limited: {
    urgent: false,
    subject: () => "GoHighLevel is rate-limiting preview requests",
    body: () => "GoHighLevel answered 429 several times. Some visitors may have been asked to retry or email instead.",
  },
  unavailable: {
    urgent: true,
    subject: () => "The preview request form is unavailable",
    body: () => "The intake refused a request as unavailable, usually because the CRM is not configured. Check the server settings.",
  },
  turnstile_unavailable: {
    urgent: false,
    subject: () => "The spam check service is not responding",
    body: () => "Cloudflare Turnstile verification failed several times. Visitors may be unable to submit the form.",
  },
  config_invalid: {
    urgent: true,
    subject: () => "Preview intake configuration problem",
    body: () => "The intake detected a configuration problem (for example the proxy stopped sending the client address). Check the server and proxy settings.",
  },
  capacity_count_unavailable: {
    urgent: false,
    subject: () => "Preview capacity could not be checked",
    body: () =>
      "The open-request count could not be read from GoHighLevel, so requests are being accepted without the limit. Check GoHighLevel if this repeats.",
  },
  test: {
    urgent: false,
    subject: () => "Test alert",
    body: () => "This is a test alert. Delivery from the app to this inbox works.",
  },
};

export function renderEmail(a: ValidAlert, cfg: Pick<ReceiverConfig, "from" | "to">): OutboundEmail {
  const c = COPY[a.event];
  const env = a.environment === "production" ? "" : ` [${a.environment}]`;
  const lines = [
    c.body(a),
    "",
    "Details",
    `Event: ${a.event}`,
    `Step: ${a.step}`,
    `Status: ${a.status}`,
    `Occurrences: ${a.count}`,
    `First seen: ${a.first_seen}`,
    `Last seen: ${a.last_seen}`,
    `Environment: ${a.environment}`,
    "",
    "This alert never contains visitor details. Look the lead up in GoHighLevel.",
  ];
  return {
    from: cfg.from,
    to: cfg.to,
    subject: `[Entrepreneuria Websites]${env} ${c.urgent ? "ACTION: " : ""}${c.subject(a)}`,
    text: lines.join("\n"),
  };
}

export async function handleAlertRequest(request: Request, deps: ReceiverDeps): Promise<Response> {
  const now = deps.nowMs ?? Date.now;
  const log = deps.log ?? (() => {});
  const cfg = deps.config;
  const tolerance = cfg.toleranceSeconds ?? 300;
  const cooldown = cfg.cooldownSeconds ?? 15 * 60;
  const cap = cfg.hourlyEmailCap ?? 12;

  if (new URL(request.url).pathname !== ALERT_PATH) return json({ ok: false }, 404);
  if (request.method !== "POST") return json({ ok: false }, 405);

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return json({ ok: false }, 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_BODY_BYTES) return json({ ok: false }, 413);
  const body = new TextDecoder().decode(bytes);

  const signature = request.headers.get(SIGNATURE_HEADER);
  const ok = await verifySignature({
    body,
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    signature,
    secret: cfg.secret,
    nowMs: now(),
    toleranceSeconds: tolerance,
  });
  if (!ok) {
    log("rejected", { reason: "signature" });
    return json({ ok: false }, 401);
  }

  // Replay: a captured request re-sent inside the timestamp window.
  const replayKey = `sig:${signature}`;
  const replay = await deps.store.get(replayKey);
  if (replay === "pending") return json({ ok: false, retry: "later" }, 503);
  if (replay === "sent") return json({ ok: true, duplicate: true }, 200);

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }
  const alert = validateAlert(parsed);
  if (!alert) {
    log("rejected", { reason: "payload" });
    return json({ ok: false }, 400);
  }
  const coolKey = `cool:${alert.event}|${alert.step}|${alert.status}|${alert.environment}`;
  if (await deps.store.get(coolKey)) {
    log("suppressed", { reason: "cooldown", event: alert.event });
    return json({ ok: true, suppressed: "cooldown" }, 200);
  }

  const hourKey = `cap:${Math.floor(now() / 3_600_000)}`;
  const sentThisHour = Number((await deps.store.get(hourKey)) ?? "0");
  if (sentThisHour >= cap) {
    log("suppressed", { reason: "hourly_cap", event: alert.event });
    // A review notice is tracked by the app: answer non-2xx so it stays pending and is re-sent later.
    if (alert.event === "returning_contact_review") {
      return json({ ok: false, retry: "later" }, 429);
    }
    return json({ ok: true, suppressed: "hourly_cap" }, 200);
  }

  await deps.store.put(replayKey, "pending", tolerance * 2);
  try {
    await deps.mailer.send(renderEmail(alert, cfg));
  } catch (err) {
    // Stage and SMTP code only (e.g. "rcpt", 550): enough to diagnose, no addresses or reply text.
    const e = err as { name?: string; stage?: unknown; code?: unknown };
    log("email failed", {
      event: alert.event,
      error: e?.name ?? "error",
      ...(typeof e?.stage === "string" ? { stage: e.stage } : {}),
      ...(typeof e?.code === "number" ? { code: e.code } : {}),
    });
    // Let a later retry through: forget the replay marker. 5xx makes the sender retry.
    await deps.store.put(replayKey, "", 1);
    return json({ ok: false }, 502);
  }

  await deps.store.put(coolKey, "1", cooldown);
  await deps.store.put(replayKey, "sent", tolerance * 2);
  await deps.store.put(hourKey, String(sentThisHour + 1), 3600);
  log("sent", { event: alert.event });
  return json({ ok: true }, 200);
}

/** In-memory store with expiry, for tests and as a per-isolate fallback when no KV namespace is bound. */
export function createMemoryStore(nowMs: () => number = Date.now): DedupeStore {
  const m = new Map<string, { v: string; exp: number }>();
  return {
    async get(k) {
      const e = m.get(k);
      if (!e || e.exp <= nowMs() || e.v === "") return null;
      return e.v;
    },
    async put(k, v, ttl) {
      m.set(k, { v, exp: nowMs() + ttl * 1000 });
    },
  };
}

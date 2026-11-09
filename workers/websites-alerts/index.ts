/**
 * Cloudflare Worker entry for the Entrepreneuria Websites alert receiver.
 * All logic lives in lib/services/websites/alert-receiver.ts (tested in CI).
 * Deployment and configuration: workers/websites-alerts/README.md.
 *
 * Types are declared locally (no @cloudflare/workers-types dependency) so the
 * app's own typecheck covers this file without a new package.
 */
import {
  createMemoryStore,
  handleAlertRequest,
  type DedupeStore,
  type OutboundEmail,
} from "../../lib/services/websites/alert-receiver";

interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/** Cloudflare Email Service send binding (plain-object form). */
interface SendEmailBinding {
  send(message: OutboundEmail): Promise<{ messageId?: string }>;
}

export interface Env {
  /** Secret (wrangler secret put): same value as the app's WEBSITES_ALERT_WEBHOOK_SECRET. */
  ALERT_WEBHOOK_SECRET: string;
  /** Plain var: verified destination address. */
  ALERT_EMAIL_TO: string;
  /** Plain var: sender on the onboarded sending subdomain. */
  ALERT_EMAIL_FROM: string;
  /** send_email binding, restricted to ALERT_EMAIL_TO in wrangler.jsonc. */
  ALERT_EMAIL: SendEmailBinding;
  /** Optional KV namespace for dedupe across isolates. Without it, dedupe is per isolate. */
  ALERT_DEDUPE?: KVNamespaceLike;
}

/* KV requires expirationTtl >= 60 seconds. */
const kvStore = (kv: KVNamespaceLike): DedupeStore => ({
  get: (k) => kv.get(k),
  put: (k, v, ttl) => kv.put(k, v, { expirationTtl: Math.max(60, Math.ceil(ttl)) }),
});

let isolateStore: DedupeStore | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.ALERT_WEBHOOK_SECRET || env.ALERT_WEBHOOK_SECRET.length < 32 || !env.ALERT_EMAIL_TO || !env.ALERT_EMAIL_FROM) {
      // Misconfigured: refuse everything rather than accept unsigned traffic.
      return new Response(JSON.stringify({ ok: false }), { status: 503, headers: { "content-type": "application/json" } });
    }
    const store = env.ALERT_DEDUPE ? kvStore(env.ALERT_DEDUPE) : (isolateStore ??= createMemoryStore());
    return handleAlertRequest(request, {
      config: { secret: env.ALERT_WEBHOOK_SECRET, to: env.ALERT_EMAIL_TO, from: env.ALERT_EMAIL_FROM },
      store,
      mailer: {
        async send(message) {
          await env.ALERT_EMAIL.send(message);
        },
      },
      log: (msg, meta) => console.log(`[websites-alerts] ${msg}`, JSON.stringify(meta ?? {})),
    });
  },
};

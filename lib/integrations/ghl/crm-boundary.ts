/**
 * Runtime boundary between sandbox and production GHL access (F4).
 *
 * Before this module, every mode read the same ordinary GHL_* credentials, so
 * a `nonproduction` intake (or a `leads` rehearsal on a staging host) wrote
 * real leads into the production sub-account and could fire its automations.
 *
 * Now the CRM a request may use is decided from facts the server resolved, not
 * from a name or a flag:
 *
 *   production CRM   only when the release gate resolved `leads` or
 *                    `production` mode (each already needs its own owner
 *                    authorization and gates) AND the request was served on
 *                    the canonical production host. Uses GHL_*.
 *   sandbox CRM      every other request (nonproduction mode, or any mode on
 *                    a staging or loopback host). Uses ONLY GHL_SANDBOX_*,
 *                    and ordinary GHL_* is never read for it except to prove
 *                    it is different.
 *
 * A sandbox target is usable only if all of these hold:
 *   1. every GHL_SANDBOX_* setting is present and well-formed;
 *   2. the sandbox token, location, pipeline and stage differ from every
 *      ordinary GHL_* value present (and the reverse for production);
 *   3. a live, read-only identity check (the same gate the owner's sandbox
 *      harness uses) shows the token reaches exactly GHL_SANDBOX_LOCATION_ID,
 *      whose name is exactly GHL_SANDBOX_EXPECT_LOCATION_NAME and contains
 *      "sandbox", that the pipeline, stage and custom fields belong to it, and
 *      that none of its workflows is active (so test traffic cannot trigger
 *      automations or messages).
 * The check re-runs on a timer, and every CRM call waits for it. Any doubt
 * (unreadable response, timeout, rename) refuses the call: nothing is written
 * and intake answers as it does when the CRM is unavailable.
 *
 * Errors and logs name settings and failed checks, never tokens.
 */
import { createHash } from "node:crypto";

import type { ServicesMode } from "../../services/websites/flags";
import { PRODUCTION_SERVING_HOSTS } from "../../services/websites/gate";
import { createGhlClient, GhlError, type GhlConfig, type LeadCrm } from "./client";
import { parseCustomFieldIds } from "./config";
import { verifySandboxIdentity } from "./sandbox-discover";

type Env = Record<string, string | undefined>;
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** What the release gate resolved for this request. Built from the gate result, never from the request. */
export interface CrmContext {
  mode: Exclude<ServicesMode, "off">;
  /** Authority the visitor addressed, as the gate normalized it. */
  host: string;
}

export type CrmTarget = "production" | "sandbox";

export type CrmRefusal =
  | "sandbox_not_configured"
  | "sandbox_shares_production_value"
  | "production_not_configured"
  | "production_shares_sandbox_value";

export type CrmDecision =
  | { ok: true; target: "production"; config: GhlConfig }
  | { ok: true; target: "sandbox"; config: GhlConfig; expectedLocationName: string }
  | { ok: false; target: CrmTarget; reason: CrmRefusal; /** Setting names only, never values. */ detail: string[] };

export const SANDBOX_IDENTITY_OK_TTL_MS = 10 * 60_000;
export const SANDBOX_IDENTITY_FAIL_TTL_MS = 30_000;
const IDENTITY_TIMEOUT_MS = 8_000;

const SANDBOX_SETTINGS = [
  "GHL_SANDBOX_TOKEN",
  "GHL_SANDBOX_LOCATION_ID",
  "GHL_SANDBOX_EXPECT_LOCATION_NAME",
  "GHL_SANDBOX_PIPELINE_ID",
  "GHL_SANDBOX_PIPELINE_STAGE_ID",
  "GHL_SANDBOX_CUSTOM_FIELD_IDS",
] as const;

const hostnameOf = (host: string) => host.replace(/:\d+$/, "").toLowerCase();

/** Which CRM this request is allowed to reach. Pure. */
export function crmTargetFor(ctx: CrmContext): CrmTarget {
  const productionMode = ctx.mode === "leads" || ctx.mode === "production";
  return productionMode && PRODUCTION_SERVING_HOSTS.includes(hostnameOf(ctx.host)) ? "production" : "sandbox";
}

const present = (env: Env, k: string) => (env[k] ?? "").trim();

/** Ordinary values a sandbox setting must never equal, and the reverse. */
const PAIRS: ReadonlyArray<[prod: string, sandbox: string]> = [
  ["GHL_API_TOKEN", "GHL_SANDBOX_TOKEN"],
  ["GHL_LOCATION_ID", "GHL_SANDBOX_LOCATION_ID"],
  ["GHL_PIPELINE_ID", "GHL_SANDBOX_PIPELINE_ID"],
  ["GHL_PIPELINE_STAGE_ID", "GHL_SANDBOX_PIPELINE_STAGE_ID"],
];

function sharedValues(env: Env): string[] {
  return PAIRS.filter(([p, s]) => present(env, p) && present(env, p) === present(env, s)).map(([p, s]) => `${p}=${s}`);
}

export function decideCrm(ctx: CrmContext, env: Env): CrmDecision {
  const target = crmTargetFor(ctx);

  if (target === "production") {
    const missing = ["GHL_API_TOKEN", "GHL_LOCATION_ID", "GHL_PIPELINE_ID", "GHL_PIPELINE_STAGE_ID"].filter((k) => !present(env, k));
    if (missing.length) return { ok: false, target, reason: "production_not_configured", detail: missing };
    const shared = sharedValues(env);
    if (shared.length) return { ok: false, target, reason: "production_shares_sandbox_value", detail: shared };
    const { ids } = parseCustomFieldIds(env.GHL_CUSTOM_FIELD_IDS, env.GHL_CUSTOM_FIELD_KEYS);
    return {
      ok: true,
      target,
      config: {
        token: present(env, "GHL_API_TOKEN"),
        locationId: present(env, "GHL_LOCATION_ID"),
        pipelineId: present(env, "GHL_PIPELINE_ID"),
        pipelineStageId: present(env, "GHL_PIPELINE_STAGE_ID"),
        apiVersion: env.GHL_API_VERSION ?? "2021-07-28",
        customFieldIds: ids,
      },
    };
  }

  const missing = SANDBOX_SETTINGS.filter((k) => !present(env, k));
  if (missing.length) return { ok: false, target, reason: "sandbox_not_configured", detail: [...missing] };
  const shared = sharedValues(env);
  if (shared.length) return { ok: false, target, reason: "sandbox_shares_production_value", detail: shared };
  // The identity check requires exactly the two sandbox fields; other logical fields are optional here.
  const { ids } = parseCustomFieldIds(env.GHL_SANDBOX_CUSTOM_FIELD_IDS);
  if (!ids.style_interest || !ids.package_interest) return { ok: false, target, reason: "sandbox_not_configured", detail: ["GHL_SANDBOX_CUSTOM_FIELD_IDS"] };
  return {
    ok: true,
    target,
    expectedLocationName: present(env, "GHL_SANDBOX_EXPECT_LOCATION_NAME"),
    config: {
      token: present(env, "GHL_SANDBOX_TOKEN"),
      locationId: present(env, "GHL_SANDBOX_LOCATION_ID"),
      pipelineId: present(env, "GHL_SANDBOX_PIPELINE_ID"),
      pipelineStageId: present(env, "GHL_SANDBOX_PIPELINE_STAGE_ID"),
      apiVersion: env.GHL_SANDBOX_API_VERSION ?? env.GHL_API_VERSION ?? "2021-07-28",
      customFieldIds: ids,
    },
  };
}

export interface CrmProviderDeps {
  env?: Env;
  /** Used for the identity check and by the client. Tests inject a fake; nothing in tests touches the network. */
  fetch?: FetchLike;
  now?: () => number;
  log?: (msg: string, meta?: Record<string, unknown>) => void;
}

interface Verification {
  ok: boolean;
  until: number;
  pending?: Promise<boolean>;
}

const refusal = (message: string) => new GhlError(message, "contact", null, false, undefined, { outcome: "rejected" });

/**
 * Per-process CRM selection. `getCrm(ctx)` returns a client for the target the
 * context allows, or null when that target is refused. Sandbox clients wait for
 * a fresh, successful identity check before every call.
 */
export function createCrmProvider(deps: CrmProviderDeps = {}) {
  const getEnv = () => deps.env ?? process.env;
  const now = deps.now ?? Date.now;
  const log = deps.log ?? ((msg, meta) => console.error(`[websites-crm] ${msg}`, meta ?? ""));
  const baseFetch: FetchLike = deps.fetch ?? ((url, init) => fetch(url, init));
  const timedFetch: FetchLike = (url, init) => baseFetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(IDENTITY_TIMEOUT_MS) });

  const reported = new Set<string>();
  const reportOnce = (key: string, msg: string, meta?: Record<string, unknown>) => {
    if (reported.has(key)) return;
    reported.add(key);
    log(msg, meta);
  };

  const clients = new Map<string, LeadCrm>();
  const verifications = new Map<string, Verification>();

  function verified(key: string, d: Extract<CrmDecision, { target: "sandbox" }>): Promise<boolean> {
    const v = verifications.get(key);
    if (v && v.until > now()) return v.pending ?? Promise.resolve(v.ok);
    const entry: Verification = { ok: false, until: now() + SANDBOX_IDENTITY_FAIL_TTL_MS };
    entry.pending = (async () => {
      try {
        const result = await verifySandboxIdentity(
          { ...d.config, baseUrl: undefined },
          d.expectedLocationName,
          // Read-only by construction: discoverSandbox wraps this in readOnlyFetch.
          timedFetch
        );
        entry.ok = result.ok;
        entry.until = now() + (result.ok ? SANDBOX_IDENTITY_OK_TTL_MS : SANDBOX_IDENTITY_FAIL_TTL_MS);
        if (!result.ok) reportOnce(`identity:${key}:${result.errors.join("|")}`, "sandbox CRM identity check failed; CRM calls are refused", { problems: result.errors });
      } catch {
        entry.ok = false;
        entry.until = now() + SANDBOX_IDENTITY_FAIL_TTL_MS;
        reportOnce(`identity-error:${key}`, "sandbox CRM identity check could not complete; CRM calls are refused");
      } finally {
        entry.pending = undefined;
      }
      return entry.ok;
    })();
    verifications.set(key, entry);
    return entry.pending;
  }

  function sandboxClient(d: Extract<CrmDecision, { target: "sandbox" }>): LeadCrm {
    const inner = createGhlClient(d.config, deps.fetch ? { fetch: deps.fetch } : undefined);
    const key = `${d.config.locationId}|${d.config.pipelineId}|${d.config.pipelineStageId}|${d.expectedLocationName}`;
    const gate = async () => {
      if (!(await verified(key, d))) throw refusal("sandbox CRM identity is not verified; refusing the call");
    };
    const guarded: LeadCrm = {
      async syncLead(lead) {
        await gate();
        return inner.syncLead(lead);
      },
    };
    if (inner.countOpenOpportunities) {
      const count = inner.countOpenOpportunities.bind(inner);
      guarded.countOpenOpportunities = async (opts) => {
        await gate();
        return count(opts);
      };
    }
    if (inner.findContactByEmail) {
      const find = inner.findContactByEmail.bind(inner);
      guarded.findContactByEmail = async (email, reference) => {
        await gate();
        return find(email, reference);
      };
    }
    return guarded;
  }

  return {
    decide: (ctx: CrmContext) => decideCrm(ctx, getEnv()),

    getCrm(ctx: CrmContext): LeadCrm | null {
      const d = decideCrm(ctx, getEnv());
      if (!d.ok) {
        reportOnce(`${d.target}:${d.reason}:${d.detail.join(",")}`, `${d.target} CRM refused: ${d.reason}`, { settings: d.detail });
        return null;
      }
      const key = `${d.target}|${d.config.locationId}|${d.config.pipelineId}|${d.config.pipelineStageId}|${createHash("sha256").update(d.config.token).digest("hex").slice(0, 16)}|${JSON.stringify(d.config.customFieldIds)}`;
      let client = clients.get(key);
      if (!client) {
        client = d.target === "sandbox" ? sandboxClient(d) : createGhlClient(d.config, deps.fetch ? { fetch: deps.fetch } : undefined);
        clients.set(key, client);
      }
      return client;
    },
  };
}

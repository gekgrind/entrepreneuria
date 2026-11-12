/**
 * Entrepreneuria Websites — per-request release gate.
 *
 * The page and the inquiry route both call `resolveWebsitesGate` and serve
 * nothing (404) unless it returns `enabled: true`. It fails closed: any
 * missing or unrecognised setting means "off".
 *
 * On top of WEBSITES_SERVICES_MODE (flags.ts) it requires:
 *
 *   Host allowlist
 *     production     the canonical production host only
 *     leads          the canonical production host, plus any host named in
 *                    WEBSITES_NONPRODUCTION_HOSTS (so leads mode can be
 *                    rehearsed on a staging host before production).
 *     nonproduction  WEBSITES_NONPRODUCTION_HOSTS, a comma list of exact
 *                    hosts (`name` or `name:port`). Empty or unset means
 *                    nonproduction serves nowhere. Production hosts are
 *                    never accepted here, and loopback entries are ignored
 *                    when NODE_ENV=production.
 *     The host is read from X-Forwarded-Host and Host. Every value present
 *     must be the same allowlisted host, so a reverse proxy in front of the
 *     app must forward the visitor's Host header.
 *
 *   WEBSITES_IP_HASH_SALT   server secret, at least 16 characters
 *   TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY   both set
 *
 * Pure (env and headers are injected), so it is unit-tested.
 */
import { explainLeadsOff, resolveServicesMode, type LeadsOffReason, type ServicesMode } from "./flags";
import type { ReleaseGate } from "./release-gates";

type Env = Record<string, string | undefined>;
type HeaderReader = { get(name: string): string | null };

/** Hosts the production mode serves on. Never valid as nonproduction hosts. */
export const WEBSITES_PRODUCTION_HOSTS: readonly string[] = ["entrepreneuria.io", "www.entrepreneuria.io"];
/** Only the canonical host is served in production mode. Also the only host that may use production CRM credentials. */
export const PRODUCTION_SERVING_HOSTS: readonly string[] = ["entrepreneuria.io"];

export const MIN_IP_HASH_SALT_LENGTH = 16;

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

export type GateDisabledReason =
  | "mode_off"
  | LeadsOffReason
  | "host_not_allowed"
  | "ip_hash_salt_missing"
  | "turnstile_not_configured";

export type WebsitesGate =
  | { enabled: false; mode: ServicesMode; reason: GateDisabledReason; /** Names of missing settings, never values. */ missing?: string[] }
  | {
      enabled: true;
      mode: Exclude<ServicesMode, "off">;
      /** Authority the visitor addressed (`name` or `name:port`). */
      host: string;
      /** Host without port; what Turnstile reports back. */
      hostname: string;
      /** The only origin a submission's page_url may have. */
      origin: string;
      ipHashSalt: string;
      turnstileSecret: string;
    };

/* A DNS name or bracketed IPv6 literal, with an optional port. Nothing the URL parser would rewrite. */
const HOST_SYNTAX = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*|\[[0-9a-f:.]+\])(?::(\d{1,5}))?$/;

/** Normalises a bare host authority (lowercase, default port dropped), or returns null if it is not one. */
export function normalizeHost(raw: string | null | undefined): string | null {
  const value = raw?.trim().toLowerCase();
  if (!value || !HOST_SYNTAX.test(value)) return null;
  try {
    const url = new URL(`https://${value}`);
    // Reject spellings the parser would canonicalise into a different name (e.g. numeric IPv4 forms).
    if (url.hostname !== value.replace(/:\d+$/, "")) return null;
    return url.host;
  } catch {
    return null;
  }
}

const hostnameOf = (host: string) => new URL(`https://${host}`).hostname;
const isLoopback = (host: string) => LOOPBACK_HOSTNAMES.has(hostnameOf(host));
const isProductionHost = (host: string) => WEBSITES_PRODUCTION_HOSTS.includes(hostnameOf(host));

export function parseNonproductionHosts(raw: string | undefined, env: Env = process.env): string[] {
  const hosts = new Set<string>();
  for (const part of (raw ?? "").split(",")) {
    const host = normalizeHost(part);
    if (!host || isProductionHost(host)) continue;
    if (isLoopback(host) && env.NODE_ENV === "production") continue;
    hosts.add(host);
  }
  return [...hosts];
}

/** Every host value the request carries, or null if any of them is malformed. */
function requestHosts(headers: HeaderReader): string[] | null {
  const raw = [
    ...(headers.get("x-forwarded-host") ?? "").split(","),
    headers.get("host") ?? "",
  ].filter((v) => v.trim());
  const hosts: string[] = [];
  for (const value of raw) {
    const host = normalizeHost(value);
    if (!host) return null;
    hosts.push(host);
  }
  return hosts;
}

/** The allowlisted host this request is addressed to, or null. Every host value present must name it. */
export function matchAllowedHost(headers: HeaderReader, allowed: readonly string[]): string | null {
  const hosts = requestHosts(headers);
  if (!hosts?.length || !allowed.length) return null;
  const distinct = new Set(hosts);
  if (distinct.size !== 1) return null;
  const [host] = distinct;
  return allowed.includes(host) ? host : null;
}

export function resolveWebsitesGate(
  headers: HeaderReader,
  env: Env = process.env,
  leadsGates?: readonly ReleaseGate[]
): WebsitesGate {
  const mode = resolveServicesMode(env, leadsGates);
  if (mode === "off") {
    // Leads mode was asked for but is not ready: say why (setting names only), never silently.
    const why = env.WEBSITES_SERVICES_MODE === "leads" ? explainLeadsOff(env, leadsGates) : null;
    return { enabled: false, mode, reason: why?.reason ?? "mode_off", ...(why?.missing ? { missing: why.missing } : {}) };
  }

  const nonproductionHosts = parseNonproductionHosts(env.WEBSITES_NONPRODUCTION_HOSTS, env);
  const allowed =
    mode === "production"
      ? PRODUCTION_SERVING_HOSTS
      : mode === "leads"
        ? [...new Set([...PRODUCTION_SERVING_HOSTS, ...nonproductionHosts])]
        : nonproductionHosts;
  const host = matchAllowedHost(headers, allowed);
  if (!host) return { enabled: false, mode, reason: "host_not_allowed" };

  const ipHashSalt = env.WEBSITES_IP_HASH_SALT ?? "";
  if (ipHashSalt.length < MIN_IP_HASH_SALT_LENGTH) return { enabled: false, mode, reason: "ip_hash_salt_missing" };

  const turnstileSecret = env.TURNSTILE_SECRET_KEY ?? "";
  if (!turnstileSecret || !env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    return { enabled: false, mode, reason: "turnstile_not_configured" };
  }

  const hostname = hostnameOf(host);
  // Plain http only for a loopback host in nonproduction (local development).
  const scheme = mode === "nonproduction" && isLoopback(host) ? "http" : "https";
  const origin = new URL(`${scheme}://${host}`).origin;
  return { enabled: true, mode, host, hostname, origin, ipHashSalt, turnstileSecret };
}

const reported = new Set<string>();

/**
 * Logs why a configured (non-off) gate stayed closed, once per distinct
 * reason, so a misconfiguration is visible without flooding the logs.
 */
export function reportClosedGate(gate: WebsitesGate, log: (msg: string) => void = console.error): void {
  if (gate.enabled || gate.reason === "mode_off") return;
  const detail = gate.missing?.length ? ` (missing: ${gate.missing.join(", ")})` : "";
  const signature = `${gate.mode}:${gate.reason}${detail}`;
  if (reported.has(signature)) return;
  reported.add(signature);
  log(`[websites] ${gate.mode} mode is set but the page and inquiry route stay off: ${gate.reason}${detail}`);
}

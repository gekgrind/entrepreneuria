/**
 * Entrepreneuria Websites — which hosts may serve the Websites page and intake.
 *
 * Pure (no env reads of its own, no `server-only`) so flags.ts, the inquiry
 * schema and tests can share it.
 *
 * Hosts are compared as the lowercase `Host` header value, including a port
 * if one is present. An allowlist entry without a port only matches a
 * request without a port.
 */

/** The public production origin(s). Production mode serves only these. */
export const WEBSITES_PRODUCTION_HOSTS: readonly string[] = ["entrepreneuria.io", "www.entrepreneuria.io"];

/** hostname or hostname:port; letters, digits, dots and hyphens only. */
const HOST = /^(?=.{1,253}(?::\d{1,5})?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*(?::\d{1,5})?$/;

/** Lowercased, trimmed host (with port), or null if it isn't a plain host. */
export function normalizeHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const host = raw.trim().toLowerCase().replace(/\.(?=:|$)/, "");
  return HOST.test(host) ? host : null;
}

/** The hostname without any port. */
export function hostnameOf(host: string): string {
  return host.replace(/:\d+$/, "");
}

/** Parses a comma-separated host list, dropping anything that isn't a plain host. */
export function parseHostList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((h) => normalizeHost(h))
    .filter((h): h is string => h !== null);
}

export function isProductionHost(host: string): boolean {
  return WEBSITES_PRODUCTION_HOSTS.includes(hostnameOf(host));
}

/** Loopback hosts are the only ones allowed to use plain http (local development). */
export function isLoopbackHost(host: string): boolean {
  const name = hostnameOf(host);
  return name === "localhost" || name === "127.0.0.1";
}

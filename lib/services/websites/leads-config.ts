/**
 * Leads-only mode: required configuration.
 *
 * Fail closed. Every setting the mode needs for safety must be present and
 * valid, or the mode does not start (flags.ts resolves it to `off`) and the
 * request handler refuses with an explicit 503. Nothing here falls back to a
 * permissive default. Problems name the setting only, never its value.
 *
 * Pure: reads an env object, touches nothing else. Server-side only.
 */

type Env = Record<string, string | undefined>;

/** Owner's initial proposal for the open-request limit. Never applied implicitly: it must be set in env. */
export const PROPOSED_MAX_OPEN_REQUESTS = 5;

/** Upper bound. The GHL count reads one page of 100, so a higher limit could not be enforced. */
export const MAX_OPEN_REQUESTS_CEILING = 100;

export type PreviewIntake = "open" | "paused";

export interface LeadsConfig {
  alertWebhookUrl: string;
  alertWebhookSecret: string;
  previewIntake: PreviewIntake;
  maxOpenRequests: number;
  /** Optional: count only this pipeline stage as an open preview request. */
  countStageId: string | undefined;
  /** Absolute directory of the review store (returning contacts), outside the web root. */
  reviewDir: string;
  /** Key for review references (the IP-hash salt, already required by the gate). */
  referenceKey: string;
}

/**
 * Public services inbox shown on the page and used by the email fallback.
 * Server setting, no default (owner, 2026-11-09): set it only after the
 * mailbox is confirmed operational and monitored. Unset or malformed keeps
 * leads mode off and the page unrendered, so an unconfirmed address is never
 * published by this page.
 */
export function parseContactEmail(env: Env): string | null {
  const v = env.WEBSITES_CONTACT_EMAIL?.trim() ?? "";
  return /^[^\s@<>"'(),;:]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(v) && v.length <= 254 ? v : null;
}

function parseHttpsUrl(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

/**
 * Settings only the leads path needs. The host allowlist, IP-hash salt and
 * Turnstile keys are enforced for every mode by the per-request gate
 * (gate.ts), so they are not repeated here.
 */
export function readLeadsConfig(env: Env): { config: LeadsConfig | null; problems: string[] } {
  const problems: string[] = [];
  const need = (name: string, ok: boolean) => {
    if (!ok) problems.push(name);
  };

  const hook = parseAlertWebhookUrl(env.WEBSITES_ALERT_WEBHOOK_URL?.trim());
  need("WEBSITES_ALERT_WEBHOOK_URL", hook !== null);
  const hookSecret = env.WEBSITES_ALERT_WEBHOOK_SECRET ?? "";
  need("WEBSITES_ALERT_WEBHOOK_SECRET", hookSecret.length >= 32);

  need("WEBSITES_CONTACT_EMAIL", parseContactEmail(env) !== null);

  // The CRM is the only place a lead lands in this mode (no store), so it must be configured.
  for (const name of ["GHL_API_TOKEN", "GHL_LOCATION_ID", "GHL_PIPELINE_ID", "GHL_PIPELINE_STAGE_ID"]) {
    need(name, Boolean(env[name]?.trim()));
  }

  // Returning contacts are stored here, never in the CRM (owner, 2026-11-09).
  const reviewDir = env.WEBSITES_REVIEW_DIR?.trim() ?? "";
  need("WEBSITES_REVIEW_DIR", reviewDir.startsWith("/") && !reviewDir.split("/").includes(".."));

  const intake = env.WEBSITES_PREVIEW_INTAKE?.trim().toLowerCase();
  need("WEBSITES_PREVIEW_INTAKE", intake === "open" || intake === "paused");

  const rawMax = env.WEBSITES_PREVIEW_MAX_OPEN_REQUESTS?.trim() ?? "";
  const max = /^\d{1,3}$/.test(rawMax) ? Number(rawMax) : NaN;
  need("WEBSITES_PREVIEW_MAX_OPEN_REQUESTS", Number.isInteger(max) && max >= 1 && max <= MAX_OPEN_REQUESTS_CEILING);

  if (problems.length) return { config: null, problems };

  return {
    problems,
    config: {
      alertWebhookUrl: hook!.toString(),
      alertWebhookSecret: hookSecret,
      previewIntake: intake as PreviewIntake,
      maxOpenRequests: max,
      countStageId: env.WEBSITES_PREVIEW_COUNT_STAGE_ID?.trim() || undefined,
      reviewDir,
      referenceKey: env.WEBSITES_IP_HASH_SALT ?? "",
    },
  };
}

export function leadsConfigProblems(env: Env): string[] {
  return readLeadsConfig(env).problems;
}

/**
 * The alert receiver runs on this server, bound to loopback (owner decision
 * 2026-11-09: no DNS migration). Plain http is accepted ONLY for a loopback
 * host; anything else must be https.
 */
export function parseAlertWebhookUrl(raw: string | undefined): URL | null {
  const https = parseHttpsUrl(raw);
  if (https) return https;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "[::1]") && !u.username && !u.password ? u : null;
  } catch {
    return null;
  }
}

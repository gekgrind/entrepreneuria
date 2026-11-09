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

export type ClientIpSource =
  | { kind: "x-real-ip" }
  /** Nth entry from the RIGHT of X-Forwarded-For (1 = the entry our own proxy appended). */
  | { kind: "xff-from-right"; hops: number };

export type PreviewIntake = "open" | "paused";

export interface LeadsConfig {
  alertWebhookUrl: string;
  alertWebhookSecret: string;
  turnstileSecret: string;
  ipHashSalt: string;
  clientIpSource: ClientIpSource;
  /** Exact https origin of the public site. The only origin allowed to post. */
  publicOrigin: string;
  previewIntake: PreviewIntake;
  maxOpenRequests: number;
  /** Optional: count only this pipeline stage as an open preview request. */
  countStageId: string | undefined;
}

export function parseClientIpSource(raw: string | undefined): ClientIpSource | null {
  const v = raw?.trim().toLowerCase();
  if (!v) return null;
  if (v === "x-real-ip") return { kind: "x-real-ip" };
  if (v === "xff-last") return { kind: "xff-from-right", hops: 1 };
  const m = /^xff-hops:([1-5])$/.exec(v);
  return m ? { kind: "xff-from-right", hops: Number(m[1]) } : null;
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

export function readLeadsConfig(env: Env): { config: LeadsConfig | null; problems: string[] } {
  const problems: string[] = [];
  const need = (name: string, ok: boolean) => {
    if (!ok) problems.push(name);
  };

  const hook = parseHttpsUrl(env.WEBSITES_ALERT_WEBHOOK_URL?.trim());
  need("WEBSITES_ALERT_WEBHOOK_URL", hook !== null);
  const hookSecret = env.WEBSITES_ALERT_WEBHOOK_SECRET ?? "";
  need("WEBSITES_ALERT_WEBHOOK_SECRET", hookSecret.length >= 32);

  const turnstile = env.TURNSTILE_SECRET_KEY ?? "";
  need("TURNSTILE_SECRET_KEY", turnstile.length > 0);
  // The widget renders only with the site key; without it every submit fails verification.
  need("NEXT_PUBLIC_TURNSTILE_SITE_KEY", Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()));

  const salt = env.WEBSITES_IP_HASH_SALT ?? "";
  need("WEBSITES_IP_HASH_SALT", salt.length >= 16);

  const ipSource = parseClientIpSource(env.WEBSITES_CLIENT_IP_SOURCE);
  need("WEBSITES_CLIENT_IP_SOURCE", ipSource !== null);

  const origin = parseHttpsUrl(env.WEBSITES_PUBLIC_ORIGIN?.trim());
  const originOk = origin !== null && origin.origin === env.WEBSITES_PUBLIC_ORIGIN!.trim().replace(/\/$/, "");
  need("WEBSITES_PUBLIC_ORIGIN", originOk);

  for (const name of ["GHL_API_TOKEN", "GHL_LOCATION_ID", "GHL_PIPELINE_ID", "GHL_PIPELINE_STAGE_ID"]) {
    need(name, Boolean(env[name]?.trim()));
  }

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
      turnstileSecret: turnstile,
      ipHashSalt: salt,
      clientIpSource: ipSource!,
      publicOrigin: origin!.origin,
      previewIntake: intake as PreviewIntake,
      maxOpenRequests: max,
      countStageId: env.WEBSITES_PREVIEW_COUNT_STAGE_ID?.trim() || undefined,
    },
  };
}

export function leadsConfigProblems(env: Env): string[] {
  return readLeadsConfig(env).problems;
}

import { createChunks, stringToBase64URL, type CookieOptions } from "@supabase/ssr";

import {
  SUPABASE_AUTH_COOKIE_DOMAIN,
  SUPABASE_AUTH_COOKIE_NAME,
  getSupabaseCookieOptions,
  isEntrepreneuriaHostname,
} from "./cookie-options";

/*
 * The one place that decides what the hub may do with the session
 * cookie family (`entrepreneuria-auth-token`, `entrepreneuria-auth-token.N`).
 *
 * A browser can hold the family twice: a host-only copy written by the
 * old server code and a `.entrepreneuria.io` copy written by the browser
 * client. The Cookie header carries no scope, so the two cannot be told
 * apart, and picking one, or stitching chunks from both, can pair one
 * account's access token with another's refresh token. So this module
 * never chooses: a family whose bytes are not unambiguously one session
 * is a `conflict`, and the caller signs the visitor out. Pure functions
 * only — it runs in the proxy, route handlers and the browser.
 */

export const AUTH_CODE_VERIFIER_COOKIE_NAME = `${SUPABASE_AUTH_COOKIE_NAME}-code-verifier`;

/* Cookie names the pre-contract apps and older SDKs used. Only expired. */
const LEGACY_AUTH_COOKIE_PATTERN = /^(sb-.*auth-token(\.\d+)?|sb-access-token|supabase-auth-token)$/;

const FAMILY_PATTERN = new RegExp(
  `^${SUPABASE_AUTH_COOKIE_NAME.replace(/[-.]/g, "\\$&")}(?:\\.(0|[1-9]\\d*))?$`,
);

export type CookiePair = { name: string; value: string };

export type StoredSession = {
  userId: string;
  accessToken: string;
  refreshToken: string;
  /** Earlier of the JWT `exp` and the SDK's `expires_at`, in seconds. */
  expiresAt: number;
};

export type AuthCookieInventory =
  | { kind: "none"; names: string[] }
  | {
      kind: "single";
      names: string[];
      /** Names that arrived twice with identical bytes (both scopes). */
      duplicatedNames: string[];
      session: StoredSession;
    }
  | { kind: "conflict"; names: string[]; reason: ConflictReason };

export type ConflictReason =
  | "duplicate"
  | "mixed"
  | "partial"
  | "undecodable"
  | "identity"
  | "expiry";

export function isAuthFamilyCookie(name: string) {
  return FAMILY_PATTERN.test(name);
}

export function isLegacyAuthCookie(name: string) {
  return LEGACY_AUTH_COOKIE_PATTERN.test(name);
}

/** Every `name=value` of a Cookie header, duplicates and order kept. */
export function parseCookieHeader(header: string | null | undefined): CookiePair[] {
  if (!header) {
    return [];
  }

  const pairs: CookiePair[] = [];

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");

    if (separator <= 0) {
      continue;
    }

    const name = part.slice(0, separator).trim();
    let value = part.slice(separator + 1).trim();

    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1);
    }

    try {
      value = decodeURIComponent(value);
    } catch {
      /* Kept raw: it then fails to decode as a session, which is a conflict. */
    }

    pairs.push({ name, value });
  }

  return pairs;
}

function chunkIndex(name: string) {
  const match = FAMILY_PATTERN.exec(name);

  return match?.[1] === undefined ? null : Number(match[1]);
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

  if (typeof atob === "function") {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    return new TextDecoder().decode(bytes);
  }

  return Buffer.from(padded, "base64").toString("utf8");
}

/** The stored session's identity, or why the bytes are not one session. */
export function decodeStoredSession(
  value: string,
): StoredSession | ConflictReason {
  let session: unknown;

  try {
    const json = value.startsWith("base64-")
      ? decodeBase64Url(value.slice("base64-".length))
      : value;
    session = JSON.parse(json);
  } catch {
    return "undecodable";
  }

  if (!session || typeof session !== "object") {
    return "undecodable";
  }

  const { access_token, refresh_token, expires_at, user } = session as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_at?: unknown;
    user?: { id?: unknown } | null;
  };

  if (
    typeof access_token !== "string" ||
    typeof refresh_token !== "string" ||
    !refresh_token ||
    typeof user?.id !== "string"
  ) {
    return "undecodable";
  }

  let claims: { sub?: unknown; exp?: unknown };

  try {
    claims = JSON.parse(decodeBase64Url(access_token.split(".")[1] ?? ""));
  } catch {
    return "undecodable";
  }

  if (!claims || typeof claims !== "object") {
    return "undecodable";
  }

  if (claims.sub !== user.id) {
    return "identity";
  }

  /* auth-js decides when to refresh from `expires_at`, not the JWT, so a
     value whose two expiries disagree could be refreshed at a moment the
     JWT says it is not due. */
  if (
    typeof claims.exp !== "number" ||
    typeof expires_at !== "number" ||
    !Number.isFinite(expires_at) ||
    Math.abs(expires_at - claims.exp) > 60
  ) {
    return "expiry";
  }

  return {
    userId: user.id,
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresAt: Math.min(claims.exp, expires_at),
  };
}

export function classifyAuthCookies(pairs: CookiePair[]): AuthCookieInventory {
  const values = new Map<string, Set<string>>();
  const counts = new Map<string, number>();

  for (const { name, value } of pairs) {
    if (!isAuthFamilyCookie(name)) {
      continue;
    }

    if (!values.has(name)) {
      values.set(name, new Set());
    }

    values.get(name)!.add(value);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const names = Array.from(values.keys()).sort();

  if (names.length === 0) {
    return { kind: "none", names };
  }

  if (Array.from(values.values()).some((set) => set.size > 1)) {
    return { kind: "conflict", names, reason: "duplicate" };
  }

  const only = (name: string) => values.get(name)!.values().next().value as string;
  const indexes = names
    .map(chunkIndex)
    .filter((index): index is number => index !== null)
    .sort((a, b) => a - b);
  let assembled: string;

  if (values.has(SUPABASE_AUTH_COOKIE_NAME)) {
    if (indexes.length > 0) {
      return { kind: "conflict", names, reason: "mixed" };
    }

    assembled = only(SUPABASE_AUTH_COOKIE_NAME);
  } else {
    if (indexes.some((index, position) => index !== position)) {
      return { kind: "conflict", names, reason: "partial" };
    }

    assembled = indexes
      .map((index) => only(`${SUPABASE_AUTH_COOKIE_NAME}.${index}`))
      .join("");
  }

  let session: StoredSession | ConflictReason;

  try {
    session = decodeStoredSession(assembled);
  } catch {
    session = "undecodable";
  }

  if (typeof session === "string") {
    return { kind: "conflict", names, reason: session };
  }

  return {
    kind: "single",
    names,
    duplicatedNames: names.filter((name) => (counts.get(name) ?? 0) > 1),
    session,
  };
}

/** The Domain attribute the hub writes for a validated public hostname. */
export function getAuthCookieDomain(publicHostname: string) {
  return isEntrepreneuriaHostname(publicHostname)
    ? SUPABASE_AUTH_COOKIE_DOMAIN
    : undefined;
}

function serialize(
  name: string,
  value: string,
  options: CookieOptions,
  domain: string | undefined,
) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/"];

  if (domain) {
    parts.push(`Domain=${domain}`);
  }

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.floor(options.maxAge)}`);

    if (options.maxAge <= 0) {
      parts.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    }
  }

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.secure) {
    parts.push("Secure");
  }

  parts.push("SameSite=Lax");

  return parts.join("; ");
}

function isRemoval(value: string, options: CookieOptions) {
  return value === "" || (options.maxAge !== undefined && options.maxAge <= 0);
}

/**
 * One SDK cookie write as a scope pair: first expire any host-only copy
 * (an expiry without Domain removes only that one), then write in the
 * contract scope. On localhost both are host-only and the write comes
 * last, so it stands.
 */
export function serializeScopePair(
  name: string,
  value: string,
  options: CookieOptions,
  domain: string | undefined,
) {
  const contract = getSupabaseCookieOptions(domain ? "entrepreneuria.io" : null);
  const merged: CookieOptions = {
    ...options,
    secure: contract.secure,
    httpOnly: contract.httpOnly,
  };

  if (isRemoval(value, options)) {
    return serializeExpiry(name, domain, merged.secure);
  }

  return [
    serialize(name, "", { ...merged, maxAge: 0 }, undefined),
    serialize(name, value, { ...merged, maxAge: options.maxAge ?? contract.maxAge }, domain),
  ];
}

/** Expires `name` in both scopes (one header on localhost). */
export function serializeExpiry(
  name: string,
  domain: string | undefined,
  secure = Boolean(domain),
) {
  const options: CookieOptions = { maxAge: 0, secure };
  const headers = [serialize(name, "", options, undefined)];

  if (domain) {
    headers.push(serialize(name, "", options, domain));
  }

  return headers;
}

/** Only the host-only copy: used when the Domain copy holds the same bytes. */
export function serializeHostOnlyExpiry(name: string, secure: boolean) {
  return serialize(name, "", { maxAge: 0, secure }, undefined);
}

export type CookieWrite = { name: string; value: string; options: CookieOptions };

/** The session a batch of SDK writes leaves behind, judged like a jar. */
export function classifyWrites(writes: CookieWrite[]) {
  return classifyAuthCookies(
    writes
      .filter(({ name, value, options }) => isAuthFamilyCookie(name) && !isRemoval(value, options))
      .map(({ name, value }) => ({ name, value })),
  );
}

/**
 * The writes that store `session` the way @supabase/ssr does (base64url,
 * chunked), plus expiries for stored family names it no longer uses.
 */
export function sessionWrites(
  session: unknown,
  storedNames: string[],
  options: CookieOptions,
): CookieWrite[] {
  const chunks = createChunks(
    SUPABASE_AUTH_COOKIE_NAME,
    `base64-${stringToBase64URL(JSON.stringify(session))}`,
  );
  const kept = new Set(chunks.map(({ name }) => name));

  return [
    ...storedNames
      .filter((name) => !kept.has(name))
      .map((name) => ({ name, value: "", options: { ...options, maxAge: 0 } })),
    ...chunks.map(({ name, value }) => ({ name, value, options })),
  ];
}

export function writesRemoveSession(writes: CookieWrite[]) {
  const family = writes.filter(({ name }) => isAuthFamilyCookie(name));

  return family.length > 0 && family.every(({ value, options }) => isRemoval(value, options));
}

/**
 * Wraps fetch so a caller can tell a definitive Auth API answer from an
 * outage. auth-js removes the stored session on any non-retryable
 * refresh error, a plain 500 included, so a removal is only honoured
 * when no Auth API call in the same request was indeterminate.
 */
export function createAuthFetchObserver(baseFetch: typeof fetch = fetch) {
  let indeterminate = false;

  const observed: typeof fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const isAuthApi = url.includes("/auth/v1/");

    try {
      const response = await baseFetch(input, init);

      if (isAuthApi && (response.status >= 500 || response.status === 429)) {
        indeterminate = true;
      }

      return response;
    } catch (error) {
      if (isAuthApi) {
        indeterminate = true;
      }

      throw error;
    }
  };

  return { fetch: observed, isIndeterminate: () => indeterminate };
}

import { stringFromBase64URL, type CookieOptions } from "@supabase/ssr";

import {
  SUPABASE_AUTH_COOKIE_DOMAIN,
  SUPABASE_AUTH_COOKIE_NAME,
  getSupabaseCookieOptions,
  isEntrepreneuriaHostname,
} from "./cookie-options";

/*
 * What the hub's browser Supabase client may read and write, ported from
 * #26 (`selectBrowserCookies` / `browserCookieWrites` there). Pure, so it
 * runs against `document.cookie` in the app and a modelled jar in tests.
 *
 * `document.cookie` carries every scope's copy of a name with no scope
 * attached. The browser's own parser (and @supabase/ssr's, which uses
 * it) keeps the FIRST value of a name; Next's `request.cookies` on the
 * server keeps the LAST. A browser client reading a duplicated name
 * would therefore see a different session from the proxy's, and could
 * act on it — refresh it, or decide it is invalid and expire the family
 * in the shared scope. So it only ever sees a family that is exactly one
 * well-formed session; anything else reads as signed out here, and the
 * proxy, which sweeps duplicates, settles it on the next navigation.
 *
 * The browser never refreshes (see client.ts), so a session close enough
 * to expiry that auth-js would try to is hidden too.
 */

export type CookiePair = { name: string; value: string };

/*
 * auth-js refreshes a session inside a 90 s margin of `expires_at`.
 * Hidden from 120 s, so the browser client never holds one it would try
 * to refresh; the proxy refreshes it on the next request (within its own
 * 90 s margin).
 */
export const BROWSER_SESSION_CUTOFF_SECONDS = 120;

const KEY_PREFIX = `${SUPABASE_AUTH_COOKIE_NAME}.`;
const CHUNK_SUFFIX = /^(0|[1-9][0-9]*)$/;
const BASE64_PREFIX = "base64-";

/** The bare session cookie or one of its `.N` chunks. */
function chunkIndex(name: string) {
  if (!name.startsWith(KEY_PREFIX)) return null;

  const suffix = name.slice(KEY_PREFIX.length);

  return CHUNK_SUFFIX.test(suffix) ? Number(suffix) : null;
}

function isSessionName(name: string) {
  return name === SUPABASE_AUTH_COOKIE_NAME || chunkIndex(name) !== null;
}

/** Any name under the session key, malformed ones (`.0.0`) included. */
function isSessionKeyName(name: string) {
  return name === SUPABASE_AUTH_COOKIE_NAME || name.startsWith(KEY_PREFIX);
}

/** Every `name=value` of a Cookie header, duplicates and order kept. */
export function parseCookieHeader(header: string | null | undefined): CookiePair[] {
  const pairs: CookiePair[] = [];

  for (const part of (header ?? "").split(";")) {
    const separator = part.indexOf("=");

    if (separator <= 0) continue;

    const name = part.slice(0, separator).trim();
    let value = part.slice(separator + 1).trim();

    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1);
    }

    try {
      value = decodeURIComponent(value);
    } catch {
      /* Kept raw: it then fails to decode as a session, and is hidden. */
    }

    pairs.push({ name, value });
  }

  return pairs;
}

function decodeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function jwtClaims(token: string) {
  try {
    return decodeJson(stringFromBase64URL(token.split(".")[1] ?? "")) as {
      sub?: unknown;
      exp?: unknown;
    } | null;
  } catch {
    return null;
  }
}

/**
 * The earlier of the stored `expires_at` and the JWT's `exp`, when the
 * value is one session auth-js would accept and whose JWT names the
 * stored user; null otherwise. Unverified: it only decides what the
 * browser client is shown, never what is deleted.
 */
function sessionExpiry(value: string) {
  let json = value;

  if (value.startsWith(BASE64_PREFIX)) {
    try {
      json = stringFromBase64URL(value.slice(BASE64_PREFIX.length));
    } catch {
      return null;
    }
  }

  const session = decodeJson(json) as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_at?: unknown;
    user?: { id?: unknown } | null;
  } | null;

  if (
    !session ||
    typeof session !== "object" ||
    typeof session.access_token !== "string" ||
    typeof session.refresh_token !== "string" ||
    !session.refresh_token ||
    typeof session.expires_at !== "number" ||
    !Number.isFinite(session.expires_at) ||
    typeof session.user?.id !== "string"
  ) {
    return null;
  }

  const claims = jwtClaims(session.access_token);

  if (
    !claims ||
    typeof claims !== "object" ||
    claims.sub !== session.user.id ||
    typeof claims.exp !== "number"
  ) {
    return null;
  }

  return Math.min(claims.exp, session.expires_at);
}

/**
 * The cookies the browser client may see: every non-session cookie, and
 * the session family only when it is one unambiguous, well-formed
 * session that is not close to expiry. Hidden whenever a session name
 * arrives twice with different values (two scopes), a bare cookie sits
 * beside chunks, the chunks have a gap, or the value does not decode.
 * Byte-identical duplicates are one session and are passed once.
 * Malformed names are never passed: no reader assembles them.
 */
export function selectBrowserCookies(
  pairs: CookiePair[],
  now = Math.floor(Date.now() / 1000),
): CookiePair[] {
  const others = pairs.filter(({ name }) => !isSessionKeyName(name));
  const values = new Map<string, Set<string>>();

  for (const { name, value } of pairs) {
    if (!isSessionName(name)) continue;

    values.set(name, (values.get(name) ?? new Set()).add(value));
  }

  if (values.size === 0) return others;

  if ([...values.values()].some((set) => set.size > 1)) return others;

  const only = (name: string) => values.get(name)!.values().next().value as string;
  const indexes = [...values.keys()]
    .map(chunkIndex)
    .filter((index): index is number => index !== null)
    .sort((a, b) => a - b);
  let names: string[];

  if (values.has(SUPABASE_AUTH_COOKIE_NAME)) {
    if (indexes.length > 0) return others;
    names = [SUPABASE_AUTH_COOKIE_NAME];
  } else {
    if (indexes.some((index, position) => index !== position)) return others;
    names = indexes.map((index) => `${KEY_PREFIX}${index}`);
  }

  const expiresAt = sessionExpiry(names.map(only).join(""));

  if (expiresAt === null || expiresAt - now < BROWSER_SESSION_CUTOFF_SECONDS) {
    return others;
  }

  return [...others, ...names.map((name) => ({ name, value: only(name) }))];
}

/**
 * Whether the browser holds one well-formed, unambiguous session that
 * `selectBrowserCookies` hides only because of its expiry: what it would
 * show with no expiry limit at all, and does not show now. The server's
 * clock, or the time a response took to arrive, can disagree with this
 * one, so a session the server judged fresh enough can still be hidden.
 */
export function isSessionHiddenNearExpiry(
  pairs: CookiePair[],
  now = Math.floor(Date.now() / 1000),
) {
  const showsSession = (selected: CookiePair[]) =>
    selected.some(({ name }) => isSessionName(name));

  return (
    !showsSession(selectBrowserCookies(pairs, now)) &&
    showsSession(selectBrowserCookies(pairs, Number.NEGATIVE_INFINITY))
  );
}

/** The Domain attribute the browser writes for its own hostname. */
export function getBrowserCookieDomain(hostname: string) {
  return isEntrepreneuriaHostname(hostname) ? SUPABASE_AUTH_COOKIE_DOMAIN : undefined;
}

function serialize(
  name: string,
  value: string,
  { maxAge, secure }: { maxAge: number; secure: boolean },
  domain: string | undefined,
) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    ...(domain ? [`Domain=${domain}`] : []),
    `Max-Age=${Math.floor(maxAge)}`,
    ...(maxAge <= 0 ? ["Expires=Thu, 01 Jan 1970 00:00:00 GMT"] : []),
    ...(secure ? ["Secure"] : []),
    "SameSite=Lax",
  ].join("; ");
}

function isRemoval(value: string, options: CookieOptions) {
  return value === "" || (options.maxAge !== undefined && options.maxAge <= 0);
}

/** Expires `name` host-only and, on the shared domain, there too. */
function serializeExpiry(name: string, domain: string | undefined, secure: boolean) {
  return [
    serialize(name, "", { maxAge: 0, secure }, undefined),
    ...(domain ? [serialize(name, "", { maxAge: 0, secure }, domain)] : []),
  ];
}

/**
 * The `document.cookie` strings one batch of Supabase writes turns into.
 * On the shared domain each write expires any host-only copy of its name
 * first (an expiry without Domain removes only that one), then writes in
 * the `.entrepreneuria.io` scope, so the browser never creates a
 * duplicate. A removal expires both scopes. When the batch writes a
 * session, every other session-key name present — stale chunks, a bare
 * fragment, malformed names — is expired in both scopes: the browser
 * just received a session from the Auth API, so nothing else is current.
 * Off the shared domain everything is host-only.
 */
export function browserCookieWrites(
  present: CookiePair[],
  cookiesToSet: { name: string; value: string; options: CookieOptions }[],
  hostname: string,
) {
  const domain = getBrowserCookieDomain(hostname);
  const contract = getSupabaseCookieOptions(hostname);
  const secure = Boolean(contract.secure);
  const writes = cookiesToSet.flatMap(({ name, value, options }) =>
    isRemoval(value, options)
      ? serializeExpiry(name, domain, secure)
      : [
          ...(domain ? [serialize(name, "", { maxAge: 0, secure }, undefined)] : []),
          serialize(
            name,
            value,
            { maxAge: options.maxAge ?? contract.maxAge ?? 0, secure },
            domain,
          ),
        ],
  );
  const writtenNames = new Set(cookiesToSet.map(({ name }) => name));
  const writesSession = cookiesToSet.some(
    ({ name, value, options }) => isSessionName(name) && !isRemoval(value, options),
  );

  if (!writesSession) return writes;

  const stale = [
    ...new Set(
      present
        .map(({ name }) => name)
        .filter((name) => isSessionKeyName(name) && !writtenNames.has(name)),
    ),
  ];

  return [...stale.flatMap((name) => serializeExpiry(name, domain, secure)), ...writes];
}

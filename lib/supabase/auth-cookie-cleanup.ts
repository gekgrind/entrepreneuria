import type { NextRequest, NextResponse } from "next/server";
import { stringFromBase64URL } from "@supabase/ssr";

import {
  getSupabaseCookieHostname,
  isEntrepreneuriaHostname,
  mergeSupabaseCookieOptions,
  SUPABASE_AUTH_COOKIE_DOMAIN,
  SUPABASE_AUTH_COOKIE_NAME,
} from "./cookie-options";

/*
 * Retiring auth cookies written under the wrong scope, or left behind in
 * a shape the session reader can never assemble.
 *
 * A cookie is identified by name + Domain + Path, and a deletion only
 * removes the cookie with exactly that scope: a host-only expiry never
 * touches the `.entrepreneuria.io` copy and vice versa. Earlier writers
 * on entrepreneuria.io planted host-only copies of the shared session
 * next to the canonical `.entrepreneuria.io` ones, so both scopes have
 * to be addressed explicitly here.
 *
 * These expiries are appended as raw Set-Cookie headers because Next's
 * `response.cookies` holds one entry per name — the second scope of the
 * same name would silently replace the first. For the same reason they
 * must be appended after the response's last `response.cookies.set`,
 * which rewrites every Set-Cookie header from that name-keyed map.
 */

type HeaderReader = { get(name: string): string | null };

type CookieScope = "host-only" | "shared-domain";

export type AuthCookieInventory = {
  /** Hostname that decides the canonical scope (see cookie-options). */
  cookieHostname: string | null;
  /** Distinct shared-session cookie names the browser sent. */
  session: string[];
  /** Distinct legacy Supabase auth cookie names the browser sent. */
  legacy: string[];
  /**
   * Distinct names under the session key that no reader ever assembles
   * (`entrepreneuria-auth-token.0.0`, `.01`, …; see
   * `isMalformedSessionCookieName`). Always legacy.
   */
  malformed: string[];
  /** A shared-session name arrived more than once: two scopes coexist. */
  duplicated: boolean;
  /**
   * Every duplicated name arrived with the same value each time: the two
   * scopes hold byte-identical copies, so dropping one loses nothing.
   */
  identicalDuplicates: boolean;
  /**
   * Shared-session names that can never be part of a readable session
   * (see `findUnreadableSessionCookies`). Always empty when duplicates
   * differ: the Cookie header does not say which scope one came from.
   */
  unreadable: string[];
  /**
   * Every distinct readable session the sent cookies can assemble, one
   * per scope family (see `assembleSessionCandidates`).
   */
  candidates: SessionCandidate[];
  /**
   * Token pairs that decode but whose cached user is not the access
   * token's subject, and that no candidate already holds. Never a session
   * to authenticate with — a cached profile grafted onto someone's tokens
   * — but the tokens themselves may still work, so sign-out revokes them
   * and nothing deletes their cookies before the Auth API rules them out.
   * `userId` is the token's own `sub`.
   */
  revocationOnly: SessionCandidate[];
  /** Assembly gave up before trying every combination. */
  candidatesTruncated: boolean;
};

/**
 * One readable session, as the cookies of a single family hold it.
 *
 * Everything but the cookies themselves is read from an unverified
 * cookie: any host on the shared domain can plant one, and the access
 * token is decoded without checking its signature. These fields are
 * hints for ordering work, never evidence for deleting anything — only
 * an Auth API answer about a candidate's own tokens is (see
 * `auth-session-resolution`).
 */
export type SessionCandidate = {
  /** One value per cookie name, exactly as a reader would assemble it. */
  cookies: { name: string; value: string }[];
  accessToken: string;
  refreshToken: string;
  /** The stored `expires_at`, in Unix seconds. Unverified. */
  expiresAt: number;
  /** The access token's `exp` claim, in Unix seconds. Unverified. */
  tokenExpiresAt: number | null;
  /**
   * The access token's `session_id` claim: one per sign-in, kept across
   * every refresh of it. Null when the token does not carry one.
   * Unverified until the Auth API accepts the token.
   */
  sessionId: string | null;
  /** The token's `sub`, else the stored user's id. Unverified. */
  userId: string | null;
};

/* Unverified cookie JSON: any field may be missing or of any type. */
type StoredSession = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_at?: unknown;
  user?: { id?: unknown } | null;
};

const CHUNK_SUFFIX = /^\.(0|[1-9][0-9]*)$/;

/* RFC 6265 cookie-name token; anything else is never echoed back. */
const COOKIE_NAME_TOKEN = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;

const BASE64_PREFIX = "base64-";

/*
 * The anti-cache headers @supabase/ssr 0.10.3 passes as the second
 * argument of `setAll` whenever it writes auth cookies. Responses that
 * change auth cookies without going through Supabase (the expiries
 * below, sign-out) carry the same ones, so no shared cache can store a
 * Set-Cookie holding someone's session.
 */
export const AUTH_NO_STORE_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

export function applyAuthResponseHeaders(
  response: NextResponse,
  headers: Record<string, string> = AUTH_NO_STORE_HEADERS,
) {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
}

/** `entrepreneuria-auth-token` and its `.0`, `.1`, … chunks. */
export function isSharedSessionCookieName(name: string) {
  return (
    name === SUPABASE_AUTH_COOKIE_NAME ||
    (name.startsWith(SUPABASE_AUTH_COOKIE_NAME) &&
      CHUNK_SUFFIX.test(name.slice(SUPABASE_AUTH_COOKIE_NAME.length)))
  );
}

/**
 * A name under the session key that no reader assembles: @supabase/ssr
 * reads exactly `entrepreneuria-auth-token` and `entrepreneuria-auth-token.N`,
 * so `.0.0` (a chunk name chunked again by a writer that leaked the
 * storage key into per-cookie options), `.01` or `.x` is never part of a
 * session. Only expired. `entrepreneuria-auth-token-code-verifier` is
 * not one: it starts with `-`, not `.`.
 */
export function isMalformedSessionCookieName(name: string) {
  return (
    name.startsWith(`${SUPABASE_AUTH_COOKIE_NAME}.`) &&
    !isSharedSessionCookieName(name)
  );
}

/**
 * Whether any of these cookie names is an auth cookie the browser still
 * holds. A sign-out that went through expired every one of them, so a
 * page reporting that outcome can tell a real result from a typed URL.
 */
export function holdsAuthCookies(names: Iterable<string>) {
  for (const name of names) {
    if (
      isSharedSessionCookieName(name) ||
      isMalformedSessionCookieName(name) ||
      isLegacySupabaseAuthCookieName(name)
    ) {
      return true;
    }
  }

  return false;
}

/*
 * Request header the proxy sets on every request it forwards: whether
 * the browser sent any auth cookie, judged before the proxy strips
 * duplicated, malformed and unreadable names from the forwarded Cookie
 * header. A page reading its own cookies would otherwise take a
 * stripped session for one the browser no longer holds. Always
 * overwritten by the proxy, so a client cannot supply it.
 */
export const AUTH_COOKIES_HELD_HEADER = "x-entrepreneuria-auth-cookies-held";

/*
 * Every name in a raw Cookie header, values never decoded: Next's parsed
 * `request.cookies` silently drops a pair whose value is not valid
 * percent-encoding, and the browser still holds that cookie.
 */
function rawCookieNames(header: string | null) {
  return (header ?? "")
    .split(";")
    .map((pair) => {
      const separator = pair.indexOf("=");
      return (separator === -1 ? pair : pair.slice(0, separator)).trim();
    })
    .filter(Boolean);
}

/** Stamps the browser's own cookie names onto the forwarded request. */
export function markAuthCookiesHeld(request: NextRequest) {
  request.headers.set(
    AUTH_COOKIES_HELD_HEADER,
    holdsAuthCookies(rawCookieNames(request.headers.get("cookie"))) ? "1" : "0",
  );
}

/**
 * Whether the browser itself sent an auth cookie: the proxy's stamp when
 * there is one, else the names the page received (no proxy ran, so
 * nothing was deleted from them).
 */
export function browserHeldAuthCookies(
  stamp: string | null,
  cookieNames: Iterable<string>,
) {
  if (stamp === "0") return false;
  if (stamp === "1") return true;

  return holdsAuthCookies(cookieNames);
}

/** Supabase's default cookie names from before the shared storage key. */
export function isLegacySupabaseAuthCookieName(name: string) {
  return (
    name === "sb-access-token" ||
    name === "sb-refresh-token" ||
    name === "supabase-auth-token" ||
    (name.startsWith("sb-") && name.includes("auth-token"))
  );
}

/*
 * Whether a stored value is a session auth-js would accept, decoded
 * exactly as @supabase/ssr 0.10.3 does: a `base64-` value that fails
 * base64url or JSON decoding is reported as absent (and so never
 * removed by Supabase itself); anything else is JSON-parsed by auth-js
 * and must carry the fields its `_isValidSession` checks.
 */
function parseStoredSession(value: string): StoredSession | null {
  let decoded = value;

  if (value.startsWith(BASE64_PREFIX)) {
    try {
      decoded = stringFromBase64URL(value.slice(BASE64_PREFIX.length));
    } catch {
      return null;
    }
  }

  try {
    const session: unknown = JSON.parse(decoded);

    /* Either token alone is a credential worth accounting for; whether
       the record is a whole session is decided by its reader. */
    return typeof session === "object" &&
      session !== null &&
      ("access_token" in session || "refresh_token" in session)
      ? (session as StoredSession)
      : null;
  } catch {
    return null;
  }
}

/*
 * Whether a reader can take this value without failing: auth-js
 * multiplies `expires_at` by 1000, which throws on an object whose
 * `valueOf` and `toString` are not callable — one planted cookie would
 * then fail every request that reads it. A value like that is never part
 * of a session, whatever its tokens.
 */
function isReadableSession(value: string) {
  const session = parseStoredSession(value);

  return (
    session !== null &&
    (session.expires_at === undefined ||
      session.expires_at === null ||
      ["number", "string", "boolean"].includes(typeof session.expires_at))
  );
}

/** The token's payload, decoded without verifying anything. */
export function claimsOf(accessToken: string): Record<string, unknown> {
  try {
    const claims: unknown = JSON.parse(
      stringFromBase64URL(accessToken.split(".")[1] ?? ""),
    );

    return typeof claims === "object" && claims !== null
      ? (claims as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/* A number read from cookie JSON, never coerced: `Number()` on an object
   whose `valueOf` and `toString` are not callable throws, and one planted
   cookie must not fail the whole request. */
function finiteNumberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/* Bounds the combinations tried below; a browser holds at most a few
   scopes of one name, so real requests stay far under it. */
const MAX_CANDIDATE_ASSEMBLIES = 64;

/**
 * Every distinct readable session the sent cookies can hold.
 *
 * The Cookie header carries each scope's copy of a name, but not which
 * scope it came from, so a family cannot be read off by scope. Instead
 * every value of the bare cookie, and every chain of `.0`, `.1`, … values
 * up to the first that decodes, is tried as its own session — the
 * reader's own rules, applied per family instead of per collapsed name.
 * One copy of the same session in two scopes is one candidate.
 *
 * A chain stitched from two families can still decode when the chunk
 * boundary falls inside content both share: the head chunk's tokens over
 * the other family's cached user. Such a chain is rejected outright when
 * that user is not the token's subject, and otherwise yields to the chain
 * drawn from one header position — a family's chunks are written
 * together, so they sit at the same position among their names'
 * occurrences.
 *
 * `occurrences` holds every decoded value per name, in header order.
 */
export function assembleSessionCandidates(occurrences: Map<string, string[]>) {
  const found = new Map<
    string,
    { candidate: SessionCandidate; aligned: boolean }
  >();
  /* Token pairs rejected only for their grafted profile, by pair. */
  const unbound = new Map<string, SessionCandidate>();
  let budget = MAX_CANDIDATE_ASSEMBLIES;
  let truncated = false;

  function positions(name: string, value: string) {
    return (occurrences.get(name) ?? []).flatMap((occurrence, index) =>
      occurrence === value ? [index] : [],
    );
  }

  function isAligned(cookies: SessionCandidate["cookies"]) {
    const [first, ...rest] = cookies.map(({ name, value }) =>
      positions(name, value),
    );

    return (first ?? []).some((index) =>
      rest.every((indexes) => indexes.includes(index)),
    );
  }

  function accept(cookies: SessionCandidate["cookies"]) {
    const session = parseStoredSession(
      cookies.map(({ value }) => value).join(""),
    );

    if (!session) {
      return false;
    }

    const accessToken =
      typeof session.access_token === "string" ? session.access_token : "";
    const refreshToken =
      typeof session.refresh_token === "string" ? session.refresh_token : "";

    if (!accessToken && !refreshToken) {
      return false;
    }

    const readableExpiry =
      typeof session.expires_at === "number" &&
      Number.isFinite(session.expires_at);

    if (!accessToken || !refreshToken || !readableExpiry) {
      /* Half a session, or one whose expiry is not a number: nothing to
         serve — auth-js itself throws on an expiry it cannot coerce —
         but auth-js would still refresh a lone refresh token, and a lone
         access token may still be live. Kept for revocation; an empty
         token is no credential. */
      const claims = accessToken ? claimsOf(accessToken) : {};
      const key = `${accessToken}|${refreshToken}`;

      if (!unbound.has(key)) {
        unbound.set(key, {
          cookies,
          accessToken,
          refreshToken,
          expiresAt: finiteNumberOr(session.expires_at, 0),
          tokenExpiresAt:
            typeof claims.exp === "number" && Number.isFinite(claims.exp)
              ? claims.exp
              : null,
          sessionId:
            typeof claims.session_id === "string" ? claims.session_id : null,
          userId: typeof claims.sub === "string" ? claims.sub : null,
        });
      }

      return false;
    }

    const claims = claimsOf(accessToken);
    const userId = session.user?.id;
    const key = `${accessToken}|${refreshToken}`;
    const candidate: SessionCandidate = {
      cookies,
      accessToken,
      refreshToken,
      expiresAt: finiteNumberOr(session.expires_at, 0),
      tokenExpiresAt:
        typeof claims.exp === "number" && Number.isFinite(claims.exp)
          ? claims.exp
          : null,
      sessionId:
        typeof claims.session_id === "string" ? claims.session_id : null,
      userId:
        typeof claims.sub === "string"
          ? claims.sub
          : typeof userId === "string"
            ? userId
            : null,
    };

    if (
      typeof userId === "string" &&
      typeof claims.sub === "string" &&
      userId !== claims.sub
    ) {
      /* Not a session anyone may be served from, but its tokens are
         still credentials: kept for revocation, by the token's `sub`. */
      if (!unbound.has(key)) unbound.set(key, candidate);
      return false;
    }

    const aligned = isAligned(cookies);
    const existing = found.get(key);

    if (!existing || (aligned && !existing.aligned)) {
      found.set(key, { aligned, candidate });
    }

    return true;
  }

  for (const value of new Set(occurrences.get(SUPABASE_AUTH_COOKIE_NAME) ?? [])) {
    if (budget <= 0) {
      truncated = true;
      break;
    }
    budget -= 1;
    accept([{ name: SUPABASE_AUTH_COOKIE_NAME, value }]);
  }

  function extend(index: number, cookies: SessionCandidate["cookies"]) {
    const name = `${SUPABASE_AUTH_COOKIE_NAME}.${index}`;

    for (const value of new Set(occurrences.get(name) ?? [])) {
      if (budget <= 0) {
        truncated = true;
        return;
      }
      budget -= 1;

      const chain = [...cookies, { name, value }];

      if (!accept(chain)) {
        extend(index + 1, chain);
      }
    }
  }

  extend(0, []);

  return {
    candidates: [...found.values()].map(({ candidate }) => candidate),
    /* A pair some family also holds properly is judged as that family. */
    revocationOnly: [...unbound]
      .filter(([key]) => !found.has(key))
      .map(([, candidate]) => candidate),
    truncated,
  };
}

/**
 * The shared-session cookies that cannot contribute to a readable
 * session, judged only from the cookies themselves — never from whether
 * Supabase could validate the session, so an Auth API or network
 * failure can never cause a structurally sound session to be deleted.
 *
 * The live cookies are the bare one when no chunk is present and it
 * decodes to a session, or else the contiguous `.0…` run that does — the
 * shortest one, so a stale `.2` trailing a sound `.0`/`.1` is dropped
 * instead of the whole session. Every other name in the family (a
 * corrupt or empty bare cookie, chunks past a gap, orphans with no `.0`,
 * a run that never decodes) is unreadable.
 *
 * A bare cookie beside any chunk is unreadable whatever it holds. One
 * writer never leaves both (@supabase/ssr expires the bare name when it
 * writes chunks, and the chunks when it writes the bare name), so the
 * pair is two writers' leftovers, and the bare one is the legacy: the
 * shared session is several chunks long. It is also the dangerous one.
 * @supabase/ssr reads the bare name first and ignores the chunks when it
 * has any value, so a fragment there shadows a sound chunked session;
 * auth-js then finds no valid session and its `_removeSession` expires
 * every name of the family — the sound `.0`/`.1` included, in the
 * `.entrepreneuria.io` scope — for every app on the domain. The proxy
 * strips it from the request before any client reads it.
 *
 * `values` must hold one value per name, as the reader sees them.
 */
export function findUnreadableSessionCookies(values: Map<string, string>) {
  const bare = values.get(SUPABASE_AUTH_COOKIE_NAME);
  const hasChunks = [...values.keys()].some(
    (name) => name !== SUPABASE_AUTH_COOKIE_NAME,
  );
  let live: string[] = [];

  if (!hasChunks && bare && isReadableSession(bare)) {
    live = [SUPABASE_AUTH_COOKIE_NAME];
  } else {
    let joined = "";

    for (let index = 0; ; index += 1) {
      const name = `${SUPABASE_AUTH_COOKIE_NAME}.${index}`;
      const chunk = values.get(name);

      if (!chunk) {
        break;
      }

      joined += chunk;

      if (isReadableSession(joined)) {
        live = Array.from(
          { length: index + 1 },
          (_, chunkIndex) => `${SUPABASE_AUTH_COOKIE_NAME}.${chunkIndex}`,
        );
        break;
      }
    }
  }

  return [...values.keys()].filter((name) => !live.includes(name));
}

/*
 * Read from the raw Cookie header, not `request.cookies`: that map keeps
 * one value per name, which hides exactly the duplicates this is for.
 * Take it before any Supabase client runs — the proxy rewrites the
 * request's Cookie header when it forwards a refreshed session.
 */
export function readAuthCookieInventory(request: {
  headers: HeaderReader;
}): AuthCookieInventory {
  const pairs = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((pair) => {
      const separator = pair.indexOf("=");

      return separator === -1
        ? { name: pair.trim(), value: "" }
        : {
            name: pair.slice(0, separator).trim(),
            value: pair.slice(separator + 1).trim(),
          };
    })
    .filter(({ name }) => Boolean(name));
  const sessionPairs = pairs.filter(({ name }) =>
    isSharedSessionCookieName(name),
  );
  const session = [...new Set(sessionPairs.map(({ name }) => name))];
  const duplicated = session.length !== sessionPairs.length;
  const identicalDuplicates = session.every(
    (name) =>
      new Set(
        sessionPairs
          .filter((pair) => pair.name === name)
          .map(({ value }) => value),
      ).size === 1,
  );

  /* One value per name, decoded the way Next's request.cookies does
     before Supabase reads it. A value that fails to decode is dropped
     there, so here it reads as empty — never part of a session. */
  const values = new Map<string, string>(session.map((name) => [name, ""]));
  /* Every value per name, for telling the families apart. Empty and
     undecodable values are never part of a session. */
  const occurrences = new Map<string, string[]>();

  for (const { name, value } of sessionPairs) {
    try {
      const decoded = decodeURIComponent(value);
      values.set(name, decoded);

      if (decoded) {
        occurrences.set(name, [...(occurrences.get(name) ?? []), decoded]);
      }
    } catch {
      // Next skips the pair; an earlier decodable value, if any, stands.
    }
  }

  const { candidates, revocationOnly, truncated } =
    assembleSessionCandidates(occurrences);

  return {
    cookieHostname: getSupabaseCookieHostname(request.headers),
    session,
    legacy: [
      ...new Set(
        pairs
          .map(({ name }) => name)
          .filter(isLegacySupabaseAuthCookieName),
      ),
    ],
    malformed: [
      ...new Set(
        pairs.map(({ name }) => name).filter(isMalformedSessionCookieName),
      ),
    ],
    duplicated,
    identicalDuplicates,
    unreadable:
      duplicated && !identicalDuplicates
        ? []
        : findUnreadableSessionCookies(values),
    candidates,
    revocationOnly,
    candidatesTruncated: truncated,
  };
}

function expiredSetCookie(
  name: string,
  domain: string | undefined,
  path: string,
  secure: boolean,
) {
  return [
    `${name}=`,
    `Path=${path}`,
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
    ...(domain ? [`Domain=${domain}`] : []),
    ...(secure ? ["Secure"] : []),
    "SameSite=Lax",
  ].join("; ");
}

function expireAuthCookies(
  response: NextResponse,
  names: Iterable<string>,
  scopes: CookieScope[],
  cookieHostname: string | null,
) {
  const { path = "/", secure = false } = mergeSupabaseCookieOptions(
    cookieHostname,
    {},
  );
  /* The response's own Set-Cookie for a name + scope always stands, so
     a freshly written session is never expired by its own response. */
  const addressed = new Set(
    response.cookies
      .getAll()
      .map((cookie) => `${cookie.name}|${cookie.domain ?? ""}`),
  );
  let expired = false;

  for (const name of new Set(names)) {
    if (!COOKIE_NAME_TOKEN.test(name)) {
      continue;
    }

    for (const scope of scopes) {
      const domain =
        scope === "shared-domain" ? SUPABASE_AUTH_COOKIE_DOMAIN : undefined;

      if (addressed.has(`${name}|${domain ?? ""}`)) {
        continue;
      }

      response.headers.append(
        "set-cookie",
        expiredSetCookie(name, domain, path, secure),
      );
      expired = true;
    }
  }

  if (expired) {
    applyAuthResponseHeaders(response);
  }
}


const BOTH_SCOPES: CookieScope[] = ["shared-domain", "host-only"];

function writtenSessionNames(response: NextResponse) {
  return response.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter(isSharedSessionCookieName);
}

/**
 * The duplicate sweep: expires the host-only copy of every session-key
 * name the browser sent (chunks, the bare name, malformed names) and of
 * every legacy `sb-*` auth cookie.
 *
 * A `Max-Age=0` without a Domain attribute removes only the host-only
 * cookie of that name and path (RFC 6265 §5.3: a cookie is replaced only
 * by one with the same name, domain and host-only flag, and path), so it
 * can never reach the `.entrepreneuria.io` copy. That makes it safe
 * without knowing which copy holds what: whatever the host-only copy
 * was, the shared copy is the one the contract keeps.
 *
 * Only on the shared domain. Off it (local development) host-only is the
 * canonical scope itself, and nothing is expired.
 */
export function expireHostOnlyAuthCookies(
  inventory: AuthCookieInventory,
  response: NextResponse,
) {
  if (!isEntrepreneuriaHostname(inventory.cookieHostname)) {
    return;
  }

  expireAuthCookies(
    response,
    [...inventory.session, ...inventory.malformed, ...inventory.legacy],
    ["host-only"],
    inventory.cookieHostname,
  );
}

/**
 * Moves a browser onto the single canonical `.entrepreneuria.io` scope
 * and clears session cookies that can never be read back. Called on
 * every proxy response, after its last `response.cookies.set`.
 *
 * Host-only session copies are retired whenever the family is known to
 * be in flux: this response writes the session, or the browser sent the
 * same chunk name twice (both scopes present). Host-only expiries never
 * touch the canonical copies, so a valid shared session is not lost.
 * Legacy `sb-*` host-only cookies are retired whenever present; on
 * entrepreneuria.io only this app can have written them.
 *
 * Malformed names (`.0.0` and the like) are retired host-only on every
 * host: no reader assembles them, and a request may remove a shared-scope
 * cookie only on structural proof. Their shared-scope copies, if any,
 * go at sign-out.
 *
 * Structurally unreadable session cookies are retired in every scope
 * this host can hold them in, canonical included — but only when the
 * cookies themselves prove it (`inventory.unreadable`, which includes a
 * bare fragment beside chunks). A session that Supabase merely failed to
 * validate (Auth API down, network error, revoked token) is left to
 * Supabase.
 *
 * Off the shared domain (local development) the canonical scope is
 * host-only itself: there is no second scope to retire, and localhost
 * `sb-*` cookies may belong to other local projects.
 */
export function retireStaleAuthCookies(
  inventory: AuthCookieInventory,
  response: NextResponse,
) {
  const sharedDomain = isEntrepreneuriaHostname(inventory.cookieHostname);

  if (sharedDomain) {
    const written = writtenSessionNames(response);
    const inFlux = written.length > 0 || inventory.duplicated;

    expireAuthCookies(
      response,
      [
        ...(inFlux ? [...inventory.session, ...written] : []),
        ...inventory.legacy,
      ],
      ["host-only"],
      inventory.cookieHostname,
    );
  }

  expireAuthCookies(
    response,
    inventory.malformed,
    ["host-only"],
    inventory.cookieHostname,
  );

  expireAuthCookies(
    response,
    inventory.unreadable,
    sharedDomain ? BOTH_SCOPES : ["host-only"],
    inventory.cookieHostname,
  );
}

/**
 * After a route established a new session (OAuth callback, email
 * confirmation): every other copy of every session-key name the browser
 * sent is superseded, in both scopes. Called in place of
 * `retireStaleAuthCookies`, after the response's last
 * `response.cookies.set`; the response's own writes stand (see
 * `expireAuthCookies`). Legacy `sb-*` host-only cookies are retired as
 * `retireStaleAuthCookies` does.
 */
export function retireSupersededAuthCookies(
  inventory: AuthCookieInventory,
  response: NextResponse,
) {
  const sharedDomain = isEntrepreneuriaHostname(inventory.cookieHostname);

  expireAuthCookies(
    response,
    [...inventory.session, ...inventory.malformed, ...writtenSessionNames(response)],
    sharedDomain ? BOTH_SCOPES : ["host-only"],
    inventory.cookieHostname,
  );
  applyAuthResponseHeaders(response);

  if (sharedDomain) {
    expireAuthCookies(
      response,
      inventory.legacy,
      ["host-only"],
      inventory.cookieHostname,
    );
  }
}

/**
 * Sign-out: expires every shared-session, malformed and legacy auth
 * cookie the browser sent, in both the `.entrepreneuria.io` and
 * host-only scopes.
 */
export function expireAllAuthCookies(
  inventory: AuthCookieInventory,
  response: NextResponse,
) {
  expireAuthCookies(
    response,
    [...inventory.session, ...inventory.malformed, ...inventory.legacy],
    isEntrepreneuriaHostname(inventory.cookieHostname)
      ? BOTH_SCOPES
      : ["host-only"],
    inventory.cookieHostname,
  );
  applyAuthResponseHeaders(response);
}

/*
 * The duplicate sweep's one-shot loop guard (see proxy.ts). Set on the
 * sweep's 303, host-only and short-lived: a browser that comes back
 * still sending a duplicated name — a copy no host-only expiry reaches,
 * such as one under another Path — is served unauthenticated instead of
 * being redirected again. Not an auth cookie: it holds only a flag and
 * no reader looks at it (it is outside the session key's names).
 */
export const AUTH_SWEEP_GUARD_COOKIE = "entrepreneuria-auth-sweep";
export const AUTH_SWEEP_GUARD_MAX_AGE_SECONDS = 60;

export function hasAuthSweepGuard(request: { headers: HeaderReader }) {
  return rawCookieNames(request.headers.get("cookie")).includes(
    AUTH_SWEEP_GUARD_COOKIE,
  );
}

function sweepGuardSecure(cookieHostname: string | null) {
  return mergeSupabaseCookieOptions(cookieHostname, {}).secure ?? false;
}

export function setAuthSweepGuard(
  response: NextResponse,
  cookieHostname: string | null,
) {
  response.headers.append(
    "set-cookie",
    [
      `${AUTH_SWEEP_GUARD_COOKIE}=1`,
      "Path=/",
      `Max-Age=${AUTH_SWEEP_GUARD_MAX_AGE_SECONDS}`,
      "HttpOnly",
      ...(sweepGuardSecure(cookieHostname) ? ["Secure"] : []),
      "SameSite=Lax",
    ].join("; "),
  );
}

/* Appended last: see the module comment on raw Set-Cookie headers. */
export function clearAuthSweepGuard(
  response: NextResponse,
  cookieHostname: string | null,
) {
  response.headers.append(
    "set-cookie",
    expiredSetCookie(
      AUTH_SWEEP_GUARD_COOKIE,
      undefined,
      "/",
      sweepGuardSecure(cookieHostname),
    ),
  );
}

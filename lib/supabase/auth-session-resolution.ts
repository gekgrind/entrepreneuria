import type { AuthCookieInventory, SessionCandidate } from "./auth-cookie-cleanup";
import { claimsOf } from "./auth-cookie-cleanup";

/*
 * Revoking every session the browser holds a copy of, at sign-out.
 *
 * Requests never call the Auth API about duplicated copies: a request
 * that carries a session name twice is swept instead (see proxy.ts) —
 * its host-only copies expired, nothing refreshed, nothing read — so
 * only the one `.entrepreneuria.io` copy is ever refreshed, by the
 * proxy's own Supabase client. Sign-out is the one place every copy
 * still matters: each is a credential that may still work, so each is
 * judged on its own, by direct Auth API calls about its own tokens.
 *
 * Evidence rules:
 *
 * - What a cookie says about itself is not evidence. Any host on the
 *   shared domain can plant one, and the access token is decoded without
 *   checking its signature, so `expires_at`, `exp`, `session_id` and
 *   `sub` only order work. A status code alone (a gateway's 401, a WAF's
 *   403, a misrouted 404) proves nothing either: only GoTrue's explicit
 *   error codes do.
 * - An accepted access token proves that token, and its claims. It does
 *   not prove the refresh token stored beside it: a cookie can pair one
 *   sign-in's access token with another's refresh token, so access
 *   tokens, refresh tokens and users are accounted separately.
 */

export type SupabaseConfig = {
  supabaseUrl: string;
  supabaseKey: string;
  /** Per Auth API request; defaults to `AUTH_REQUEST_TIMEOUT_MS`. */
  timeoutMs?: number;
  /**
   * Epoch milliseconds after which no further Auth API request is made;
   * an unsent request reads as no answer. Set from `SIGN_OUT_BUDGET_MS`
   * unless the caller passes one.
   */
  deadline?: number;
};

/*
 * At most this many candidates are revoked. A browser holds at most two
 * scopes of one name plus a bare/chunked variant, so real requests stay
 * far under it. Past it, sign-out reports itself incomplete.
 */
export const MAX_JUDGED_CANDIDATES = 4;

/*
 * Every Auth API call made here is a single attempt with its own
 * deadline — never auth-js's refresh, which retries for up to 30 s.
 */
export const AUTH_REQUEST_TIMEOUT_MS = 3000;

/*
 * Aggregate budget: at most one parallel round of sign-outs, then one
 * refresh and one sign-out per candidate, in order. Whatever the budget
 * cuts off is reported as unknown — never as success — and nothing is
 * retried.
 */
export const SIGN_OUT_BUDGET_MS = 8000;

/* GoTrue's explicit refusals (auth-js `ErrorCode`). */
const SIGN_IN_GONE = new Set([
  "session_not_found",
  "session_expired",
  "user_not_found",
]);
const REFRESH_TOKEN_GONE = new Set(["refresh_token_not_found", ...SIGN_IN_GONE]);
const REFRESH_TOKEN_REUSED = "refresh_token_already_used";
const ACCESS_TOKEN_REFUSED = "bad_jwt";

type AuthAnswer =
  | { ok: true; status: number; body: Record<string, unknown> }
  | { ok: false; status: number; code: string | null }
  /** No answer at all: network failure, timeout, unreadable body. */
  | { ok: false; status: 0; code: null };

/** One Auth API request: no retries, no session storage, no cookies. */
async function authRequest(
  config: SupabaseConfig,
  path: string,
  init: { method: "GET" | "POST"; jwt?: string; body?: unknown },
): Promise<AuthAnswer> {
  const headers: Record<string, string> = {
    apikey: config.supabaseKey,
    /* Error codes arrive as `code` from this API version on. */
    "X-Supabase-Api-Version": "2024-01-01",
  };

  if (init.jwt) headers.Authorization = `Bearer ${init.jwt}`;
  if (init.body !== undefined) headers["Content-Type"] = "application/json";

  const remaining =
    config.deadline === undefined ? Infinity : config.deadline - Date.now();

  if (remaining <= 0) {
    return { ok: false, status: 0, code: null };
  }

  let response: Response;

  try {
    response = await fetch(
      `${config.supabaseUrl.replace(/\/$/, "")}/auth/v1${path}`,
      {
        method: init.method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        cache: "no-store",
        signal: AbortSignal.timeout(
          Math.min(config.timeoutMs ?? AUTH_REQUEST_TIMEOUT_MS, remaining),
        ),
      },
    );
  } catch {
    return { ok: false, status: 0, code: null };
  }

  let body: unknown = null;

  try {
    const text = await response.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  const record =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  if (response.ok) {
    return { ok: true, status: response.status, body: record };
  }

  /* A legacy error body carries the HTTP status as a numeric `code`;
     only a string is an error code. */
  const code =
    typeof record.error_code === "string"
      ? record.error_code
      : typeof record.code === "string"
        ? record.code
        : null;

  return { ok: false, status: response.status, code };
}

type StoredSession = {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  user: Record<string, unknown>;
};

export type RefreshVerdict =
  | { kind: "live"; session: StoredSession }
  /** This refresh token yields no session: forged, or its sign-in ended. */
  | { kind: "gone" }
  /** Already rotated: GoTrue has treated this as reuse. */
  | { kind: "reused" }
  | { kind: "unknown" };

/** Rotates a refresh token. A mutation: see the module comment. */
export async function refreshSession(
  config: SupabaseConfig,
  refreshToken: string,
  now: number,
): Promise<RefreshVerdict> {
  if (!refreshToken) return { kind: "gone" };

  const answer = await authRequest(config, "/token?grant_type=refresh_token", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });

  if (answer.ok) {
    const { body } = answer;

    if (
      typeof body.access_token !== "string" ||
      typeof body.refresh_token !== "string" ||
      typeof body.user !== "object" ||
      body.user === null
    ) {
      return { kind: "unknown" };
    }

    const expiresIn = Number(body.expires_in) || 3600;

    return {
      kind: "live",
      session: {
        access_token: body.access_token,
        token_type:
          typeof body.token_type === "string" ? body.token_type : "bearer",
        expires_in: expiresIn,
        expires_at:
          Number(body.expires_at) || Math.floor(now / 1000) + expiresIn,
        refresh_token: body.refresh_token,
        user: body.user as Record<string, unknown>,
      },
    };
  }

  if (answer.code === REFRESH_TOKEN_REUSED) return { kind: "reused" };
  if (answer.code && REFRESH_TOKEN_GONE.has(answer.code)) return { kind: "gone" };

  return { kind: "unknown" };
}

/* The scope of the explicit sign-out the visitor asks for on /sign-out,
   whose button reads "Sign out of all devices": every sign-in of the
   user. Only that request uses it. Nothing automatic ever does — a
   swept duplicate or a session that fails to refresh only loses this
   browser's cookies (see proxy.ts) — and nothing routes there on its
   own any more. */
type SignOutScope = "global" | "local";
const SIGN_OUT_SCOPE: SignOutScope = "global";

type LogoutVerdict =
  /** Signed out: every sign-in of the token's (verified) user is gone. */
  | "revoked"
  /** The token's sign-in no longer exists; the user's others may. */
  | "session-gone"
  /** The token's user no longer exists, nor any of their sign-ins. */
  | "user-gone"
  /** Refused as a JWT: says nothing about any sign-in. */
  | "refused"
  | "failed";

/** Revokes the sign-in an access token belongs to (`scope`). */
async function logOut(
  config: SupabaseConfig,
  accessToken: string,
  scope: SignOutScope,
): Promise<LogoutVerdict> {
  const answer = await authRequest(config, `/logout?scope=${scope}`, {
    method: "POST",
    jwt: accessToken,
  });

  if (answer.ok) return "revoked";
  if (answer.code === "user_not_found") return "user-gone";
  if (answer.code && SIGN_IN_GONE.has(answer.code)) return "session-gone";
  if (answer.code === ACCESS_TOKEN_REFUSED) return "refused";

  return "failed";
}

/* Hint order: the later-looking generation first. Never evidence. */
function byNewestHint(candidates: SessionCandidate[]) {
  const hint = (candidate: SessionCandidate) =>
    candidate.tokenExpiresAt ?? candidate.expiresAt;

  return [...candidates].sort((a, b) => hint(b) - hint(a));
}

/**
 * What a sign-out proved, at three levels.
 *
 * - `complete`: every credential the browser held (each access token and
 *   each refresh token) is confirmed unusable, and every user those
 *   credentials name was signed out of every device by a sign-out the
 *   Auth API confirmed. Only then may the visitor be told so.
 * - `local`: every credential the browser held is confirmed unusable,
 *   but some user could not be signed out everywhere — the browser held
 *   nothing that still worked for them, or held nothing at all. Local
 *   cookies are gone; sessions elsewhere are unknown.
 * - `incomplete`: some credential may still work (an error, a timeout, a
 *   reused refresh token, a copy past the budget, or legacy cookies this
 *   code cannot read). Never presented as success.
 */
export type RevocationStatus = "complete" | "local" | "incomplete";

export type RevocationReport = {
  status: RevocationStatus;
  /** Distinct readable sessions the browser sent. */
  candidates: number;
  /** Credentials a confirmed sign-out made unusable. */
  revoked: number;
  /** Credentials already unusable: expired, or refused with an explicit code. */
  alreadyInvalid: number;
  /** Credentials whose state is unknown. */
  uncertain: number;
  /** Candidates past `MAX_JUDGED_CANDIDATES`, or a truncated assembly. */
  skipped: number;
  /** Users a confirmed global sign-out covered. */
  usersSignedOut: number;
  /** Users the browser's credentials name that no confirmed sign-out covered. */
  usersUnconfirmed: number;
  /** Legacy Supabase auth cookies, never read or revoked here. */
  legacyCookies: number;
};

type Credential = "revoked" | "invalid" | "uncertain";

/**
 * Server-side sign-out for every credential the browser holds, within
 * `SIGN_OUT_BUDGET_MS` of Auth API work, and never through auth-js's
 * `signOut` (which reports success on 401, 403 and 404).
 *
 * Access tokens, refresh tokens and users are accounted separately: a
 * cookie may pair one sign-in's access token with another's refresh
 * token, so signing out the user behind one says nothing about the
 * other.
 *
 * 1. Every unexpired access token signs out (`global`), in parallel. An
 *    accepted one proves its user, who is then signed out everywhere.
 * 2. Every refresh token is presented, newest-looking first. Most are
 *    gone by now (signing out deletes sign-ins and their refresh
 *    tokens); one that still works yields a fresh access token naming
 *    its user, which signs out too.
 *
 * An expired or refused access token is an unusable credential, but not
 * proof that its user's sessions ended. Its `sub` is read without
 * verification only to ask whether a confirmed sign-out already covered
 * that user: a real token's claims are true, so if it names a user who
 * was signed out everywhere, its session ended with them; a forged one
 * is no credential at all. A user it names whom no confirmed sign-out
 * covered stays unconfirmed — never assumed signed out because another
 * user was.
 *
 * The caller clears every local cookie whatever this reports. Access
 * tokens issued before the sign-out stay valid for JWT-only verifiers
 * until they expire.
 */
export async function revokeSessionCandidates(
  inventory: AuthCookieInventory,
  baseConfig: SupabaseConfig,
  { now = Date.now() }: { now?: number } = {},
): Promise<RevocationReport> {
  const config = {
    ...baseConfig,
    deadline: baseConfig.deadline ?? now + SIGN_OUT_BUDGET_MS,
  };
  const nowSeconds = Math.floor(now / 1000);
  /* Grafted-profile pairs are credentials too: each is judged on its own
     tokens, and `userId` is already the token's `sub`. */
  const credentialSets = [...inventory.candidates, ...inventory.revocationOnly];
  const judged = byNewestHint(credentialSets.slice(0, MAX_JUDGED_CANDIDATES));
  const skipped =
    credentialSets.length -
    judged.length +
    (inventory.candidatesTruncated ? 1 : 0);
  const credentials: Credential[] = [];
  /** Users a confirmed global sign-out (or the user's deletion) covers. */
  const signedOut = new Set<string>();
  /** Users the Auth API vouched for, whatever happened to them. */
  const verifiedUsers = new Set<string>();
  /** Users only an unverified token names; null for a token naming none. */
  const claimedUsers = new Set<string | null>();

  /* 1. Access tokens, in parallel. */
  const accessResults = await Promise.all(
    judged.map(async (candidate) =>
      candidate.tokenExpiresAt === null ||
      candidate.tokenExpiresAt <= nowSeconds
        ? null
        : logOut(config, candidate.accessToken, SIGN_OUT_SCOPE),
    ),
  );

  judged.forEach((candidate, index) => {
    /* A half session without an access token: only its refresh token
       is a credential, judged below. */
    if (!candidate.accessToken) return;

    const verdict = accessResults[index];
    /* Evidence only when the answer checked the token's signature. */
    const sub = claimsOf(candidate.accessToken).sub;
    const verifiedSub = typeof sub === "string" ? sub : null;

    switch (verdict) {
      case "revoked":
      case "user-gone":
        credentials.push(verdict === "revoked" ? "revoked" : "invalid");
        if (verifiedSub) {
          verifiedUsers.add(verifiedSub);
          signedOut.add(verifiedSub);
        }
        return;
      case "session-gone":
        credentials.push("invalid");
        if (verifiedSub) verifiedUsers.add(verifiedSub);
        return;
      case "failed":
        credentials.push("uncertain");
        claimedUsers.add(candidate.userId);
        return;
      default:
        /* Expired, or refused as a JWT. */
        credentials.push("invalid");
        claimedUsers.add(candidate.userId);
    }
  });

  /* 2. Refresh tokens, in order. */
  for (const candidate of judged) {
    if (!candidate.refreshToken) continue;

    const refreshed = await refreshSession(config, candidate.refreshToken, now);

    if (refreshed.kind === "gone") {
      credentials.push("invalid");
      continue;
    }

    if (refreshed.kind !== "live") {
      credentials.push("uncertain");
      continue;
    }

    /* Issued by the Auth API just now: its user is evidence. */
    const user = claimsOf(refreshed.session.access_token).sub;
    if (typeof user === "string") verifiedUsers.add(user);

    const verdict = await logOut(
      config,
      refreshed.session.access_token,
      SIGN_OUT_SCOPE,
    );

    if (verdict === "revoked" || verdict === "user-gone") {
      credentials.push(verdict === "revoked" ? "revoked" : "invalid");
      if (typeof user === "string") signedOut.add(user);
    } else if (verdict === "session-gone") {
      credentials.push("invalid");
    } else {
      credentials.push("uncertain");
    }
  }

  const users = new Set<string | null>([...verifiedUsers, ...claimedUsers]);
  const unconfirmed = [...users].filter(
    (user) => user === null || !signedOut.has(user),
  ).length;
  const count = (credential: Credential) =>
    credentials.filter((value) => value === credential).length;
  const uncertain = count("uncertain");

  const status: RevocationStatus =
    uncertain > 0 || skipped > 0 || inventory.legacy.length > 0
      ? "incomplete"
      : users.size > 0 && unconfirmed === 0
        ? "complete"
        : "local";

  return {
    status,
    candidates: credentialSets.length,
    revoked: count("revoked"),
    alreadyInvalid: count("invalid"),
    uncertain,
    skipped,
    usersSignedOut: signedOut.size,
    usersUnconfirmed: unconfirmed,
    legacyCookies: inventory.legacy.length,
  };
}

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { NextRequest, NextResponse } from "next/server";

import { GET as oauthCallback } from "../../app/auth/callback/route";
import { GET as confirmEmail } from "../../app/auth/confirm/route";
import { POST as signOut } from "../../app/auth/signout/route";
import { proxy } from "../../proxy";
import { AUTH_NO_STORE_HEADERS } from "./auth-cookie-cleanup";
import {
  mergeSupabaseCookieOptions,
  SUPABASE_AUTH_COOKIE_DOMAIN,
  SUPABASE_AUTH_COOKIE_NAME,
} from "./cookie-options";

/*
 * Regression coverage for the OAuth → /dashboard → /login bounce.
 *
 * Drives the real /auth/callback route and the real proxy against a
 * stubbed Supabase Auth API, carrying cookies between them through a
 * browser-like jar built only from the Set-Cookie headers. Every token
 * here is a fake, unsigned placeholder; nothing touches the network.
 */

const SUPABASE_URL = "https://project-ref.supabase.co";
const ORIGIN = "http://localhost:3000";
const FAKE_VERIFIER = "fake-pkce-verifier";

function base64url(input: string) {
  return Buffer.from(input).toString("base64url");
}

const DEFAULT_SESSION_ID = "00000000-0000-4000-8000-000000000002";

/* `session_id` names one sign-in; it survives every refresh of it. */
function fakeAccessToken({
  sessionId = DEFAULT_SESSION_ID,
  expiresIn = 3600,
}: { sessionId?: string; expiresIn?: number } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      sub: "00000000-0000-4000-8000-000000000001",
      aud: "authenticated",
      role: "authenticated",
      iat: now + expiresIn - 3600,
      exp: now + expiresIn,
      session_id: sessionId,
    }),
  );

  return `${header}.${payload}.fake-signature`;
}

function sessionIdOf(token: string) {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString())
      .session_id as string | undefined;
  } catch {
    return undefined;
  }
}

/* Provider sign-ins carry identity metadata (names, avatar URLs,
   provider ids) that email/password sessions do not, which pushes the
   serialized session past @supabase/ssr's 3180-char chunk size. */
function fakeOAuthUser() {
  const identityData = {
    avatar_url: `https://avatars.example.com/u/${"a".repeat(180)}`,
    email: "founder@example.com",
    email_verified: true,
    full_name: "Test Founder",
    iss: "https://accounts.example.com",
    name: "Test Founder",
    picture: `https://avatars.example.com/p/${"b".repeat(180)}`,
    provider_id: "1234567890",
    sub: "1234567890",
  };

  return {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "founder@example.com",
    app_metadata: { provider: "google", providers: ["google", "github"] },
    user_metadata: identityData,
    identities: ["google", "github"].map((provider, index) => ({
      identity_id: `00000000-0000-4000-8000-00000000001${index}`,
      id: identityData.sub,
      user_id: "00000000-0000-4000-8000-000000000001",
      identity_data: identityData,
      provider,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    })),
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

/** Minimal browser cookie jar: applies Set-Cookie headers in order. */
function applySetCookies(jar: Map<string, string>, response: Response) {
  for (const header of response.headers.getSetCookie()) {
    const [pair, ...attributes] = header.split(";").map((part) => part.trim());
    const separator = pair.indexOf("=");
    const name = pair.slice(0, separator);
    const value = decodeURIComponent(pair.slice(separator + 1));
    const expired = attributes.some((attribute) => {
      const [key, attrValue = ""] = attribute.split("=");
      const lower = key.toLowerCase();

      return (
        (lower === "max-age" && Number(attrValue) <= 0) ||
        (lower === "expires" && new Date(attrValue).getTime() <= Date.now())
      );
    });

    if (expired || value === "") {
      jar.delete(name);
    } else {
      jar.set(name, value);
    }
  }
}

function cookieHeader(jar: Map<string, string>) {
  return Array.from(jar, ([name, value]) => `${name}=${value}`).join("; ");
}

function authCookieNames(jar: Map<string, string>) {
  return Array.from(jar.keys())
    .filter((name) => name.startsWith(SUPABASE_AUTH_COOKIE_NAME))
    .sort();
}

const originalFetch = globalThis.fetch;
const originalEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};
let accessToken: string;
/* Access tokens of other session generations the Auth API accepts. */
let liveAccessTokens: Set<string>;
/* Sign-ins revoked server-side: their JWTs answer `session_not_found`. */
let revokedSessionIds: Set<string>;
let validatedTokens: string[];
/* Refresh tokens the stubbed Auth API still honours, and what it saw. */
let liveRefreshTokens: Set<string>;
/* Already rotated: presenting one again is refresh-token reuse, which
   GoTrue answers by revoking the whole session family. */
let consumedRefreshTokens: Set<string>;
/* The sign-in each issued refresh token belongs to: a refresh keeps it. */
let refreshSessionIds: Map<string, string>;
let reuseDetected: boolean;
let refreshedTokens: string[];
let refreshCalls: number;
let logoutCalls: number;
let loggedOutTokens: string[];
/* Answer `/logout` with this status, revoking nothing, when set. */
let logoutFailure: number | null;
/* "down": the network fails; "unavailable": the Auth API answers 503. */
let authApi: "up" | "down" | "unavailable";
/* `/user` answers 500: a transient failure after a code was consumed. */
let userLookupFails: boolean;
/* `/verify` confirms the address but returns no session. */
let verifyWithoutSession: boolean;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake-anon-key";
  accessToken = fakeAccessToken();
  liveAccessTokens = new Set();
  revokedSessionIds = new Set();
  validatedTokens = [];
  liveRefreshTokens = new Set(["fake-refresh-token"]);
  consumedRefreshTokens = new Set();
  refreshSessionIds = new Map();
  reuseDetected = false;
  refreshedTokens = [];
  refreshCalls = 0;
  logoutCalls = 0;
  loggedOutTokens = [];
  logoutFailure = null;
  authApi = "up";
  userLookupFails = false;
  verifyWithoutSession = false;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });

    if (authApi === "down") {
      throw new TypeError("fetch failed");
    }

    if (authApi === "unavailable") {
      return json({ message: "service unavailable" }, 503);
    }

    if (url.pathname === "/auth/v1/token") {
      const body = JSON.parse(String(init?.body ?? "{}"));

      if (url.searchParams.get("grant_type") === "refresh_token") {
        refreshCalls += 1;
        refreshedTokens.push(body.refresh_token);

        if (consumedRefreshTokens.has(body.refresh_token)) {
          reuseDetected = true;
          liveRefreshTokens.clear();
          liveAccessTokens.clear();
          accessToken = "revoked-by-refresh-token-reuse";

          return json({ error_code: "refresh_token_already_used" }, 400);
        }

        if (!liveRefreshTokens.delete(body.refresh_token)) {
          return json({ error_code: "refresh_token_not_found" }, 400);
        }

        consumedRefreshTokens.add(body.refresh_token);

        /* Rotates both tokens within the same sign-in, and drops the
           bulky provider metadata so the refreshed session needs fewer
           chunks than the old one. */
        const sessionId =
          refreshSessionIds.get(body.refresh_token) ?? DEFAULT_SESSION_ID;
        accessToken = fakeAccessToken({ sessionId });
        const refreshToken = `fake-refresh-token-${refreshCalls}`;
        liveRefreshTokens.add(refreshToken);
        refreshSessionIds.set(refreshToken, sessionId);

        return json({
          access_token: accessToken,
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: refreshToken,
          user: { ...fakeOAuthUser(), user_metadata: {}, identities: [] },
        });
      }

      if (
        url.searchParams.get("grant_type") !== "pkce" ||
        body.code_verifier !== FAKE_VERIFIER
      ) {
        return json({ error: "invalid_grant" }, 400);
      }

      /* A new sign-in issues this refresh token afresh. */
      liveRefreshTokens.add("fake-refresh-token");
      consumedRefreshTokens.delete("fake-refresh-token");
      if (revokedSessionIds.delete(DEFAULT_SESSION_ID)) {
        accessToken = fakeAccessToken();
      }

      return json({
        access_token: accessToken,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "fake-refresh-token",
        user: fakeOAuthUser(),
      });
    }

    if (url.pathname === "/auth/v1/user") {
      if (userLookupFails) {
        return json({ message: "internal error" }, 500);
      }

      const authorization = new Headers(init?.headers).get("authorization");
      const token = authorization?.replace(/^Bearer /, "") ?? "";

      validatedTokens.push(token);

      if (revokedSessionIds.has(sessionIdOf(token) ?? "")) {
        return json(
          { error_code: "session_not_found", msg: "Session does not exist" },
          403,
        );
      }

      /* GoTrue refuses an unknown or expired JWT as `bad_jwt`. */
      return token === accessToken || liveAccessTokens.has(token)
        ? json(fakeOAuthUser())
        : json({ error_code: "bad_jwt", msg: "invalid JWT" }, 403);
    }

    if (url.pathname === "/auth/v1/logout") {
      const authorization = new Headers(init?.headers).get("authorization");
      const token = authorization?.replace(/^Bearer /, "") ?? "";

      logoutCalls += 1;
      loggedOutTokens.push(token);

      if (logoutFailure) {
        return json({ message: "logout failed" }, logoutFailure);
      }

      if (revokedSessionIds.has(sessionIdOf(token) ?? "")) {
        return json({ error_code: "session_not_found" }, 403);
      }

      if (token !== accessToken && !liveAccessTokens.has(token)) {
        return json({ error_code: "bad_jwt", msg: "invalid JWT" }, 403);
      }

      /* scope=global: every sign-in of the (one) user is revoked, so no
         token or refresh token of any of them works afterwards. */
      for (const live of [accessToken, ...liveAccessTokens]) {
        const sessionId = sessionIdOf(live);
        if (sessionId) revokedSessionIds.add(sessionId);
      }
      liveAccessTokens.clear();
      liveRefreshTokens.clear();
      accessToken = "revoked-by-sign-out";

      return new Response(null, { status: 204 });
    }

    /* Email confirmation: verifyOtp exchanges the emailed token_hash. */
    if (url.pathname === "/auth/v1/verify") {
      const body = JSON.parse(String(init?.body ?? "{}"));

      if (body.token_hash !== "fake-token-hash") {
        return json({ error: "otp_expired" }, 403);
      }

      if (verifyWithoutSession) {
        return json({ user: fakeOAuthUser() });
      }

      liveRefreshTokens.add("fake-refresh-token");
      consumedRefreshTokens.delete("fake-refresh-token");
      if (revokedSessionIds.delete(DEFAULT_SESSION_ID)) {
        accessToken = fakeAccessToken();
      }

      return json({
        access_token: accessToken,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "fake-refresh-token",
        user: fakeOAuthUser(),
      });
    }

    return json({ message: "unexpected request" }, 404);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.url;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnv.key;
});

describe("OAuth session cookies survive callback → proxy", () => {
  async function signInThroughCallback() {
    /* The browser client stored the PKCE verifier when sign-in began. */
    const jar = new Map([
      [
        `${SUPABASE_AUTH_COOKIE_NAME}-code-verifier`,
        `base64-${base64url(JSON.stringify(FAKE_VERIFIER))}`,
      ],
    ]);

    const callbackResponse = await oauthCallback(
      new NextRequest(`${ORIGIN}/auth/callback?code=fake-code&next=%2Fdashboard`, {
        /* The callback builds its redirect from the Host the browser
           addressed, never from the server's bind address. */
        headers: { cookie: cookieHeader(jar), host: new URL(ORIGIN).host },
      }),
    );

    assert.equal(callbackResponse.status, 307);
    assert.equal(callbackResponse.headers.get("location"), `${ORIGIN}/dashboard`);

    applySetCookies(jar, callbackResponse);

    return jar;
  }

  it("writes every session chunk under its own cookie name", async () => {
    const jar = await signInThroughCallback();

    assert.deepEqual(authCookieNames(jar), [
      `${SUPABASE_AUTH_COOKIE_NAME}.0`,
      `${SUPABASE_AUTH_COOKIE_NAME}.1`,
    ]);
  });

  for (const pathname of ["/dashboard", "/command-center"]) {
    it(`lets the freshly signed-in visitor through to ${pathname}`, async () => {
      const jar = await signInThroughCallback();
      validatedTokens = [];

      const response = await proxy(
        new NextRequest(`${ORIGIN}${pathname}`, {
          headers: { cookie: cookieHeader(jar) },
        }),
      );

      assert.equal(response.headers.get("location"), null);
      assert.equal(response.headers.get("x-middleware-next"), "1");
      /* The proxy verified the reassembled session's own access token. */
      assert.deepEqual(validatedTokens, [accessToken]);
    });
  }

  it("still bounces a visitor without a session to /login", async () => {
    const response = await proxy(new NextRequest(`${ORIGIN}/dashboard`));

    assert.equal(response.status, 307);
    assert.equal(
      new URL(response.headers.get("location")!).pathname +
        new URL(response.headers.get("location")!).search,
      "/login?next=%2Fdashboard",
    );
  });

  it("still bounces a visitor whose session chunks are incomplete", async () => {
    const jar = await signInThroughCallback();
    jar.delete(`${SUPABASE_AUTH_COOKIE_NAME}.1`);

    const response = await proxy(
      new NextRequest(`${ORIGIN}/dashboard`, {
        headers: { cookie: cookieHeader(jar) },
      }),
    );

    assert.equal(response.status, 307);
    assert.match(response.headers.get("location") ?? "", /\/login\?next=/);
  });
});

describe("mergeSupabaseCookieOptions", () => {
  it("never carries the storage-key `name` into per-cookie options", () => {
    for (const hostname of ["localhost", "entrepreneuria.io", "app.entrepreneuria.io"]) {
      assert.equal(
        "name" in mergeSupabaseCookieOptions(hostname, { maxAge: 10 }),
        false,
      );
    }
  });

  it("keeps each chunk's own name when written through Next's cookie API", () => {
    const response = NextResponse.next();

    for (const name of [`${SUPABASE_AUTH_COOKIE_NAME}.0`, `${SUPABASE_AUTH_COOKIE_NAME}.1`]) {
      response.cookies.set(
        name,
        "chunk",
        mergeSupabaseCookieOptions("localhost", {}),
      );
    }

    assert.deepEqual(
      response.cookies.getAll().map((cookie) => cookie.name),
      [`${SUPABASE_AUTH_COOKIE_NAME}.0`, `${SUPABASE_AUTH_COOKIE_NAME}.1`],
    );
  });

  it("preserves the shared-domain contract on Entrepreneuria hosts only", () => {
    assert.equal(
      mergeSupabaseCookieOptions("app.entrepreneuria.io", {}).domain,
      ".entrepreneuria.io",
    );
    assert.equal(mergeSupabaseCookieOptions("localhost", {}).domain, undefined);
  });
});

/*
 * Production: `next start` behind nginx. Every handler sees the bind
 * address (http://localhost:3000) as its URL while the browser addressed
 * entrepreneuria.io — the setup that split the shared session into a
 * host-only and a `.entrepreneuria.io` copy of every chunk.
 */

const BIND_ADDRESS = "http://localhost:3000";
const PUBLIC_HOST = "entrepreneuria.io";
const SHARED_DOMAIN = SUPABASE_AUTH_COOKIE_DOMAIN.replace(/^\./, "");

type Scope = "host-only" | "shared-domain";
type ScopedCookie = {
  name: string;
  value: string;
  /** Host a host-only cookie is bound to; null for a Domain cookie. */
  host: string | null;
  /** Domain a Domain cookie is scoped to, without the leading dot. */
  domain: string | null;
  path: string;
  expiresAt: number;
  created: number;
};

/**
 * Browser cookie jar, just faithful enough for scope migration: cookies
 * are keyed by name + Domain/host + Path (RFC 6265 §5.3), so a host-only
 * and a `.entrepreneuria.io` cookie of one name coexist and a deletion
 * removes only the scope and path it names. A host-only cookie is sent
 * only to the host that set it; a Domain cookie to that domain and its
 * subdomains. The Cookie header orders longer paths first, then older
 * cookies first, and an overwrite keeps the original creation time.
 */
class ScopedJar {
  private cookies = new Map<string, ScopedCookie>();
  private clock = 0;

  constructor(private readonly host = PUBLIC_HOST) {}

  private key(name: string, host: string | null, domain: string | null, path: string) {
    return `${name}|${domain ? `.${domain}` : host}|${path}`;
  }

  private store(cookie: Omit<ScopedCookie, "created">) {
    const key = this.key(cookie.name, cookie.host, cookie.domain, cookie.path);
    const existing = this.cookies.get(key);

    if (cookie.expiresAt <= Date.now()) {
      this.cookies.delete(key);
    } else {
      this.cookies.set(key, {
        ...cookie,
        created: existing?.created ?? (this.clock += 1),
      });
    }
  }

  apply(response: Response, requestHost = this.host) {
    for (const header of response.headers.getSetCookie()) {
      const [pair, ...attributes] = header.split(";").map((part) => part.trim());
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator);
      const value = decodeURIComponent(pair.slice(separator + 1));
      let domain: string | null = null;
      let path = "/";
      let expiresAt = Infinity;

      for (const attribute of attributes) {
        const [attrName, attrValue = ""] = attribute.split("=");
        const lower = attrName.toLowerCase();

        if (lower === "domain") {
          domain = attrValue.replace(/^\./, "").toLowerCase();
          /* A browser rejects a Domain this host is not inside. */
          assert.ok(
            requestHost === domain || requestHost.endsWith(`.${domain}`),
            `Set-Cookie from ${requestHost} for foreign domain ${domain}`,
          );
        } else if (lower === "path") {
          path = attrValue || "/";
        } else if (lower === "max-age") {
          expiresAt = Math.min(expiresAt, Date.now() + Number(attrValue) * 1000);
        } else if (lower === "expires" && expiresAt === Infinity) {
          expiresAt = new Date(attrValue).getTime();
        }
      }

      this.store({
        name,
        value,
        host: domain ? null : requestHost,
        domain,
        path,
        expiresAt,
      });
    }
  }

  set(
    name: string,
    value: string,
    scope: Scope,
    { path = "/", host = this.host }: { path?: string; host?: string } = {},
  ) {
    this.store({
      name,
      value,
      host: scope === "host-only" ? host : null,
      domain: scope === "host-only" ? null : SHARED_DOMAIN,
      path,
      expiresAt: Infinity,
    });
  }

  get(name: string, scope: Scope, { path = "/", host = this.host } = {}) {
    return this.cookies.get(
      scope === "host-only"
        ? this.key(name, host, null, path)
        : this.key(name, null, SHARED_DOMAIN, path),
    )?.value;
  }

  /** The Cookie header this browser sends to `host` for `pathname`. */
  header(pathname = "/", host = this.host) {
    const now = Date.now();

    return Array.from(this.cookies.values())
      .filter(
        (cookie) =>
          cookie.expiresAt > now &&
          (cookie.domain
            ? host === cookie.domain || host.endsWith(`.${cookie.domain}`)
            : cookie.host === host) &&
          (cookie.path === "/" ||
            pathname === cookie.path ||
            pathname.startsWith(`${cookie.path.replace(/\/$/, "")}/`)),
      )
      .sort((a, b) => b.path.length - a.path.length || a.created - b.created)
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ");
  }

  authCookies(scope: Scope, host = this.host) {
    return Array.from(this.cookies.values())
      .filter(
        (cookie) =>
          cookie.name.startsWith(SUPABASE_AUTH_COOKIE_NAME) &&
          (scope === "host-only"
            ? cookie.host === host
            : cookie.domain === SHARED_DOMAIN),
      )
      .map((cookie) => cookie.name)
      .sort();
  }

  get size() {
    return this.cookies.size;
  }
}

function productionRequest(
  pathname: string,
  jar: ScopedJar,
  init: { method?: string } = {},
) {
  return new NextRequest(`${BIND_ADDRESS}${pathname}`, {
    ...init,
    headers: {
      host: PUBLIC_HOST,
      "x-forwarded-proto": "https",
      cookie: jar.header(new URL(pathname, BIND_ADDRESS).pathname),
      /* A browser form or fetch POST names the page's origin. */
      ...(init.method === "POST" ? { origin: `https://${PUBLIC_HOST}` } : {}),
    },
  });
}

/* A session serialized and chunked the way @supabase/ssr stores it. */
function sessionChunks(session: Record<string, unknown>) {
  const encoded = `base64-${base64url(JSON.stringify(session))}`;
  const chunks = encoded.match(/.{1,3180}/g)!;

  return chunks.length === 1
    ? [[SUPABASE_AUTH_COOKIE_NAME, encoded]]
    : chunks.map((chunk, index) => [
        `${SUPABASE_AUTH_COOKIE_NAME}.${index}`,
        chunk,
      ]);
}

function storedSession({
  refreshToken,
  expiresIn,
  bulky = true,
  token = accessToken,
}: {
  refreshToken: string;
  expiresIn: number;
  bulky?: boolean;
  token?: string;
}) {
  const user = fakeOAuthUser();

  return {
    access_token: token,
    token_type: "bearer",
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    refresh_token: refreshToken,
    /* The bulky variant needs three chunks, the plain one two. */
    user: bulky
      ? { ...user, user_metadata: { ...user.user_metadata, bio: "c".repeat(2600) } }
      : user,
  };
}

function plant(
  jar: ScopedJar,
  session: Record<string, unknown>,
  scope: Scope,
) {
  for (const [name, value] of sessionChunks(session)) {
    jar.set(name, value, scope);
  }
}

async function productionSignIn(jar: ScopedJar) {
  /* The browser client stores the verifier on the shared domain. */
  jar.set(
    `${SUPABASE_AUTH_COOKIE_NAME}-code-verifier`,
    `base64-${base64url(JSON.stringify(FAKE_VERIFIER))}`,
    "shared-domain",
  );

  const response = await oauthCallback(
    productionRequest("/auth/callback?code=fake-code&next=%2Fdashboard", jar),
  );

  assert.equal(
    response.headers.get("location"),
    `https://${PUBLIC_HOST}/dashboard`,
  );
  jar.apply(response);

  return response;
}

function setCookiesFor(response: Response, name: string) {
  return response.headers
    .getSetCookie()
    .filter((header) => header.startsWith(`${name}=`));
}

describe("production: one canonical .entrepreneuria.io session family", () => {
  it("callback writes every chunk to .entrepreneuria.io despite the localhost bind URL", async () => {
    const jar = new ScopedJar();
    const response = await productionSignIn(jar);

    for (const name of [
      `${SUPABASE_AUTH_COOKIE_NAME}.0`,
      `${SUPABASE_AUTH_COOKIE_NAME}.1`,
    ]) {
      const written = setCookiesFor(response, name).filter(
        (header) => !header.startsWith(`${name}=;`),
      );

      assert.equal(written.length, 1);
      assert.match(written[0], /Domain=\.entrepreneuria\.io/i);
      assert.match(written[0], /Path=\//);
      assert.match(written[0], /Secure/);
      assert.match(written[0], /SameSite=lax/i);
      assert.doesNotMatch(written[0], /HttpOnly/i);
    }

    /* The PKCE verifier is removed in the scope the browser set it. */
    assert.equal(
      jar.get(`${SUPABASE_AUTH_COOKIE_NAME}-code-verifier`, "shared-domain"),
      undefined,
    );
    assert.deepEqual(jar.authCookies("host-only"), []);
    assert.deepEqual(jar.authCookies("shared-domain"), [
      `${SUPABASE_AUTH_COOKIE_NAME}.0`,
      `${SUPABASE_AUTH_COOKIE_NAME}.1`,
    ]);
  });

  it("the proxy accepts that session and writes no cookies at all", async () => {
    const jar = new ScopedJar();
    await productionSignIn(jar);
    validatedTokens = [];

    const response = await proxy(productionRequest("/dashboard", jar));

    assert.equal(response.headers.get("location"), null);
    assert.deepEqual(validatedTokens, [accessToken]);
    assert.deepEqual(response.headers.getSetCookie(), []);
  });

  it("a proxy refresh moves a host-only session onto .entrepreneuria.io without a sign-in", async () => {
    /* A browser signed in before the fix: only a host-only family. */
    const jar = new ScopedJar();
    plant(
      jar,
      storedSession({ refreshToken: "fake-refresh-token", expiresIn: -60 }),
      "host-only",
    );
    assert.equal(jar.authCookies("host-only").length, 3);

    const response = await proxy(productionRequest("/dashboard", jar));

    assert.equal(response.headers.get("location"), null);
    assert.equal(refreshCalls, 1);
    jar.apply(response);

    assert.deepEqual(jar.authCookies("host-only"), []);
    assert.ok(jar.authCookies("shared-domain").length > 0);

    validatedTokens = [];
    const next = await proxy(productionRequest("/dashboard", jar));
    assert.equal(next.headers.get("location"), null);
    assert.deepEqual(validatedTokens, [accessToken]);
  });

  it("deletes superseded chunks of the canonical family when the session shrinks", async () => {
    const jar = new ScopedJar();
    plant(
      jar,
      storedSession({ refreshToken: "fake-refresh-token", expiresIn: -60 }),
      "shared-domain",
    );
    const before = jar.authCookies("shared-domain");
    assert.equal(before.length, 3);

    const response = await proxy(productionRequest("/", jar));
    jar.apply(response);

    const after = jar.authCookies("shared-domain");
    const superseded = before.filter((name) => !after.includes(name));
    assert.ok(superseded.length > 0);

    for (const name of superseded) {
      assert.ok(
        setCookiesFor(response, name).some(
          (header) =>
            /Domain=\.entrepreneuria\.io/i.test(header) &&
            /Max-Age=0/i.test(header),
        ),
        `${name} expired on .entrepreneuria.io`,
      );
    }
  });

  it("serves a browser holding both scopes without deleting either copy", async () => {
    const jar = new ScopedJar();
    /* An older three-chunk host-only family, then a newer two-chunk
       .entrepreneuria.io family. Next keeps one value per name, so the
       request stitches .0 and .1 from one family onto .2 of the other. */
    plantStaleHostOnly(jar);
    plant(
      jar,
      storedSession({
        refreshToken: "fake-refresh-token",
        expiresIn: 3600,
        bulky: false,
      }),
      "shared-domain",
    );
    const canonical = jar.authCookies("shared-domain");
    const canonicalValues = canonical.map((name) =>
      jar.get(name, "shared-domain"),
    );
    assert.equal(jar.authCookies("host-only").length, 3);

    const before = jar.header();
    const first = await proxy(productionRequest("/dashboard", jar));

    /* The canonical session's access token serves the visitor. The
       host-only family's refresh token cannot be ruled out without a
       refresh, and an accepted access token says nothing about the
       refresh token beside it, so neither family is rewritten or
       retired (auth-session-resolution). */
    assert.equal(first.headers.get("location"), null);
    assert.deepEqual(
      first.headers
        .getSetCookie()
        .filter((header) => header.startsWith(KEY)),
      [],
    );
    jar.apply(first);

    assert.equal(jar.header(), before);
    assert.equal(jar.authCookies("host-only").length, 3);
    assert.deepEqual(
      canonical.map((name) => jar.get(name, "shared-domain")),
      canonicalValues,
    );
    assert.equal(refreshCalls, 0);
  });

  it("signing in over a stale host-only family leaves only the new canonical family", async () => {
    const jar = new ScopedJar();
    plant(
      jar,
      storedSession({ refreshToken: "stale-refresh-token", expiresIn: 3600 }),
      "host-only",
    );

    await productionSignIn(jar);

    assert.deepEqual(jar.authCookies("host-only"), []);
    assert.deepEqual(jar.authCookies("shared-domain"), [
      `${SUPABASE_AUTH_COOKIE_NAME}.0`,
      `${SUPABASE_AUTH_COOKIE_NAME}.1`,
    ]);
  });

  it("retires legacy host-only sb-* auth cookies and nothing unrelated", async () => {
    const jar = new ScopedJar();
    await productionSignIn(jar);
    jar.set("sb-project-ref-auth-token", "legacy", "host-only");
    jar.set("unrelated-preference", "keep", "host-only");

    const response = await proxy(productionRequest("/", jar));
    jar.apply(response);

    assert.equal(jar.get("sb-project-ref-auth-token", "host-only"), undefined);
    assert.equal(jar.get("unrelated-preference", "host-only"), "keep");
    assert.equal(jar.authCookies("shared-domain").length, 2);
  });

  it("sign-out revokes the session and expires every auth cookie in both scopes", async () => {
    const jar = new ScopedJar();
    await productionSignIn(jar);
    plant(
      jar,
      storedSession({ refreshToken: "stale-refresh-token", expiresIn: 3600 }),
      "host-only",
    );
    jar.set("sb-project-ref-auth-token", "legacy", "host-only");
    jar.set("unrelated-preference", "keep", "shared-domain");

    const response = await signOut(
      productionRequest("/auth/signout", jar, { method: "POST" }),
    );

    assert.equal(response.status, 303);
    /* The legacy `sb-*` cookie is expired too, but this code cannot read
       or revoke what it holds, so the sign-out is not reported as
       complete and the visitor is told so. */
    assert.equal(response.headers.get("x-auth-revocation"), "incomplete");
    assert.equal(
      response.headers.get("location"),
      `https://${PUBLIC_HOST}/sign-out?status=incomplete`,
    );

    const expiries = setCookiesFor(response, `${SUPABASE_AUTH_COOKIE_NAME}.0`);
    assert.equal(expiries.length, 2);
    assert.ok(expiries.some((header) => /Domain=\.entrepreneuria\.io/i.test(header)));
    assert.ok(expiries.some((header) => !/Domain=/i.test(header)));

    jar.apply(response);
    assert.deepEqual(jar.authCookies("host-only"), []);
    assert.deepEqual(jar.authCookies("shared-domain"), []);
    assert.equal(jar.get("sb-project-ref-auth-token", "host-only"), undefined);
    assert.equal(jar.get("unrelated-preference", "shared-domain"), "keep");
  });

  it("email confirmation writes the session to .entrepreneuria.io and retires host-only copies", async () => {
    const jar = new ScopedJar();
    plant(
      jar,
      storedSession({ refreshToken: "stale-refresh-token", expiresIn: 3600 }),
      "host-only",
    );

    const response = await confirmEmail(
      productionRequest(
        "/auth/confirm?token_hash=fake-token-hash&type=signup&next=%2Fdashboard",
        jar,
      ),
    );

    assert.equal(
      response.headers.get("location"),
      `https://${PUBLIC_HOST}/dashboard`,
    );
    jar.apply(response);

    assert.deepEqual(jar.authCookies("host-only"), []);
    assert.deepEqual(jar.authCookies("shared-domain"), [
      `${SUPABASE_AUTH_COOKIE_NAME}.0`,
      `${SUPABASE_AUTH_COOKIE_NAME}.1`,
    ]);

    validatedTokens = [];
    const next = await proxy(productionRequest("/dashboard", jar));
    assert.equal(next.headers.get("location"), null);
    assert.deepEqual(validatedTokens, [accessToken]);
  });

  it("sign-out calls the Auth API to revoke a readable session", async () => {
    const jar = new ScopedJar();
    await productionSignIn(jar);

    const response = await signOut(
      productionRequest("/auth/signout", jar, { method: "POST" }),
    );

    assert.equal(logoutCalls, 1);
    assert.ok(revokedSessionIds.has(DEFAULT_SESSION_ID), "revoked server-side");
    assert.equal(response.headers.get("x-auth-revocation"), "complete");
  });

  it("repeated sign-in / browse / sign-out cycles keep the cookie count bounded", async () => {
    const jar = new ScopedJar();
    jar.set("unrelated-preference", "keep", "host-only");

    for (let cycle = 0; cycle < 12; cycle += 1) {
      await productionSignIn(jar);

      for (const pathname of ["/", "/dashboard", "/command-center"]) {
        jar.apply(await proxy(productionRequest(pathname, jar)));
      }

      assert.deepEqual(jar.authCookies("host-only"), []);
      assert.equal(jar.authCookies("shared-domain").length, 2);
      assert.equal(jar.size, 3);

      jar.apply(
        await signOut(productionRequest("/auth/signout", jar, { method: "POST" })),
      );
      assert.equal(jar.size, 1);
    }
  });
});

const KEY = SUPABASE_AUTH_COOKIE_NAME;

function assertUncacheable(response: Response) {
  for (const [key, value] of Object.entries(AUTH_NO_STORE_HEADERS)) {
    assert.equal(response.headers.get(key), value, key);
  }
}

function sharedValues(jar: ScopedJar) {
  return jar
    .authCookies("shared-domain")
    .map((name) => [name, jar.get(name, "shared-domain")]);
}

/* A browser that signed in before the fix: a stale host-only family,
   an earlier generation of the session whose access token and refresh
   token the Auth API no longer accepts. */
function plantStaleHostOnly(jar: ScopedJar) {
  plant(
    jar,
    storedSession({
      refreshToken: "stale-refresh-token",
      expiresIn: 1800,
      token: fakeAccessToken({ expiresIn: 1800 }),
    }),
    "host-only",
  );
}

describe("production: structurally unreadable canonical storage", () => {
  it("retires a corrupt bare canonical cookie in both scopes, and nothing else", async () => {
    for (const value of ["base64-!!corrupt!!", "base64-bm90LWpzb24", "not-json"]) {
      const jar = new ScopedJar();
      jar.set(KEY, value, "shared-domain");
      jar.set("unrelated-preference", "keep", "shared-domain");

      const response = await proxy(productionRequest("/dashboard", jar));

      assert.match(response.headers.get("location") ?? "", /\/login\?next=/);
      assert.ok(
        setCookiesFor(response, KEY).some(
          (header) => /Domain=\.entrepreneuria\.io/i.test(header) && /Max-Age=0/.test(header),
        ),
      );
      assertUncacheable(response);
      jar.apply(response);

      assert.deepEqual(jar.authCookies("shared-domain"), []);
      assert.deepEqual(jar.authCookies("host-only"), []);
      assert.equal(jar.get("unrelated-preference", "shared-domain"), "keep");

      /* Converged: the next request has nothing left to retire. */
      const next = await proxy(productionRequest("/", jar));
      assert.deepEqual(next.headers.getSetCookie(), []);
    }
  });

  for (const scope of ["shared-domain", "host-only"] as const) {
    it(`retires only an orphan ${scope} .2 trailing a sound canonical .0/.1`, async () => {
      const jar = new ScopedJar();
      await productionSignIn(jar);
      const canonical = sharedValues(jar);
      jar.set(`${KEY}.2`, "stale-chunk", scope);
      jar.set("unrelated-preference", "keep", "host-only");

      const first = await proxy(productionRequest("/dashboard", jar));

      assert.deepEqual(
        first.headers.getSetCookie().map((header) => header.split("=")[0]),
        [`${KEY}.2`, `${KEY}.2`],
      );
      jar.apply(first);

      assert.deepEqual(sharedValues(jar), canonical);
      assert.equal(jar.get("unrelated-preference", "host-only"), "keep");

      validatedTokens = [];
      const second = await proxy(productionRequest("/dashboard", jar));
      assert.equal(second.headers.get("location"), null);
      assert.deepEqual(validatedTokens, [accessToken]);
      assert.deepEqual(second.headers.getSetCookie(), []);
    });
  }

  it("retires a non-contiguous .0/.2 family in full", async () => {
    const jar = new ScopedJar();
    const [chunk0, , chunk2] = sessionChunks(
      storedSession({ refreshToken: "fake-refresh-token", expiresIn: 3600 }),
    );
    jar.set(chunk0[0], chunk0[1], "shared-domain");
    jar.set(chunk2[0], chunk2[1], "shared-domain");
    jar.set("unrelated-preference", "keep", "shared-domain");

    const response = await proxy(productionRequest("/", jar));
    jar.apply(response);

    assert.deepEqual(jar.authCookies("shared-domain"), []);
    assert.equal(jar.get("unrelated-preference", "shared-domain"), "keep");
  });

  it("retires malformed canonical values: mixed generations and bad encoding", async () => {
    const newer = sessionChunks(
      storedSession({ refreshToken: "fake-refresh-token", expiresIn: 3600, bulky: false }),
    );
    const older = sessionChunks(
      storedSession({ refreshToken: "stale-refresh-token", expiresIn: 3600 }),
    );

    for (const chunks of [
      [newer[0], older[1]],
      [newer[0], [newer[1][0], "%E0%A4%A"]],
    ]) {
      const jar = new ScopedJar();

      for (const [name, value] of chunks) {
        jar.set(name, value, "shared-domain");
      }

      const response = await proxy(productionRequest("/", jar));
      jar.apply(response);

      assert.deepEqual(jar.authCookies("shared-domain"), []);
    }
  });

  for (const outage of ["down", "unavailable"] as const) {
    it(`keeps a sound canonical session when the Auth API is ${outage}`, async () => {
      const jar = new ScopedJar();
      await productionSignIn(jar);
      const canonical = sharedValues(jar);

      authApi = outage;
      for (const pathname of ["/dashboard", "/"]) {
        const response = await proxy(productionRequest(pathname, jar));

        assert.deepEqual(response.headers.getSetCookie(), [], pathname);
        jar.apply(response);
      }
      assert.deepEqual(sharedValues(jar), canonical);

      authApi = "up";
      validatedTokens = [];
      const recovered = await proxy(productionRequest("/dashboard", jar));
      assert.equal(recovered.headers.get("location"), null);
      assert.deepEqual(validatedTokens, [accessToken]);
    });

    it(`keeps a sound pre-fix host-only session when the Auth API is ${outage}`, async () => {
      /* Phase A retired host-only cookies whenever the session did not
         resolve, which signed these browsers out on an outage. */
      const jar = new ScopedJar();
      plant(
        jar,
        storedSession({ refreshToken: "fake-refresh-token", expiresIn: 3600 }),
        "host-only",
      );
      const before = jar.authCookies("host-only");

      authApi = outage;
      const response = await proxy(productionRequest("/dashboard", jar));
      jar.apply(response);

      assert.deepEqual(response.headers.getSetCookie(), []);
      assert.deepEqual(jar.authCookies("host-only"), before);
    });
  }

  it("leaves a sound bare (single-cookie) canonical session untouched", async () => {
    const jar = new ScopedJar();
    const session = {
      ...storedSession({ refreshToken: "fake-refresh-token", expiresIn: 3600 }),
      user: { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated" },
    };
    plant(jar, session, "shared-domain");
    assert.deepEqual(jar.authCookies("shared-domain"), [KEY]);

    validatedTokens = [];
    const response = await proxy(productionRequest("/dashboard", jar));

    assert.equal(response.headers.get("location"), null);
    assert.deepEqual(validatedTokens, [accessToken]);
    assert.deepEqual(response.headers.getSetCookie(), []);
  });

  it("OAuth callback over stale and corrupt state keeps only the new canonical session", async () => {
    const jar = new ScopedJar();
    plantStaleHostOnly(jar);
    /* Corrupt canonical chunks under the very names the callback writes. */
    for (const name of [`${KEY}.0`, `${KEY}.1`, `${KEY}.2`]) {
      jar.set(name, "base64-corrupt", "shared-domain");
    }
    jar.set("sb-refresh-token", "legacy", "host-only");
    jar.set("unrelated-preference", "keep", "shared-domain");

    const response = await productionSignIn(jar);

    assertUncacheable(response);
    for (const name of [`${KEY}.0`, `${KEY}.1`]) {
      const shared = setCookiesFor(response, name).filter((header) =>
        /Domain=\.entrepreneuria\.io/i.test(header),
      );
      assert.equal(shared.length, 1, name);
      assert.doesNotMatch(shared[0], /Max-Age=0/, `${name} written, not expired`);
    }

    assert.deepEqual(jar.authCookies("host-only"), []);
    assert.deepEqual(jar.authCookies("shared-domain"), [`${KEY}.0`, `${KEY}.1`]);
    assert.equal(jar.get("sb-refresh-token", "host-only"), undefined);
    assert.equal(jar.get("unrelated-preference", "shared-domain"), "keep");

    validatedTokens = [];
    const next = await proxy(productionRequest("/dashboard", jar));
    assert.equal(next.headers.get("location"), null);
    assert.deepEqual(validatedTokens, [accessToken]);
  });

  it("email confirmation over stale and corrupt state keeps only the new canonical session", async () => {
    const jar = new ScopedJar();
    plantStaleHostOnly(jar);
    jar.set(`${KEY}.4`, "orphan", "shared-domain");
    jar.set(KEY, "base64-corrupt", "shared-domain");
    jar.set("unrelated-preference", "keep", "host-only");

    const response = await confirmEmail(
      productionRequest(
        "/auth/confirm?token_hash=fake-token-hash&type=signup&next=%2Fdashboard",
        jar,
      ),
    );

    assertUncacheable(response);
    jar.apply(response);

    assert.deepEqual(jar.authCookies("host-only"), []);
    assert.deepEqual(jar.authCookies("shared-domain"), [`${KEY}.0`, `${KEY}.1`]);
    assert.equal(jar.get("unrelated-preference", "host-only"), "keep");

    validatedTokens = [];
    const next = await proxy(productionRequest("/dashboard", jar));
    assert.equal(next.headers.get("location"), null);
    assert.deepEqual(validatedTokens, [accessToken]);
  });

  for (const order of ["host-only first", "canonical first"] as const) {
    it(`serves the canonical family whichever scope the browser sends first (${order})`, async () => {
      const jar = new ScopedJar();
      const canonicalSession = storedSession({
        refreshToken: "fake-refresh-token",
        expiresIn: 3600,
        bulky: false,
      });

      if (order === "host-only first") {
        plantStaleHostOnly(jar);
        plant(jar, canonicalSession, "shared-domain");
      } else {
        plant(jar, canonicalSession, "shared-domain");
        plantStaleHostOnly(jar);
      }
      const canonical = sharedValues(jar);
      const firstName = jar.header().split("=")[0];
      assert.equal(firstName, `${KEY}.0`);

      const before = jar.header();
      const response = await proxy(productionRequest("/dashboard", jar));

      /* Signed in at once; the unproven host-only copy is left alone. */
      assert.equal(response.headers.get("location"), null);
      jar.apply(response);
      assert.equal(jar.header(), before);
      assert.deepEqual(sharedValues(jar), canonical);
    });
  }

  it("both scopes plus a canonical orphan stay bounded and untouched", async () => {
    const jar = new ScopedJar();
    await productionSignIn(jar);
    plantStaleHostOnly(jar);
    jar.set(`${KEY}.3`, "orphan", "shared-domain");
    const before = jar.header();

    /* A conflict nobody proved: the session is served, and no copy is
       written or deleted, request after request. */
    const counts: number[] = [];
    for (let request = 0; request < 3; request += 1) {
      const response = await proxy(productionRequest("/", jar));
      counts.push(response.headers.getSetCookie().length);
      jar.apply(response);
    }

    assert.deepEqual(counts, [0, 0, 0]);
    assert.equal(jar.header(), before);
  });

  it("repeated requests over malformed storage never grow cookies or headers", async () => {
    const jar = new ScopedJar();
    jar.set(KEY, "base64-corrupt", "shared-domain");
    jar.set(`${KEY}.0`, "x", "host-only");
    jar.set(`${KEY}.9`, "y", "shared-domain");
    jar.set("unrelated-preference", "keep", "shared-domain");
    const initial = jar.size;

    /* A client that never stores the expiries: each response repeats the
       same fixed set, it does not accumulate. */
    const request = () => proxy(productionRequest("/dashboard", jar));
    const baseline = (await request()).headers.getSetCookie();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.deepEqual((await request()).headers.getSetCookie(), baseline);
    }
    assert.ok(baseline.length <= 2 * 3);

    /* A browser that does store them converges at once. */
    for (let attempt = 0; attempt < 5; attempt += 1) {
      jar.apply(await request());
      assert.ok(jar.size <= initial);
    }
    assert.equal(jar.size, 1);
  });
});

describe("production: revoked sessions, legacy cookies and cache safety", () => {
  it("a revoked refresh token clears the surviving cookies on the login redirect", async () => {
    const jar = new ScopedJar();
    plant(
      jar,
      storedSession({ refreshToken: "revoked-refresh-token", expiresIn: -60 }),
      "shared-domain",
    );
    jar.set("unrelated-preference", "keep", "shared-domain");

    const response = await proxy(productionRequest("/dashboard", jar));

    assert.equal(refreshCalls, 1);
    assert.match(response.headers.get("location") ?? "", /\/login\?next=/);
    assert.ok(response.headers.getSetCookie().length >= 3);
    assertUncacheable(response);
    jar.apply(response);

    assert.deepEqual(jar.authCookies("shared-domain"), []);
    assert.equal(jar.get("unrelated-preference", "shared-domain"), "keep");
  });

  it("a proxy refresh carries Supabase's anti-cache headers beside every chunk", async () => {
    const jar = new ScopedJar();
    plant(
      jar,
      storedSession({ refreshToken: "fake-refresh-token", expiresIn: -60 }),
      "shared-domain",
    );

    const response = await proxy(productionRequest("/dashboard", jar));

    assert.equal(response.headers.get("location"), null);
    assert.ok(response.headers.getSetCookie().length >= 2);
    assertUncacheable(response);
  });

  it("OAuth callback and email confirmation responses are uncacheable", async () => {
    const callback = await productionSignIn(new ScopedJar());
    const confirm = await confirmEmail(
      productionRequest(
        "/auth/confirm?token_hash=fake-token-hash&type=signup&next=%2Fdashboard",
        new ScopedJar(),
      ),
    );

    for (const response of [callback, confirm]) {
      assert.ok(response.headers.getSetCookie().length >= 2);
      assertUncacheable(response);
    }
  });

  it("sign-out is uncacheable, with or without cookies to expire", async () => {
    const signedIn = new ScopedJar();
    await productionSignIn(signedIn);

    for (const jar of [signedIn, new ScopedJar()]) {
      const response = await signOut(
        productionRequest("/auth/signout", jar, { method: "POST" }),
      );

      assertUncacheable(response);
    }
  });

  it("retires legacy sb-access-token / sb-refresh-token host-only, and both scopes at sign-out", async () => {
    const jar = new ScopedJar();
    await productionSignIn(jar);
    jar.set("sb-access-token", "legacy", "host-only");
    jar.set("sb-refresh-token", "legacy", "host-only");
    jar.set("sb-refresh-token", "legacy", "shared-domain");
    jar.set("sb-unrelated", "keep", "host-only");

    const browsed = await proxy(productionRequest("/", jar));
    assertUncacheable(browsed);
    jar.apply(browsed);

    assert.equal(jar.get("sb-access-token", "host-only"), undefined);
    assert.equal(jar.get("sb-refresh-token", "host-only"), undefined);
    /* A shared-domain legacy cookie may belong to another app: only
       sign-out removes it. */
    assert.equal(jar.get("sb-refresh-token", "shared-domain"), "legacy");

    jar.apply(
      await signOut(productionRequest("/auth/signout", jar, { method: "POST" })),
    );
    assert.equal(jar.get("sb-refresh-token", "shared-domain"), undefined);
    assert.equal(jar.get("sb-unrelated", "host-only"), "keep");
  });
});

describe("local development keeps host-only auth cookies", () => {
  it("no auth writer sets a Domain attribute on localhost", async () => {
    const jar = new Map([
      [
        `${SUPABASE_AUTH_COOKIE_NAME}-code-verifier`,
        `base64-${base64url(JSON.stringify(FAKE_VERIFIER))}`,
      ],
    ]);
    const host = new URL(ORIGIN).host;

    const callback = await oauthCallback(
      new NextRequest(`${ORIGIN}/auth/callback?code=fake-code&next=%2Fdashboard`, {
        headers: { host, cookie: cookieHeader(jar) },
      }),
    );
    applySetCookies(jar, callback);

    const proxied = await proxy(
      new NextRequest(`${ORIGIN}/dashboard`, {
        headers: { host, cookie: cookieHeader(jar) },
      }),
    );
    const signedOut = await signOut(
      new NextRequest(`${ORIGIN}/auth/signout`, {
        method: "POST",
        /* A browser's form or fetch POST names the page's origin. */
        headers: { host, origin: ORIGIN, cookie: cookieHeader(jar) },
      }),
    );

    assert.equal(proxied.headers.get("location"), null);
    for (const response of [callback, proxied, signedOut]) {
      for (const header of response.headers.getSetCookie()) {
        assert.doesNotMatch(header, /Domain=/i);
      }
    }

    applySetCookies(jar, signedOut);
    assert.deepEqual(authCookieNames(jar), []);
  });
});

/*
 * Distinct session generations in both scopes — conflict resolution and
 * sign-out across them — are covered in auth-session-resolution.test.ts
 * and auth-session-adversarial.test.ts, against the GoTrue model in
 * ./testing/fake-auth-api. That model keeps refresh-token rotation,
 * reuse intervals, the parent-of-active exception and per-scope sign-out;
 * the inline stub in this file simplifies all of them (any rotated token
 * is reuse and clears everything, sign-out clears everything), which is
 * fine for the single-session cookie flows tested here but not for
 * judging competing sessions.
 */

describe("production: session-establishing routes see and retire every copy", () => {
  /* An old host-only bare session beside a different, three-chunk
     shared-domain family: two generations the new sign-in supersedes. */
  function plantTwoOldGenerations(jar: ScopedJar) {
    plant(
      jar,
      {
        access_token: fakeAccessToken({ sessionId: "00000000-0000-4000-8000-0000000000aa" }),
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "old-bare-refresh-token",
        user: { id: "00000000-0000-4000-8000-000000000001" },
      },
      "host-only",
    );
    plant(
      jar,
      storedSession({ refreshToken: "old-shared-refresh-token", expiresIn: 3600 }),
      "shared-domain",
    );
    assert.deepEqual(jar.authCookies("host-only"), [SUPABASE_AUTH_COOKIE_NAME]);
    assert.equal(jar.authCookies("shared-domain").length, 3);
  }

  const routes = [
    {
      label: "OAuth callback",
      path: "/auth/callback?code=fake-code&next=%2Fdashboard",
      handler: oauthCallback,
      prepare(jar: ScopedJar) {
        jar.set(
          `${SUPABASE_AUTH_COOKIE_NAME}-code-verifier`,
          `base64-${base64url(JSON.stringify(FAKE_VERIFIER))}`,
          "shared-domain",
        );
      },
    },
    {
      label: "email confirmation",
      path: "/auth/confirm?token_hash=fake-token-hash&type=email&next=%2Fdashboard",
      handler: confirmEmail,
      prepare() {},
    },
  ];

  for (const { label, path, handler, prepare } of routes) {
    it(`${label}: the proxy passes the browser's cookies through untouched`, async () => {
      const jar = new ScopedJar();
      plantTwoOldGenerations(jar);
      prepare(jar);

      const passed = await proxy(productionRequest(path, jar));

      assert.equal(passed.headers.get("x-middleware-next"), "1");
      assert.equal(passed.headers.get("x-middleware-request-cookie"), null);
      assert.deepEqual(passed.headers.getSetCookie(), []);
      assert.equal(refreshCalls, 0);
    });

    it(`${label}: every superseded copy is retired, in both scopes`, async () => {
      const jar = new ScopedJar();
      plantTwoOldGenerations(jar);
      prepare(jar);

      const response = await handler(productionRequest(path, jar));

      assert.equal(response.headers.get("location"), `https://${PUBLIC_HOST}/dashboard`);
      jar.apply(response);
      assert.deepEqual(jar.authCookies("host-only"), []);
      assert.deepEqual(jar.authCookies("shared-domain"), [
        `${SUPABASE_AUTH_COOKIE_NAME}.0`,
        `${SUPABASE_AUTH_COOKIE_NAME}.1`,
      ]);

      /* The next request sees one session and no conflict. */
      validatedTokens = [];
      const next = await proxy(productionRequest("/dashboard", jar));
      assert.equal(next.headers.get("location"), null);
      assert.deepEqual(validatedTokens, [accessToken]);
    });

    it(`${label}: a stale third chunk on .entrepreneuria.io is retired too`, async () => {
      /* Two three-chunk families under the same names, one per scope:
         the duplicates differ, so nothing is provably unreadable, and
         the new two-chunk session leaves the shared `.2` behind unless
         every non-written name is retired in both scopes. */
      const jar = new ScopedJar();
      plant(
        jar,
        storedSession({ refreshToken: "old-host-refresh-token", expiresIn: 3600 }),
        "host-only",
      );
      plant(
        jar,
        storedSession({ refreshToken: "old-shared-refresh-token", expiresIn: 3600 }),
        "shared-domain",
      );
      prepare(jar);

      const response = await handler(productionRequest(path, jar));

      jar.apply(response);
      assert.deepEqual(jar.authCookies("host-only"), []);
      assert.deepEqual(jar.authCookies("shared-domain"), [
        `${SUPABASE_AUTH_COOKIE_NAME}.0`,
        `${SUPABASE_AUTH_COOKIE_NAME}.1`,
      ]);
    });

    it(`${label}: a failing user lookup cannot discard the new session`, async () => {
      const jar = new ScopedJar();
      prepare(jar);
      userLookupFails = true;

      const response = await handler(productionRequest(path, jar));

      assert.equal(response.headers.get("location"), `https://${PUBLIC_HOST}/dashboard`);
      jar.apply(response);
      assert.deepEqual(jar.authCookies("shared-domain"), [
        `${SUPABASE_AUTH_COOKIE_NAME}.0`,
        `${SUPABASE_AUTH_COOKIE_NAME}.1`,
      ]);
    });
  }

  it("OAuth callback keeps the new session beside a cookie with an unreadable expiry", async () => {
    const jar = new ScopedJar();
    plant(
      jar,
      {
        ...storedSession({ refreshToken: "old-shared-refresh-token", expiresIn: 3600 }),
        /* `Number()` throws on this; inventory must not. */
        expires_at: { valueOf: null, toString: null },
      },
      "shared-domain",
    );

    const response = await productionSignIn(jar);

    assert.equal(response.status, 307);
    assert.deepEqual(jar.authCookies("shared-domain"), [
      `${SUPABASE_AUTH_COOKIE_NAME}.0`,
      `${SUPABASE_AUTH_COOKIE_NAME}.1`,
    ]);
  });

  it("email confirmation without a session goes to /login and writes no session", async () => {
    const jar = new ScopedJar();
    verifyWithoutSession = true;

    const response = await confirmEmail(
      productionRequest(
        "/auth/confirm?token_hash=fake-token-hash&type=email&next=%2Fdashboard",
        jar,
      ),
    );

    assert.match(response.headers.get("location") ?? "", /\/login\?/);
    jar.apply(response);
    assert.deepEqual(jar.authCookies("shared-domain"), []);
    assert.deepEqual(jar.authCookies("host-only"), []);
  });
});

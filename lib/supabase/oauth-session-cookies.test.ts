import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { NextRequest, NextResponse } from "next/server";

import { GET as oauthCallback } from "../../app/auth/callback/route";
import { proxy } from "../../proxy";
import {
  mergeSupabaseCookieOptions,
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

function fakeAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      sub: "00000000-0000-4000-8000-000000000001",
      aud: "authenticated",
      role: "authenticated",
      iat: now,
      exp: now + 3600,
      session_id: "00000000-0000-4000-8000-000000000002",
    }),
  );

  return `${header}.${payload}.fake-signature`;
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

describe("OAuth session cookies survive callback → proxy", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  let accessToken: string;
  let validatedTokens: string[];

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake-anon-key";
    accessToken = fakeAccessToken();
    validatedTokens = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        });

      if (url.pathname === "/auth/v1/token") {
        const body = JSON.parse(String(init?.body ?? "{}"));

        if (
          url.searchParams.get("grant_type") !== "pkce" ||
          body.code_verifier !== FAKE_VERIFIER
        ) {
          return json({ error: "invalid_grant" }, 400);
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
        const authorization = new Headers(init?.headers).get("authorization");
        const token = authorization?.replace(/^Bearer /, "") ?? "";

        validatedTokens.push(token);

        return token === accessToken
          ? json(fakeOAuthUser())
          : json({ message: "invalid JWT" }, 401);
      }

      return json({ message: "unexpected request" }, 404);
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnv.key;
  });

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

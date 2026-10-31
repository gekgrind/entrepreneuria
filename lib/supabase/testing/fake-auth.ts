import { createChunks, stringToBase64URL } from "@supabase/ssr";

import { SUPABASE_AUTH_COOKIE_NAME } from "../cookie-options";

import type { Scope, ScopedJar } from "./scoped-jar";

/*
 * A stubbed Supabase Auth API, just faithful enough for the hub's
 * session cookies: refresh tokens rotate and a spent one is refused,
 * access tokens are accepted only if issued here and unexpired, and
 * every request is recorded. All tokens are fake, unsigned placeholders.
 */

export const SUPABASE_URL = "https://project-ref.supabase.co";
export const KEY = SUPABASE_AUTH_COOKIE_NAME;
export const USER_A = "00000000-0000-4000-8000-00000000000a";
export const USER_B = "00000000-0000-4000-8000-00000000000b";

const b64 = (value: string) => Buffer.from(value).toString("base64url");
const now = () => Math.floor(Date.now() / 1000);

export type FakeSession = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
  expires_at: number;
  user: { id: string; aud: string; role: string; email: string; user_metadata: Record<string, unknown> };
};

export type Failure = "timeout" | 500 | 503 | 429 | null;

export class FakeAuth {
  calls: { path: string; grant: string | null; bearer: string | null; body: Record<string, unknown> }[] = [];
  /** How /token and /user answer while set. */
  failure: Failure = null;
  private refreshOwners = new Map<string, string>();
  private spent = new Set<string>();
  private issued = new Set<string>();
  private counter = 0;
  /** PKCE codes and email token hashes, mapped to the user they sign in. */
  codes = new Map<string, { userId: string; verifier: string }>();
  tokenHashes = new Map<string, string>();
  passwords = new Map<string, string>();

  session(userId: string, { expiresIn = 3600, padding = 0 } = {}): FakeSession {
    const id = (this.counter += 1);
    const exp = now() + expiresIn;
    const access_token = [
      b64(JSON.stringify({ alg: "HS256", typ: "JWT" })),
      b64(JSON.stringify({ sub: userId, aud: "authenticated", role: "authenticated", exp, session_id: `s-${userId}` })),
      b64(`fake-signature-${id}`),
    ].join(".");
    const refresh_token = `refresh-${userId.slice(-1)}-${id}`;

    this.issued.add(access_token);
    this.refreshOwners.set(refresh_token, userId);

    return {
      access_token,
      refresh_token,
      token_type: "bearer",
      expires_in: expiresIn,
      expires_at: exp,
      user: {
        id: userId,
        aud: "authenticated",
        role: "authenticated",
        email: `${userId.slice(-1)}@example.com`,
        user_metadata: { padding: "x".repeat(padding) },
      },
    };
  }

  /** Cookie name/value pairs @supabase/ssr would store for `value`. */
  static cookies(value: unknown) {
    return createChunks(KEY, `base64-${stringToBase64URL(JSON.stringify(value))}`);
  }

  static store(jar: ScopedJar, value: unknown, scope: Scope) {
    for (const { name, value: chunk } of FakeAuth.cookies(value)) {
      jar.set(name, chunk, scope);
    }
  }

  isIssued(token: string) {
    return this.issued.has(token);
  }

  tokenCalls(grant?: string) {
    return this.calls.filter((call) => call.path === "/auth/v1/token" && (!grant || call.grant === grant));
  }

  install() {
    const original = globalThis.fetch;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));

      if (url.origin !== SUPABASE_URL) {
        return original(input, init);
      }

      const headers = new Headers(init?.headers);
      const bearer = headers.get("authorization")?.replace(/^Bearer /, "") ?? null;
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const grant = url.searchParams.get("grant_type");
      const json = (payload: unknown, status = 200) =>
        new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });

      this.calls.push({ path: url.pathname, grant, bearer, body });

      if (this.failure && (url.pathname === "/auth/v1/token" || url.pathname === "/auth/v1/user")) {
        if (this.failure === "timeout") {
          throw new TypeError("fetch failed");
        }

        return json({ message: "unavailable" }, this.failure);
      }

      if (url.pathname === "/auth/v1/token" && grant === "refresh_token") {
        const owner = this.refreshOwners.get(body.refresh_token);

        if (!owner || this.spent.has(body.refresh_token)) {
          return json({ code: "refresh_token_not_found", error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" }, 400);
        }

        this.spent.add(body.refresh_token);
        return json(this.session(owner));
      }

      if (url.pathname === "/auth/v1/token" && grant === "pkce") {
        const code = this.codes.get(body.auth_code);

        if (!code || code.verifier !== body.code_verifier) {
          return json({ error_code: "bad_code_verifier", msg: "invalid" }, 400);
        }

        this.codes.delete(body.auth_code);
        return json(this.session(code.userId, { padding: 4000 }));
      }

      if (url.pathname === "/auth/v1/token" && grant === "password") {
        const userId = this.passwords.get(`${body.email}:${body.password}`);

        return userId
          ? json(this.session(userId))
          : json({ error_code: "invalid_credentials", msg: "Invalid login credentials" }, 400);
      }

      if (url.pathname === "/auth/v1/verify") {
        const userId = this.tokenHashes.get(body.token_hash);

        if (!userId) {
          return json({ error_code: "otp_expired", msg: "expired" }, 403);
        }

        this.tokenHashes.delete(body.token_hash);
        return json(this.session(userId));
      }

      if (url.pathname === "/auth/v1/user" || url.pathname === "/auth/v1/logout") {
        const payload = bearer ? JSON.parse(Buffer.from(bearer.split(".")[1] ?? "", "base64url").toString() || "{}") : {};

        if (!bearer || !this.issued.has(bearer) || payload.exp <= now()) {
          return json({ error_code: "bad_jwt", msg: "invalid JWT" }, 403);
        }

        return url.pathname === "/auth/v1/user"
          ? json({ id: payload.sub, aud: "authenticated", role: "authenticated", email: `${String(payload.sub).slice(-1)}@example.com` })
          : new Response(null, { status: 204 });
      }

      return json({ message: `unexpected ${url.pathname}` }, 404);
    }) as typeof fetch;

    return () => {
      globalThis.fetch = original;
    };
  }
}

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";

import { NextRequest } from "next/server";

import { GET as oauthCallback } from "../../app/auth/callback/route";
import { GET as emailConfirm } from "../../app/auth/confirm/route";
import { POST as signOut } from "../../app/auth/signout/route";
import { proxy } from "../../proxy";
import {
  AUTH_CODE_VERIFIER_COOKIE_NAME,
  classifyAuthCookies,
  createAuthFetchObserver,
  parseCookieHeader,
  refuseRefreshGrants,
} from "./auth-cookies";
import { createServerClient } from "@supabase/ssr";

import { createHubBrowserClient, selectBrowserCookies } from "./client";
import { FakeAuth, KEY, SUPABASE_URL, USER_A, USER_B } from "./testing/fake-auth";
import { ScopedJar } from "./testing/scoped-jar";

/*
 * Adversarial coverage for the structural cookie migration (plan H1/H1b).
 *
 * The real proxy and auth routes run against a fake Auth API, with a
 * browser jar that keeps host-only and `.entrepreneuria.io` copies apart
 * the way a browser does. Requests arrive at the `next start` bind
 * address, as they do behind nginx, with the public Host header.
 */

const BIND = "http://localhost:3000";
const HOST = "entrepreneuria.io";
const SIBLING = "channelwright.entrepreneuria.io";

let auth: FakeAuth;
let restoreFetch: () => void;
const env = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake-anon-key";
  auth = new FakeAuth();
  restoreFetch = auth.install();
});

afterEach(() => {
  restoreFetch();
  process.env = { ...env };
});

function request(path: string, jar: ScopedJar, init: { method?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(`${BIND}${path}`, {
    method: init.method ?? "GET",
    headers: { host: HOST, cookie: jar.header(path.split("?")[0]), ...init.headers },
  });
}

async function visit(path: string, jar: ScopedJar, init?: Parameters<typeof request>[2]) {
  const response = await proxy(request(path, jar, init));
  jar.apply(response);
  return response;
}

/** What a sibling app on another subdomain reads from the shared jar. */
function siblingSession(jar: ScopedJar) {
  return classifyAuthCookies(parseCookieHeader(jar.header("/", SIBLING)));
}

/** The Cookie header the proxy forwards to the page or route handler. */
function forwardedCookies(response: Response) {
  return parseCookieHeader(response.headers.get("x-middleware-request-cookie"));
}

function familyNames(jar: ScopedJar, scope: "host-only" | "shared-domain") {
  return jar.names(scope, KEY).filter((name) => name !== AUTH_CODE_VERIFIER_COOKIE_NAME);
}

function assertSignedOutEverywhere(jar: ScopedJar) {
  assert.deepEqual(familyNames(jar, "host-only"), []);
  assert.deepEqual(familyNames(jar, "shared-domain"), []);
}

function assertSessionReset(response: Response, path = "/dashboard") {
  assert.equal(response.status, 307);
  const location = new URL(response.headers.get("location")!);
  assert.equal(location.origin, "https://entrepreneuria.io");
  assert.equal(location.pathname, "/login");
  assert.equal(location.searchParams.get("next"), path);
  assert.equal(location.searchParams.get("auth_error"), "session_reset");
}

describe("single valid session", () => {
  it("migrates a host-only session to the shared scope on refresh", async () => {
    const jar = new ScopedJar();
    FakeAuth.store(jar, auth.session(USER_A, { expiresIn: 120, padding: 4000 }), "host-only");

    const response = await visit("/dashboard", jar);

    assert.equal(response.headers.get("location"), null);
    assert.equal(auth.tokenCalls("refresh_token").length, 1);
    /* The rotated session is smaller: its stale chunks go in both scopes. */
    assert.deepEqual(familyNames(jar, "host-only"), []);
    assert.deepEqual(familyNames(jar, "shared-domain"), [KEY]);
    for (const header of response.headers.getSetCookie().filter((h) => !h.includes("Max-Age=0"))) {
      assert.match(header, /Domain=\.entrepreneuria\.io/);
    }

    const sibling = siblingSession(jar);
    assert.equal(sibling.kind, "single");
    assert.equal(sibling.kind === "single" && sibling.session.userId, USER_A);
  });

  it("forwards the refreshed session to the page it serves", async () => {
    const jar = new ScopedJar();
    FakeAuth.store(jar, auth.session(USER_A, { expiresIn: 120 }), "shared-domain");

    const response = await visit("/", jar);
    const forwarded = classifyAuthCookies(forwardedCookies(response));

    assert.equal(forwarded.kind, "single");
    assert.ok(forwarded.kind === "single" && forwarded.session.expiresAt > Date.now() / 1000 + 3000);
  });

  for (const expiresIn of [60, -10]) {
    it(`exchanges a token ${expiresIn < 0 ? "already expired" : "inside the SDK margin"} exactly once`, async () => {
      const jar = new ScopedJar();
      const session = auth.session(USER_A, { expiresIn });
      FakeAuth.store(jar, session, "shared-domain");

      const response = await visit("/dashboard", jar);

      assert.equal(response.headers.get("location"), null);
      assert.deepEqual(
        auth.tokenCalls("refresh_token").map((call) => call.body.refresh_token),
        [session.refresh_token],
      );
      const sibling = siblingSession(jar);
      assert.ok(sibling.kind === "single" && sibling.session.refreshToken !== session.refresh_token);
    });
  }

  it("persists a completed rotation when the identity check then hits an outage", async () => {
    const jar = new ScopedJar();
    const session = auth.session(USER_A, { expiresIn: 120 });
    FakeAuth.store(jar, session, "shared-domain");
    auth.failure = 503;
    auth.failureOn = new Set(["/auth/v1/user"]);

    const response = await visit("/dashboard", jar);

    assert.equal(new URL(response.headers.get("location")!).searchParams.get("auth_error"), "unavailable");
    const sibling = siblingSession(jar);
    assert.ok(sibling.kind === "single" && sibling.session.refreshToken !== session.refresh_token);

    auth.failure = null;
    assert.equal((await visit("/dashboard", jar)).headers.get("location"), null);
  });

  it("leaves a fresh session alone and makes no refresh", async () => {
    const jar = new ScopedJar();
    FakeAuth.store(jar, auth.session(USER_A), "shared-domain");

    const response = await visit("/dashboard", jar);

    assert.equal(response.headers.get("location"), null);
    assert.equal(auth.tokenCalls().length, 0);
    assert.deepEqual(response.headers.getSetCookie(), []);
  });
});

describe("duplicate shared and host-only cookies", () => {
  it("drops the host-only copy of identical bytes without asking the Auth API", async () => {
    const jar = new ScopedJar();
    const session = auth.session(USER_A, { padding: 4000 });
    FakeAuth.store(jar, session, "host-only");
    FakeAuth.store(jar, session, "shared-domain");

    const response = await visit("/", jar);

    assert.equal(auth.calls.length, 0);
    assert.deepEqual(familyNames(jar, "host-only"), []);
    assert.deepEqual(familyNames(jar, "shared-domain"), [`${KEY}.0`, `${KEY}.1`]);
    assert.equal(response.headers.getSetCookie().every((h) => !h.includes("Domain=")), true);
  });

  for (const order of ["host-only first", "shared first"] as const) {
    it(`signs out two generations of one account (${order}) without probing either`, async () => {
      const jar = new ScopedJar();
      const older = auth.session(USER_A);
      const newer = auth.session(USER_A);
      const [first, second] = order === "host-only first" ? ["host-only", "shared-domain"] as const : ["shared-domain", "host-only"] as const;
      FakeAuth.store(jar, older, first);
      FakeAuth.store(jar, newer, second);

      const response = await visit("/dashboard", jar);

      assertSessionReset(response);
      assert.equal(auth.calls.length, 0);
      assertSignedOutEverywhere(jar);
    });
  }
});

describe("two different authenticated accounts", () => {
  for (const path of ["/dashboard", "/"]) {
    it(`serves neither account on ${path}`, async () => {
      const jar = new ScopedJar();
      FakeAuth.store(jar, auth.session(USER_A), "host-only");
      FakeAuth.store(jar, auth.session(USER_B), "shared-domain");

      const response = await visit(path, jar);

      assert.equal(auth.calls.length, 0);
      assertSignedOutEverywhere(jar);

      if (path === "/dashboard") {
        assertSessionReset(response);
      } else {
        assert.deepEqual(
          forwardedCookies(response).filter(({ name }) => name.startsWith(KEY)),
          [],
        );
      }
    });
  }
});

describe("mixed access and refresh token fragments", () => {
  /* Chunks are 3180-character slices of one base64 value, and both
     tokens and the user id sit in the first, so a stitched family is at
     worst the first chunk's own session with someone else's metadata. */
  it("never uses the other account's credentials from a stitched family", async () => {
    const jar = new ScopedJar();
    const a = auth.session(USER_A, { expiresIn: 120, padding: 4000 });
    const b = auth.session(USER_B, { padding: 5000 });
    const [a0] = FakeAuth.cookies(a);
    const [, b1] = FakeAuth.cookies(b);
    jar.set(a0.name, a0.value, "host-only");
    jar.set(b1.name, b1.value, "shared-domain");

    const response = await visit("/dashboard", jar);

    /* Either outcome is safe — A's own session, or a fresh sign-in — as
       long as nothing of B's is presented or served. */
    const sent = JSON.stringify(auth.calls);
    assert.equal(sent.includes(b.refresh_token) || sent.includes(b.access_token), false);
    for (const call of auth.tokenCalls("refresh_token")) {
      assert.equal(call.body.refresh_token, a.refresh_token);
    }
    const sibling = siblingSession(jar);
    assert.notEqual(sibling.kind === "single" && sibling.session.userId, USER_B);
    if (response.headers.get("location")) {
      assertSessionReset(response);
    }
  });

  it("treats a bare cookie next to numbered chunks as a conflict", async () => {
    const jar = new ScopedJar();
    FakeAuth.store(jar, auth.session(USER_A, { padding: 4000 }), "shared-domain");
    FakeAuth.store(jar, auth.session(USER_A), "host-only");

    assertSessionReset(await visit("/dashboard", jar));
    assert.equal(auth.calls.length, 0);
  });

  it("rejects a refresh that returns another account", async () => {
    const jar = new ScopedJar();
    const a = auth.session(USER_A, { expiresIn: 120 });
    const b = auth.session(USER_B);
    /* A's access token and identity, B's refresh token, in one value. */
    FakeAuth.store(jar, { ...a, refresh_token: b.refresh_token }, "shared-domain");

    const response = await visit("/dashboard", jar);

    assertSessionReset(response);
    assertSignedOutEverywhere(jar);
    assert.equal(siblingSession(jar).kind, "none");
  });

  it("rejects a value whose cached user is not its token's subject", async () => {
    const jar = new ScopedJar();
    const a = auth.session(USER_A);
    FakeAuth.store(jar, { ...a, user: { ...a.user, id: USER_B } }, "shared-domain");

    assertSessionReset(await visit("/dashboard", jar));
    assert.equal(auth.calls.length, 0);
  });
});

describe("missing or partial cookie chunks", () => {
  const cases: [string, (jar: ScopedJar) => void][] = [
    ["a missing .0", (jar) => {
      const [, c1] = FakeAuth.cookies(auth.session(USER_A, { padding: 4000 }));
      jar.set(c1.name, c1.value, "shared-domain");
    }],
    ["a gap", (jar) => {
      const [c0, , c2] = FakeAuth.cookies(auth.session(USER_A, { padding: 7000 }));
      jar.set(c0.name, c0.value, "shared-domain");
      jar.set(c2.name, c2.value, "shared-domain");
    }],
    ["an orphan .2", (jar) => {
      FakeAuth.store(jar, auth.session(USER_A, { padding: 4000 }), "shared-domain");
      jar.set(`${KEY}.2`, "stale", "host-only");
    }],
    ["an undecodable value", (jar) => jar.set(KEY, "base64-not-json", "shared-domain")],
    ["a JWT whose payload is null", (jar) => {
      const a = auth.session(USER_A);
      FakeAuth.store(jar, { ...a, access_token: "e30.bnVsbA.c2ln" }, "shared-domain");
    }],
    ["an expires_at that disagrees with the JWT", (jar) => {
      const a = auth.session(USER_A);
      FakeAuth.store(jar, { ...a, expires_at: a.expires_at - 3500 }, "shared-domain");
    }],
  ];

  for (const [label, arrange] of cases) {
    it(`asks for a fresh sign-in on ${label}`, async () => {
      const jar = new ScopedJar();
      arrange(jar);

      assertSessionReset(await visit("/dashboard", jar));
      assert.equal(auth.calls.length, 0);
      assertSignedOutEverywhere(jar);
    });
  }
});

describe("Supabase outages", () => {
  for (const failure of ["timeout", 500, 503, 429] as const) {
    it(`keeps both scopes on a ${failure} during refresh`, async () => {
      const jar = new ScopedJar();
      const session = auth.session(USER_A, { expiresIn: 120 });
      FakeAuth.store(jar, session, "shared-domain");
      FakeAuth.store(jar, session, "host-only");
      auth.failure = failure;

      const response = await visit("/dashboard", jar);

      assert.equal(new URL(response.headers.get("location")!).searchParams.get("auth_error"), "unavailable");
      assert.deepEqual(response.headers.getSetCookie(), []);
      assert.ok(familyNames(jar, "shared-domain").length > 0);
      assert.ok(familyNames(jar, "host-only").length > 0);

      /* Once the API is back, the same session refreshes and migrates. */
      auth.failure = null;
      const recovered = await visit("/dashboard", jar);

      assert.equal(recovered.headers.get("location"), null);
      assert.deepEqual(familyNames(jar, "host-only"), []);
      assert.equal(siblingSession(jar).kind, "single");
    });
  }

  it("expires both scopes on a definitive refusal", async () => {
    const jar = new ScopedJar();
    const session = auth.session(USER_A, { expiresIn: 120 });
    FakeAuth.store(jar, { ...session, refresh_token: "refresh-unknown" }, "shared-domain");

    const response = await visit("/dashboard", jar);

    assert.equal(response.status, 307);
    assertSignedOutEverywhere(jar);
  });
});

describe("browser-side client", () => {
  function browser(jar: ScopedJar) {
    return createHubBrowserClient({
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: "fake-anon-key",
      hostname: HOST,
      readCookies: () => jar.header("/"),
      writeCookie: (header) => jar.apply(new Response(null, { headers: { "set-cookie": header } })),
    });
  }

  it("hides a conflicting family", () => {
    const jar = new ScopedJar();
    FakeAuth.store(jar, auth.session(USER_A), "host-only");
    FakeAuth.store(jar, auth.session(USER_B), "shared-domain");

    assert.deepEqual(selectBrowserCookies(parseCookieHeader(jar.header("/"))), []);
  });

  it("never refreshes a near-expiry session, even an A/B pair", async () => {
    const jar = new ScopedJar();
    const a = auth.session(USER_A, { expiresIn: 60 });
    const b = auth.session(USER_B);
    FakeAuth.store(jar, { ...a, refresh_token: b.refresh_token }, "shared-domain");
    const before = jar.header("/");

    const { data } = await browser(jar).auth.getSession();

    assert.equal(data.session, null);
    assert.equal(auth.tokenCalls().length, 0);
    assert.equal(jar.header("/"), before);
  });

  it("hides a far-future JWT whose expires_at is near", async () => {
    const jar = new ScopedJar();
    const a = auth.session(USER_A);
    FakeAuth.store(jar, { ...a, expires_at: Math.floor(Date.now() / 1000) + 30 }, "shared-domain");

    const { data } = await browser(jar).auth.getSession();

    assert.equal(data.session, null);
    assert.equal(auth.tokenCalls().length, 0);
  });

  it("refuses a refresh grant before it leaves the browser", async () => {
    await assert.rejects(
      refuseRefreshGrants(fetch)(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, { method: "POST" }),
      TypeError,
    );
    assert.equal(auth.calls.length, 0);
  });

  it("writes a password sign-in as scope pairs and expires stale names", async () => {
    const jar = new ScopedJar();
    FakeAuth.store(jar, auth.session(USER_B, { padding: 7000 }), "host-only");
    auth.passwords.set("a@example.com:pw", USER_A);

    const { error } = await browser(jar).auth.signInWithPassword({ email: "a@example.com", password: "pw" });

    assert.equal(error, null);
    assert.deepEqual(familyNames(jar, "host-only"), []);
    const sibling = siblingSession(jar);
    assert.equal(sibling.kind === "single" && sibling.session.userId, USER_A);
  });
});

describe("downstream server client", () => {
  /* Built as lib/supabase/server-client.ts builds it, minus next/headers. */
  function downstream(jar: ScopedJar, writes: unknown[]) {
    const observer = createAuthFetchObserver(refuseRefreshGrants(fetch));

    return createServerClient(SUPABASE_URL, "fake-anon-key", {
      cookieOptions: { name: KEY },
      global: { fetch: observer.fetch },
      cookies: {
        getAll: () => parseCookieHeader(jar.header("/")),
        setAll: (cookies) => {
          writes.push(...cookies);
        },
      },
    });
  }

  it("never refreshes a token that ran out during a slow request", async () => {
    const jar = new ScopedJar();
    const a = auth.session(USER_A, { expiresIn: 60 });
    const b = auth.session(USER_B);
    /* Forwarded by the proxy with time to spare; the request then took
       long enough to cross auth-js's margin. */
    FakeAuth.store(jar, { ...a, refresh_token: b.refresh_token }, "shared-domain");
    const writes: unknown[] = [];

    const { data } = await downstream(jar, writes).auth.getUser();

    assert.equal(data.user, null);
    assert.equal(auth.tokenCalls().length, 0);
    assert.deepEqual(writes, []);
  });

  it("uses the proxy's own refusal in lib/supabase/server-client.ts", () => {
    const source = readFileSync(new URL("./server-client.ts", import.meta.url), "utf8");

    assert.match(source, /createAuthFetchObserver\(refuseRefreshGrants\(fetch\)\)/);
  });
});

describe("OAuth callback", () => {
  const VERIFIER = "pkce-verifier";

  function startFlow(jar: ScopedJar, userId: string) {
    jar.set(AUTH_CODE_VERIFIER_COOKIE_NAME, `base64-${Buffer.from(JSON.stringify(VERIFIER)).toString("base64url")}`, "shared-domain");
    auth.codes.set("code-1", { userId, verifier: VERIFIER });
  }

  async function callback(jar: ScopedJar, query = "code=code-1&next=%2Fdashboard") {
    const response = await oauthCallback(request(`/auth/callback?${query}`, jar));
    jar.apply(response);
    return response;
  }

  it("never sends stored sessions to the Auth API, and supersedes them", async () => {
    const jar = new ScopedJar();
    FakeAuth.store(jar, auth.session(USER_A, { expiresIn: 60, padding: 7000 }), "host-only");
    FakeAuth.store(jar, auth.session(USER_A, { expiresIn: 60 }), "shared-domain");
    startFlow(jar, USER_B);

    const response = await callback(jar);

    assert.equal(response.headers.get("location"), "https://entrepreneuria.io/dashboard");
    assert.equal(auth.tokenCalls("refresh_token").length, 0);
    assert.deepEqual(familyNames(jar, "host-only"), []);
    assert.equal(jar.names("shared-domain", AUTH_CODE_VERIFIER_COOKIE_NAME).length, 0);
    const sibling = siblingSession(jar);
    assert.equal(sibling.kind === "single" && sibling.session.userId, USER_B);
    /* The only token checked is the one the exchange returned. */
    const userCalls = auth.calls.filter((call) => call.path === "/auth/v1/user");
    assert.equal(userCalls.length, 1);

    assert.equal((await visit("/dashboard", jar)).headers.get("location"), null);
  });

  it("replaces a malformed stored session", async () => {
    const jar = new ScopedJar();
    FakeAuth.store(jar, { ...auth.session(USER_A), access_token: "e30.bnVsbA.c2ln" }, "host-only");
    startFlow(jar, USER_B);

    const response = await callback(jar);

    assert.equal(response.headers.get("location"), "https://entrepreneuria.io/dashboard");
    assert.deepEqual(familyNames(jar, "host-only"), []);
    const sibling = siblingSession(jar);
    assert.equal(sibling.kind === "single" && sibling.session.userId, USER_B);
  });

  it("writes no session when the exchange fails", async () => {
    const jar = new ScopedJar();
    FakeAuth.store(jar, auth.session(USER_A), "shared-domain");
    startFlow(jar, USER_B);
    auth.codes.clear();

    const response = await callback(jar);

    assert.equal(new URL(response.headers.get("location")!).searchParams.get("auth_error"), "exchange");
    const sibling = siblingSession(jar);
    assert.equal(sibling.kind === "single" && sibling.session.userId, USER_A);
  });

  it("refuses two different verifiers without calling the Auth API", async () => {
    const jar = new ScopedJar();
    startFlow(jar, USER_B);
    jar.set(AUTH_CODE_VERIFIER_COOKIE_NAME, "base64-other", "host-only");

    const response = await callback(jar);

    assert.equal(new URL(response.headers.get("location")!).searchParams.get("auth_error"), "exchange");
    assert.equal(auth.calls.length, 0);
    assert.equal(jar.names("host-only", AUTH_CODE_VERIFIER_COOKIE_NAME).length, 0);
    assert.equal(jar.names("shared-domain", AUTH_CODE_VERIFIER_COOKIE_NAME).length, 0);
  });

  it("is left alone by the proxy", async () => {
    const jar = new ScopedJar();
    FakeAuth.store(jar, auth.session(USER_A), "host-only");
    FakeAuth.store(jar, auth.session(USER_B), "shared-domain");

    for (const path of ["/auth/callback?code=x", "/auth/confirm?token_hash=x&type=signup", "/auth/signout"]) {
      const response = await proxy(request(path, jar));
      assert.deepEqual(response.headers.getSetCookie(), [], path);
    }
  });
});

describe("email confirmation", () => {
  it("does not sign a victim's browser into the link sender's account", async () => {
    const jar = new ScopedJar();
    FakeAuth.store(jar, auth.session(USER_A), "shared-domain");
    const before = jar.header("/");
    auth.tokenHashes.set("attacker-hash", USER_B);

    const response = await emailConfirm(request("/auth/confirm?token_hash=attacker-hash&type=signup", jar));
    jar.apply(response);

    assert.deepEqual(response.headers.getSetCookie(), []);
    assert.equal(jar.header("/"), before);
    const location = new URL(response.headers.get("location")!);
    assert.equal(location.pathname, "/login");
    assert.equal(location.searchParams.get("confirmed"), "1");
    /* The session the link minted was revoked, with its own token. */
    const logout = auth.calls.find((call) => call.path === "/auth/v1/logout");
    assert.ok(logout?.bearer && auth.isIssued(logout.bearer));
  });
});

describe("hostile forwarded headers", () => {
  for (const headers of [
    { host: "evil.example" } as Record<string, string>,
    { host: "localhost:3000" },
    { host: HOST, "x-forwarded-host": "evil.example" },
    { host: HOST, "x-forwarded-host": "evil.example, entrepreneuria.io" },
    { host: "user@entrepreneuria.io" },
  ]) {
    it(`keeps the shared scope and public origin for ${JSON.stringify(headers)}`, async () => {
      process.env = { ...process.env, NODE_ENV: "production" };
      const jar = new ScopedJar();
      FakeAuth.store(jar, auth.session(USER_A), "host-only");
      FakeAuth.store(jar, auth.session(USER_B), "shared-domain");

      const response = await proxy(new NextRequest(`${BIND}/dashboard`, {
        headers: { ...headers, cookie: jar.header("/dashboard") },
      }));

      assert.equal(new URL(response.headers.get("location")!).origin, "https://entrepreneuria.io");
      assert.ok(response.headers.getSetCookie().some((h) => h.includes("Domain=.entrepreneuria.io")));
    });
  }
});

describe("reauthentication after an ambiguous migration", () => {
  it("accepts the fresh sign-in that follows a session reset", async () => {
    const jar = new ScopedJar();
    FakeAuth.store(jar, auth.session(USER_A), "host-only");
    FakeAuth.store(jar, auth.session(USER_A), "shared-domain");
    assertSessionReset(await visit("/dashboard", jar));

    auth.passwords.set("a@example.com:pw", USER_A);
    const client = createHubBrowserClient({
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: "fake-anon-key",
      hostname: HOST,
      readCookies: () => jar.header("/"),
      writeCookie: (header) => jar.apply(new Response(null, { headers: { "set-cookie": header } })),
    });
    await client.auth.signInWithPassword({ email: "a@example.com", password: "pw" });

    const response = await visit("/dashboard", jar);

    assert.equal(response.headers.get("location"), null);
    assert.equal(siblingSession(jar).kind, "single");
  });
});

describe("sign-out", () => {
  async function postSignOut(jar: ScopedJar) {
    const response = await signOut(request("/auth/signout", jar, { method: "POST" }));
    jar.apply(response);
    return response;
  }

  it("revokes with the stored access token only, never refreshing an A/B pair", async () => {
    const jar = new ScopedJar();
    const a = auth.session(USER_A, { expiresIn: 30 });
    const b = auth.session(USER_B);
    FakeAuth.store(jar, { ...a, refresh_token: b.refresh_token }, "shared-domain");
    FakeAuth.store(jar, { ...a, refresh_token: b.refresh_token }, "host-only");

    const response = await postSignOut(jar);

    assert.equal(response.status, 303);
    assert.equal(auth.tokenCalls().length, 0);
    const logouts = auth.calls.filter((call) => call.path === "/auth/v1/logout");
    assert.deepEqual(logouts.map((call) => call.bearer), [a.access_token]);
    assert.ok(auth.calls.every((call) => JSON.stringify(call.body).indexOf(b.refresh_token) === -1));
    assertSignedOutEverywhere(jar);
  });

  it("makes no Auth API call on a conflict and still clears both scopes", async () => {
    const jar = new ScopedJar();
    FakeAuth.store(jar, auth.session(USER_A), "host-only");
    FakeAuth.store(jar, auth.session(USER_B), "shared-domain");

    await postSignOut(jar);

    assert.equal(auth.calls.length, 0);
    assertSignedOutEverywhere(jar);
  });

  it("clears a malformed session without an Auth API call", async () => {
    const jar = new ScopedJar();
    FakeAuth.store(jar, { ...auth.session(USER_A), access_token: "e30.bnVsbA.c2ln" }, "shared-domain");

    const response = await postSignOut(jar);

    assert.equal(response.status, 303);
    assert.equal(auth.calls.length, 0);
    assertSignedOutEverywhere(jar);
  });

  it("imports no Supabase client and never touches cookies()", () => {
    const source = readFileSync(new URL("../../app/auth/signout/route.ts", import.meta.url), "utf8");

    assert.doesNotMatch(source, /@supabase\/(ssr|supabase-js)|server-client|next\/headers/);
  });
});

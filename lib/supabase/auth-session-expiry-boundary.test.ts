import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest } from "next/server";

import { GET as sessionCheck } from "../../app/api/auth/session/route";
import { proxy } from "../../proxy";
import {
  AUTH_SESSION_STATE_HEADER,
  createAuthFetchObserver,
  keepSessionThroughOutage,
} from "./auth-fetch";
import { BROWSER_SESSION_CUTOFF_SECONDS, parseCookieHeader } from "./browser-cookies";
import { getSupabaseCookieOptions } from "./cookie-options";
import { createHubBrowserClient, refreshSessionThroughServer } from "./client";
import {
  KEY,
  SUPABASE_URL,
  installFakeAuthApi,
  plant,
  type FakeAuthApi,
} from "./testing/fake-auth-api";
import { PUBLIC_HOST, ScopedJar } from "./testing/scoped-jar";

/*
 * The browser client hides a session with less than
 * BROWSER_SESSION_CUTOFF_SECONDS (120 s) left, because it never refreshes
 * one and auth-js would try inside its 90 s margin. The proxy is the only
 * refresher, so it must rotate such a session before the browser needs
 * it — not only inside auth-js's own 90 s margin. Between 90 and 120 s a
 * session used to be valid on the server yet invisible to the browser:
 * the password-reset page then called a live recovery session expired.
 *
 * The clock is frozen on a whole second, so "120 s left" is exactly that
 * for the proxy, auth-js and the browser alike.
 */

const LOCAL_URL = "http://localhost:3000";
const SESSION_A = "00000000-0000-4000-8000-0000000000aa";
const FROZEN_MS = 1_900_000_000_000;

let api: FakeAuthApi;
/* What the server's fetch reaches: the fake Auth API, unless a test
   puts something in front of it. */
let serverFetch: typeof fetch;
/* The server's clock relative to the frozen one (the browser's). */
let serverDelayMs: number;
/* Every path the browser sent through the proxy. */
let proxiedPaths: string[];
const originalFetch = globalThis.fetch;
const realNow = Date.now;
const originalEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

beforeEach(() => {
  Date.now = () => FROZEN_MS;
  api = installFakeAuthApi();
  serverFetch = api.fetchStub;
  serverDelayMs = 0;
  proxiedPaths = [];
  globalThis.fetch = api.fetchStub;
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake-anon-key";
});

afterEach(() => {
  Date.now = realNow;
  globalThis.fetch = originalFetch;
  for (const [name, value] of [
    ["NEXT_PUBLIC_SUPABASE_URL", originalEnv.url],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", originalEnv.key],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function request(path: string, jar: ScopedJar) {
  return new NextRequest(`${LOCAL_URL}${path}`, {
    headers: {
      host: PUBLIC_HOST,
      "x-forwarded-proto": "https",
      cookie: jar.header(new URL(path, LOCAL_URL).pathname),
    },
  });
}

/** A browser over `jar` whose same-origin requests pass through the proxy. */
function browser(jar: ScopedJar) {
  const sentByBrowser: { url: string; method: string; bearer: string | null }[] = [];
  const client = createHubBrowserClient({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: "fake-anon-key",
    hostname: PUBLIC_HOST,
    readCookies: () => jar.header("/"),
    writeCookie: (header) =>
      jar.apply(new Response(null, { headers: { "set-cookie": header } })),
  });
  /* The browser's own Auth API calls, recorded, then sent to the fake. */
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    sentByBrowser.push({
      url,
      method: init?.method ?? "GET",
      bearer: new Headers(init?.headers).get("authorization"),
    });
    return api.fetchStub(input, init);
  }) as typeof fetch;

  /* A same-origin request: the proxy, then the route handler behind it,
     whose response carries the proxy's headers and cookies. */
  const viaProxy = (async (input: RequestInfo | URL) => {
    const path = String(input);
    /* The proxy's own Auth API calls are not the browser's, and it runs
       on the server's clock. */
    const browserFetch = globalThis.fetch;
    const browserNow = Date.now;
    globalThis.fetch = serverFetch;
    Date.now = () => FROZEN_MS + serverDelayMs;
    try {
      const middleware = await proxy(request(path, jar));
      jar.apply(middleware);
      assert.equal(middleware.headers.get("location"), null);
      assert.equal(new URL(path, LOCAL_URL).pathname, "/api/auth/session");
      proxiedPaths.push(path);
      const handled = sessionCheck();
      const headers = new Headers(handled.headers);
      const state = middleware.headers.get(AUTH_SESSION_STATE_HEADER);
      if (state) headers.set(AUTH_SESSION_STATE_HEADER, state);
      return new Response(null, { status: handled.status, headers });
    } finally {
      globalThis.fetch = browserFetch;
      Date.now = browserNow;
    }
  }) as typeof fetch;

  const readCookies = () => jar.header("/");

  return { client, sentByBrowser, viaProxy, readCookies };
}

/* Issued on the server's clock: `expiresIn` is what the server sees. */
function plantSession(jar: ScopedJar, expiresIn: number, refreshLive = true) {
  const browserNow = Date.now;
  Date.now = () => FROZEN_MS + serverDelayMs;
  let session: ReturnType<FakeAuthApi["generation"]>;
  try {
    session = api.generation({ sessionId: SESSION_A, expiresIn, bulky: true, refreshLive });
  } finally {
    Date.now = browserNow;
  }
  plant(jar, session, "shared-domain");
  return session;
}

const refreshGrants = (sent: { url: string }[]) =>
  sent.filter(({ url }) => url.includes("grant_type=refresh_token"));

describe("the browser never holds a session the server has not refreshed", () => {
  assert.equal(BROWSER_SESSION_CUTOFF_SECONDS, 120);

  for (const [secondsLeft, refreshes] of [
    [125, false],
    [124, true],
    [120, true],
    [119, true],
    [105, true],
    [91, true],
    [90, true],
    [89, true],
    [-60, true],
  ] as const) {
    it(`${secondsLeft} s left: ${refreshes ? "refreshed once by the server" : "left alone"}, and the browser sees a session`, async () => {
      const jar = new ScopedJar();
      const planted = plantSession(jar, secondsLeft);
      const { client, sentByBrowser, viaProxy, readCookies } = browser(jar);

      /* Page load: the reset page asks the server before it looks. */
      const server = await refreshSessionThroughServer({ fetchImpl: viaProxy, readCookies });
      const { data } = await client.auth.getSession();

      assert.equal(server, "ok");
      assert.equal(api.state.refreshCalls, refreshes ? 1 : 0);
      assert.ok(data.session, "the browser sees a session");
      assert.equal(
        data.session.access_token === planted.access_token,
        !refreshes,
        refreshes ? "a fresh session" : "the original session",
      );
      if (refreshes) {
        assert.ok(
          (data.session.expires_at ?? 0) - FROZEN_MS / 1000 >= BROWSER_SESSION_CUTOFF_SECONDS,
        );
      }
      assert.deepEqual(refreshGrants(sentByBrowser), [], "the browser never refreshes");
    });
  }

  it("a refreshed session is not refreshed again on the following requests", async () => {
    const jar = new ScopedJar();
    plantSession(jar, 105);
    const { viaProxy, readCookies } = browser(jar);

    for (let index = 0; index < 4; index += 1) {
      await viaProxy("/api/auth/session");
    }

    assert.equal(api.state.refreshCalls, 1);
  });

  it("a session the server left alone needs no second request", async () => {
    const jar = new ScopedJar();
    plantSession(jar, 125);
    const { client, viaProxy, readCookies } = browser(jar);

    assert.equal(await refreshSessionThroughServer({ fetchImpl: viaProxy, readCookies }), "ok");
    assert.deepEqual(proxiedPaths, ["/api/auth/session"]);
    assert.equal(api.state.refreshCalls, 0);
    assert.ok((await client.auth.getSession()).data.session);
  });

  for (const [label, browserAheadMs] of [
    ["a response that arrives 6 s later", 6_000],
    ["a browser clock 6 s ahead of the server's", 6_000],
    ["a browser clock 4 minutes ahead of the server's", 240_000],
  ] as const) {
    it(`${label}: the browser asks again, and the server refreshes ahead`, async () => {
      const jar = new ScopedJar();
      /* The server judges on its clock; the browser reads later (or its
         clock runs ahead): to it, the session has under 120 s left. */
      serverDelayMs = -browserAheadMs;
      plantSession(jar, 125);
      const { client, sentByBrowser, viaProxy, readCookies } = browser(jar);

      assert.equal(await refreshSessionThroughServer({ fetchImpl: viaProxy, readCookies }), "ok");
      assert.deepEqual(proxiedPaths, ["/api/auth/session", "/api/auth/session?refresh=ahead"]);
      assert.equal(api.state.refreshCalls, 1);
      const { data } = await client.auth.getSession();
      assert.ok(data.session, "visible after the second request");

      const { error } = await client.auth.updateUser({ password: "a-new-password" });
      assert.equal(error, null);
      assert.deepEqual(refreshGrants(sentByBrowser), []);
    });
  }

  it("a browser clock beyond the allowance asks once more, then stops", async () => {
    const jar = new ScopedJar();
    /* 3600 s left to the server is far past the allowance for a browser
       this far ahead: neither request refreshes, and there is no loop. */
    serverDelayMs = -3_500_000;
    plantSession(jar, 3600);
    const { viaProxy, readCookies } = browser(jar);

    assert.equal(await refreshSessionThroughServer({ fetchImpl: viaProxy, readCookies }), "ok");
    assert.equal(proxiedPaths.length, 2);
    assert.equal(api.state.refreshCalls, 0);
  });

  it("a session the server left alone stays visible while the response travels", async () => {
    const jar = new ScopedJar();
    plantSession(jar, 125);
    const { client, viaProxy, readCookies } = browser(jar);

    assert.equal(await refreshSessionThroughServer({ fetchImpl: viaProxy, readCookies }), "ok");
    assert.equal(api.state.refreshCalls, 0);
    /* Up to the lead later, the browser still holds it (120 s left). */
    Date.now = () => FROZEN_MS + 5_000;
    assert.ok((await client.auth.getSession()).data.session);
  });

  it("a protected page at 105 s is served, not sent to /login, and refreshed", async () => {
    const jar = new ScopedJar();
    plantSession(jar, 105);

    const response = await proxy(request("/dashboard", jar));

    assert.equal(response.headers.get("location"), null);
    assert.equal(api.state.refreshCalls, 1);
  });
});

describe("password reset at 105 s left, the previously failing case", () => {
  it("recovery is detected and the new password is submitted with the refreshed session", async () => {
    const jar = new ScopedJar();
    plantSession(jar, 105);
    const { client, sentByBrowser, viaProxy, readCookies } = browser(jar);

    assert.equal(await refreshSessionThroughServer({ fetchImpl: viaProxy, readCookies }), "ok");
    const {
      data: { session },
    } = await client.auth.getSession();
    assert.ok(session, "recovery session detected on load");

    /* Submit: the page asks the server again, then updates the password. */
    assert.equal(await refreshSessionThroughServer({ fetchImpl: viaProxy, readCookies }), "ok");
    const { error } = await client.auth.updateUser({ password: "a-new-password" });

    assert.equal(error, null);
    const update = sentByBrowser.find(
      ({ url, method }) => url.endsWith("/auth/v1/user") && method === "PUT",
    );
    assert.ok(update, "the password update was sent");
    assert.equal(update.bearer, `Bearer ${session.access_token}`);
    assert.deepEqual(refreshGrants(sentByBrowser), []);
  });
});

describe("when the server cannot refresh", () => {
  it("an Auth API outage keeps the session, is reported as unavailable, not as expired", async () => {
    const jar = new ScopedJar();
    plantSession(jar, 105);
    const before = jar.header("/");
    const { client, viaProxy, readCookies } = browser(jar);
    api.state.mode = "unavailable";

    const response = await proxy(request("/api/auth/session", jar));
    jar.apply(response);

    assert.equal(response.headers.get(AUTH_SESSION_STATE_HEADER), "unavailable");
    assert.equal(jar.header("/"), before, "nothing written or removed");

    /* What the reset page then sees: no session, and a server that could
       not reach the Auth API — so it says so instead of "expired". */
    assert.equal(await refreshSessionThroughServer({ fetchImpl: viaProxy, readCookies }), "unavailable");
    const { data } = await client.auth.getSession();
    assert.equal(data.session, null);

    /* Once the Auth API is back, the same session is refreshed. */
    api.state.mode = "up";
    assert.equal(await refreshSessionThroughServer({ fetchImpl: viaProxy, readCookies }), "ok");
    assert.ok((await client.auth.getSession()).data.session);
  });

  it("a server that cannot be reached at all reads as unavailable", async () => {
    const failing = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;

    assert.equal(await refreshSessionThroughServer({ fetchImpl: failing }), "unavailable");
  });

  it("a plain 500 under auth-js's margin keeps the session through the whole request", async () => {
    const jar = new ScopedJar();
    plantSession(jar, 89);
    const before = jar.header("/");
    const { viaProxy, readCookies } = browser(jar);
    /* A bare 500 is not one auth-js retries: it would remove the session. */
    api.state.mode = "gateway-500" as typeof api.state.mode;

    assert.equal(await refreshSessionThroughServer({ fetchImpl: viaProxy, readCookies }), "unavailable");
    assert.equal(jar.header("/"), before, "nothing removed by proxy or handler");
  });

  it("a rotation whose confirmation gets no clear answer is reported, and recovers later", async () => {
    const jar = new ScopedJar();
    plantSession(jar, 105);
    const before = jar.header("/");
    const { client, viaProxy, readCookies } = browser(jar);
    let userAnswers = false;
    serverFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      /* A gateway refusing /user with no GoTrue error code. */
      if (url.endsWith("/auth/v1/user") && !userAnswers) {
        return new Response(JSON.stringify({ message: "blocked" }), { status: 403 });
      }
      return api.fetchStub(input, init);
    }) as typeof fetch;

    assert.equal(await refreshSessionThroughServer({ fetchImpl: viaProxy, readCookies }), "unavailable");
    assert.equal(jar.header("/"), before, "the stored session is unchanged");

    userAnswers = true;
    assert.equal(await refreshSessionThroughServer({ fetchImpl: viaProxy, readCookies }), "ok");
    assert.ok((await client.auth.getSession()).data.session);
  });

  it("a stalled confirmation is cut off and reported, the session kept", async () => {
    const jar = new ScopedJar();
    plantSession(jar, 105);
    const before = jar.header("/");
    const { viaProxy, readCookies } = browser(jar);
    serverFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/auth/v1/user")) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        });
      }
      return api.fetchStub(input, init);
    }) as typeof fetch;
    /* The stub opens no socket; keep the loop alive until the deadline. */
    const keepAlive = setInterval(() => {}, 1000);

    try {
      assert.equal(await refreshSessionThroughServer({ fetchImpl: viaProxy, readCookies }), "unavailable");
    } finally {
      clearInterval(keepAlive);
    }
    assert.equal(jar.header("/"), before);
  });

  it("a server check that never answers gives up as unavailable", async () => {
    const stalled = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as typeof fetch;
    const keepAlive = setInterval(() => {}, 1000);

    try {
      assert.equal(await refreshSessionThroughServer({ fetchImpl: stalled, timeoutMs: 50 }), "unavailable");
    } finally {
      clearInterval(keepAlive);
    }
  });

  it("a refused refresh writes no session and is not reported as an outage", async () => {
    const jar = new ScopedJar();
    plantSession(jar, 105, false);
    const before = jar.header("/");
    const { client, viaProxy, readCookies } = browser(jar);

    assert.equal(await refreshSessionThroughServer({ fetchImpl: viaProxy, readCookies }), "ok");
    assert.equal(jar.header("/"), before, "no new session was written");
    assert.equal((await client.auth.getSession()).data.session, null);
  });

  it("an expired session whose refresh token is gone is rejected and cleared", async () => {
    const jar = new ScopedJar();
    plantSession(jar, -60, false);
    const { client, viaProxy, readCookies } = browser(jar);

    assert.equal(await refreshSessionThroughServer({ fetchImpl: viaProxy, readCookies }), "ok");
    assert.deepEqual(jar.names("shared-domain", KEY), []);
    assert.equal((await client.auth.getSession()).data.session, null);

    const protectedPage = await proxy(request("/dashboard", jar));
    assert.match(protectedPage.headers.get("location") ?? "", /\/login\?next=/);
  });
});

describe("a server client behind the proxy (as /api/auth/user's getUser runs)", () => {
  /* What lib/supabase/server-client.ts builds, over a modelled cookie
     store: that module is server-only and reads next/headers. */
  function serverClient(jar: ScopedJar, guarded: boolean) {
    const observer = createAuthFetchObserver(fetch);
    const writes: { name: string; value: string }[] = [];
    const record = (
      cookiesToSet: { name: string; value: string; options: CookieOptions }[],
    ) => {
      writes.push(...cookiesToSet);
    };
    const client = createServerClient(SUPABASE_URL, "fake-anon-key", {
      cookieOptions: getSupabaseCookieOptions(PUBLIC_HOST),
      global: { fetch: observer.fetch },
      cookies: {
        getAll: () => parseCookieHeader(jar.header("/")),
        setAll: guarded ? keepSessionThroughOutage(observer, record) : record,
      },
    });
    const removals = () => writes.filter(({ value }) => value === "");
    return { client, removals };
  }

  it("keeps the session through a plain 500, where an unguarded client would remove it", async () => {
    for (const guarded of [true, false]) {
      api = installFakeAuthApi();
      globalThis.fetch = api.fetchStub;
      const jar = new ScopedJar();
      plantSession(jar, 89);
      api.state.mode = "gateway-500" as typeof api.state.mode;
      const { client, removals } = serverClient(jar, guarded);

      await client.auth.getUser();

      assert.equal(removals().length > 0, !guarded, guarded ? "kept" : "unguarded removes");
    }
  });

  it("still removes a session the Auth API refused outright", async () => {
    const jar = new ScopedJar();
    plantSession(jar, 89, false);
    const { client, removals } = serverClient(jar, true);

    await client.auth.getUser();

    assert.ok(removals().length > 0);
  });

  it("is the adapter lib/supabase/server-client.ts uses", () => {
    const source = readFileSync(
      join(__dirname, "server-client.ts"),
      "utf8",
    );

    assert.match(source, /global: \{ fetch: observer\.fetch \}/);
    assert.match(source, /setAll: keepSessionThroughOutage\(observer,/);
  });
});

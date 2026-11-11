import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { NextRequest } from "next/server";

import { proxy } from "../../proxy";
import { AUTH_SESSION_STATE_HEADER } from "./auth-fetch";
import { BROWSER_SESSION_CUTOFF_SECONDS } from "./browser-cookies";
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
const originalFetch = globalThis.fetch;
const realNow = Date.now;
const originalEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

beforeEach(() => {
  Date.now = () => FROZEN_MS;
  api = installFakeAuthApi();
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

  const viaProxy = (async (input: RequestInfo | URL) => {
    /* The proxy's own Auth API calls are not the browser's. */
    const browserFetch = globalThis.fetch;
    globalThis.fetch = api.fetchStub;
    try {
      const response = await proxy(request(String(input), jar));
      jar.apply(response);
      return response;
    } finally {
      globalThis.fetch = browserFetch;
    }
  }) as typeof fetch;

  return { client, sentByBrowser, viaProxy };
}

function plantSession(jar: ScopedJar, expiresIn: number, refreshLive = true) {
  const session = api.generation({ sessionId: SESSION_A, expiresIn, bulky: true, refreshLive });
  plant(jar, session, "shared-domain");
  return session;
}

const refreshGrants = (sent: { url: string }[]) =>
  sent.filter(({ url }) => url.includes("grant_type=refresh_token"));

describe("the browser never holds a session the server has not refreshed", () => {
  assert.equal(BROWSER_SESSION_CUTOFF_SECONDS, 120);

  for (const [secondsLeft, refreshes] of [
    [125, false],
    [120, false],
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
      const { client, sentByBrowser, viaProxy } = browser(jar);

      /* Page load: the reset page asks the server before it looks. */
      const server = await refreshSessionThroughServer(viaProxy);
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
    const { viaProxy } = browser(jar);

    for (let index = 0; index < 4; index += 1) {
      await viaProxy("/reset-password");
    }

    assert.equal(api.state.refreshCalls, 1);
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
    const { client, sentByBrowser, viaProxy } = browser(jar);

    assert.equal(await refreshSessionThroughServer(viaProxy), "ok");
    const {
      data: { session },
    } = await client.auth.getSession();
    assert.ok(session, "recovery session detected on load");

    /* Submit: the page asks the server again, then updates the password. */
    assert.equal(await refreshSessionThroughServer(viaProxy), "ok");
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
    const { client, viaProxy } = browser(jar);
    api.state.mode = "unavailable";

    const response = await proxy(request("/api/auth/user", jar));
    jar.apply(response);

    assert.equal(response.headers.get(AUTH_SESSION_STATE_HEADER), "unavailable");
    assert.equal(jar.header("/"), before, "nothing written or removed");

    /* What the reset page then sees: no session, and a server that could
       not reach the Auth API — so it says so instead of "expired". */
    assert.equal(await refreshSessionThroughServer(viaProxy), "unavailable");
    const { data } = await client.auth.getSession();
    assert.equal(data.session, null);

    /* Once the Auth API is back, the same session is refreshed. */
    api.state.mode = "up";
    assert.equal(await refreshSessionThroughServer(viaProxy), "ok");
    assert.ok((await client.auth.getSession()).data.session);
  });

  it("a server that cannot be reached at all reads as unavailable", async () => {
    const failing = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;

    assert.equal(await refreshSessionThroughServer(failing), "unavailable");
  });

  it("a refused refresh writes no session and is not reported as an outage", async () => {
    const jar = new ScopedJar();
    plantSession(jar, 105, false);
    const before = jar.header("/");
    const { client, viaProxy } = browser(jar);

    assert.equal(await refreshSessionThroughServer(viaProxy), "ok");
    assert.equal(jar.header("/"), before, "no new session was written");
    assert.equal((await client.auth.getSession()).data.session, null);
  });

  it("an expired session whose refresh token is gone is rejected and cleared", async () => {
    const jar = new ScopedJar();
    plantSession(jar, -60, false);
    const { client, viaProxy } = browser(jar);

    assert.equal(await refreshSessionThroughServer(viaProxy), "ok");
    assert.deepEqual(jar.names("shared-domain", KEY), []);
    assert.equal((await client.auth.getSession()).data.session, null);

    const protectedPage = await proxy(request("/dashboard", jar));
    assert.match(protectedPage.headers.get("location") ?? "", /\/login\?next=/);
  });
});

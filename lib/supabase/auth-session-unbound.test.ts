import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { NextRequest } from "next/server";

import { POST as signOut } from "../../app/auth/signout/route";
import { proxy } from "../../proxy";
import { SIGN_OUT_PAGE_PATH } from "../auth/session-recovery";
import { readAuthCookieInventory } from "./auth-cookie-cleanup";
import {
  KEY,
  OTHER_USER_ID,
  SUPABASE_URL,
  USER_ID,
  fakeUser,
  installFakeAuthApi,
  plant,
  type FakeAuthApi,
} from "./testing/fake-auth-api";
import { PUBLIC_HOST, ScopedJar } from "./testing/scoped-jar";

/*
 * Grafted-profile sessions: tokens of one sign-in stored beside a cached
 * user that is not the token's subject. They are never a session to
 * serve, but their tokens may still work, so nothing deletes them before
 * the Auth API rules them out, and sign-out revokes them.
 */

const LOCAL_URL = "http://localhost:3000";
const ORIGIN = "https://entrepreneuria.io";
const SESSION_A = "00000000-0000-4000-8000-0000000000aa";
const SESSION_B = "00000000-0000-4000-8000-0000000000bb";

let api: FakeAuthApi;
const originalFetch = globalThis.fetch;
const originalWarn = console.warn;
const originalEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

beforeEach(() => {
  api = installFakeAuthApi();
  globalThis.fetch = api.fetchStub;
  console.warn = () => {};
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake-anon-key";
});

afterEach(() => {
  console.warn = originalWarn;
  globalThis.fetch = originalFetch;
  if (originalEnv.url === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.url;
  }
  if (originalEnv.key === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnv.key;
  }
});

function request(
  path: string,
  jar: ScopedJar,
  { method = "GET", headers = {} }: { method?: string; headers?: Record<string, string> } = {}
) {
  return new NextRequest(`${LOCAL_URL}${path}`, {
    method,
    headers: {
      host: PUBLIC_HOST,
      "x-forwarded-proto": "https",
      cookie: jar.header(new URL(path, LOCAL_URL).pathname),
      ...headers,
    },
  });
}

const logoutRequest = (jar: ScopedJar) =>
  request("/auth/signout", jar, { method: "POST", headers: { origin: ORIGIN } });

const sessionWrites = (response: Response) =>
  response.headers
    .getSetCookie()
    .filter((header) => header.startsWith(KEY) && !/Max-Age=0/.test(header));

/** B's own tokens under A's cached profile. */
function grafted(options: Parameters<FakeAuthApi["generation"]>[0]) {
  return {
    ...api.generation({ userId: OTHER_USER_ID, ...options }),
    user: fakeUser(false, USER_ID),
  };
}

describe("a grafted-profile session alone", () => {
  it("is held for revocation only, by the token's own subject, and is a conflict", () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(jar, grafted({ sessionId: SESSION_B }), "shared-domain");

    const inventory = readAuthCookieInventory(request("/dashboard", jar));

    assert.deepEqual(inventory.candidates, []);
    assert.equal(inventory.revocationOnly.length, 1);
    assert.equal(inventory.revocationOnly[0]?.userId, OTHER_USER_ID);
    assert.equal(inventory.conflict, true);
  });

  for (const [label, expiresIn] of [
    ["with a working access token", 3600],
    ["with an expired access token and a working refresh token", -60],
  ] as const) {
    it(`${label} is never served, refreshed or deleted by a request`, async () => {
      const jar = new ScopedJar(PUBLIC_HOST);
      plant(jar, grafted({ sessionId: SESSION_B, expiresIn }), "shared-domain");
      const before = jar.header();

      const response = await proxy(request("/dashboard", jar));

      assert.equal(
        response.headers.get("location"),
        `${ORIGIN}${SIGN_OUT_PAGE_PATH}?reason=session-unresolved&next=%2Fdashboard`
      );
      assert.equal(api.state.refreshCalls, 0);
      assert.deepEqual(sessionWrites(response), []);
      jar.apply(response);
      assert.equal(jar.header(), before);
      assert.equal(api.isLive(SESSION_B), true);
    });
  }

  it("is retired once the Auth API rules both of its tokens out", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(jar, grafted({ sessionId: SESSION_B, refreshLive: false }), "shared-domain");
    api.revokeSession(SESSION_B);

    const response = await proxy(request("/dashboard", jar));

    assert.match(response.headers.get("location") ?? "", /\/login\?next=/);
    jar.apply(response);
    assert.deepEqual(jar.names("shared-domain", KEY), []);
  });

  it("is revoked by sign-out, which is complete only then", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(jar, grafted({ sessionId: SESSION_B }), "shared-domain");

    const response = await signOut(logoutRequest(jar));

    assert.equal(api.isLive(SESSION_B), false);
    assert.equal(response.headers.get("x-auth-revocation"), "complete");
  });

  it("leaves sign-out incomplete when it cannot be revoked", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(jar, grafted({ sessionId: SESSION_B }), "shared-domain");
    api.state.logoutFailure = 500;

    const response = await signOut(logoutRequest(jar));

    assert.equal(api.isLive(SESSION_B), true);
    assert.equal(response.headers.get("x-auth-revocation"), "incomplete");
  });
});

describe("half a session", () => {
  it("a lone refresh token beside a real session is revoked by sign-out", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(jar, api.generation({ sessionId: SESSION_A, bulky: true }), "shared-domain");
    plant(
      jar,
      {
        ...api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID, expiresIn: -60 }),
        access_token: null,
      },
      "host-only"
    );
    assert.equal(readAuthCookieInventory(request("/dashboard", jar)).revocationOnly.length, 1);

    const response = await signOut(logoutRequest(jar));

    assert.equal(api.isLive(SESSION_A), false);
    assert.equal(api.isLive(SESSION_B), false);
    assert.equal(response.headers.get("x-auth-revocation"), "complete");
  });

  it("a lone access token beside a real session is revoked by sign-out", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(jar, api.generation({ sessionId: SESSION_A, bulky: true }), "shared-domain");
    plant(
      jar,
      {
        ...api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID }),
        refresh_token: null,
      },
      "host-only"
    );

    const response = await signOut(logoutRequest(jar));

    assert.equal(api.isLive(SESSION_A), false);
    assert.equal(api.isLive(SESSION_B), false);
    assert.equal(response.headers.get("x-auth-revocation"), "complete");
  });

  it("alone, it is never refreshed or deleted by a request", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(
      jar,
      {
        ...api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID, expiresIn: -60 }),
        access_token: null,
      },
      "shared-domain"
    );
    const before = jar.header();

    const response = await proxy(request("/dashboard", jar));

    assert.match(response.headers.get("location") ?? "", /\/sign-out\?reason=session-unresolved/);
    assert.equal(api.state.refreshCalls, 0);
    jar.apply(response);
    assert.equal(jar.header(), before);
  });
});

describe("a session split past the assembly budget", () => {
  it("is never served or refreshed, and its cookies stay", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    const encoded = `base64-${Buffer.from(
      JSON.stringify(grafted({ sessionId: SESSION_B, expiresIn: -60 }))
    ).toString("base64url")}`;
    const size = Math.max(1, Math.floor(encoded.length / 70));
    for (let index = 0; index * size < encoded.length; index += 1) {
      jar.set(`${KEY}.${index}`, encoded.slice(index * size, (index + 1) * size), "shared-domain");
    }
    assert.ok(jar.names("shared-domain", KEY).length >= 65);
    const inventory = readAuthCookieInventory(request("/dashboard", jar));
    assert.equal(inventory.candidatesTruncated, true);
    assert.equal(inventory.conflict, true);
    const before = jar.header();

    const response = await proxy(request("/dashboard", jar));

    assert.match(response.headers.get("location") ?? "", /\/sign-out\?reason=session-unresolved/);
    assert.equal(api.state.refreshCalls, 0);
    assert.deepEqual(sessionWrites(response), []);
    jar.apply(response);
    assert.equal(jar.header(), before);
  });
});

describe("a stored session with a field left out", () => {
  function omit(session: Record<string, unknown>, field: string) {
    const { [field]: _omitted, ...rest } = session;
    return rest;
  }

  for (const [label, field, expiresIn] of [
    ["without an access_token", "access_token", -60],
    ["without a refresh_token", "refresh_token", 3600],
    ["without an expires_at", "expires_at", 3600],
  ] as const) {
    it(`${label}, beside a real session, is held and revoked by sign-out`, async () => {
      const jar = new ScopedJar(PUBLIC_HOST);
      plant(jar, api.generation({ sessionId: SESSION_A, bulky: true }), "shared-domain");
      plant(
        jar,
        omit(api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID, expiresIn }), field),
        "host-only"
      );
      const inventory = readAuthCookieInventory(request("/dashboard", jar));
      assert.equal(inventory.revocationOnly.length, 1);
      assert.equal(inventory.conflict, true);

      const hostOnlyBefore = jar.names("host-only", KEY);
      const response = await proxy(request("/dashboard", jar));
      jar.apply(response);
      assert.deepEqual(jar.names("host-only", KEY), hostOnlyBefore);
      assert.equal(api.isLive(SESSION_B), true);

      const signedOut = await signOut(logoutRequest(jar));
      assert.equal(api.isLive(SESSION_A), false);
      assert.equal(api.isLive(SESSION_B), false);
      assert.equal(signedOut.headers.get("x-auth-revocation"), "complete");
    });
  }
});

describe("an expiry no number can be read from", () => {
  /* `Number()` throws on an object whose valueOf/toString are not callable. */
  const hostileExpiry = { valueOf: null, toString: null };

  it("does not fail the request, and sign-out still revokes the session", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(
      jar,
      { ...api.generation({ sessionId: SESSION_A, bulky: true }), expires_at: hostileExpiry },
      "shared-domain"
    );

    assert.doesNotThrow(() => readAuthCookieInventory(request("/dashboard", jar)));
    const response = await proxy(request("/dashboard", jar));
    assert.notEqual(response.status, 500);

    const signedOut = await signOut(logoutRequest(jar));
    assert.equal(api.isLive(SESSION_A), false);
    assert.equal(signedOut.headers.get("x-auth-revocation"), "complete");
  });
});

describe("a grafted-profile session beside a real one", () => {
  function jarWithBoth() {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(jar, api.generation({ sessionId: SESSION_A, bulky: true }), "shared-domain");
    plant(jar, grafted({ sessionId: SESSION_B }), "host-only");
    return jar;
  }

  it("survives an ordinary request untouched, then sign-out revokes it", async () => {
    const jar = jarWithBoth();
    const hostOnlyBefore = jar.names("host-only", KEY);
    assert.ok(hostOnlyBefore.length > 0);

    const response = await proxy(request("/dashboard", jar));
    jar.apply(response);

    assert.deepEqual(jar.names("host-only", KEY), hostOnlyBefore);
    assert.equal(api.isLive(SESSION_B), true);

    const signedOut = await signOut(logoutRequest(jar));

    assert.equal(api.isLive(SESSION_A), false);
    assert.equal(api.isLive(SESSION_B), false);
    assert.equal(signedOut.headers.get("x-auth-revocation"), "complete");
  });

  it("does not stop the real session from refreshing once it is ruled out", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(
      jar,
      api.generation({ sessionId: SESSION_A, expiresIn: 30, bulky: true }),
      "shared-domain"
    );
    plant(jar, grafted({ sessionId: SESSION_B, refreshLive: false }), "host-only");
    api.revokeSession(SESSION_B);

    const response = await proxy(request("/dashboard", jar));

    assert.equal(response.headers.get("location"), null);
    jar.apply(response);
    assert.deepEqual(jar.names("host-only", KEY), []);
    assert.ok(jar.names("shared-domain", KEY).length > 0);
  });
});

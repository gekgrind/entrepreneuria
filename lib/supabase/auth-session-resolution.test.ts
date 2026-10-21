import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { NextRequest } from "next/server";

import { proxy } from "../../proxy";
import { POST as signOut } from "../../app/auth/signout/route";
import { AUTH_NO_STORE_HEADERS } from "./auth-cookie-cleanup";
import {
  KEY,
  SUPABASE_URL,
  installFakeAuthApi,
  plant,
  sessionChunks,
  type FakeAuthApi,
} from "./testing/fake-auth-api";
import { PUBLIC_HOST, ScopedJar, type Scope } from "./testing/scoped-jar";

/*
 * Two genuinely different session generations, one per scope. Next keeps
 * the last value per cookie name, so whichever family the browser sends
 * second is what a name-keyed reader sees — and a deletion derived from
 * it used to be retargeted at the canonical `.entrepreneuria.io` copy.
 * Every generation here has its own access token, refresh token and
 * expiry; the stubbed Auth API judges each one on its own.
 */

const LOCAL_URL = "http://localhost:3000";
const ORIGIN = "https://entrepreneuria.io";
const SIGN_OUT_ROUTE = "/auth/signout";

/* Date.now runs on the real clock plus an offset the tests advance. */
const realNow = Date.now;
let clockOffset = 0;

function advanceClock(ms: number) {
  clockOffset += ms;
  Date.now = () => realNow() + clockOffset;
}

let api: FakeAuthApi;
const originalFetch = globalThis.fetch;
const originalEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

beforeEach(() => {
  api = installFakeAuthApi();
  globalThis.fetch = api.fetchStub;
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake-anon-key";
});

afterEach(() => {
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
  Date.now = realNow;
  clockOffset = 0;
});

const SESSION_A = "00000000-0000-4000-8000-0000000000aa";
const SESSION_B = "00000000-0000-4000-8000-0000000000bb";

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

function logoutRequest(jar: ScopedJar) {
  return request(SIGN_OUT_ROUTE, jar, {
    method: "POST",
    headers: { origin: ORIGIN },
  });
}

function expectUncacheable(response: Response) {
  for (const [key, value] of Object.entries(AUTH_NO_STORE_HEADERS)) {
    assert.equal(response.headers.get(key), value, key);
  }
}

type Stale = "revoked" | "expired-revoked" | "older-generation" | "corrupt";

/** A copy that must never win over the healthy one; null for corrupt chunks. */
function staleCopy(kind: Stale) {
  switch (kind) {
    case "revoked": {
      /* Unexpired JWT of a sign-in revoked server-side: the Auth API
         answers `session_not_found`, which rules it out. */
      const copy = api.generation({
        sessionId: SESSION_B,
        refreshLive: false,
        bulky: true,
      });
      api.revokeSession(SESSION_B);
      return copy;
    }
    case "expired-revoked":
      return api.generation({
        sessionId: SESSION_B,
        expiresIn: -60,
        accessLive: false,
        refreshLive: false,
        bulky: true,
      });
    case "older-generation":
      /* An earlier point of the healthy sign-in's own refresh chain:
         refreshing it would be refresh-token reuse. */
      return api.generation({
        sessionId: SESSION_A,
        expiresIn: -60,
        accessLive: false,
        refreshLive: false,
        consumed: true,
        bulky: true,
      });
    case "corrupt":
      return null;
  }
}

function plantStale(jar: ScopedJar, kind: Stale, scope: Scope) {
  const session = staleCopy(kind);

  if (session) {
    plant(jar, session, scope);
  } else {
    for (const name of [`${KEY}.0`, `${KEY}.1`, `${KEY}.2`]) {
      jar.set(name, "base64-eyJjb3JydXB0Ijp0cnVl", scope);
    }
  }
}

function sessionSetCookies(response: Response) {
  return response.headers
    .getSetCookie()
    .filter((header) => header.startsWith(KEY));
}

function forwardedAccessTokens(response: Response) {
  const forwarded = response.headers.get("x-middleware-request-cookie") ?? "";
  const pairs = forwarded
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair.startsWith(KEY))
    .sort();
  const joined = pairs.map((pair) => pair.slice(pair.indexOf("=") + 1)).join("");

  if (!joined) return [];

  const session = JSON.parse(
    Buffer.from(
      decodeURIComponent(joined).replace(/^base64-/, ""),
      "base64url"
    ).toString()
  );

  return [session.access_token as string];
}

/* Moves the clock past every access token planted so far. */
function afterAccessTokensExpire() {
  advanceClock(2 * 3600 * 1000);
}

const STALE_KINDS: Stale[] = [
  "revoked",
  "expired-revoked",
  "older-generation",
  "corrupt",
];
const ORDERS = ["canonical first", "host-only first"] as const;

/*
 * The contract, since an accepted access token proves nothing about the
 * refresh token beside it:
 *
 * - When the Auth API rules out every copy but the healthy one, a refresh
 *   proves the healthy pair at once; it is written canonically and every
 *   other copy retired.
 * - When another copy cannot be ruled out without a refresh (its access
 *   token has expired), the healthy session is served exactly as it is
 *   and nothing changes. Once its own access token expires too, two
 *   copies remain that only a refresh could tell apart, and refreshing
 *   either could destroy the other: the visitor is sent to an explicit
 *   recovery page instead of being signed in or out silently.
 */
const RULED_OUT: Stale[] = ["revoked", "corrupt"];

describe("proxy: distinct session generations in both scopes", () => {
  for (const kind of STALE_KINDS) {
    for (const order of ORDERS) {
      for (const healthyScope of ["shared-domain", "host-only"] as const) {
        const staleScope: Scope =
          healthyScope === "shared-domain" ? "host-only" : "shared-domain";
        const label = `healthy ${healthyScope} copy over a ${kind} ${staleScope} copy (${order})`;

        it(label, async () => {
          const jar = new ScopedJar(PUBLIC_HOST);
          const healthy = api.generation({ sessionId: SESSION_A, bulky: true });
          const plantHealthy = () => plant(jar, healthy, healthyScope);
          const plantOther = () => plantStale(jar, kind, staleScope);

          if (order === "canonical first" === (healthyScope === "shared-domain")) {
            plantHealthy();
            plantOther();
          } else {
            plantOther();
            plantHealthy();
          }
          jar.set("unrelated-preference", "keep", staleScope);
          const before = jar.header();

          const response = await proxy(request("/dashboard", jar));

          assert.equal(response.headers.get("location"), null, "not bounced");
          assert.equal(api.state.reuseDetected, false);
          assert.equal(api.isLive(SESSION_A), true);

          if (RULED_OUT.includes(kind)) {
            /* The ruled-out copy's refresh token is presented first and
               yields nothing (it died with its sign-in); then the healthy
               pair is proven by its own refresh — the only rotation — and
               kept canonically. */
            assert.equal(api.state.refreshedTokens.at(-1), healthy.refresh_token);
            assert.equal(api.state.rotations, 1);
            expectUncacheable(response);
            jar.apply(response);
            assert.deepEqual(jar.names("host-only", KEY), []);
            assert.ok(jar.names("shared-domain", KEY).length > 0);
            assert.equal(jar.get("unrelated-preference", staleScope), "keep");

            api.state.validatedTokens = [];
            const next = await proxy(request("/dashboard", jar));
            assert.equal(next.headers.get("location"), null);
            assert.deepEqual(sessionSetCookies(next), []);
            assert.deepEqual(api.state.validatedTokens, [api.state.accessToken]);
            return;
          }

          /* Served, unchanged: nothing proved the pair or ruled the other
             copy out. */
          assert.equal(api.state.refreshCalls, 0);
          assert.deepEqual(sessionSetCookies(response), []);
          assert.deepEqual(forwardedAccessTokens(response), [healthy.access_token]);
          jar.apply(response);
          assert.equal(jar.header(), before);

          afterAccessTokensExpire();
          const later = await proxy(request("/dashboard", jar));

          assert.match(
            later.headers.get("location") ?? "",
            /\/sign-out\?reason=session-unresolved&next=%2Fdashboard$/
          );
          assert.equal(api.state.refreshCalls, 0);
          assert.deepEqual(sessionSetCookies(later), []);
          assert.equal(api.isLive(SESSION_A), true);
          assert.equal(api.canRefresh(SESSION_A), true);
        });
      }
    }
  }

  for (const order of ORDERS) {
    it(`never refreshes either of two expired generations (${order})`, async () => {
      const jar = new ScopedJar(PUBLIC_HOST);
      const older = api.generation({
        sessionId: SESSION_A,
        expiresIn: -120,
        accessLive: false,
        refreshLive: false,
        consumed: true,
        bulky: true,
      });
      const newest = api.generation({
        sessionId: SESSION_A,
        expiresIn: -60,
        bulky: true,
      });

      if (order === "canonical first") {
        plant(jar, newest, "shared-domain");
        plant(jar, older, "host-only");
      } else {
        plant(jar, older, "host-only");
        plant(jar, newest, "shared-domain");
      }
      const before = jar.header();

      const response = await proxy(request("/dashboard", jar));

      assert.match(response.headers.get("location") ?? "", /reason=session-unresolved/);
      assert.equal(api.state.refreshCalls, 0);
      assert.equal(api.state.reuseDetected, false);
      jar.apply(response);
      assert.equal(jar.header(), before);
      assert.equal(api.canRefresh(SESSION_A), true);
    });
  }

  it("an identical session in both scopes is one session: the host-only copy goes", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    const healthy = api.generation({ sessionId: SESSION_A, bulky: true });
    plant(jar, healthy, "host-only");
    plant(jar, healthy, "shared-domain");

    const response = await proxy(request("/dashboard", jar));

    assert.equal(response.headers.get("location"), null);
    for (const header of sessionSetCookies(response)) {
      assert.equal(/Domain=/i.test(header), false, header);
    }
    jar.apply(response);
    assert.deepEqual(
      jar.names("shared-domain", KEY),
      sessionChunks(healthy).map(({ name }) => name)
    );
    assert.deepEqual(jar.names("host-only", KEY), []);
  });

  for (const outage of ["down", "unavailable"] as const) {
    it(`touches neither scope while the Auth API is ${outage}`, async () => {
      for (const healthyScope of ["shared-domain", "host-only"] as const) {
        const jar = new ScopedJar(PUBLIC_HOST);
        const healthy = api.generation({ sessionId: SESSION_A, bulky: true });
        const staleScope: Scope =
          healthyScope === "shared-domain" ? "host-only" : "shared-domain";
        plant(jar, healthy, healthyScope);
        plantStale(jar, "revoked", staleScope);
        const before = jar.header();

        api.state.mode = outage;
        for (const path of ["/dashboard", "/"]) {
          const response = await proxy(request(path, jar));

          assert.deepEqual(
            sessionSetCookies(response),
            [],
            `${healthyScope} ${path}`
          );
          jar.apply(response);
        }
        assert.equal(jar.header(), before);

        api.state.mode = "up";
        const recovered = await proxy(request("/dashboard", jar));
        assert.equal(recovered.headers.get("location"), null);
        jar.apply(recovered);
        assert.deepEqual(jar.names("host-only", KEY), []);
      }
    });
  }

  it("signs out only when every generation is ruled out, in both scopes", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(
      jar,
      api.generation({
        sessionId: SESSION_A,
        expiresIn: -60,
        accessLive: false,
        refreshLive: false,
      }),
      "shared-domain"
    );
    plantStale(jar, "revoked", "host-only");
    jar.set("unrelated-preference", "keep", "shared-domain");

    const response = await proxy(request("/dashboard", jar));

    assert.match(response.headers.get("location") ?? "", /\/login\?next=/);
    expectUncacheable(response);
    jar.apply(response);
    assert.deepEqual(jar.names("shared-domain", KEY), []);
    assert.deepEqual(jar.names("host-only", KEY), []);
    assert.equal(jar.get("unrelated-preference", "shared-domain"), "keep");
  });

  it("forwards only the served session to Server Components and route handlers", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    const healthy = api.generation({ sessionId: SESSION_A, bulky: true });
    plant(jar, healthy, "shared-domain");
    plantStale(jar, "expired-revoked", "host-only");

    const response = await proxy(request("/dashboard", jar));

    assert.ok(
      (response.headers.get("x-middleware-override-headers") ?? "").includes("cookie")
    );
    assert.deepEqual(forwardedAccessTokens(response), [healthy.access_token]);
  });
});

describe("logout: distinct session generations in both scopes", () => {
  it("revokes every distinct sign-in and expires both scopes", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    const canonical = api.generation({ sessionId: SESSION_A, bulky: true });
    const hostOnly = api.generation({ sessionId: SESSION_B, bulky: true });
    plant(jar, canonical, "shared-domain");
    plant(jar, hostOnly, "host-only");
    jar.set("unrelated-preference", "keep", "host-only");

    const response = await signOut(logoutRequest(jar));

    assert.equal(api.isLive(SESSION_A), false);
    assert.equal(api.isLive(SESSION_B), false);
    assert.equal(response.headers.get("x-auth-revocation"), "complete");
    assert.equal(api.state.reuseDetected, false);
    expectUncacheable(response);
    jar.apply(response);
    assert.deepEqual(jar.names("shared-domain", KEY), []);
    assert.deepEqual(jar.names("host-only", KEY), []);
    assert.equal(jar.get("unrelated-preference", "host-only"), "keep");
  });

  it("a superseded generation's refresh token is only presented after sign-out, so it finds nothing to reuse", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    const newest = api.generation({ sessionId: SESSION_A, bulky: true });
    const older = api.generation({
      sessionId: SESSION_A,
      expiresIn: -120,
      accessLive: false,
      refreshLive: false,
      consumed: true,
      bulky: true,
    });
    plant(jar, newest, "shared-domain");
    plant(jar, older, "host-only");

    const response = await signOut(logoutRequest(jar));

    assert.equal(api.state.loggedOutTokens[0], newest.access_token);
    assert.equal(api.state.reuseDetected, false);
    assert.equal(api.isLive(SESSION_A), false);
    assert.equal(response.headers.get("x-auth-revocation"), "complete");
    jar.apply(response);
    assert.deepEqual(jar.names("shared-domain", KEY), []);
    assert.deepEqual(jar.names("host-only", KEY), []);
  });
});

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";

import { GET as oauthCallback } from "../../app/auth/callback/route";
import { GET as confirmEmail } from "../../app/auth/confirm/route";
import { POST as signOut } from "../../app/auth/signout/route";
import { proxy } from "../../proxy";
import {
  AUTH_NO_STORE_HEADERS,
  AUTH_SWEEP_GUARD_COOKIE,
} from "./auth-cookie-cleanup";
import { getSupabaseCookieOptions } from "./cookie-options";
import {
  FAKE_PKCE_VERIFIER,
  FAKE_TOKEN_HASH,
  KEY,
  SUPABASE_URL,
  USER_ID,
  installFakeAuthApi,
  plant,
  sessionChunks,
  type FakeAuthApi,
} from "./testing/fake-auth-api";
import { PUBLIC_HOST, ScopedJar, type Scope } from "./testing/scoped-jar";

/*
 * The cross-app cookie matrix (output/ops/shared-auth-remediation-plan.md,
 * "Regression tests"), driven through the real proxy and auth routes
 * against the fake GoTrue model, with a browser jar that keeps scopes
 * apart (RFC 6265 name + domain + path).
 *
 * The contract: one copy per name, `Domain=.entrepreneuria.io`. A name
 * the browser sends twice is never read: a GET is swept (host-only
 * copies expired, 303 back, once), anything else is served
 * unauthenticated. No request ever revokes a session globally.
 */

const LOCAL_URL = "http://localhost:3000";
const ORIGIN = "https://entrepreneuria.io";
const SUBDOMAINS = [
  "architecta.entrepreneuria.io",
  "prospra.entrepreneuria.io",
  "directorium.entrepreneuria.io",
  "channelwright.entrepreneuria.io",
];

/* A bare value that decodes to JSON but is no session: auth-js rejects
   it and removes the stored session. */
const BARE_FRAGMENT = `base64-${Buffer.from(JSON.stringify({ access_token: "truncated" })).toString("base64url")}`;

const SESSION_A = "00000000-0000-4000-8000-0000000000aa";
const SESSION_B = "00000000-0000-4000-8000-0000000000bb";
/* The same user signed in on another device. */
const OTHER_DEVICE = "00000000-0000-4000-8000-0000000000dd";

const realNow = Date.now;
let clockOffset = 0;

function advanceClock(ms: number) {
  clockOffset += ms;
  Date.now = () => realNow() + clockOffset;
}

let api: FakeAuthApi;
const originalFetch = globalThis.fetch;
const env = process.env as Record<string, string | undefined>;
const originalEnv = {
  url: env.NEXT_PUBLIC_SUPABASE_URL,
  key: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  nodeEnv: env.NODE_ENV,
};

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete env[name];
  else env[name] = value;
}

beforeEach(() => {
  api = installFakeAuthApi();
  globalThis.fetch = api.fetchStub;
  env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake-anon-key";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  restore("NEXT_PUBLIC_SUPABASE_URL", originalEnv.url);
  restore("NEXT_PUBLIC_SUPABASE_ANON_KEY", originalEnv.key);
  restore("NODE_ENV", originalEnv.nodeEnv);
  Date.now = realNow;
  clockOffset = 0;
});

type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  /** Replaces the default `host` / `x-forwarded-proto` pair. */
  proxyHeaders?: Record<string, string>;
};

function request(path: string, jar: ScopedJar, options: RequestOptions = {}) {
  const { method = "GET", headers = {} } = options;

  return new NextRequest(`${LOCAL_URL}${path}`, {
    method,
    headers: {
      ...(options.proxyHeaders ?? { host: PUBLIC_HOST, "x-forwarded-proto": "https" }),
      cookie: jar.header(new URL(path, LOCAL_URL).pathname),
      ...headers,
    },
  });
}

async function visit(path: string, jar: ScopedJar, options?: RequestOptions) {
  const response = await proxy(request(path, jar, options));
  jar.apply(response, PUBLIC_HOST);
  return response;
}

function authSetCookies(response: Response) {
  return response.headers.getSetCookie().filter((header) => header.startsWith(KEY));
}

function isExpiry(header: string) {
  return /Max-Age=0/i.test(header);
}

function hasDomain(header: string) {
  return /;\s*Domain=\.?entrepreneuria\.io/i.test(header);
}

/* The session names the request forwarded to pages and route handlers. */
function forwardedNames(response: Response) {
  return (response.headers.get("x-middleware-request-cookie") ?? "")
    .split(";")
    .map((pair) => pair.trim().split("=")[0])
    .filter((name) => name.startsWith(KEY))
    .sort();
}

function decodeHeaderSession(header: string) {
  const pairs = header
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => /^entrepreneuria-auth-token(\.\d+)?=/.test(pair))
    .sort();
  const names = pairs.map((pair) => pair.slice(0, pair.indexOf("=")));
  const value = pairs.map((pair) => pair.slice(pair.indexOf("=") + 1)).join("");
  const session = JSON.parse(
    Buffer.from(decodeURIComponent(value).replace(/^base64-/, ""), "base64url").toString(),
  ) as { access_token: string; user: { id: string } };

  return { names, session };
}

function assertOneCopyPerName(header: string) {
  const names = header
    .split(";")
    .map((pair) => pair.trim().split("=")[0])
    .filter((name) => name.startsWith(KEY));

  assert.deepEqual(names, [...new Set(names)], header);
}

function assertNoGlobalRevoke() {
  assert.equal(api.state.logoutScopes.includes("global"), false);
  assert.equal(api.state.logoutCalls, 0);
}

type Stale = "revoked" | "expired-revoked" | "older-generation" | "corrupt";

const STALE_KINDS: Stale[] = ["revoked", "expired-revoked", "older-generation", "corrupt"];

/* A copy that must never win over the healthy one; null for corrupt chunks. */
function staleCopy(kind: Stale) {
  switch (kind) {
    case "revoked": {
      const copy = api.generation({ sessionId: SESSION_B, refreshLive: false, bulky: true });
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
         refreshing it is refresh-token reuse. */
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

const ORDERS = ["shared copy first", "host-only copy first"] as const;

function inProduction() {
  env.NODE_ENV = "production";
}

describe("matrix 1: a sign-in on the hub", () => {
  it("is seen by every subdomain as one copy per name, all .entrepreneuria.io", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    jar.set(
      `${KEY}-code-verifier`,
      `base64-${Buffer.from(JSON.stringify(FAKE_PKCE_VERIFIER)).toString("base64url")}`,
      "shared-domain",
    );

    const callback = await oauthCallback(
      request("/auth/callback?code=fake-code&next=/dashboard", jar),
    );
    jar.apply(callback, PUBLIC_HOST);

    assert.equal(callback.status, 307);
    assert.deepEqual(jar.names("host-only", KEY), []);
    const written = jar.names("shared-domain", `${KEY}.`);
    assert.ok(written.length >= 2, "a provider session spans chunks");

    for (const host of [PUBLIC_HOST, ...SUBDOMAINS]) {
      const header = jar.header("/", host);
      const { names, session } = decodeHeaderSession(header);

      assertOneCopyPerName(header);
      assert.deepEqual(names, written, host);
      assert.equal(session.user.id, USER_ID, host);
      assert.equal(session.access_token, api.state.accessToken, host);
    }

    /* The hub's own next request adds nothing. */
    const next = await visit("/dashboard", jar);
    assert.equal(next.headers.get("location"), null);
    assert.deepEqual(authSetCookies(next), []);
  });
});

describe("matrix 2: a legacy host-only duplicate", () => {
  for (const kind of STALE_KINDS) {
    for (const order of ORDERS) {
      it(`(${kind}, ${order}) is swept on the first GET and the user stays signed in`, async () => {
        const jar = new ScopedJar(PUBLIC_HOST);
        const healthy = api.generation({ sessionId: SESSION_A, bulky: true });

        if (order === "shared copy first") {
          plant(jar, healthy, "shared-domain");
          plantStale(jar, kind, "host-only");
        } else {
          plantStale(jar, kind, "host-only");
          plant(jar, healthy, "shared-domain");
        }
        jar.set("unrelated-preference", "keep", "host-only");
        const shared = jar.names("shared-domain", KEY).map((name) => [
          name,
          jar.get(name, "shared-domain"),
        ]);

        const sweep = await visit("/dashboard?tab=1", jar);

        assert.equal(sweep.status, 303);
        assert.equal(sweep.headers.get("location"), `${ORIGIN}/dashboard?tab=1`);
        for (const [key, value] of Object.entries(AUTH_NO_STORE_HEADERS)) {
          assert.equal(sweep.headers.get(key), value, key);
        }
        /* Nothing read, nothing refreshed: no Auth API call at all. */
        assert.equal(api.state.refreshCalls, 0);
        assert.deepEqual(api.state.validatedTokens, []);
        /* Only host-only expiries: a cookie without Domain cannot touch
           the shared copy. */
        assert.ok(authSetCookies(sweep).length > 0);
        for (const header of authSetCookies(sweep)) {
          assert.ok(isExpiry(header), header);
          assert.equal(hasDomain(header), false, header);
          assert.match(header, /Path=\//);
          assert.match(header, /Secure/);
          assert.match(header, /SameSite=Lax/);
        }
        assert.deepEqual(jar.names("host-only", KEY), []);
        assert.deepEqual(
          jar.names("shared-domain", KEY).map((name) => [name, jar.get(name, "shared-domain")]),
          shared,
        );
        assert.equal(jar.get("unrelated-preference", "host-only"), "keep");

        const served = await visit("/dashboard?tab=1", jar);

        assert.equal(served.headers.get("location"), null, "signed in");
        assert.deepEqual(authSetCookies(served), []);
        assert.equal(api.state.refreshCalls, 0);
        assert.equal(api.state.reuseDetected, false);
        assert.equal(api.canRefresh(SESSION_A), true);
        assert.deepEqual(
          forwardedNames(served),
          sessionChunks(healthy).map(({ name }) => name).sort(),
        );
        assertOneCopyPerName(jar.header("/dashboard"));
        /* The guard did its job and is gone. */
        assert.equal(jar.get(AUTH_SWEEP_GUARD_COOKIE, "host-only"), undefined);
      });
    }
  }

  it("an identical copy in both scopes is swept the same way", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    const healthy = api.generation({ sessionId: SESSION_A, bulky: true });
    plant(jar, healthy, "host-only");
    plant(jar, healthy, "shared-domain");

    assert.equal((await visit("/", jar)).status, 303);
    assert.deepEqual(jar.names("host-only", KEY), []);
    assert.equal((await visit("/", jar)).headers.get("location"), null);
    assert.deepEqual(
      jar.names("shared-domain", KEY),
      sessionChunks(healthy).map(({ name }) => name),
    );
  });
});

describe("matrix 3: a stale shared copy beside a fresh host-only copy", () => {
  for (const kind of STALE_KINDS) {
    it(`(${kind}) is swept, then signed out locally — never globally`, async () => {
      const jar = new ScopedJar(PUBLIC_HOST);
      api.generation({ sessionId: OTHER_DEVICE });
      const fresh = api.generation({ sessionId: SESSION_A, bulky: true });
      plant(jar, fresh, "host-only");
      plantStale(jar, kind, "shared-domain");

      const sweep = await visit("/dashboard", jar);

      assert.equal(sweep.status, 303);
      /* The shared copy is not touched by the sweep. */
      assert.equal(authSetCookies(sweep).some(hasDomain), false);
      assert.deepEqual(jar.names("host-only", KEY), []);

      const after = await visit("/dashboard", jar);

      assert.match(after.headers.get("location") ?? "", /\/login\?next=%2Fdashboard$/);
      /* Only now, with the stale copy alone, is the shared scope cleared. */
      assert.ok(authSetCookies(after).some(hasDomain));
      assert.deepEqual(jar.names("shared-domain", KEY), []);
      assert.deepEqual(jar.names("host-only", KEY), []);
      assertNoGlobalRevoke();
      /* The user's other device is still signed in and can refresh. */
      assert.equal(api.isLive(OTHER_DEVICE), true);
      assert.equal(api.canRefresh(OTHER_DEVICE), true);
    });
  }
});

describe("matrix 4: a refresh after the access token expires", () => {
  for (const path of ["/dashboard", "/"]) {
    it(`rewrites only the .entrepreneuria.io copy (${path})`, async () => {
      const jar = new ScopedJar(PUBLIC_HOST);
      plant(
        jar,
        api.generation({ sessionId: SESSION_A, expiresIn: -60, accessLive: false, bulky: true }),
        "shared-domain",
      );

      const response = await visit(path, jar);

      assert.equal(response.headers.get("location"), null);
      assert.equal(api.state.rotations, 1);
      const writes = authSetCookies(response).filter((header) => !isExpiry(header));
      assert.ok(writes.length > 0);
      for (const header of writes) {
        assert.ok(hasDomain(header), header);
      }
      for (const header of authSetCookies(response).filter((h) => !hasDomain(h))) {
        assert.ok(isExpiry(header), `a host-only Set-Cookie may only expire: ${header}`);
      }
      assert.deepEqual(jar.names("host-only", KEY), []);
      assert.equal(
        decodeHeaderSession(jar.header("/")).session.access_token,
        api.state.accessToken,
      );
    });
  }
});

describe("matrix 8: behind a proxy, production never writes host-only", () => {
  const VARIANTS: [string, Record<string, string>][] = [
    ["Host only", { host: PUBLIC_HOST }],
    ["X-Forwarded-Host only", { "x-forwarded-host": PUBLIC_HOST, host: "127.0.0.1:3000" }],
    ["neither (bind address in Host)", { host: "localhost:3000" }],
    ["neither (no host headers)", {}],
  ];

  function assertSharedScopeOnly(response: Response, label: string) {
    const writes = authSetCookies(response).filter((header) => !isExpiry(header));

    assert.ok(writes.length > 0, `${label}: writes a session`);
    for (const header of writes) {
      assert.ok(hasDomain(header), `${label}: ${header}`);
      assert.match(header, /Secure/, label);
    }
  }

  for (const [label, proxyHeaders] of VARIANTS) {
    it(`${label}: proxy refresh, OAuth callback and email confirmation`, async () => {
      inProduction();

      const refreshJar = new ScopedJar(PUBLIC_HOST);
      plant(
        refreshJar,
        api.generation({ sessionId: SESSION_A, expiresIn: -60, accessLive: false, bulky: true }),
        "shared-domain",
      );
      const refreshed = await visit("/dashboard", refreshJar, { proxyHeaders });
      assert.equal(refreshed.headers.get("location"), null, label);
      assertSharedScopeOnly(refreshed, `${label} proxy`);
      assert.deepEqual(refreshJar.names("host-only", KEY), []);

      const signInJar = new ScopedJar(PUBLIC_HOST);
      signInJar.set(
        `${KEY}-code-verifier`,
        `base64-${Buffer.from(JSON.stringify(FAKE_PKCE_VERIFIER)).toString("base64url")}`,
        "shared-domain",
      );
      const callback = await oauthCallback(
        request("/auth/callback?code=fake-code", signInJar, { proxyHeaders }),
      );
      assert.ok(callback.headers.get("location")?.startsWith(ORIGIN), label);
      assertSharedScopeOnly(callback, `${label} callback`);
      signInJar.apply(callback, PUBLIC_HOST);
      assert.deepEqual(signInJar.names("host-only", KEY), []);

      const confirmJar = new ScopedJar(PUBLIC_HOST);
      const confirmed = await confirmEmail(
        request(`/auth/confirm?token_hash=${FAKE_TOKEN_HASH}&type=email`, confirmJar, {
          proxyHeaders,
        }),
      );
      assert.ok(confirmed.headers.get("location")?.startsWith(ORIGIN), label);
      assertSharedScopeOnly(confirmed, `${label} confirm`);
      confirmJar.apply(confirmed, PUBLIC_HOST);
      assert.deepEqual(confirmJar.names("host-only", KEY), []);
    });
  }

  it("the sweep's 303 goes to the public origin even with neither header", async () => {
    inProduction();
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(jar, api.generation({ sessionId: SESSION_A, bulky: true }), "shared-domain");
    plantStale(jar, "corrupt", "host-only");

    const sweep = await visit("/settings", jar, { proxyHeaders: { host: "localhost:3000" } });

    assert.equal(sweep.status, 303);
    assert.equal(sweep.headers.get("location"), `${ORIGIN}/settings`);
  });
});

describe("matrix 6: sign-out", () => {
  function logoutRequest(jar: ScopedJar) {
    return request("/auth/signout", jar, { method: "POST", headers: { origin: ORIGIN } });
  }

  it("clears both scopes and every chunk index, malformed names included", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(jar, api.generation({ sessionId: SESSION_A, bulky: true }), "shared-domain");
    plant(jar, api.generation({ sessionId: SESSION_B, bulky: true }), "host-only");
    for (const scope of ["shared-domain", "host-only"] as const) {
      jar.set(`${KEY}.5`, "base64-c3RhbGU", scope);
      jar.set(`${KEY}.0.0`, "base64-c3RhbGU", scope);
      jar.set(`${KEY}.1.0`, "base64-c3RhbGU", scope);
    }
    jar.set(KEY, "base64-ZnJhZ21lbnQ", "shared-domain");
    jar.set("sb-rifzbzaabkaeagyulxip-auth-token.0", "legacy", "host-only");
    jar.set("unrelated-preference", "keep", "shared-domain");

    const response = await signOut(logoutRequest(jar));
    jar.apply(response, PUBLIC_HOST);

    assert.equal(response.status, 303);
    assert.deepEqual(jar.names("shared-domain", KEY), []);
    assert.deepEqual(jar.names("host-only", KEY), []);
    assert.deepEqual(jar.names("host-only", "sb-"), []);
    assert.equal(jar.get("unrelated-preference", "shared-domain"), "keep");
    assert.equal(api.isLive(SESSION_A), false);
    assert.equal(api.isLive(SESSION_B), false);
  });

  it("a superseded generation's refresh token is only presented after sign-out, so it finds nothing to reuse", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    const newest = api.generation({ sessionId: SESSION_A, bulky: true });
    plant(jar, newest, "shared-domain");
    plantStale(jar, "older-generation", "host-only");

    const response = await signOut(logoutRequest(jar));

    assert.equal(api.state.loggedOutTokens[0], newest.access_token);
    assert.equal(api.state.reuseDetected, false);
    assert.equal(response.headers.get("x-auth-revocation"), "complete");
    jar.apply(response, PUBLIC_HOST);
    assert.deepEqual(jar.names("shared-domain", KEY), []);
    assert.deepEqual(jar.names("host-only", KEY), []);
  });
});

describe("matrix 7: malformed names and fragments, read before the client", () => {
  it("a bare fragment beside sound chunks never reaches the client, and the chunks survive", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    const healthy = api.generation({ sessionId: SESSION_A, bulky: true });
    plant(jar, healthy, "shared-domain");
    jar.set(KEY, BARE_FRAGMENT, "shared-domain");

    const response = await visit("/dashboard", jar);

    assert.equal(response.headers.get("location"), null, "signed in");
    assert.deepEqual(forwardedNames(response), sessionChunks(healthy).map(({ name }) => name).sort());
    /* The fragment goes, in both scopes; the sound chunks are never
       expired in the shared scope. */
    const expiries = authSetCookies(response).filter(isExpiry);
    assert.ok(expiries.some((header) => header.startsWith(`${KEY}=;`) && hasDomain(header)));
    assert.ok(expiries.some((header) => header.startsWith(`${KEY}=;`) && !hasDomain(header)));
    for (const { name } of sessionChunks(healthy)) {
      assert.equal(
        expiries.some((header) => header.startsWith(`${name}=`) && hasDomain(header)),
        false,
        name,
      );
    }
    assert.deepEqual(
      jar.names("shared-domain", KEY),
      sessionChunks(healthy).map(({ name }) => name),
    );
    assert.equal(api.state.refreshCalls, 0);
  });

  it("…which stock @supabase/ssr would not survive: it expires the sound chunks in the shared scope", async () => {
    /* The hazard Architecta's review found, reproduced against the
       installed @supabase/ssr: a bare value shadows the chunks, auth-js
       rejects it and `_removeSession` expires the whole family with the
       client's Domain. This is what stripping the fragment prevents. */
    const jar = new ScopedJar(PUBLIC_HOST);
    const healthy = api.generation({ sessionId: SESSION_A, bulky: true });
    plant(jar, healthy, "shared-domain");
    jar.set(KEY, BARE_FRAGMENT, "shared-domain");
    const req = request("/", jar);
    const writes: { name: string; value: string; domain?: string }[] = [];

    const client = createServerClient(SUPABASE_URL, "fake-anon-key", {
      cookieOptions: getSupabaseCookieOptions(PUBLIC_HOST),
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => {
          for (const { name, value, options } of cookies) {
            writes.push({ name, value, domain: options.domain });
          }
        },
      },
    });
    await client.auth.getSession();

    for (const { name } of sessionChunks(healthy)) {
      assert.ok(
        writes.some(
          (write) => write.name === name && write.value === "" && write.domain === ".entrepreneuria.io",
        ),
        `stock ssr expires ${name} on .entrepreneuria.io`,
      );
    }
  });

  it(".N.M names are stripped and expired host-only; the session is kept", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    const healthy = api.generation({ sessionId: SESSION_A, bulky: true });
    plant(jar, healthy, "shared-domain");
    jar.set(`${KEY}.0.0`, "base64-c3RhbGU", "host-only");
    jar.set(`${KEY}.1.0`, "base64-c3RhbGU", "host-only");

    const response = await visit("/dashboard", jar);

    assert.equal(response.headers.get("location"), null, "signed in");
    assert.deepEqual(forwardedNames(response), sessionChunks(healthy).map(({ name }) => name).sort());
    for (const name of [`${KEY}.0.0`, `${KEY}.1.0`]) {
      const headers = authSetCookies(response).filter((header) => header.startsWith(`${name}=`));
      assert.equal(headers.length, 1, name);
      assert.ok(isExpiry(headers[0]) && !hasDomain(headers[0]), headers[0]);
    }
    assert.deepEqual(jar.names("host-only", KEY), []);
    assert.deepEqual(
      jar.names("shared-domain", KEY),
      sessionChunks(healthy).map(({ name }) => name),
    );
  });

  it("a stale trailing chunk is removed and the session kept", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    const healthy = api.generation({ sessionId: SESSION_A, bulky: true });
    plant(jar, healthy, "shared-domain");
    const count = sessionChunks(healthy).length;
    jar.set(`${KEY}.${count}`, "c3RhbGUtdGFpbA", "shared-domain");

    const response = await visit("/dashboard", jar);

    assert.equal(response.headers.get("location"), null, "signed in");
    assert.deepEqual(
      jar.names("shared-domain", KEY),
      sessionChunks(healthy).map(({ name }) => name),
    );
    assert.equal(api.state.refreshCalls, 0);
  });
});

describe("the sweep's loop guard", () => {
  it("a duplicate no host-only expiry can reach is redirected once, then served unauthenticated", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(jar, api.generation({ sessionId: SESSION_A, bulky: true }), "shared-domain");
    /* A shared copy under another Path: neither scope's Path=/ expiry
       removes it, so the duplicate outlives the sweep. */
    for (const { name, value } of sessionChunks(
      api.generation({ sessionId: SESSION_B, bulky: true }),
    )) {
      jar.set(name, value, "shared-domain", { path: "/dashboard" });
    }

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await visit("/dashboard", jar);
      statuses.push(response.status);

      if (response.status !== 303) {
        assert.match(response.headers.get("location") ?? "", /\/login\?next=/);
        assert.equal(api.state.refreshCalls, 0);
        assert.deepEqual(api.state.validatedTokens, []);
        assert.equal(
          authSetCookies(response).some((header) => !isExpiry(header) || hasDomain(header)),
          false,
          "nothing but host-only expiries",
        );
      }
    }

    assert.deepEqual(statuses, [303, 307, 307, 307]);

    /* Once the guard expires, at most one more sweep: never a loop. */
    advanceClock(61_000);
    assert.equal((await visit("/dashboard", jar)).status, 303);
    assert.equal((await visit("/dashboard", jar)).status, 307);
    assertNoGlobalRevoke();
  });

  it("the guard is short-lived, host-only and holds nothing", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(jar, api.generation({ sessionId: SESSION_A, bulky: true }), "shared-domain");
    plantStale(jar, "corrupt", "host-only");

    const sweep = await proxy(request("/", jar));
    const guard = sweep.headers
      .getSetCookie()
      .find((header) => header.startsWith(`${AUTH_SWEEP_GUARD_COOKIE}=`));

    assert.ok(guard);
    assert.match(guard, /^entrepreneuria-auth-sweep=1; Path=\/; Max-Age=60; HttpOnly; (Secure; )?SameSite=Lax$/);
  });
});

describe("a non-GET request with a duplicated name", () => {
  it("is served unauthenticated, with host-only expiries and no redirect", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    const healthy = api.generation({ sessionId: SESSION_A, bulky: true });
    plant(jar, healthy, "shared-domain");
    plantStale(jar, "older-generation", "host-only");

    const response = await visit("/api/waitlist", jar, { method: "POST" });

    assert.equal(response.headers.get("location"), null);
    assert.deepEqual(forwardedNames(response), []);
    assert.equal(api.state.refreshCalls, 0);
    assert.deepEqual(api.state.validatedTokens, []);
    for (const header of authSetCookies(response)) {
      assert.ok(isExpiry(header) && !hasDomain(header), header);
    }
    assert.deepEqual(jar.names("host-only", KEY), []);

    /* The next request carries the shared copy alone and is signed in. */
    const next = await visit("/dashboard", jar);
    assert.equal(next.headers.get("location"), null);
    assertNoGlobalRevoke();
  });

  it("on a protected page goes to /login, never to a global sign-out", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(jar, api.generation({ sessionId: SESSION_A, bulky: true }), "shared-domain");
    plantStale(jar, "revoked", "host-only");

    const response = await visit("/settings", jar, { method: "POST" });

    assert.match(response.headers.get("location") ?? "", /\/login\?next=%2Fsettings$/);
    assert.deepEqual(jar.names("host-only", KEY), []);
    assert.ok(jar.names("shared-domain", KEY).length > 0);
    assertNoGlobalRevoke();
  });
});

describe("an Auth API outage", () => {
  it("(a plain 500) never clears the shared copy", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(
      jar,
      api.generation({ sessionId: SESSION_A, expiresIn: -60, accessLive: false, bulky: true }),
      "shared-domain",
    );
    const before = jar.header("/");
    const stub = api.fetchStub;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input instanceof Request ? input.url : input).includes("/auth/v1/token")
        ? new Response(JSON.stringify({ message: "internal" }), { status: 500 })
        : stub(input, init)) as typeof fetch;

    const response = await visit("/", jar);

    assert.deepEqual(authSetCookies(response), []);
    assert.equal(jar.header("/"), before);
  });
});

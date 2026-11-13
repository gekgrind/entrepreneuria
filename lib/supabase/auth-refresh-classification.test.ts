import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { combineChunks, stringFromBase64URL } from "@supabase/ssr";
import { NextRequest } from "next/server";

import { proxy } from "../../proxy";
import { AUTH_SESSION_STATE_HEADER, createAuthFetchObserver } from "./auth-fetch";
import {
  KEY,
  SUPABASE_URL,
  installFakeAuthApi,
  plant,
  type FakeAuthApi,
} from "./testing/fake-auth-api";
import { PUBLIC_HOST, ScopedJar } from "./testing/scoped-jar";

/*
 * A session with 89 s left is inside auth-js's 90 s refresh margin, so
 * the proxy's first getSession() refreshes it before any other code in
 * the proxy runs. That refresh must (1) be told apart from a refusal:
 * only a session body, or a refusal GoTrue itself coded, is an answer,
 * and anything else keeps the cookies; and (2) have a deadline, because
 * auth-js sets none and retries a failed refresh for up to 30 s.
 */

const LOCAL_URL = "http://localhost:3000";
const SESSION = "00000000-0000-4000-8000-0000000000b1";

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
  for (const [name, value] of [
    ["NEXT_PUBLIC_SUPABASE_URL", originalEnv.url],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", originalEnv.key],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function requestFor(jar: ScopedJar, path: string) {
  return new NextRequest(`${LOCAL_URL}${path}`, {
    headers: {
      host: PUBLIC_HOST,
      "x-forwarded-proto": "https",
      cookie: jar.header(path.split("?")[0]),
    },
  });
}

const isRefreshGrant = (input: RequestInfo | URL) => {
  const url = input instanceof Request ? input.url : String(input);
  return url.includes("/auth/v1/token") && url.includes("grant_type=refresh_token");
};

/** The fake Auth API, except that the refresh grant is answered by `answer`. */
function answerRefreshWith(
  answer: (init?: RequestInit) => Response | Promise<Response>,
) {
  const seen = { refreshes: 0 };

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (isRefreshGrant(input)) {
      seen.refreshes += 1;
      return answer(init);
    }

    return api.fetchStub(input, init);
  }) as typeof fetch;

  return seen;
}

function sessionWith89SecondsLeft() {
  const session = api.generation({ sessionId: SESSION, expiresIn: 89, bulky: true });
  const jar = new ScopedJar(PUBLIC_HOST);
  plant(jar, session, "shared-domain");

  return { jar, session };
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("an indeterminate refresh answer keeps the session (89 s left)", () => {
  const cases: [string, () => Response][] = [
    ["HTTP 200 with {}", () => json({}, 200)],
    ["HTTP 200 with a session missing its refresh token", () =>
      json({ access_token: "a", user: {} }, 200)],
    ["HTTP 200 that is not JSON", () => new Response("<html>ok</html>", { status: 200 })],
    ["a gateway's bare 403", () => json({ message: "blocked upstream" }, 403)],
    ["a gateway's bare 401", () => json({ message: "unauthorized" }, 401)],
    ["a 403 that is not JSON", () => new Response("Forbidden", { status: 403 })],
    ["a 4xx with an unrelated error code", () =>
      json({ error_code: "over_email_send_rate_limit", msg: "slow down" }, 400)],
    ["a plain 500", () => json({ message: "boom" }, 500)],
    ["a 429", () => json({ message: "slow down" }, 429)],
  ];

  for (const [label, answer] of cases) {
    it(`${label}: cookies untouched, reported unavailable`, async () => {
      const { jar } = sessionWith89SecondsLeft();
      const before = jar.header("/");
      const seen = answerRefreshWith(() => answer());

      const response = await proxy(requestFor(jar, "/"));

      jar.apply(response);
      assert.equal(jar.header("/"), before);
      assert.ok(jar.names("shared-domain", KEY).length > 0);
      assert.equal(response.headers.get(AUTH_SESSION_STATE_HEADER), "unavailable");
      /* One attempt, not auth-js's backoff loop. */
      assert.equal(seen.refreshes, 1);
    });
  }

  it("a protected route is not turned into a sign-out either", async () => {
    const { jar } = sessionWith89SecondsLeft();
    const before = jar.header("/dashboard");
    answerRefreshWith(() => json({}, 200));

    const response = await proxy(requestFor(jar, "/dashboard"));

    jar.apply(response);
    assert.equal(jar.header("/dashboard"), before);
    assert.equal(response.headers.get(AUTH_SESSION_STATE_HEADER), "unavailable");
  });
});

describe("a definitive answer still decides the session (89 s left)", () => {
  it("a refresh token GoTrue has no row for ends the session", async () => {
    const session = api.generation({
      sessionId: SESSION,
      expiresIn: 89,
      bulky: true,
      refreshLive: false,
    });
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(jar, session, "shared-domain");

    const response = await proxy(requestFor(jar, "/"));

    jar.apply(response);
    assert.deepEqual(jar.names("shared-domain", KEY), []);
    assert.equal(response.headers.get(AUTH_SESSION_STATE_HEADER), null);
  });

  for (const code of [
    "refresh_token_not_found",
    "refresh_token_already_used",
    "session_not_found",
    "session_expired",
  ]) {
    it(`${code} (HTTP 400) ends the session`, async () => {
      const { jar } = sessionWith89SecondsLeft();
      answerRefreshWith(() => json({ error_code: code, msg: code }, 400));

      const response = await proxy(requestFor(jar, "/"));

      jar.apply(response);
      assert.deepEqual(jar.names("shared-domain", KEY), []);
      assert.equal(response.headers.get(AUTH_SESSION_STATE_HEADER), null);
    });
  }

  it("a successful refresh rotates the session", async () => {
    const { jar, session } = sessionWith89SecondsLeft();

    const response = await proxy(requestFor(jar, "/"));

    jar.apply(response);
    assert.equal(api.state.rotations, 1);
    assert.equal(response.headers.get(AUTH_SESSION_STATE_HEADER), null);
    assert.ok(jar.names("shared-domain", KEY).length > 0);
    assert.notEqual(jar.header("/"), "");
    assert.ok(!jar.header("/").includes(session.refresh_token));
  });
});

/** The session the jar's shared-domain cookies actually hold, decoded. */
async function persistedSession(jar: ScopedJar) {
  const raw = await combineChunks(KEY, (name) => jar.get(name, "shared-domain"));

  if (raw === null) return null;
  assert.ok(raw.startsWith("base64-"), "stored in the base64- format");

  return JSON.parse(stringFromBase64URL(raw.slice("base64-".length))) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: { id: string };
  };
}

const raw200 = (text: string) =>
  new Response(text, { status: 200, headers: { "content-type": "application/json" } });
const withUser = { user: { id: "u" } };

describe("a 200 that auth-js cannot build a session from is no answer (89 s left)", () => {
  const cases: [string, () => Response][] = [
    ["missing expires_in", () =>
      json({ access_token: "a", refresh_token: "r", ...withUser }, 200)],
    ["expires_in 0", () =>
      json({ access_token: "a", refresh_token: "r", expires_in: 0, ...withUser }, 200)],
    ["a negative expires_in", () =>
      json({ access_token: "a", refresh_token: "r", expires_in: -60, ...withUser }, 200)],
    ["a non-finite expires_in (1e999)", () =>
      raw200('{"access_token":"a","refresh_token":"r","expires_in":1e999,"user":{"id":"u"}}')],
    ["expires_in sent as a string", () =>
      json({ access_token: "a", refresh_token: "r", expires_in: "3600", ...withUser }, 200)],
    ["expires_in null", () =>
      json({ access_token: "a", refresh_token: "r", expires_in: null, ...withUser }, 200)],
    ["an empty access_token", () =>
      json({ access_token: "", refresh_token: "r", expires_in: 3600, ...withUser }, 200)],
    ["an empty refresh_token", () =>
      json({ access_token: "a", refresh_token: "", expires_in: 3600, ...withUser }, 200)],
    ["no user", () =>
      json({ access_token: "a", refresh_token: "r", expires_in: 3600 }, 200)],
  ];

  for (const [label, answer] of cases) {
    it(`${label}: old session kept byte for byte, reported unavailable`, async () => {
      const { jar, session } = sessionWith89SecondsLeft();
      const before = jar.header("/");
      const seen = answerRefreshWith(() => answer());

      const response = await proxy(requestFor(jar, "/"));

      jar.apply(response);
      assert.equal(jar.header("/"), before);
      assert.equal(response.headers.get(AUTH_SESSION_STATE_HEADER), "unavailable");
      assert.equal(seen.refreshes, 1);

      /* Nothing fabricated: what is stored is still the original session. */
      const stored = await persistedSession(jar);
      assert.equal(stored?.refresh_token, session.refresh_token);
      assert.equal(stored?.access_token, session.access_token);
    });
  }

  it("the same malformed answer on a protected route keeps the session", async () => {
    const { jar } = sessionWith89SecondsLeft();
    const before = jar.header("/dashboard");
    answerRefreshWith(() =>
      json({ access_token: "a", refresh_token: "r", ...withUser }, 200),
    );

    const response = await proxy(requestFor(jar, "/dashboard"));

    jar.apply(response);
    assert.equal(jar.header("/dashboard"), before);
    assert.equal(response.headers.get(AUTH_SESSION_STATE_HEADER), "unavailable");
  });

  it("a complete refresh stores the replacement refresh token it was given", async () => {
    const { jar, session } = sessionWith89SecondsLeft();
    let issued: { refresh_token: string; access_token: string } | null = null;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await api.fetchStub(input, init);

      if (isRefreshGrant(input)) issued = await response.clone().json();

      return response;
    }) as typeof fetch;

    const response = await proxy(requestFor(jar, "/"));

    jar.apply(response);
    assert.ok(issued, "the Auth API answered one refresh");
    const { refresh_token, access_token } = issued!;
    assert.notEqual(refresh_token, session.refresh_token);

    const stored = await persistedSession(jar);
    assert.equal(stored?.refresh_token, refresh_token);
    assert.equal(stored?.access_token, access_token);
    assert.ok((stored?.expires_in ?? 0) > 0);
    assert.equal(response.headers.get(AUTH_SESSION_STATE_HEADER), null);
    assert.equal(api.state.rotations, 1);
  });

  it("recovers: after a malformed answer, the next request refreshes and stores the new token", async () => {
    const { jar, session } = sessionWith89SecondsLeft();
    const before = jar.header("/");
    answerRefreshWith(() =>
      json({ access_token: "a", refresh_token: "r", ...withUser }, 200),
    );

    const first = await proxy(requestFor(jar, "/"));

    jar.apply(first);
    assert.equal(jar.header("/"), before);
    assert.equal(first.headers.get(AUTH_SESSION_STATE_HEADER), "unavailable");
    assert.equal(api.state.rotations, 0, "the malformed answer never reached the API");

    /* The upstream is healthy again. */
    globalThis.fetch = api.fetchStub;

    const second = await proxy(requestFor(jar, "/"));

    jar.apply(second);
    assert.equal(second.headers.get(AUTH_SESSION_STATE_HEADER), null);
    assert.equal(api.state.rotations, 1);

    const stored = await persistedSession(jar);
    assert.ok(stored);
    assert.notEqual(stored.refresh_token, session.refresh_token);
    assert.match(stored.refresh_token, /^fake-refresh-token-/);
    assert.ok(stored.expires_in > 0);
  });
});

describe("a stalled refresh is cut off (89 s left)", () => {
  it("one deadline, no retries, cookies kept, reported unavailable", { timeout: 15_000 }, async () => {
    const { jar } = sessionWith89SecondsLeft();
    const before = jar.header("/");
    /* The fetch stub opens no socket and AbortSignal.timeout's timer is
       unref'd: hold the loop open so node:test does not cancel the test. */
    const keepAlive = setTimeout(() => {}, 15_000);
    const seen = answerRefreshWith(
      (init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const startedAt = performance.now();

    try {
      const response = await proxy(requestFor(jar, "/"));
      const elapsed = performance.now() - startedAt;

      jar.apply(response);
      assert.equal(jar.header("/"), before);
      assert.equal(response.headers.get(AUTH_SESSION_STATE_HEADER), "unavailable");
      assert.equal(seen.refreshes, 1);
      /* auth-js alone would retry with 200 ms, 400 ms, ... backoffs for up
         to 30 s; one 3 s deadline plus slack is all this may take. */
      assert.ok(elapsed < 5_000, `took ${Math.round(elapsed)} ms`);
    } finally {
      clearTimeout(keepAlive);
    }
  });

  it("a protected route behind the stall keeps the session too", { timeout: 15_000 }, async () => {
    const { jar } = sessionWith89SecondsLeft();
    const before = jar.header("/dashboard");
    const keepAlive = setTimeout(() => {}, 15_000);
    const seen = answerRefreshWith(
      (init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const startedAt = performance.now();

    try {
      const response = await proxy(requestFor(jar, "/dashboard"));

      jar.apply(response);
      assert.equal(jar.header("/dashboard"), before);
      assert.equal(response.headers.get(AUTH_SESSION_STATE_HEADER), "unavailable");
      /* getSession() and then getClaims() would each refresh: once only. */
      assert.equal(seen.refreshes, 1);
      assert.ok(performance.now() - startedAt < 5_000);
    } finally {
      clearTimeout(keepAlive);
    }
  });
});

describe("the observer's classification of a refresh grant", () => {
  const REFRESH = `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`;

  async function observe(answer: Response | Error, url = REFRESH) {
    const observer = createAuthFetchObserver((async () => {
      if (answer instanceof Error) throw answer;
      return answer;
    }) as typeof fetch);
    const response = await observer.fetch(url, { method: "POST" });

    return { response, indeterminate: observer.isIndeterminate() };
  }

  it("passes a session through untouched", async () => {
    const { response, indeterminate } = await observe(
      json(
        { access_token: "a", refresh_token: "r", expires_in: 3600, user: { id: "u" } },
        200,
      ),
    );

    assert.equal(response.status, 200);
    assert.equal((await response.json()).access_token, "a");
    assert.equal(indeterminate, false);
  });

  it("passes a coded refusal through untouched, body readable", async () => {
    const { response, indeterminate } = await observe(
      json({ error_code: "refresh_token_not_found", msg: "gone" }, 400),
    );

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error_code, "refresh_token_not_found");
    assert.equal(indeterminate, false);
  });

  it("answers an unusable refresh with a non-retryable 4xx, never a 502/503/504", async () => {
    for (const unusable of [
      json({}, 200),
      json({ message: "blocked" }, 403),
      json({ message: "down" }, 503),
      new Error("network down"),
    ]) {
      const { response, indeterminate } = await observe(unusable);

      assert.equal(response.status, 408);
      assert.equal(indeterminate, true);
    }
  });

  it("does not turn other Auth API 4xx answers into an outage", async () => {
    const { response, indeterminate } = await observe(
      json({ error_code: "bad_jwt", msg: "bad" }, 401),
      `${SUPABASE_URL}/auth/v1/user`,
    );

    assert.equal(response.status, 401);
    assert.equal(indeterminate, false);
  });
});

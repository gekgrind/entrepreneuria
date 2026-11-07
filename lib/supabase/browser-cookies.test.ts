import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { refuseRefreshGrants } from "./auth-fetch";
import {
  BROWSER_SESSION_CUTOFF_SECONDS,
  browserCookieWrites,
  parseCookieHeader,
  selectBrowserCookies,
} from "./browser-cookies";
import { createHubBrowserClient } from "./client";
import {
  FAKE_PASSWORD,
  KEY,
  OTHER_USER_ID,
  SUPABASE_URL,
  installFakeAuthApi,
  plant,
  sessionChunks,
  type FakeAuthApi,
} from "./testing/fake-auth-api";
import { PUBLIC_HOST, ScopedJar } from "./testing/scoped-jar";

/*
 * The hub's browser client (ported from #26): it never refreshes, and it
 * only ever sees a session family that is exactly one well-formed
 * session, so a duplicated name — which the browser's first-value parser
 * and Next's last-value parser would read differently — can never make
 * it refresh or expire anything.
 */

const ROOT = join(__dirname, "..", "..");
const SESSION_A = "00000000-0000-4000-8000-0000000000aa";
const SESSION_B = "00000000-0000-4000-8000-0000000000bb";

let api: FakeAuthApi;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  api = installFakeAuthApi();
  globalThis.fetch = api.fetchStub;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function browser(jar: ScopedJar, hostname = PUBLIC_HOST) {
  const writes: string[] = [];
  const client = createHubBrowserClient({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: "fake-anon-key",
    hostname,
    readCookies: () => jar.header("/", hostname),
    writeCookie: (header) => {
      writes.push(header);
      jar.apply(new Response(null, { headers: { "set-cookie": header } }), hostname);
    },
  });

  return { client, writes };
}

function familyOf(pairs: { name: string }[]) {
  return pairs.map(({ name }) => name).filter((name) => name.startsWith(KEY));
}

describe("selectBrowserCookies", () => {
  it("passes one well-formed session and every other cookie", () => {
    const jar = new ScopedJar();
    const session = api.generation({ sessionId: SESSION_A, bulky: true });
    plant(jar, session, "shared-domain");
    jar.set("theme", "dark", "host-only");

    const selected = selectBrowserCookies(parseCookieHeader(jar.header("/")));

    assert.deepEqual(familyOf(selected), sessionChunks(session).map(({ name }) => name));
    assert.ok(selected.some(({ name }) => name === "theme"));
  });

  for (const order of ["shared first", "host-only first"] as const) {
    it(`hides a name sent twice with different values (${order}): first- and last-value readers never disagree`, () => {
      const jar = new ScopedJar();
      const a = api.generation({ sessionId: SESSION_A, bulky: true });
      const b = api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID, bulky: true });
      if (order === "shared first") {
        plant(jar, a, "shared-domain");
        plant(jar, b, "host-only");
      } else {
        plant(jar, b, "host-only");
        plant(jar, a, "shared-domain");
      }
      jar.set("theme", "dark", "host-only");

      const selected = selectBrowserCookies(parseCookieHeader(jar.header("/")));

      assert.deepEqual(familyOf(selected), []);
      assert.ok(selected.some(({ name }) => name === "theme"));
    });
  }

  it("passes byte-identical copies once", () => {
    const jar = new ScopedJar();
    const session = api.generation({ sessionId: SESSION_A, bulky: true });
    plant(jar, session, "shared-domain");
    plant(jar, session, "host-only");

    assert.deepEqual(
      familyOf(selectBrowserCookies(parseCookieHeader(jar.header("/")))),
      sessionChunks(session).map(({ name }) => name),
    );
  });

  it("hides a bare cookie beside chunks, a gap, and an undecodable value", () => {
    const session = api.generation({ sessionId: SESSION_A, bulky: true });
    const chunks = sessionChunks(session);
    const cases = [
      [{ name: KEY, value: "base64-e30" }, ...chunks],
      [chunks[0], { name: `${KEY}.2`, value: chunks[1].value }],
      [{ name: `${KEY}.0`, value: "base64-not-json" }],
    ];

    for (const pairs of cases) {
      assert.deepEqual(familyOf(selectBrowserCookies(pairs)), []);
    }
  });

  it("never passes malformed names, but keeps the session beside them", () => {
    const session = api.generation({ sessionId: SESSION_A, bulky: true });
    const pairs = [...sessionChunks(session), { name: `${KEY}.0.0`, value: "x" }];

    assert.deepEqual(
      familyOf(selectBrowserCookies(pairs)),
      sessionChunks(session).map(({ name }) => name),
    );
  });

  it("hides a session close to expiry, or whose JWT names another user", () => {
    const near = api.generation({
      sessionId: SESSION_A,
      expiresIn: BROWSER_SESSION_CUTOFF_SECONDS - 5,
    });
    const grafted = {
      ...api.generation({ sessionId: SESSION_A }),
      user: { id: OTHER_USER_ID },
    };

    assert.deepEqual(familyOf(selectBrowserCookies(sessionChunks(near))), []);
    assert.deepEqual(familyOf(selectBrowserCookies(sessionChunks(grafted))), []);
  });
});

describe("browserCookieWrites", () => {
  it("writes each cookie as a host-only expiry, then the shared copy", () => {
    const writes = browserCookieWrites(
      [],
      [{ name: `${KEY}.0`, value: "v", options: { maxAge: 100 } }],
      PUBLIC_HOST,
    );

    assert.equal(writes.length, 2);
    assert.match(writes[0], /^entrepreneuria-auth-token\.0=; Path=\/; Max-Age=0;/);
    assert.doesNotMatch(writes[0], /Domain=/);
    assert.match(writes[1], /^entrepreneuria-auth-token\.0=v; Path=\/; Domain=\.entrepreneuria\.io; Max-Age=100;/);
  });

  it("writes host-only on localhost", () => {
    const writes = browserCookieWrites(
      [],
      [{ name: `${KEY}.0`, value: "v", options: { maxAge: 100 } }],
      "localhost",
    );

    assert.deepEqual(writes.length, 1);
    assert.doesNotMatch(writes[0], /Domain=/);
  });
});

describe("the hub browser client", () => {
  it("has auto-refresh off and refuses refresh grants before they are sent", async () => {
    const { client } = browser(new ScopedJar());

    assert.equal(
      (client.auth as unknown as { autoRefreshToken: boolean }).autoRefreshToken,
      false,
    );
    await assert.rejects(
      refuseRefreshGrants(fetch)(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
      }),
      TypeError,
    );
    assert.equal(api.state.refreshCalls, 0);
  });

  it("reads a sound session without refreshing it", async () => {
    const jar = new ScopedJar();
    const session = api.generation({ sessionId: SESSION_A, bulky: true });
    plant(jar, session, "shared-domain");
    const { client, writes } = browser(jar);

    const { data } = await client.auth.getSession();

    assert.equal(data.session?.access_token, session.access_token);
    assert.equal(api.state.refreshCalls, 0);
    assert.deepEqual(writes, []);
  });

  it("never refreshes a near-expiry session, and writes nothing", async () => {
    const jar = new ScopedJar();
    plant(jar, api.generation({ sessionId: SESSION_A, expiresIn: 60 }), "shared-domain");
    const before = jar.header("/");
    const { client, writes } = browser(jar);

    const { data } = await client.auth.getSession();

    assert.equal(data.session, null);
    assert.equal(api.state.refreshCalls, 0);
    assert.deepEqual(writes, []);
    assert.equal(jar.header("/"), before);
  });

  it("with a duplicated name or a shadowing bare fragment, reads nothing and expires nothing", async () => {
    for (const plantConflict of [
      (jar: ScopedJar) =>
        plant(jar, api.generation({ sessionId: SESSION_B, expiresIn: -60 }), "host-only"),
      (jar: ScopedJar) =>
        jar.set(KEY, `base64-${Buffer.from('{"access_token":"x"}').toString("base64url")}`, "shared-domain"),
    ]) {
      const jar = new ScopedJar();
      plant(jar, api.generation({ sessionId: SESSION_A, bulky: true }), "shared-domain");
      plantConflict(jar);
      const before = jar.header("/");
      const { client, writes } = browser(jar);

      const { data } = await client.auth.getSession();

      assert.equal(data.session, null);
      assert.equal(api.state.refreshCalls, 0);
      assert.deepEqual(writes, []);
      assert.equal(jar.header("/"), before);
    }
  });

  it("a password sign-in over a legacy host-only copy leaves only the shared session", async () => {
    const jar = new ScopedJar();
    plant(jar, api.generation({ sessionId: SESSION_B, bulky: true }), "host-only");
    jar.set(`${KEY}.0.0`, "x", "host-only");
    const { client } = browser(jar);

    const { error } = await client.auth.signInWithPassword({
      email: "founder@example.com",
      password: FAKE_PASSWORD,
    });

    assert.equal(error, null);
    assert.deepEqual(jar.names("host-only", KEY), []);
    assert.ok(jar.names("shared-domain", `${KEY}.`).length > 0);
    assert.equal(api.state.refreshCalls, 0);
  });
});

describe("browser callers", () => {
  it("the reset form refreshes through the server before updating the password", () => {
    const source = readFileSync(
      join(ROOT, "app", "(auth)", "reset-password", "ResetPasswordClient.tsx"),
      "utf8",
    );

    assert.ok(source.indexOf("await refreshSessionThroughServer()") > 0);
    assert.ok(
      source.indexOf("await refreshSessionThroughServer()") < source.indexOf("auth.updateUser("),
    );
  });

  it("the auth provider asks the server when the browser sees no session", () => {
    const source = readFileSync(join(ROOT, "components", "auth", "AuthProvider.tsx"), "utf8");

    assert.match(source, /void refreshUser\(\);\s*\}\);/);
  });
});

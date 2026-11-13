import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { NextRequest } from "next/server";

import { proxy } from "../../proxy";
import { readAuthCookieInventory } from "./auth-cookie-cleanup";
import { revokeSessionCandidates } from "./auth-session-resolution";
import {
  KEY,
  OTHER_USER_ID,
  SUPABASE_URL,
  USER_ID,
  installFakeAuthApi,
  plant,
  sessionChunks,
  type FakeAuthApi,
} from "./testing/fake-auth-api";
import { PUBLIC_HOST, ScopedJar, type Scope } from "./testing/scoped-jar";

/*
 * The session contract as invariants, checked across generated cookie
 * inventories against the fake GoTrue model's ground truth, rather than
 * by replaying known probes.
 *
 * Requests: see "sweep invariants" below (S1–S3).
 *
 * Sign-out:
 *   L1  `complete` only when no credential the browser held still works
 *       and every user those credentials name has no sign-in left.
 *   L2  Anything still usable through a credential the browser held
 *       means the report is not `complete`.
 *   L3  Outages, legacy cookies, truncated or over-budget inventories are
 *       never `complete`; an inventory naming no user is never
 *       `complete`.
 *
 * Simulated here, needing hosted Supabase to confirm: GoTrue's error
 * codes and their HTTP statuses, the parent-of-active and reuse-interval
 * rules, `/logout` scope semantics, and JWT signature checks.
 */

const LOCAL_URL = "http://localhost:3000";

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
});

const config = () => ({
  supabaseUrl: SUPABASE_URL,
  supabaseKey: "fake-anon-key",
});

/* A deterministic generator, so a failure always reproduces. */
function prng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

const ACCESS = ["valid", "near-expiry", "expired", "forged", "revoked"] as const;
const REFRESH = ["own", "same-user-other", "other-user", "dead"] as const;
type Access = (typeof ACCESS)[number];
type Refresh = (typeof REFRESH)[number];
type Spec = { user: string; access: Access; refresh: Refresh; sessionId: boolean };

type Built = {
  spec: Spec;
  session: Record<string, unknown>;
  /** The sign-in its access token was issued for; null when forged. */
  accessSession: string | null;
  /** The sign-in its refresh token belongs to; null when dead. */
  refreshSession: string | null;
  refreshUser: string | null;
};

let ids = 0;
const newSessionId = () =>
  `00000000-0000-4000-8000-${(ids += 1).toString(16).padStart(12, "0")}`;

/** Builds one candidate on the fake, recording its ground truth. */
function build(spec: Spec): Built {
  const sessionId = newSessionId();
  const expiresIn =
    spec.access === "near-expiry" ? 60 : spec.access === "expired" ? -60 : 3600;

  if (spec.access === "forged") {
    const forged = api.forgedSession({ sessionId, userId: spec.user });
    return finish(forged, null, sessionId);
  }

  const own = api.generation({
    sessionId,
    userId: spec.user,
    expiresIn,
    omitSessionId: !spec.sessionId,
  });

  if (spec.access === "revoked") api.revokeSession(sessionId);

  return finish(own, sessionId, sessionId);

  function finish(
    base: Record<string, unknown>,
    accessSession: string | null,
    ownSession: string
  ): Built {
    if (spec.refresh === "own") {
      const alive = spec.access !== "revoked" && spec.access !== "forged";
      return {
        spec,
        session: base,
        accessSession,
        refreshSession: alive ? ownSession : null,
        refreshUser: alive ? spec.user : null,
      };
    }

    if (spec.refresh === "dead") {
      return {
        spec,
        session: { ...base, refresh_token: `dead-${ownSession}` },
        accessSession,
        refreshSession: null,
        refreshUser: null,
      };
    }

    const otherUser =
      spec.refresh === "other-user"
        ? spec.user === USER_ID
          ? OTHER_USER_ID
          : USER_ID
        : spec.user;
    const otherSession = newSessionId();
    const other = api.generation({ sessionId: otherSession, userId: otherUser });

    return {
      spec,
      session: { ...base, refresh_token: other.refresh_token },
      accessSession,
      refreshSession: otherSession,
      refreshUser: otherUser,
    };
  }
}

function randomSpec(next: () => number): Spec {
  const pick = <T>(values: readonly T[]) =>
    values[Math.floor(next() * values.length)];

  return {
    user: next() < 0.75 ? USER_ID : OTHER_USER_ID,
    access: pick(ACCESS),
    refresh: pick(REFRESH),
    sessionId: next() < 0.85,
  };
}

function every1(): Spec[][] {
  return ACCESS.flatMap((access) =>
    REFRESH.flatMap((refresh) =>
      [true, false].map((sessionId) => [
        { user: USER_ID, access, refresh, sessionId },
      ])
    )
  );
}

function sampled(count: number, size: number, seed: number): Spec[][] {
  const next = prng(seed);
  return Array.from({ length: count }, () =>
    Array.from({ length: size }, () => randomSpec(next))
  );
}

/* Each candidate as its own bare cookie value: the Cookie header can
   carry the same name any number of times (scopes, paths). */
function inventoryFor(built: Built[]) {
  const header = built
    .map(({ session }) => {
      const [{ value }] = sessionChunks(session);
      return `${KEY}=${value}`;
    })
    .join("; ");

  return readAuthCookieInventory(
    new NextRequest(`${LOCAL_URL}/dashboard`, {
      headers: {
        host: PUBLIC_HOST,
        "x-forwarded-proto": "https",
        cookie: header,
      },
    })
  );
}

const describeSpecs = (specs: Spec[]) =>
  specs
    .map(
      (spec) =>
        `${spec.user === USER_ID ? "U" : "V"}:${spec.access}/${spec.refresh}${spec.sessionId ? "" : "/no-sid"}`
    )
    .join(" + ");

function accessAccepted(candidate: Built) {
  const { spec } = candidate;
  return (
    (spec.access === "valid" || spec.access === "near-expiry") &&
    candidate.accessSession !== null &&
    api.isLive(candidate.accessSession)
  );
}

function holdsUsableCredential(candidate: Built) {
  return (
    accessAccepted(candidate) ||
    (candidate.refreshSession !== null && api.canRefresh(candidate.refreshSession))
  );
}

function proxyRequest(jar: ScopedJar, path = "/dashboard") {
  return new NextRequest(`${LOCAL_URL}${path}`, {
    headers: {
      host: PUBLIC_HOST,
      "x-forwarded-proto": "https",
      cookie: jar.header(path),
    },
  });
}

function decodeShared(jar: ScopedJar) {
  const value = jar
    .names("shared-domain", KEY)
    .map((name) => jar.get(name, "shared-domain"))
    .join("");

  return value
    ? (JSON.parse(
        Buffer.from(decodeURIComponent(value).replace(/^base64-/, ""), "base64url").toString()
      ) as { user: { id: string }; access_token: string })
    : null;
}

/*
 * Sweep invariants, for any two generated candidates planted in the two
 * scopes under the same names:
 *   S1  The first GET makes no Auth API call, writes no session, expires
 *       only host-only copies, and answers 303 to the same URL.
 *   S2  No request ever ends a sign-in (no `/logout`, no session row
 *       deleted), whatever the copies hold.
 *   S3  A session written after the sweep is the shared copy's own: its
 *       refresh token's sign-in. The host-only copy's tokens are never
 *       presented.
 */
describe("sweep invariants (sampled, both scopes)", () => {
  it("hold for every sampled pair", async () => {
    for (const [index, specs] of sampled(80, 2, 99).entries()) {
      api = installFakeAuthApi();
      globalThis.fetch = api.fetchStub;
      const built = specs.map(build);
      const jar = new ScopedJar(PUBLIC_HOST);
      const [shared, hostOnly] = index % 2 === 0 ? [built[0], built[1]] : [built[1], built[0]];
      plant(jar, shared.session, "shared-domain");
      plant(jar, hostOnly.session, "host-only");
      const label = describeSpecs(specs);
      const liveBefore = [...new Set(
        built.flatMap(({ accessSession, refreshSession }) => [accessSession, refreshSession])
      )].filter((id): id is string => id !== null && api.isLive(id));
      const duplicated = jar.names("host-only", KEY).some((name) =>
        jar.names("shared-domain", KEY).includes(name)
      );

      const first = await proxy(proxyRequest(jar));

      if (duplicated) {
        /* S1 */
        assert.equal(first.status, 303, label);
        assert.equal(api.state.refreshCalls, 0, label);
        assert.deepEqual(api.state.validatedTokens, [], label);
        for (const header of first.headers.getSetCookie().filter((h) => h.startsWith(KEY))) {
          assert.match(header, /Max-Age=0/, label);
          assert.doesNotMatch(header, /Domain=/, label);
        }
      }

      jar.apply(first);
      for (let step = 0; step < 2; step += 1) {
        jar.apply(await proxy(proxyRequest(jar)));
      }

      /* S2 */
      assert.equal(api.state.logoutCalls, 0, label);
      for (const id of liveBefore) assert.equal(api.isLive(id), true, label);

      /* S3 */
      if (duplicated) {
        assert.equal(
          api.state.refreshedTokens.includes(hostOnly.session.refresh_token as string) &&
            hostOnly.session.refresh_token !== shared.session.refresh_token,
          false,
          label
        );
        const written = decodeShared(jar);
        if (written && api.state.rotations > 0) {
          assert.equal(api.sessionOf(written.access_token), shared.refreshSession, label);
        }
      }
    }
  });
});

/*
 * Formerly OPEN (two `todo` tests): "a lone cookie pairing A's access
 * token with B's refresh token never becomes B". Resolved by scope, not
 * by probing:
 *
 * - The realistic source of such a pair was a family stitched from two
 *   copies: chunks of one scope interleaved with chunks of the other
 *   under the same names, or a bare value shadowing chunks. Neither is
 *   ever read now. Duplicated names are swept before any client runs,
 *   and a bare cookie beside chunks is stripped from the request. One
 *   family left alone was written by one writer in one batch, and holds
 *   one sign-in's tokens.
 * - A lone pair planted deliberately requires B's refresh token. Whoever
 *   holds that already holds B's session; refreshing it in their own
 *   browser grants nothing they could not take directly, so binding the
 *   refresh to the access token's sign-in is not a security boundary.
 *   Enforcing it would mean probing the Auth API on every refresh — the
 *   per-request probing this change removes.
 *
 * What is tested instead is the guarantee that closes the real source.
 */
describe("a family stitched from two copies is never read", () => {
  for (const order of ["shared first", "host-only first"] as const) {
    it(`A's chunks over B's (${order}): no token of either is presented`, async () => {
      const a = api.generation({ sessionId: newSessionId(), bulky: true });
      const b = api.generation({
        sessionId: newSessionId(),
        userId: OTHER_USER_ID,
        bulky: true,
      });
      const jar = new ScopedJar(PUBLIC_HOST);
      if (order === "shared first") {
        plant(jar, a, "shared-domain");
        plant(jar, b, "host-only");
      } else {
        plant(jar, b, "host-only");
        plant(jar, a, "shared-domain");
      }

      const response = await proxy(proxyRequest(jar));

      assert.equal(response.status, 303);
      assert.deepEqual(api.state.refreshedTokens, []);
      assert.deepEqual(api.state.validatedTokens, []);
      jar.apply(response);
      assert.equal(decodeShared(jar)?.user.id, USER_ID);
      assert.deepEqual(jar.names("host-only", KEY), []);
    });
  }
});

describe("sign-out invariants", () => {
  async function checkSignOut(specs: Spec[], mode: "up" | "down" | "gateway-403" = "up") {
    api = installFakeAuthApi();
    globalThis.fetch = api.fetchStub;
    const built = specs.map(build);
    /* A second device of every user, outside this browser. */
    const elsewhere = [USER_ID, OTHER_USER_ID].map((user) => {
      const id = newSessionId();
      api.generation({ sessionId: id, userId: user });
      return { user, id };
    });
    api.state.mode = mode;

    const report = await revokeSessionCandidates(inventoryFor(built), config());
    api.state.mode = "up";
    const label = `${mode} ${describeSpecs(specs)} → ${report.status}`;

    const stillUsable = built.some(holdsUsableCredential);
    const namedUsers = new Set(
      built.flatMap((candidate) =>
        [candidate.spec.user, candidate.refreshUser].filter(
          (user): user is string => user !== null
        )
      )
    );

    /* L2 */
    if (stillUsable) assert.equal(report.status, "incomplete", label);

    if (report.status === "complete") {
      /* L1 */
      assert.equal(stillUsable, false, label);
      for (const user of namedUsers) {
        assert.deepEqual(api.liveSessionsOf(user), [], `${label} user ${user}`);
      }
      assert.equal(report.usersUnconfirmed, 0, label);
      assert.ok(report.revoked > 0, label);
    }

    /* L3 */
    if (mode !== "up") assert.notEqual(report.status, "complete", label);

    return { report, elsewhere };
  }

  it("hold for every single candidate", async () => {
    for (const specs of every1()) await checkSignOut(specs);
  });

  for (const size of [2, 3, 4]) {
    it(`hold for ${size} candidates (sampled)`, async () => {
      for (const specs of sampled(100, size, 31 * size)) await checkSignOut(specs);
    });
  }

  it("hold through outages", async () => {
    for (const specs of sampled(40, 2, 5)) {
      await checkSignOut(specs, "down");
      await checkSignOut(specs, "gateway-403");
    }
  });

  it("end a user's sessions on other devices, or say they could not", async () => {
    const { report, elsewhere } = await checkSignOut([
      { user: USER_ID, access: "valid", refresh: "own", sessionId: true },
    ]);

    assert.equal(report.status, "complete");
    assert.equal(api.isLive(elsewhere[0].id), false);
    /* Another user's device is never touched. */
    assert.equal(api.isLive(elsewhere[1].id), true);
  });

  it("revoking the refresh token's user never vouches for the access token's user", async () => {
    /* Expired access token of U beside a live refresh token of V. */
    const { report, elsewhere } = await checkSignOut([
      { user: USER_ID, access: "expired", refresh: "other-user", sessionId: true },
    ]);

    assert.notEqual(report.status, "complete");
    assert.equal(report.usersUnconfirmed, 1);
    assert.equal(api.isLive(elsewhere[1].id), false);
    assert.equal(api.isLive(elsewhere[0].id), true);
  });

  it("an expired access token is not a revoked session", async () => {
    const { report } = await checkSignOut([
      { user: USER_ID, access: "expired", refresh: "dead", sessionId: true },
    ]);

    assert.equal(report.status, "local");
    assert.equal(report.revoked, 0);
  });

  for (const [label, header] of [
    ["empty", ""],
    ["unreadable-only", `${KEY}=base64-!!corrupt!!`],
    ["legacy-only", "sb-project-ref-auth-token=legacy; sb-refresh-token=legacy"],
  ] as const) {
    it(`a ${label} inventory never reports a sign-out everywhere`, async () => {
      const inventory = readAuthCookieInventory(
        new NextRequest(`${LOCAL_URL}/`, {
          headers: {
            host: PUBLIC_HOST,
            "x-forwarded-proto": "https",
            cookie: header,
          },
        })
      );

      const report = await revokeSessionCandidates(inventory, config());

      assert.notEqual(report.status, "complete");
      assert.equal(report.status, label === "legacy-only" ? "incomplete" : "local");
    });
  }

  it("a truncated inventory is incomplete", async () => {
    const built = [build({ user: USER_ID, access: "valid", refresh: "own", sessionId: true })];
    const report = await revokeSessionCandidates(
      { ...inventoryFor(built), candidatesTruncated: true },
      config()
    );

    assert.equal(report.status, "incomplete");
  });

  it("stays within its budget when the Auth API hangs, and says so", async () => {
    const built = Array.from({ length: 4 }, () =>
      build({ user: USER_ID, access: "valid", refresh: "own", sessionId: true })
    );
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as typeof fetch;
    const started = Date.now();
    /* AbortSignal.timeout's timer is unref'd, and this stub opens no
       socket the way a real fetch does, so nothing else would keep the
       event loop alive until the budget runs out. */
    const keepAlive = setInterval(() => {}, 1000);

    try {
      const report = await revokeSessionCandidates(inventoryFor(built), {
        ...config(),
        timeoutMs: 50,
        deadline: Date.now() + 200,
      });

      assert.equal(report.status, "incomplete");
      assert.ok(Date.now() - started < 1500);
    } finally {
      clearInterval(keepAlive);
    }
  });
});


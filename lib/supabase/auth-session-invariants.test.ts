import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { NextRequest } from "next/server";

import { proxy } from "../../proxy";
import { readAuthCookieInventory } from "./auth-cookie-cleanup";
import {
  resolveSessionConflict,
  revokeSessionCandidates,
  type SessionResolution,
} from "./auth-session-resolution";
import { getSupabaseCookieOptions } from "./cookie-options";
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
 * Resolution (conflict path):
 *   R1  A session is only written canonically when its refresh produced
 *       the same user and the same non-null sign-in as an access token
 *       the Auth API accepted in that request.
 *   R2  A request is only ever served as a user an accepted access token
 *       names — never one only a refresh token leads to.
 *   R3  Cookies are only deleted (live, revoked) when every other
 *       candidate holds no usable credential.
 *   R4  Resolution never ends a sign-in, never triggers reuse, and
 *       rotates at most one refresh token.
 *   R5  Without a definitive Auth API, nothing is written or deleted.
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
  cookieOptions: getSupabaseCookieOptions(PUBLIC_HOST),
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

function decodeSession(resolution: SessionResolution) {
  if (resolution.status !== "live" && resolution.status !== "pinned") return null;

  const joined = resolution.cookies
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ value }) => value)
    .join("");

  return JSON.parse(
    Buffer.from(joined.replace(/^base64-/, ""), "base64url").toString()
  ) as { access_token: string; user: { id: string } };
}

async function checkResolution(specs: Spec[]) {
  api = installFakeAuthApi();
  globalThis.fetch = api.fetchStub;
  const built = specs.map(build);
  const liveBefore = built
    .flatMap(({ accessSession, refreshSession }) => [accessSession, refreshSession])
    .filter((id): id is string => id !== null && api.isLive(id));
  const usableBefore = built.map(holdsUsableCredential);
  const acceptedBefore = built.map(accessAccepted);

  const resolution = await resolveSessionConflict(inventoryFor(built), config());
  const label = `${describeSpecs(specs)} → ${resolution.status}`;
  const served = decodeSession(resolution);

  /* R4 */
  assert.equal(api.state.reuseDetected, false, label);
  assert.ok(api.state.rotations <= 1, label);
  for (const id of liveBefore) assert.equal(api.isLive(id), true, label);

  if (resolution.status === "live") {
    /* R1: the refresh was bound to an accepted access token's sign-in. */
    const committedSession = api.sessionOf(served!.access_token);
    const anchor = built.find(
      (candidate, index) =>
        acceptedBefore[index] &&
        candidate.spec.sessionId &&
        candidate.accessSession === committedSession &&
        candidate.refreshSession === committedSession
    );
    assert.notEqual(anchor, undefined, label);
    assert.equal(served!.user.id, anchor!.spec.user, label);

    /* R3 */
    built.forEach((candidate, index) => {
      if (candidate !== anchor) assert.equal(usableBefore[index], false, label);
    });
  }

  if (resolution.status === "pinned") {
    /* R2: served through an access token the Auth API accepted. */
    const index = built.findIndex(
      ({ session }) => session.access_token === served!.access_token
    );
    assert.ok(index >= 0, label);
    assert.equal(acceptedBefore[index], true, label);
    assert.equal(built[index].spec.sessionId, true, label);
    assert.equal(served!.user.id, built[index].spec.user, label);
  }

  if (resolution.status === "revoked") {
    /* R3 */
    assert.equal(usableBefore.every((usable) => !usable), true, label);
  }

  return resolution;
}

describe("resolution invariants", () => {
  it("hold for every single candidate", async () => {
    for (const specs of every1()) await checkResolution(specs);
  });

  for (const size of [2, 3, 4]) {
    it(`hold for ${size} candidates (sampled)`, async () => {
      for (const specs of sampled(120, size, 7 * size)) await checkResolution(specs);
    });
  }

  it("never adopt a refresh token whose sign-in differs from the accepted access token's", async () => {
    for (const refresh of ["same-user-other", "other-user"] as const) {
      for (const access of ["valid", "near-expiry", "expired"] as const) {
        const resolution = await checkResolution([
          { user: USER_ID, access, refresh, sessionId: true },
        ]);
        assert.notEqual(resolution.status, "live", `${access}/${refresh}`);
      }
    }
  });

  it("treat a missing session id as unresolved, never as a binding", async () => {
    for (const refresh of REFRESH) {
      const resolution = await checkResolution([
        { user: USER_ID, access: "valid", refresh, sessionId: false },
      ]);
      assert.ok(
        ["unresolved", "revoked"].includes(resolution.status),
        refresh
      );
    }
  });

  /* R5 */
  it("change nothing while the Auth API gives no definitive answer", async () => {
    for (const mode of ["down", "unavailable", "gateway-401", "gateway-403", "gateway-404"] as const) {
      for (const specs of sampled(30, 2, mode.length)) {
        api = installFakeAuthApi();
        globalThis.fetch = api.fetchStub;
        const built = specs.map(build);
        const sessions = built.flatMap(({ accessSession, refreshSession }) =>
          [accessSession, refreshSession].filter((id): id is string => id !== null)
        );
        const before = sessions.map((id) => [api.isLive(id), api.canRefresh(id)]);
        api.state.mode = mode;

        const resolution = await resolveSessionConflict(inventoryFor(built), config());

        assert.ok(
          !["live", "revoked", "pinned"].includes(resolution.status),
          `${mode} ${describeSpecs(specs)}`
        );
        assert.deepEqual(
          sessions.map((id) => [api.isLive(id), api.canRefresh(id)]),
          before
        );
      }
    }
  });

  it("a refresh that rotated server-side but timed out changes nothing, and recovers next time", async () => {
    const built = build({ user: USER_ID, access: "valid", refresh: "own", sessionId: true });
    const extra = build({ user: USER_ID, access: "revoked", refresh: "own", sessionId: true });
    const inventory = inventoryFor([built, extra]);
    let dropNextRefresh = true;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await api.fetchStub(input, init);
      if (String(input).includes("/token") && dropNextRefresh) {
        dropNextRefresh = false;
        throw new TypeError("timed out after the server rotated");
      }
      return response;
    }) as typeof fetch;

    const first = await resolveSessionConflict(inventory, config());
    /* Served unwritten by the accepted access token. */
    assert.equal(first.status, "pinned");
    assert.equal(api.canRefresh(built.refreshSession!), true);

    /* Presented again it is the parent of the active token. */
    const second = await resolveSessionConflict(inventory, config());
    assert.equal(second.status, "live");
    assert.equal(api.state.reuseDetected, false);
  });

  it("stay within the request budget when the Auth API hangs", async () => {
    const built = [
      build({ user: USER_ID, access: "valid", refresh: "own", sessionId: true }),
      build({ user: USER_ID, access: "revoked", refresh: "own", sessionId: true }),
    ];
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as typeof fetch;
    const started = Date.now();

    const resolution = await resolveSessionConflict(inventoryFor(built), {
      ...config(),
      timeoutMs: 50,
      deadline: Date.now() + 120,
    });

    assert.equal(resolution.status, "unverifiable");
    assert.ok(Date.now() - started < 1000);
  });
});

describe("middleware cookie writes follow the resolution invariants", () => {
  it("never writes or deletes a session family without a proven survivor (sampled, both scopes)", async () => {
    const scopes: [Scope, Scope][] = [
      ["shared-domain", "host-only"],
      ["host-only", "shared-domain"],
    ];

    for (const [index, specs] of sampled(60, 2, 99).entries()) {
      api = installFakeAuthApi();
      globalThis.fetch = api.fetchStub;
      const built = specs.map(build);
      const jar = new ScopedJar(PUBLIC_HOST);
      const [first, second] = scopes[index % 2];
      plant(jar, built[0].session, first);
      plant(jar, built[1].session, second);
      const usable = built.map(holdsUsableCredential);
      const label = describeSpecs(specs);

      const response = await proxy(
        new NextRequest(`${LOCAL_URL}/dashboard`, {
          headers: {
            host: PUBLIC_HOST,
            "x-forwarded-proto": "https",
            cookie: jar.header("/dashboard"),
          },
        })
      );
      const sessionHeaders = response.headers
        .getSetCookie()
        .filter((header) => header.startsWith(KEY));
      const writes = sessionHeaders.filter((header) => !/Max-Age=0/i.test(header));
      const deletions = sessionHeaders.filter((header) => /Max-Age=0/i.test(header));

      if (writes.length > 0) {
        /* Whatever is written was bound in this request: its user is one
           an accepted access token named. */
        jar.apply(response);
        const [{ value }] = [{ value: jar.names("shared-domain", KEY).map((name) => jar.get(name, "shared-domain")).join("") }];
        const written = JSON.parse(
          Buffer.from(decodeURIComponent(value).replace(/^base64-/, ""), "base64url").toString()
        ) as { user: { id: string }; access_token: string };
        const anchor = built.find(
          (candidate) =>
            candidate.spec.sessionId &&
            candidate.accessSession !== null &&
            candidate.accessSession === api.sessionOf(written.access_token)
        );
        assert.notEqual(anchor, undefined, label);
        assert.equal(written.user.id, anchor!.spec.user, label);
      }

      if (deletions.length > 0 && writes.length === 0) {
        /* Everything retired held nothing usable. */
        assert.equal(usable.every((value) => !value), true, label);
      }
    }
  });
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

    const report = await revokeSessionCandidates(inventoryFor(built), {
      ...config(),
      timeoutMs: 50,
      deadline: Date.now() + 200,
    });

    assert.equal(report.status, "incomplete");
    assert.ok(Date.now() - started < 1500);
  });
});

/*
 * OPEN — requires an architectural decision (see the remediation report).
 *
 * A lone cookie never reaches conflict resolution: stock auth-js reads
 * and refreshes it — in this middleware, in server clients, and in every
 * browser client of every app sharing `.entrepreneuria.io`. A cookie
 * pairing A's access token with B's refresh token is therefore refreshed
 * into B. These tests assert the contract and are expected to fail until
 * that decision is made and implemented. They are `todo`: node:test
 * reports a failing todo without failing the suite, and also reports one
 * that starts passing — so check the todo lines of each run, and drop the
 * `todo` once the decision lands.
 */
describe("OPEN: a lone cookie is held to the same binding contract", () => {
  for (const [label, access] of [
    ["accepted access token, stored expiry in the past", "valid-stale-expiry"],
    ["expired access token", "expired"],
  ] as const) {
    it(`${label}: A's access + B's refresh never becomes B`, { todo: "OPEN: requires an architectural decision — see the remediation report" }, async () => {
      const a = api.generation({
        sessionId: newSessionId(),
        expiresIn: access === "expired" ? -60 : 3600,
      });
      const b = api.generation({ sessionId: newSessionId(), userId: OTHER_USER_ID });
      const jar = new ScopedJar(PUBLIC_HOST);
      plant(
        jar,
        {
          ...a,
          refresh_token: b.refresh_token,
          ...(access === "valid-stale-expiry"
            ? { expires_at: Math.floor(Date.now() / 1000) - 10 }
            : {}),
        },
        "shared-domain"
      );

      const response = await proxy(
        new NextRequest(`${LOCAL_URL}/dashboard`, {
          headers: {
            host: PUBLIC_HOST,
            "x-forwarded-proto": "https",
            cookie: jar.header("/dashboard"),
          },
        })
      );
      jar.apply(response);
      const value = jar
        .names("shared-domain", KEY)
        .map((name) => jar.get(name, "shared-domain"))
        .join("");
      const stored = JSON.parse(
        Buffer.from(decodeURIComponent(value).replace(/^base64-/, ""), "base64url").toString()
      ) as { user: { id: string } };

      assert.notEqual(stored.user.id, OTHER_USER_ID);
    });
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";

import SignOutPage from "../../app/(auth)/sign-out/page";
import { GET as signOutGet, POST as signOut } from "../../app/auth/signout/route";
import { proxy } from "../../proxy";
import { isSameOriginRequest } from "../auth/same-origin";
import { SIGN_OUT_PAGE_PATH } from "../auth/session-recovery";
import { SIGN_OUT_FAILED_PATH, signOutDestination } from "../auth/sign-out-client";
import {
  AUTH_COOKIES_HELD_HEADER,
  browserHeldAuthCookies,
  readAuthCookieInventory,
} from "./auth-cookie-cleanup";
import {
  MAX_JUDGED_CANDIDATES,
  resolveSessionConflict,
  revokeSessionCandidates,
} from "./auth-session-resolution";
import { getSupabaseCookieOptions } from "./cookie-options";
import {
  KEY,
  OTHER_USER_ID,
  SUPABASE_URL,
  installFakeAuthApi,
  plant,
  type FakeAuthApi,
} from "./testing/fake-auth-api";
import { PUBLIC_HOST, ScopedJar, type Scope } from "./testing/scoped-jar";

/*
 * Adversarial regressions for session resolution and sign-out. A cookie
 * is attacker-controllable data — any host on `.entrepreneuria.io` can
 * plant one — so nothing it claims (expiry, sign-in, user) may on its
 * own cause a session to be adopted, deleted, refreshed into reuse, or
 * reported revoked. The fake Auth API keeps GoTrue's server state, so
 * these assert on what is actually live, refreshable or revoked.
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
const originalWarn = console.warn;
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
  Date.now = realNow;
  clockOffset = 0;
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

const SESSION_A = "00000000-0000-4000-8000-0000000000aa";
const SESSION_B = "00000000-0000-4000-8000-0000000000bb";
const SESSION_C = "00000000-0000-4000-8000-0000000000cc";
const SCOPES: [Scope, Scope][] = [
  ["shared-domain", "host-only"],
  ["host-only", "shared-domain"],
];

/** Captures console.warn calls instead of printing them. */
function captureWarnings() {
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    calls.push(args);
  };

  return calls;
}

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

function logoutRequest(jar: ScopedJar, headers: Record<string, string> = {}) {
  return request(SIGN_OUT_ROUTE, jar, {
    method: "POST",
    headers: { origin: ORIGIN, ...headers },
  });
}

const config = () => ({
  supabaseUrl: SUPABASE_URL,
  supabaseKey: "fake-anon-key",
  cookieOptions: getSupabaseCookieOptions(PUBLIC_HOST),
});

function inventoryOf(jar: ScopedJar) {
  return readAuthCookieInventory(request("/dashboard", jar));
}

function sessionSetCookies(response: Response) {
  return response.headers
    .getSetCookie()
    .filter((header) => header.startsWith(KEY));
}

function forwardedSession(response: Response) {
  const forwarded = response.headers.get("x-middleware-request-cookie") ?? "";
  const joined = forwarded
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair.startsWith(KEY))
    .sort()
    .map((pair) => pair.slice(pair.indexOf("=") + 1))
    .join("");

  return joined
    ? (JSON.parse(
        Buffer.from(
          decodeURIComponent(joined).replace(/^base64-/, ""),
          "base64url"
        ).toString()
      ) as Record<string, unknown>)
    : null;
}

/** A copy of a sign-in revoked server-side whose JWT has not expired. */
function revokedCopy(sessionId: string) {
  const copy = api.generation({ sessionId, refreshLive: false, bulky: true });
  api.revokeSession(sessionId);
  return copy;
}

async function renderPage(params: Record<string, string>) {
  return renderToStaticMarkup(
    await SignOutPage({ searchParams: Promise.resolve(params) })
  );
}

describe("Codex probe 1: an access token never vouches for the refresh token beside it", () => {
  for (const [label, otherUser] of [
    ["same user", undefined],
    ["another user", OTHER_USER_ID],
  ] as const) {
    for (const [mismatchScope, otherScope] of SCOPES) {
      it(`A's access + B's refresh (${label}, in ${mismatchScope}) is never adopted`, async () => {
        const jar = new ScopedJar(PUBLIC_HOST);
        const a = api.generation({ sessionId: SESSION_A, bulky: true });
        const b = api.generation({ sessionId: SESSION_B, userId: otherUser, bulky: true });
        /* The probe: A's live access token, B's live refresh token. */
        plant(jar, { ...a, refresh_token: b.refresh_token }, mismatchScope);
        /* A copy the Auth API rules out, so the probe is the only open
           candidate — the case that used to be canonicalized. */
        plant(jar, revokedCopy(SESSION_C), otherScope);
        const before = jar.header();

        const resolution = await resolveSessionConflict(inventoryOf(jar), config());
        assert.equal(resolution.status, "unresolved");

        const response = await proxy(request("/dashboard", jar));

        assert.match(response.headers.get("location") ?? "", /reason=session-unresolved/);
        assert.deepEqual(sessionSetCookies(response), []);
        assert.equal(forwardedSession(response), null);
        jar.apply(response);
        assert.equal(jar.header(), before);
        /* Neither sign-in was revoked or lost. B's refresh token was
           rotated by the proof attempt, but presenting it again is the
           parent-of-active case: B stays refreshable. */
        assert.equal(api.isLive(SESSION_A), true);
        assert.equal(api.isLive(SESSION_B), true);
        assert.equal(api.canRefresh(SESSION_B), true);
        assert.equal(api.state.reuseDetected, false);
      });
    }
  }

  it("beside A's own family the probe is served as A, adopted nowhere, B never presented", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    const a = api.generation({ sessionId: SESSION_A, bulky: true });
    const b = api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID, bulky: true });
    plant(jar, a, "shared-domain");
    plant(jar, { ...a, refresh_token: b.refresh_token }, "host-only");
    const before = jar.header();

    const response = await proxy(request("/dashboard", jar));

    assert.equal(response.headers.get("location"), null);
    assert.equal(forwardedSession(response)?.access_token, a.access_token);
    assert.deepEqual(sessionSetCookies(response), []);
    assert.deepEqual(api.state.refreshedTokens, []);
    jar.apply(response);
    assert.equal(jar.header(), before);
  });

  it("the probe alone, once its access token expires, is still not adopted", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    const a = api.generation({ sessionId: SESSION_A, expiresIn: -60 });
    const b = api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID });
    plant(jar, { ...a, refresh_token: b.refresh_token }, "host-only");
    plant(jar, revokedCopy(SESSION_C), "shared-domain");

    const resolution = await resolveSessionConflict(inventoryOf(jar), config());

    /* Its claims named A; the refresh produced B. */
    assert.equal(resolution.status, "unresolved");
  });

  it("a pinned request carries the verified expiry and user, never the cookie's own", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    const a = api.generation({ sessionId: SESSION_A });
    /* Claims to expire now (so auth-js would refresh it downstream) and
       carries someone else's cached profile. */
    plant(
      jar,
      {
        ...a,
        expires_at: Math.floor(Date.now() / 1000),
        user: { id: a.user.id, email: "planted@example.com" },
      },
      "shared-domain"
    );
    plant(
      jar,
      api.generation({ sessionId: SESSION_B, expiresIn: -60, bulky: true }),
      "host-only"
    );

    const response = await proxy(request("/dashboard", jar));
    const forwarded = forwardedSession(response);

    assert.ok(
      (forwarded?.expires_at as number) > Math.floor(Date.now() / 1000) + 3000
    );
    assert.equal(
      (forwarded?.user as { email: string }).email,
      "founder@example.com"
    );
    assert.equal(api.state.refreshCalls, 0);
  });
});

describe("Codex probe 2: sign-out is complete only when every copy is accounted for", () => {
  it("a copy claiming an already signed-out user still has its own tokens revoked", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    const mine = api.generation({ sessionId: SESSION_A, bulky: true });
    const theirs = api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID });
    /* Claims to be mine (expired JWT naming me), holds their refresh. */
    const claimsMine = api.generation({ sessionId: SESSION_A, expiresIn: -60 });
    plant(jar, mine, "shared-domain");
    plant(jar, { ...claimsMine, refresh_token: theirs.refresh_token }, "host-only");

    const response = await signOut(logoutRequest(jar));

    assert.equal(api.isLive(SESSION_A), false);
    /* The old shortcut marked this copy "covered" and left B live. */
    assert.equal(api.isLive(SESSION_B), false);
    assert.equal(response.headers.get("x-auth-revocation"), "complete");
  });

  it("is reported incomplete when that other sign-in cannot be revoked", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    const mine = api.generation({ sessionId: SESSION_A, bulky: true });
    const theirs = api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID });
    const claimsMine = api.generation({ sessionId: SESSION_A, expiresIn: -60 });
    plant(jar, mine, "shared-domain");
    plant(jar, { ...claimsMine, refresh_token: theirs.refresh_token }, "host-only");
    api.state.logoutFailure = (token) =>
      api.sessionOf(token) === SESSION_B ? 500 : null;
    const warnings = captureWarnings();

    const response = await signOut(logoutRequest(jar));

    assert.equal(api.isLive(SESSION_A), false);
    assert.equal(api.isLive(SESSION_B), true);
    assert.equal(response.headers.get("x-auth-revocation"), "incomplete");
    assert.equal(
      response.headers.get("location"),
      `${ORIGIN}${SIGN_OUT_PAGE_PATH}?status=incomplete`
    );
    assert.doesNotMatch(JSON.stringify(warnings), /eyJ|refresh-|fake-/);
    jar.apply(response);
    assert.deepEqual(jar.names("shared-domain", KEY), []);
    assert.deepEqual(jar.names("host-only", KEY), []);
  });

  it("a refresh token GoTrue reports as reused leaves the result uncertain", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    const theirs = api.generation({
      sessionId: SESSION_B,
      userId: OTHER_USER_ID,
      expiresIn: -60,
      refreshLive: false,
      consumed: true,
    });
    /* A live sibling keeps the sign-in row and its access token alive. */
    api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID });
    plant(jar, theirs, "shared-domain");

    const report = await revokeSessionCandidates(inventoryOf(jar), config());

    assert.equal(report.uncertain, 1);
    assert.equal(report.status, "incomplete");
    assert.equal(api.isLive(SESSION_B), true);
  });

  it("distinguishes revoked, already-invalid and uncertain copies", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(jar, api.generation({ sessionId: SESSION_A }), "shared-domain");
    plant(jar, revokedCopy(SESSION_C), "host-only");

    const report = await revokeSessionCandidates(inventoryOf(jar), config());

    /* Counted per credential (two tokens per copy) and per user. */
    assert.equal(report.status, "complete");
    assert.equal(report.candidates, 2);
    assert.equal(report.revoked, 1);
    assert.equal(report.alreadyInvalid, 3);
    assert.equal(report.uncertain, 0);
    assert.equal(report.skipped, 0);
    assert.equal(report.usersSignedOut, 1);
    assert.equal(report.usersUnconfirmed, 0);
  });

  it("past the candidate budget it is never complete, and resolution concludes nothing", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(jar, api.generation({ sessionId: SESSION_A }), "shared-domain");
    const inventory = inventoryOf(jar);
    const crowded = {
      ...inventory,
      conflict: true,
      candidates: Array.from({ length: MAX_JUDGED_CANDIDATES + 1 }, (_, index) => ({
        ...inventory.candidates[0],
        refreshToken: `copy-${index}`,
      })),
    };

    assert.equal((await resolveSessionConflict(crowded, config())).status, "unresolved");
    assert.deepEqual(api.state.validatedTokens, []);
    assert.equal(api.state.refreshCalls, 0);

    const report = await revokeSessionCandidates(crowded, config());
    assert.equal(report.skipped, 1);
    assert.equal(report.status, "incomplete");
  });
});

describe("sign-out CSRF protection", () => {
  const allowed: [string, Record<string, string>][] = [
    ["same Origin, no Sec-Fetch-Site", { origin: ORIGIN }],
    ["same Origin, Sec-Fetch-Site same-origin", { origin: ORIGIN, "sec-fetch-site": "same-origin" }],
    ["no Origin, Sec-Fetch-Site same-origin", { "sec-fetch-site": "same-origin" }],
  ];
  const refused: [string, Record<string, string>][] = [
    ["neither header", {}],
    ["an Origin trusted only by X-Forwarded-Host", { origin: "https://app.example", "x-forwarded-host": "app.example" }],
    ["the right host over http", { origin: `http://${PUBLIC_HOST}` }],
    ["a foreign Origin", { origin: "https://evil.example" }],
    ["a sibling-subdomain Origin", { origin: "https://evil.entrepreneuria.io" }],
    ["an opaque Origin", { origin: "null" }],
    ["a malformed Origin", { origin: "not a url" }],
    ["an Origin with a path", { origin: `${ORIGIN}/auth/signout` }],
    ["a non-http Origin", { origin: `ftp://${PUBLIC_HOST}` }],
    ["the right host over another port", { origin: `${ORIGIN}:8443` }],
    ["Sec-Fetch-Site cross-site alone", { "sec-fetch-site": "cross-site" }],
    ["Sec-Fetch-Site same-site alone", { "sec-fetch-site": "same-site" }],
    ["Sec-Fetch-Site none alone", { "sec-fetch-site": "none" }],
    ["same Origin contradicted by cross-site", { origin: ORIGIN, "sec-fetch-site": "cross-site" }],
    ["same-origin contradicted by a foreign Origin", { origin: "https://evil.example", "sec-fetch-site": "same-origin" }],
  ];

  for (const [label, headers] of allowed) {
    it(`allows ${label}`, () => {
      assert.equal(
        isSameOriginRequest(
          { headers: new Headers({ host: PUBLIC_HOST, ...headers }) },
          new Set([ORIGIN])
        ),
        true
      );
    });
  }

  for (const [label, headers] of refused) {
    it(`refuses ${label}: nothing revoked or expired`, async () => {
      const jar = new ScopedJar(PUBLIC_HOST);
      plant(jar, api.generation({ sessionId: SESSION_A }), "shared-domain");

      const response = await signOut(
        request(SIGN_OUT_ROUTE, jar, { method: "POST", headers })
      );

      assert.equal(response.status, 403);
      assert.deepEqual(response.headers.getSetCookie(), []);
      assert.equal(api.state.logoutCalls, 0);
      assert.equal(api.isLive(SESSION_A), true);
    });
  }

  it("GET changes nothing and forwards to the confirmation page", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(jar, api.generation({ sessionId: SESSION_A }), "shared-domain");

    const response = await signOutGet(
      request(`${SIGN_OUT_ROUTE}?reason=session-unresolved&next=https://evil.example/x`, jar)
    );

    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("location"),
      `${ORIGIN}${SIGN_OUT_PAGE_PATH}?reason=session-unresolved&next=%2Fdashboard`
    );
    assert.deepEqual(response.headers.getSetCookie(), []);
    assert.equal(api.state.logoutCalls, 0);
    assert.equal(api.isLive(SESSION_A), true);
  });

  it("GET drops a reason it does not know", async () => {
    const response = await signOutGet(
      request(`${SIGN_OUT_ROUTE}?reason=<script>`, new ScopedJar(PUBLIC_HOST))
    );

    assert.equal(response.headers.get("location"), `${ORIGIN}${SIGN_OUT_PAGE_PATH}`);
  });
});

describe("unresolved conflicts: explicit recovery, never a login loop", () => {
  function unresolvedJar() {
    const jar = new ScopedJar(PUBLIC_HOST);
    /* Two expired generations: only refreshes could tell them apart. */
    plant(
      jar,
      api.generation({ sessionId: SESSION_A, expiresIn: -60, bulky: true }),
      "shared-domain"
    );
    plant(
      jar,
      api.generation({
        sessionId: SESSION_A,
        expiresIn: -120,
        accessLive: false,
        refreshLive: false,
        consumed: true,
        bulky: true,
      }),
      "host-only"
    );
    return jar;
  }

  it("repeated requests land on the recovery page every time, changing nothing", async () => {
    const jar = unresolvedJar();
    const before = jar.header();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await proxy(request("/dashboard?tab=2", jar));

      assert.equal(
        response.headers.get("location"),
        `${ORIGIN}${SIGN_OUT_PAGE_PATH}?reason=session-unresolved&next=%2Fdashboard%3Ftab%3D2`
      );
      assert.doesNotMatch(
        response.headers.get("location") ?? "",
        /entrepreneuria\.io\/login/
      );
      jar.apply(response);
    }

    assert.equal(jar.header(), before);
    assert.equal(api.state.refreshCalls, 0);
    assert.equal(api.canRefresh(SESSION_A), true);
  });

  it("the recovery page itself is reachable and changes nothing", async () => {
    const jar = unresolvedJar();
    const before = jar.header();

    const response = await proxy(
      request(`${SIGN_OUT_PAGE_PATH}?reason=session-unresolved`, jar)
    );

    assert.equal(response.headers.get("location"), null);
    assert.deepEqual(sessionSetCookies(response), []);
    jar.apply(response);
    assert.equal(jar.header(), before);
  });

  it("the page explains the state and offers only an explicit sign-out", async () => {
    const html = await renderPage({ reason: "session-unresolved", next: "/dashboard" });

    assert.match(html, /couldn&#x27;t safely restore your session/);
    assert.match(html, /every device/);
    assert.match(
      html,
      /<form[^>]*method="post"[^>]*action="\/auth\/signout"|<form[^>]*action="\/auth\/signout"[^>]*method="post"/
    );
    assert.ok(html.includes("Sign out of all devices"));
    assert.ok(!html.includes("Try again"));
  });

  it("signing out from it ends the conflict for good", async () => {
    const jar = unresolvedJar();

    const signedOut = await signOut(logoutRequest(jar));
    assert.equal(signedOut.headers.get("x-auth-revocation"), "complete");
    jar.apply(signedOut);
    assert.equal(api.isLive(SESSION_A), false);

    const next = await proxy(request("/dashboard", jar));
    assert.match(next.headers.get("location") ?? "", /\/login\?next=/);
  });

  for (const [label, plantSecond] of [
    ["two live identities", "identity"],
    ["an Auth API outage", "outage"],
  ] as const) {
    it(`${label} also routes protected pages to recovery, not login`, async () => {
      const jar = new ScopedJar(PUBLIC_HOST);
      plant(jar, api.generation({ sessionId: SESSION_A, bulky: true }), "shared-domain");
      if (plantSecond === "identity") {
        plant(
          jar,
          api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID, bulky: true }),
          "host-only"
        );
      } else {
        plant(jar, revokedCopy(SESSION_C), "host-only");
        api.state.mode = "down";
      }

      const response = await proxy(request("/dashboard", jar));
      const reason = plantSecond === "identity" ? "session-conflict" : "auth-unavailable";

      assert.equal(
        response.headers.get("location"),
        `${ORIGIN}${SIGN_OUT_PAGE_PATH}?reason=${reason}&next=%2Fdashboard`
      );
      assert.deepEqual(sessionSetCookies(response), []);

      const html = await renderPage({ reason, next: "/dashboard" });
      if (plantSecond === "outage") {
        assert.ok(html.includes('href="/dashboard"'));
        assert.ok(html.includes("Try again"));

        api.state.mode = "up";
        const retried = await proxy(request("/dashboard", jar));
        assert.equal(retried.headers.get("location"), null);
      } else {
        assert.match(html, /More than one account/);
      }
    });
  }
});

describe("incomplete revocation is never shown as success", () => {
  it("lands on a page that says so, with a sign-in path to finish it and no automatic retry", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(jar, api.generation({ sessionId: SESSION_A }), "shared-domain");
    api.state.logoutFailure = 500;
    captureWarnings();

    const response = await signOut(logoutRequest(jar));

    assert.equal(
      response.headers.get("location"),
      `${ORIGIN}${SIGN_OUT_PAGE_PATH}?status=incomplete`
    );

    const html = await renderPage({ status: "incomplete" });
    assert.match(html, /couldn&#x27;t confirm/);
    assert.ok(html.includes("Sign in"));
    assert.ok(html.includes('href="/login"'));
    assert.ok(!html.includes("<form"));
    assert.doesNotMatch(html, /http-equiv="refresh"/i);
  });

  it("a complete sign-out still goes straight to shared sign-in", async () => {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(jar, api.generation({ sessionId: SESSION_A }), "shared-domain");

    const response = await signOut(logoutRequest(jar));

    assert.equal(response.headers.get("location"), `${ORIGIN}/login`);
  });
});

describe("browser-to-server sign-out", () => {
  it("every sign-out control posts to /auth/signout and calls no client-side signOut", () => {
    for (const file of [
      "components/Header.tsx",
      "components/UserMenu.tsx",
      "components/account/UserAccountMenu.tsx",
    ]) {
      const source = readFileSync(join(__dirname, "..", "..", file), "utf8");

      assert.doesNotMatch(source, /\.signOut\(/, file);
      assert.ok(source.includes('"/auth/signout"'), file);
      assert.match(source, /method(?::\s*"POST"|="post")/i, file);
    }
  });

  it("the default confirmation says it ends every device's session", async () => {
    const html = await renderPage({});

    assert.ok(html.includes("Sign out of all devices?"));
    assert.match(html, /every device you&#x27;re signed in on/);
  });
});

describe("the signed-out result trusts only what the browser sent", () => {
  const STAMP = `x-middleware-request-${AUTH_COOKIES_HELD_HEADER}`;

  function forwardedCookieNames(response: Response) {
    return (response.headers.get("x-middleware-request-cookie") ?? "")
      .split(";")
      .map((pair) => pair.trim().split("=")[0])
      .filter(Boolean);
  }

  function twoAccounts() {
    const jar = new ScopedJar(PUBLIC_HOST);
    plant(jar, api.generation({ sessionId: SESSION_A, bulky: true }), "shared-domain");
    plant(
      jar,
      api.generation({ sessionId: SESSION_B, userId: OTHER_USER_ID, bulky: true }),
      "host-only"
    );
    return jar;
  }

  it("a typed ?status=local beside two live accounts still counts their cookies", async () => {
    const jar = twoAccounts();

    const response = await proxy(request(`${SIGN_OUT_PAGE_PATH}?status=local`, jar));
    const forwarded = forwardedCookieNames(response);

    /* The proxy pinned both sessions away from the page's request… */
    assert.equal(forwardedSession(response), null);
    assert.equal(forwarded.some((name) => name.startsWith(KEY)), false);
    /* …but stamped that the browser holds them, so the page never says
       its cookies were cleared. */
    assert.equal(response.headers.get(STAMP), "1");
    assert.equal(browserHeldAuthCookies(response.headers.get(STAMP), forwarded), true);
    assert.equal(api.isLive(SESSION_A), true);
    assert.equal(api.isLive(SESSION_B), true);
  });

  it("a client cannot supply the stamp", async () => {
    const jar = twoAccounts();

    const response = await proxy(
      request(`${SIGN_OUT_PAGE_PATH}?status=local`, jar, {
        headers: { [AUTH_COOKIES_HELD_HEADER]: "0" },
      })
    );

    assert.equal(response.headers.get(STAMP), "1");
  });

  it("is stamped absent only once a real sign-out expired every cookie", async () => {
    const jar = twoAccounts();
    captureWarnings();

    jar.apply(await signOut(logoutRequest(jar)));
    const response = await proxy(request(`${SIGN_OUT_PAGE_PATH}?status=local`, jar));

    assert.equal(response.headers.get(STAMP), "0");
    assert.equal(browserHeldAuthCookies(response.headers.get(STAMP), []), false);
  });

  for (const name of [`${KEY}.0`, "sb-refresh-token"]) {
    it(`counts ${name} even when its value is not valid percent-encoding`, async () => {
      const response = await proxy(
        new NextRequest(`${LOCAL_URL}${SIGN_OUT_PAGE_PATH}?status=local`, {
          headers: { host: PUBLIC_HOST, cookie: `${name}=%ZZ; theme=dark` },
        })
      );

      assert.equal(response.headers.get(STAMP), "1");
    });
  }

  it("without a stamp falls back to the cookies the page received", () => {
    assert.equal(browserHeldAuthCookies(null, [`${KEY}.0`]), true);
    assert.equal(browserHeldAuthCookies(null, ["theme"]), false);
  });

  it("a failed sign-out request lands on the form with a warning", async () => {
    const html = await renderPage({ error: "sign-out-failed" });

    assert.match(html, /didn&#x27;t go through/);
    assert.ok(html.includes('action="/auth/signout"'));
  });
});

describe("where the sign-out controls send the visitor", () => {
  const HERE = `${ORIGIN}/dashboard`;
  const FAILED = `${ORIGIN}${SIGN_OUT_FAILED_PATH}`;

  it("follows the route's own outcome redirects on this origin", () => {
    assert.equal(
      signOutDestination({ redirected: true, ok: true, url: `${ORIGIN}/login` }, HERE),
      `${ORIGIN}/login`
    );
    assert.equal(
      signOutDestination(
        {
          redirected: true,
          ok: true,
          url: `${ORIGIN}${SIGN_OUT_PAGE_PATH}?status=incomplete`,
        },
        HERE
      ),
      `${ORIGIN}${SIGN_OUT_PAGE_PATH}?status=incomplete`
    );
  });

  /* `ok` is what fetch reports for the final response: false for 403/5xx. */
  for (const [label, response] of [
    ["a request that never completed", null],
    ["the same-origin guard's 403", { redirected: false, ok: false, url: `${ORIGIN}/auth/signout` }],
    ["a 5xx from the route or proxy", { redirected: false, ok: false, url: `${ORIGIN}/auth/signout` }],
    ["an unredirected 200", { redirected: false, ok: true, url: `${ORIGIN}/auth/signout` }],
    ["a redirect to /login ending in a 403", { redirected: true, ok: false, url: `${ORIGIN}/login` }],
    ["a redirect to /login ending in a 503", { redirected: true, ok: false, url: `${ORIGIN}/login` }],
    ["a redirect to another origin", { redirected: true, ok: true, url: "http://localhost:3000/login" }],
    ["a redirect to an unexpected page", { redirected: true, ok: true, url: `${ORIGIN}/dashboard` }],
  ] as const) {
    it(`sends ${label} back to the form, never to /login`, () => {
      assert.equal(signOutDestination(response, HERE), FAILED);
    });
  }
});

describe("the fake GoTrue model itself", () => {
  async function refresh(token: string) {
    const response = await api.fetchStub(
      `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      { method: "POST", body: JSON.stringify({ refresh_token: token }) }
    );
    return { status: response.status, body: await response.json() };
  }

  async function logoutWith(token: string, scope: string) {
    return api.fetchStub(`${SUPABASE_URL}/auth/v1/logout?scope=${scope}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
  }

  it("rotates, then answers the parent of the active token with the active token", async () => {
    const first = api.generation({ sessionId: SESSION_A });

    const rotated = await refresh(first.refresh_token);
    advanceClock(60_000);
    const again = await refresh(first.refresh_token);

    assert.equal(rotated.status, 200);
    assert.equal(again.status, 200);
    assert.equal(again.body.refresh_token, rotated.body.refresh_token);
    assert.equal(api.state.reuseDetected, false);
  });

  it("issues a new child within the reuse interval", async () => {
    const first = api.generation({ sessionId: SESSION_A });

    const second = await refresh(first.refresh_token);
    await refresh(second.body.refresh_token);
    /* `first` is now a grandparent, but was rotated moments ago. */
    const sibling = await refresh(first.refresh_token);

    assert.equal(sibling.status, 200);
    assert.notEqual(sibling.body.refresh_token, second.body.refresh_token);
    assert.equal(api.state.reuseDetected, false);
  });

  it("treats a grandparent presented after the reuse interval as an attack", async () => {
    const first = api.generation({ sessionId: SESSION_A });

    const second = await refresh(first.refresh_token);
    await refresh(second.body.refresh_token);
    advanceClock(60_000);
    const reused = await refresh(first.refresh_token);

    assert.equal(reused.body.error_code, "refresh_token_already_used");
    assert.equal(api.state.reuseDetected, true);
    assert.equal(api.canRefresh(SESSION_A), false);
    /* Reuse revokes refresh tokens; the sign-in row and its JWTs live on. */
    assert.equal(api.isLive(SESSION_A), true);
  });

  it("local, others and global sign-out delete exactly their sessions", async () => {
    const a = api.generation({ sessionId: SESSION_A });
    const b = api.generation({ sessionId: SESSION_B });
    const other = api.generation({ sessionId: SESSION_C, userId: OTHER_USER_ID });

    assert.equal((await logoutWith(a.access_token, "local")).status, 204);
    assert.deepEqual([api.isLive(SESSION_A), api.isLive(SESSION_B)], [false, true]);

    /* A fresh sign-in of the same user, then "others" from B. */
    api.generation({ sessionId: SESSION_A });
    assert.equal((await logoutWith(b.access_token, "others")).status, 204);
    assert.deepEqual([api.isLive(SESSION_A), api.isLive(SESSION_B)], [false, true]);

    assert.equal((await logoutWith(b.access_token, "global")).status, 204);
    assert.equal(api.isLive(SESSION_B), false);
    /* Another user's sign-in is never touched. */
    assert.equal(api.isLive(SESSION_C), true);
    assert.equal(api.sessionOf(other.access_token), SESSION_C);
  });

  it("a revoked sign-in's JWT is refused by GoTrue but still verifies locally until it expires", async () => {
    const a = api.generation({ sessionId: SESSION_A });
    api.revokeSession(SESSION_A);

    const user = await api.fetchStub(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { authorization: `Bearer ${a.access_token}` },
    });

    assert.equal((await user.json()).error_code, "session_not_found");
    assert.equal(api.acceptsJwtLocally(a.access_token), true);

    advanceClock(2 * 3600 * 1000);
    assert.equal(api.acceptsJwtLocally(a.access_token), false);
  });
});

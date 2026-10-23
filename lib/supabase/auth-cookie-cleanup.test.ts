import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

import { NextResponse } from "next/server";
import {
  createChunks,
  stringFromBase64URL,
  stringToBase64URL,
} from "@supabase/ssr";

import {
  AUTH_NO_STORE_HEADERS,
  expireAllAuthCookies,
  findUnreadableSessionCookies,
  holdsAuthCookies,
  readAuthCookieInventory,
  retireStaleAuthCookies,
} from "./auth-cookie-cleanup";
import {
  getSupabaseCookieHostname,
  getSupabaseCookieOptions,
  mergeSupabaseCookieOptions,
  SUPABASE_AUTH_COOKIE_NAME,
} from "./cookie-options";

const KEY = SUPABASE_AUTH_COOKIE_NAME;

function headers(values: Record<string, string>) {
  return new Headers(values);
}

/* A stored session, encoded and chunked by @supabase/ssr itself. */
function storedSession(padding = 0, refreshToken = "fake-refresh-token") {
  return createChunks(
    KEY,
    `base64-${stringToBase64URL(
      JSON.stringify({
        access_token: "fake-access-token",
        refresh_token: refreshToken,
        expires_at: 4102444800,
        user: { id: "user", bio: "x".repeat(padding) },
      }),
    )}`,
  );
}

function cookieHeaderOf(chunks: { name: string; value: string }[]) {
  return chunks.map(({ name, value }) => `${name}=${value}`).join("; ");
}

function sessionMap(chunks: { name: string; value: string }[]) {
  return new Map(chunks.map(({ name, value }) => [name, value]));
}

function inventoryFor(cookie: string, host = "entrepreneuria.io") {
  return readAuthCookieInventory({ headers: headers({ host, cookie }) });
}

function retire(cookie: string, host = "entrepreneuria.io") {
  const response = NextResponse.next();
  retireStaleAuthCookies(inventoryFor(cookie, host), response);

  return response.headers.getSetCookie();
}

const expiry = (name: string, domain?: string) =>
  `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; ${
    domain ? `Domain=${domain}; ` : ""
  }Secure; SameSite=Lax`;

describe("getSupabaseCookieHostname", () => {
  it("uses the public host nginx forwards, not the bind address", () => {
    const requests: Record<string, string>[] = [
      { host: "entrepreneuria.io" },
      { host: "localhost:3000", "x-forwarded-host": "entrepreneuria.io" },
      { host: "entrepreneuria.io", "x-forwarded-host": "localhost:3000" },
    ];

    for (const values of requests) {
      assert.equal(getSupabaseCookieHostname(headers(values)), "entrepreneuria.io");
    }
  });

  it("resolves every production writer to the same .entrepreneuria.io scope", () => {
    const production = headers({ host: "entrepreneuria.io" });
    const options = getSupabaseCookieOptions(getSupabaseCookieHostname(production));

    assert.deepEqual(
      {
        name: options.name,
        domain: options.domain,
        path: options.path,
        sameSite: options.sameSite,
        secure: options.secure,
        httpOnly: options.httpOnly,
      },
      {
        name: KEY,
        domain: ".entrepreneuria.io",
        path: "/",
        sameSite: "lax",
        secure: true,
        httpOnly: false,
      },
    );
    assert.equal(
      mergeSupabaseCookieOptions(getSupabaseCookieHostname(production), {
        domain: undefined,
      }).domain,
      ".entrepreneuria.io",
    );
  });

  it("stays host-only for local development", () => {
    for (const host of ["localhost:3000", "127.0.0.1:3000"]) {
      const hostname = getSupabaseCookieHostname(headers({ host }));

      assert.equal(getSupabaseCookieOptions(hostname).domain, undefined);
    }
  });

  it("stays host-only without any host header", () => {
    assert.equal(getSupabaseCookieHostname(headers({})), null);
    assert.equal(getSupabaseCookieOptions(null).domain, undefined);
  });
});

describe("readAuthCookieInventory", () => {
  it("sees a chunk name sent twice, which request.cookies would hide", () => {
    const inventory = readAuthCookieInventory({
      headers: headers({
        host: "entrepreneuria.io",
        cookie: `${KEY}.0=a; ${KEY}.1=b; ${KEY}.0=c; ${KEY}.1=d; theme=dark`,
      }),
    });

    assert.equal(inventory.duplicated, true);
    assert.deepEqual(inventory.session, [`${KEY}.0`, `${KEY}.1`]);
    assert.deepEqual(inventory.legacy, []);
  });

  it("recognises sb-refresh-token, the old auth-helpers refresh cookie, and no other sb-* cookie", () => {
    const inventory = inventoryFor(
      "sb-refresh-token=a; sb-access-token=b; sb-refresh=c; sb-provider=d; sb-refresh-token-x=e",
    );

    assert.deepEqual(inventory.legacy, ["sb-refresh-token", "sb-access-token"]);
  });

  it("recognises only the shared session family and legacy sb-* auth cookies", () => {
    const inventory = readAuthCookieInventory({
      headers: headers({
        cookie: [
          `${KEY}=a`,
          `${KEY}.12=b`,
          `${KEY}-code-verifier=c`,
          `${KEY}.x=d`,
          "sb-ref-auth-token=e",
          "sb-ref-auth-token.0=f",
          "sb-other=g",
          "theme=dark",
        ].join("; "),
      }),
    });

    assert.equal(inventory.duplicated, false);
    assert.deepEqual(inventory.session, [KEY, `${KEY}.12`]);
    assert.deepEqual(inventory.legacy, ["sb-ref-auth-token", "sb-ref-auth-token.0"]);
  });
});

describe("dual-scope expiry", () => {
  it("Next's cookie API cannot carry two scopes of one name", () => {
    /* Why the expiries are raw headers: the second set replaces the first. */
    const response = NextResponse.next();
    response.cookies.set(`${KEY}.0`, "", { domain: ".entrepreneuria.io", maxAge: 0 });
    response.cookies.set(`${KEY}.0`, "", { maxAge: 0 });

    assert.equal(response.headers.getSetCookie().length, 1);
  });

  it("sign-out expires each auth cookie on .entrepreneuria.io and host-only", () => {
    const response = NextResponse.next();
    expireAllAuthCookies(
      readAuthCookieInventory({
        headers: headers({
          host: "entrepreneuria.io",
          cookie: `${KEY}.0=a; ${KEY}.0=b; sb-ref-auth-token=c; theme=dark`,
        }),
      }),
      response,
    );

    assert.deepEqual(response.headers.getSetCookie(), [
      `${KEY}.0=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Domain=.entrepreneuria.io; Secure; SameSite=Lax`,
      `${KEY}.0=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Secure; SameSite=Lax`,
      "sb-ref-auth-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Domain=.entrepreneuria.io; Secure; SameSite=Lax",
      "sb-ref-auth-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Secure; SameSite=Lax",
    ]);
  });

  it("never expires the scope a response is writing", () => {
    const hostname = "entrepreneuria.io";
    const response = NextResponse.next();
    response.cookies.set(`${KEY}.0`, "fresh", mergeSupabaseCookieOptions(hostname, {}));

    retireStaleAuthCookies(
      readAuthCookieInventory({
        headers: headers({ host: hostname, cookie: cookieHeaderOf(storedSession(4000)) }),
      }),
      response,
    );

    const headersFor = (name: string) =>
      response.headers.getSetCookie().filter((header) => header.startsWith(`${name}=`));

    assert.equal(headersFor(`${KEY}.0`).length, 2);
    assert.match(headersFor(`${KEY}.0`)[0], /^entrepreneuria-auth-token\.0=fresh;.*Domain=\.entrepreneuria\.io/);
    assert.doesNotMatch(headersFor(`${KEY}.0`)[1], /Domain=/);
    assert.doesNotMatch(headersFor(`${KEY}.1`)[0], /Domain=/);
  });

  it("leaves a readable single-scope session alone", () => {
    for (const session of [storedSession(), storedSession(4000), storedSession(8000)]) {
      assert.deepEqual(retire(`${cookieHeaderOf(session)}; theme=dark`), []);
    }
  });

  it("does nothing off the shared domain, where host-only is canonical", () => {
    const response = NextResponse.next();

    retireStaleAuthCookies(
      readAuthCookieInventory({
        headers: headers({
          host: "localhost:3000",
          cookie: `${KEY}.0=a; ${KEY}.0=b; sb-ref-auth-token=c`,
        }),
      }),
      response,
    );

    assert.deepEqual(response.headers.getSetCookie(), []);
  });
});

describe("structurally unreadable session storage", () => {
  const [chunk0, chunk1] = storedSession(4000);
  const other = storedSession(5000, "other-refresh-token");

  it("a readable session has no unreadable cookies, bare or chunked", () => {
    for (const session of [storedSession(), storedSession(4000), storedSession(8000)]) {
      assert.deepEqual(findUnreadableSessionCookies(sessionMap(session)), []);
    }
  });

  it("a corrupt bare cookie is unreadable", () => {
    for (const value of ["base64-%%%", "base64-bm90LWpzb24", "not-json", "base64-eyJhIjoxfQ"]) {
      assert.deepEqual(findUnreadableSessionCookies(new Map([[KEY, value]])), [KEY]);
    }
  });

  it("a corrupt bare cookie beside sound chunks loses only the bare cookie", () => {
    assert.deepEqual(
      findUnreadableSessionCookies(sessionMap([{ name: KEY, value: "base64-!!" }, chunk0, chunk1])),
      [KEY],
    );
  });

  it("chunks shadowed by a readable bare cookie are unreadable", () => {
    const [bare] = storedSession();

    assert.deepEqual(findUnreadableSessionCookies(sessionMap([bare, chunk0, chunk1])), [
      chunk0.name,
      chunk1.name,
    ]);
  });

  it("drops an orphan .2 trailing a sound .0/.1, and only that", () => {
    assert.deepEqual(
      findUnreadableSessionCookies(sessionMap([chunk0, chunk1, { name: `${KEY}.2`, value: "stale" }])),
      [`${KEY}.2`],
    );
  });

  it("a non-contiguous .0/.2 family is unreadable in full", () => {
    const [three0, , three2] = storedSession(8000);

    assert.deepEqual(findUnreadableSessionCookies(sessionMap([three0, three2])), [
      three0.name,
      three2.name,
    ]);
  });

  it("orphans with no .0 are unreadable", () => {
    assert.deepEqual(
      findUnreadableSessionCookies(sessionMap([chunk1, { name: `${KEY}.7`, value: "x" }])),
      [chunk1.name, `${KEY}.7`],
    );
  });

  it("chunks stitched from two generations are unreadable", () => {
    assert.deepEqual(findUnreadableSessionCookies(sessionMap([chunk0, other[1]])), [
      chunk0.name,
      other[1].name,
    ]);
  });

  it("a value that is not valid percent-encoding reads as empty, as Next drops it", () => {
    const inventory = inventoryFor(`${chunk0.name}=${chunk0.value}; ${chunk1.name}=%E0%A4%A`);

    assert.deepEqual(inventory.unreadable, [chunk0.name, chunk1.name]);
  });

  it("is not judged when two scopes of a name coexist", () => {
    const inventory = inventoryFor(`${chunk0.name}=a; ${chunk0.name}=b`);

    assert.equal(inventory.duplicated, true);
    assert.deepEqual(inventory.unreadable, []);
  });

  it("retires unreadable cookies in both scopes on entrepreneuria.io, and nothing else", () => {
    assert.deepEqual(retire(`${KEY}=base64-!!; theme=dark; sb-other=x`), [
      expiry(KEY, ".entrepreneuria.io"),
      expiry(KEY),
    ]);
    assert.deepEqual(
      retire(`${cookieHeaderOf([chunk0, chunk1])}; ${KEY}.2=stale; theme=dark`),
      [expiry(`${KEY}.2`, ".entrepreneuria.io"), expiry(`${KEY}.2`)],
    );
  });

  it("retires unreadable cookies in the host-only canonical scope on localhost", () => {
    const response = NextResponse.next();
    retireStaleAuthCookies(
      inventoryFor(`${KEY}=base64-!!; sb-ref-auth-token=c`, "localhost:3000"),
      response,
    );

    assert.deepEqual(response.headers.getSetCookie(), [
      `${KEY}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax`,
    ]);
  });

  it("never expires a name + scope the response is writing", () => {
    const response = NextResponse.next();
    response.cookies.set(`${KEY}.0`, "fresh", mergeSupabaseCookieOptions("entrepreneuria.io", {}));
    retireStaleAuthCookies(inventoryFor(`${KEY}.0=garbage; ${KEY}.1=garbage`), response);

    const setCookies = response.headers.getSetCookie();
    assert.equal(setCookies.filter((header) => header.startsWith(`${KEY}.0=fresh;`)).length, 1);
    assert.ok(!setCookies.includes(expiry(`${KEY}.0`, ".entrepreneuria.io")));
    assert.ok(setCookies.includes(expiry(`${KEY}.0`)));
    assert.ok(setCookies.includes(expiry(`${KEY}.1`, ".entrepreneuria.io")));
  });

  it("marks any response that expires auth cookies as uncacheable", () => {
    const response = NextResponse.next();
    retireStaleAuthCookies(inventoryFor(`${KEY}=base64-!!`), response);

    for (const [key, value] of Object.entries(AUTH_NO_STORE_HEADERS)) {
      assert.equal(response.headers.get(key), value);
    }

    const untouched = NextResponse.next();
    retireStaleAuthCookies(inventoryFor(cookieHeaderOf(storedSession())), untouched);
    assert.equal(untouched.headers.get("cache-control"), null);
  });
});

/* Every writer of the shared session must take its scope from
   getSupabaseCookieHostname. The bind-address URL is what split the
   session into two scopes; a raw Host read is how writers drifted. */
describe("auth cookie writers resolve scope in one place", () => {
  const ROOT = join(__dirname, "..", "..");
  const SKIP = new Set(["node_modules", ".next", "output", ".git"]);

  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      if (SKIP.has(entry)) {
        return [];
      }

      const path = join(dir, entry);

      if (statSync(path).isDirectory()) {
        return sources(path);
      }

      return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
    });
  }

  const writers = [...sources(join(ROOT, "app")), ...sources(join(ROOT, "lib")), join(ROOT, "proxy.ts")]
    /* cookie-options.ts is the resolver itself. */
    .filter((file) => !file.endsWith(join("supabase", "cookie-options.ts")))
    .filter((file) => /createServerClient|createBrowserClient|CookieOptions\(/.test(readFileSync(file, "utf8")));

  it("finds the writers", () => {
    const names = writers.map((file) => relative(ROOT, file).replaceAll("\\", "/"));

    for (const expected of [
      "proxy.ts",
      "app/auth/callback/route.ts",
      "app/auth/confirm/route.ts",
      "app/auth/signout/route.ts",
      "lib/supabase/server-client.ts",
    ]) {
      assert.ok(names.includes(expected), expected);
    }
  });

  for (const file of writers) {
    it(relative(ROOT, file).replaceAll("\\", "/"), () => {
      const source = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");

      assert.doesNotMatch(source, /nextUrl\.hostname/);
      assert.doesNotMatch(source, /new URL\(\s*(request|req)\.url\s*\)\.hostname/);
      assert.doesNotMatch(source, /(headers|headerStore)\.get\(\s*["']host["']\s*\)/);
    });
  }
});

describe("session candidates", () => {
  /* A session whose JWT names its user and sign-in, as GoTrue's do. */
  function signedSession({
    sub = "user-a",
    sessionId = "sign-in-1",
    refreshToken = "refresh-1",
    profileFirst = false,
  } = {}) {
    const claims = stringToBase64URL(JSON.stringify({ sub, session_id: sessionId }));
    const user = profileFirst
      ? { bio: "x".repeat(3000), id: sub }
      : { id: sub, bio: "x".repeat(3000) };

    return createChunks(
      KEY,
      `base64-${stringToBase64URL(
        JSON.stringify({
          access_token: `header.${claims}.signature`,
          refresh_token: refreshToken,
          expires_at: 4102444800,
          user,
        }),
      )}`,
    );
  }

  it("one session copied byte for byte into both scopes is one session, not a conflict", () => {
    const session = signedSession();
    const inventory = inventoryFor(cookieHeaderOf([...session, ...session]));

    assert.equal(inventory.candidates.length, 1);
    assert.equal(inventory.duplicated, true);
    assert.equal(inventory.identicalDuplicates, true);
    /* Dropping either copy loses nothing, so no resolution is needed. */
    assert.equal(inventory.conflict, false);
  });

  it("a name sent twice with different values is a conflict", () => {
    const session = signedSession();
    const inventory = inventoryFor(
      cookieHeaderOf([
        ...session,
        { name: session[0].name, value: `${session[0].value}x` },
      ]),
    );

    assert.equal(inventory.identicalDuplicates, false);
    assert.equal(inventory.conflict, true);
  });

  it("assembles each family on its own, though a stitched chain also decodes", () => {
    const a = signedSession();
    const b = signedSession({ refreshToken: "refresh-2" });
    /* The chunk boundary falls inside content both share. */
    assert.ok(
      inventoryFor(cookieHeaderOf([a[0], b[1]])).candidates.length === 1,
    );

    const inventory = inventoryFor(cookieHeaderOf([...a, ...b]));

    assert.deepEqual(
      inventory.candidates.map(({ cookies }) => cookies),
      [a, b],
    );
    assert.deepEqual(
      inventory.candidates.map(({ sessionId }) => sessionId),
      ["sign-in-1", "sign-in-1"],
    );
  });

  it("never grafts another user's cached profile onto a token", () => {
    const a = signedSession({ sub: "user-a", profileFirst: true });
    const b = signedSession({ sub: "user-b", profileFirst: true });
    /* The stitched chain does decode: user-a's tokens, user-b's profile. */
    const stitched = JSON.parse(
      stringFromBase64URL((a[0].value + b[1].value).slice("base64-".length)),
    );
    assert.equal(stitched.user.id, "user-b");

    const stitchedOnly = inventoryFor(cookieHeaderOf([a[0], b[1]]));
    assert.deepEqual(stitchedOnly.candidates, []);
    /* Its tokens are user-a's, and may still work: kept for sign-out. */
    assert.deepEqual(
      stitchedOnly.revocationOnly.map(({ userId }) => userId),
      ["user-a"],
    );
    assert.equal(stitchedOnly.conflict, true);

    const both = inventoryFor(cookieHeaderOf([...a, ...b]));
    assert.deepEqual(
      both.candidates.map(({ cookies }) => cookies),
      [a, b],
    );
    /* The same tokens are held properly by user-a's own family. */
    assert.deepEqual(both.revocationOnly, []);
  });

  it("a bare cookie beside another session's chunks is a conflict with no duplicate name", () => {
    const chunked = signedSession();
    const bare = createChunks(
      KEY,
      `base64-${stringToBase64URL(
        JSON.stringify({
          access_token: "bare-access-token",
          refresh_token: "bare-refresh-token",
          expires_at: 4102444800,
        }),
      )}`,
    );
    const inventory = inventoryFor(cookieHeaderOf([...bare, ...chunked]));

    assert.equal(inventory.duplicated, false);
    assert.equal(inventory.candidates.length, 2);
    assert.equal(inventory.conflict, true);
  });

  it("gives up past a bounded number of combinations", () => {
    const cookie = Array.from({ length: 80 }, (_, index) => `${KEY}.0=junk-${index}`).join("; ");
    const inventory = inventoryFor(cookie);

    assert.equal(inventory.candidatesTruncated, true);
    assert.deepEqual(inventory.candidates, []);
  });
});

describe("holdsAuthCookies", () => {
  it("is true while any session chunk or legacy auth cookie remains", () => {
    assert.equal(holdsAuthCookies([`${KEY}.1`, "theme"]), true);
    assert.equal(holdsAuthCookies([KEY]), true);
    assert.equal(holdsAuthCookies(["sb-project-auth-token"]), true);
  });

  it("is false once none remains, whatever else the browser holds", () => {
    assert.equal(holdsAuthCookies([]), false);
    assert.equal(holdsAuthCookies(["theme", `${KEY}-code-verifier`]), false);
  });
});

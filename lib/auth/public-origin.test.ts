import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildOAuthCallbackUrl } from "./oauth";
import {
  CANONICAL_AUTH_ORIGIN,
  getPublicRequestOrigin,
  resolveAuthDestination,
} from "./public-origin";
import { getSafeAuthRedirect } from "./trusted-redirect";

/* Regression: behind nginx, `next start` reports every request as
   http://localhost:3000, and the OAuth callback redirected production
   visitors there after a successful exchange. The callback builds its
   redirects from getPublicRequestOrigin + resolveAuthDestination. */

function request(
  headers: Record<string, string>,
  protocol = "http:",
) {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
    /* What `next start` actually hands the route handler in production. */
    nextUrl: { protocol },
  };
}

const production = { isProduction: true };
const development = { isProduction: false };

describe("getPublicRequestOrigin in production", () => {
  it("uses the forwarded public host, not the localhost bind address", () => {
    assert.equal(
      getPublicRequestOrigin(
        request({ host: "localhost:3000", "x-forwarded-host": "entrepreneuria.io" }),
        production,
      ),
      "https://entrepreneuria.io",
    );
  });

  it("uses the Host header when nginx forwards it", () => {
    assert.equal(
      getPublicRequestOrigin(request({ host: "entrepreneuria.io" }), production),
      "https://entrepreneuria.io",
    );
  });

  it("upgrades a trusted host to https even when the proxy spoke http", () => {
    assert.equal(
      getPublicRequestOrigin(request({ host: "entrepreneuria.io" }, "http:"), production),
      "https://entrepreneuria.io",
    );
  });

  it("keeps trusted ecosystem subdomains", () => {
    assert.equal(
      getPublicRequestOrigin(
        request({ host: "prospra.entrepreneuria.io" }),
        production,
      ),
      "https://prospra.entrepreneuria.io",
    );
  });

  for (const host of [
    "localhost:3000",
    "127.0.0.1:3000",
    "[::1]:3000",
    "192.168.12.105:3000",
    "10.0.0.5",
  ]) {
    it(`never selects loopback/private host ${host}`, () => {
      assert.equal(
        getPublicRequestOrigin(request({ host }), production),
        CANONICAL_AUTH_ORIGIN,
      );
    });
  }

  it("falls back to the canonical origin when no host is sent", () => {
    assert.equal(getPublicRequestOrigin(request({}), production), CANONICAL_AUTH_ORIGIN);
  });

  for (const host of [
    "evil.example.com",
    "entrepreneuria.io.evil.example.com",
    "evilentrepreneuria.io",
    "entrepreneuria.io:8443",
    "entrepreneuria.io/@evil.example.com",
    "user@evil.example.com",
  ]) {
    it(`rejects untrusted host ${host}`, () => {
      assert.equal(
        getPublicRequestOrigin(request({ host }), production),
        CANONICAL_AUTH_ORIGIN,
      );
      assert.equal(
        getPublicRequestOrigin(
          request({ host: "localhost:3000", "x-forwarded-host": host }),
          production,
        ),
        CANONICAL_AUTH_ORIGIN,
      );
    });
  }
});

describe("getPublicRequestOrigin in local development", () => {
  it("keeps http://localhost:3000 when the app really runs locally", () => {
    assert.equal(
      getPublicRequestOrigin(request({ host: "localhost:3000" }), development),
      "http://localhost:3000",
    );
  });

  it("keeps 127.0.0.1 loopback", () => {
    assert.equal(
      getPublicRequestOrigin(request({ host: "127.0.0.1:3000" }), development),
      "http://127.0.0.1:3000",
    );
  });

  it("still rejects an arbitrary external host", () => {
    assert.equal(
      getPublicRequestOrigin(request({ host: "evil.example.com" }), development),
      CANONICAL_AUTH_ORIGIN,
    );
  });
});

describe("OAuth round trip destinations", () => {
  it("a production-origin OAuth start cannot produce a localhost redirectTo", () => {
    const redirectTo = new URL(
      buildOAuthCallbackUrl("https://entrepreneuria.io", "/dashboard"),
    );

    assert.equal(redirectTo.origin, "https://entrepreneuria.io");
    assert.equal(
      redirectTo.toString(),
      "https://entrepreneuria.io/auth/callback?next=%2Fdashboard",
    );
  });

  it("the production callback resolves /dashboard on the public origin", () => {
    const origin = getPublicRequestOrigin(
      request({ host: "entrepreneuria.io", "x-forwarded-proto": "https" }),
      production,
    );

    assert.equal(
      resolveAuthDestination(origin, getSafeAuthRedirect("/dashboard")),
      "https://entrepreneuria.io/dashboard",
    );
  });

  it("the production callback never resolves a localhost destination", () => {
    const origin = getPublicRequestOrigin(
      request({ host: "localhost:3000" }),
      production,
    );

    for (const next of [
      null,
      "/dashboard",
      "http://localhost:3000/dashboard",
      "https://localhost:3000/dashboard",
      "//localhost:3000/dashboard",
    ]) {
      const destination = new URL(
        resolveAuthDestination(origin, getSafeAuthRedirect(next)),
      );

      assert.equal(destination.origin, "https://entrepreneuria.io", String(next));
    }
  });

  it("preserves a trusted ecosystem destination", () => {
    assert.equal(
      resolveAuthDestination(
        "https://entrepreneuria.io",
        getSafeAuthRedirect("https://prospra.entrepreneuria.io/app"),
      ),
      "https://prospra.entrepreneuria.io/app",
    );
  });

  it("rejects malicious external destinations", () => {
    for (const next of [
      "https://evil.example.com/steal",
      "//evil.example.com",
      "javascript:alert(1)",
      "https://entrepreneuria.io.evil.example.com/",
    ]) {
      assert.equal(
        resolveAuthDestination(
          "https://entrepreneuria.io",
          getSafeAuthRedirect(next),
        ),
        "https://entrepreneuria.io/dashboard",
        next,
      );
    }
  });

  it("local development callback lands on localhost", () => {
    const origin = getPublicRequestOrigin(
      request({ host: "localhost:3000" }),
      development,
    );

    assert.equal(
      resolveAuthDestination(origin, getSafeAuthRedirect("/dashboard")),
      "http://localhost:3000/dashboard",
    );
  });
});

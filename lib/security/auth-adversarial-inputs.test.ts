import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getTrustedSiteOrigins, isSameOriginRequest } from "../auth/same-origin";
import { getSafeAuthRedirect } from "../auth/trusted-redirect";

/*
 * Extra adversarial inputs for the controls that keep a login from
 * being turned against the visitor. lib/auth/trusted-redirect.test.ts
 * covers the core cases; these are the encodings and scheme tricks
 * phishing kits use to bounce a fresh session to their own page.
 */

describe("malicious post-login destinations fall back to the dashboard", () => {
  const MALICIOUS = [
    "javascript:alert(document.cookie)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "vbscript:msgbox(1)",
    "https://entrepreneuria.io@evil.example/",
    "https://entrepreneuria.io.evil.example/",
    "https://evil.example/https://entrepreneuria.io/",
    "https://evil.example\\@entrepreneuria.io/",
    "https:evil.example",
    "https:/evil.example",
    "HTTPS://EVIL.EXAMPLE/",
    "//entrepreneuria.io@evil.example",
    "/\\/evil.example",
    "\\\\evil.example",
    "\t//evil.example",
    "https://xn--entrepreneuria-xyz.io/",
    "http://prospra.entrepreneuria.io/",
    "https://prospra.entrepreneuria.io:8443/",
    "ftp://entrepreneuria.io/",
    "file:///etc/passwd",
  ];

  for (const value of MALICIOUS) {
    it(JSON.stringify(value), () => {
      const result = getSafeAuthRedirect(value);
      assert.equal(result, "/dashboard");
    });
  }

  it("the fallback itself, resolved on the public origin, stays on it", () => {
    for (const value of MALICIOUS) {
      const resolved = new URL(getSafeAuthRedirect(value), "https://entrepreneuria.io");
      assert.equal(resolved.origin, "https://entrepreneuria.io", value);
    }
  });

  it("percent-encoded separators stay a path on this site", () => {
    /* Accepted as-is, which is safe: URL parsing never decodes them into
       a scheme or authority. */
    for (const value of ["/%09/evil.example", "/%2F/evil.example", "/%5C%5Cevil.example"]) {
      const resolved = new URL(getSafeAuthRedirect(value), "https://entrepreneuria.io");
      assert.equal(resolved.origin, "https://entrepreneuria.io", value);
    }
  });

  it("still accepts the legitimate ecosystem returns", () => {
    for (const value of [
      "/dashboard",
      "/settings?tab=profile",
      "https://architecta.entrepreneuria.io/dashboard",
      "https://prospra.entrepreneuria.io/app",
      "https://directorium.entrepreneuria.io/",
      "https://synceri.entrepreneuria.io/",
      "https://channelwright.entrepreneuria.io/studio",
    ]) {
      assert.equal(getSafeAuthRedirect(value), value);
    }
  });
});

describe("state-changing requests from sibling subdomains are refused", () => {
  /* Every *.entrepreneuria.io origin is same-SITE, so SameSite=Lax sends
     the shared session cookie with their requests. Same-ORIGIN is the
     boundary routes like /auth/signout and /api/account/avatar enforce. */
  const site = getTrustedSiteOrigins({
    headers: new Headers({ host: "entrepreneuria.io" }),
    nextUrl: { protocol: "https:" },
  });

  function from(headers: Record<string, string>) {
    return { headers: new Headers(headers) };
  }

  it("accepts the hub's own pages", () => {
    assert.equal(isSameOriginRequest(from({ origin: "https://entrepreneuria.io", "sec-fetch-site": "same-origin" }), site), true);
  });

  for (const origin of [
    "https://architecta.entrepreneuria.io",
    "https://prospra.entrepreneuria.io",
    "https://channelwright.entrepreneuria.io",
    "https://evil.entrepreneuria.io",
    "https://evil.example",
    "null",
  ]) {
    it(`refuses Origin ${origin}`, () => {
      assert.equal(isSameOriginRequest(from({ origin }), site), false);
    });
  }

  it("refuses a same-site fetch even with a forged-looking Origin", () => {
    assert.equal(
      isSameOriginRequest(from({ origin: "https://entrepreneuria.io", "sec-fetch-site": "same-site" }), site),
      false,
    );
  });

  it("refuses a request that proves nothing about where it came from", () => {
    assert.equal(isSameOriginRequest(from({}), site), false);
  });
});

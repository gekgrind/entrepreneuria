import assert from "node:assert/strict";
import { describe, it } from "node:test";

import nextConfig from "../../next.config.mjs";
import {
  BASELINE_CSP,
  DEFAULT_HSTS_MAX_AGE_SECONDS,
  getBrowserSecurityHeaders,
  getHstsMaxAge,
} from "./browser-headers.mjs";

function asMap(headers: { key: string; value: string }[]) {
  return new Map(headers.map(({ key, value }) => [key.toLowerCase(), value]));
}

describe("browser security headers", () => {
  const production = asMap(getBrowserSecurityHeaders({ isProduction: true, hstsMaxAge: undefined }));

  it("sends the standard hardening headers", () => {
    assert.equal(production.get("x-content-type-options"), "nosniff");
    assert.equal(production.get("referrer-policy"), "strict-origin-when-cross-origin");
    assert.equal(production.get("x-frame-options"), "DENY");
    assert.match(production.get("permissions-policy") ?? "", /camera=\(\)/);
    assert.match(production.get("permissions-policy") ?? "", /microphone=\(\)/);
    assert.match(production.get("permissions-policy") ?? "", /geolocation=\(\)/);
  });

  it("scopes HSTS to this host: no includeSubDomains, no preload", () => {
    const hsts = production.get("strict-transport-security") ?? "";
    assert.equal(hsts, `max-age=${DEFAULT_HSTS_MAX_AGE_SECONDS}`);
    assert.doesNotMatch(hsts, /includesubdomains/i);
    assert.doesNotMatch(hsts, /preload/i);
  });

  it("sends no HSTS outside production", () => {
    const dev = asMap(getBrowserSecurityHeaders({ isProduction: false }));
    assert.equal(dev.has("strict-transport-security"), false);
  });

  it("takes an explicit HSTS max-age and ignores nonsense", () => {
    assert.equal(getHstsMaxAge("31536000"), 31536000);
    assert.equal(getHstsMaxAge("0"), 0);
    for (const value of ["", " ", "-1", "1e9", "abc", "1.5", "99999999999"]) {
      assert.equal(getHstsMaxAge(value), DEFAULT_HSTS_MAX_AGE_SECONDS, value);
    }
  });

  it("enforces only the nonce-free baseline statically; scripts are the proxy's job", () => {
    const csp = production.get("content-security-policy") ?? "";
    assert.equal(csp, BASELINE_CSP);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /base-uri 'self'/);
    assert.doesNotMatch(csp, /script-src|default-src|nonce/);
  });
});

describe("next.config.mjs", () => {
  it("applies the headers to every path and hides X-Powered-By", async () => {
    assert.equal(nextConfig.poweredByHeader, false);

    assert.ok(nextConfig.headers, "next.config defines headers()");
    const rules = await nextConfig.headers();
    const all = rules.find((rule: { source: string }) => rule.source === "/:path*");

    assert.ok(all, "a catch-all header rule");
    const keys = all.headers.map(({ key }: { key: string }) => key.toLowerCase());
    for (const name of ["x-content-type-options", "referrer-policy", "permissions-policy", "x-frame-options"]) {
      assert.ok(keys.includes(name), name);
    }
  });
});

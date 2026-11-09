import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchAllowedHost, normalizeHost, parseNonproductionHosts, reportClosedGate, resolveWebsitesGate } from "./gate";

/* Synthetic hosts and placeholder secrets only. */
const SECRETS = {
  WEBSITES_IP_HASH_SALT: "test-salt-0123456789abcdef",
  TURNSTILE_SECRET_KEY: "test-turnstile-secret",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test-turnstile-site-key",
};
const NONPROD = {
  WEBSITES_SERVICES_MODE: "nonproduction",
  WEBSITES_NONPRODUCTION_HOSTS: "staging.example.com, preview.example.com:8443",
  ...SECRETS,
};

function hdrs(values: Record<string, string>) {
  const lower = Object.fromEntries(Object.entries(values).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name: string) => lower[name.toLowerCase()] ?? null };
}

describe("websites gate: default off", () => {
  it("is off with WEBSITES_SERVICES_MODE unset, whatever else is configured", () => {
    const gate = resolveWebsitesGate(hdrs({ host: "staging.example.com" }), { ...SECRETS, WEBSITES_NONPRODUCTION_HOSTS: "staging.example.com" });
    assert.deepEqual(gate, { enabled: false, mode: "off", reason: "mode_off" });
  });

  it("is off for unknown mode values", () => {
    for (const mode of ["", "on", "true", "NONPRODUCTION", "staging"]) {
      const gate = resolveWebsitesGate(hdrs({ host: "staging.example.com" }), { ...NONPROD, WEBSITES_SERVICES_MODE: mode });
      assert.equal(gate.enabled, false, mode);
    }
  });

  it("production still resolves to off while release gates are open, even when authorized", () => {
    const gate = resolveWebsitesGate(hdrs({ host: "entrepreneuria.io" }), {
      ...SECRETS,
      WEBSITES_SERVICES_MODE: "production",
      WEBSITES_OWNER_RELEASE_AUTHORIZED: "true",
    });
    assert.deepEqual(gate, { enabled: false, mode: "off", reason: "mode_off" });
  });
});

describe("websites gate: nonproduction host allowlist", () => {
  it("opens on an allowlisted host with every secret set", () => {
    const gate = resolveWebsitesGate(hdrs({ host: "staging.example.com" }), NONPROD);
    assert.ok(gate.enabled);
    assert.equal(gate.host, "staging.example.com");
    assert.equal(gate.hostname, "staging.example.com");
    assert.equal(gate.origin, "https://staging.example.com");
  });

  it("keeps a non-default port in the host and origin", () => {
    const gate = resolveWebsitesGate(hdrs({ host: "preview.example.com:8443" }), NONPROD);
    assert.ok(gate.enabled);
    assert.equal(gate.origin, "https://preview.example.com:8443");
    assert.equal(gate.hostname, "preview.example.com");
  });

  it("fails closed with no allowlist", () => {
    for (const hosts of [undefined, "", " , "]) {
      const gate = resolveWebsitesGate(hdrs({ host: "staging.example.com" }), { ...NONPROD, WEBSITES_NONPRODUCTION_HOSTS: hosts });
      assert.deepEqual(gate, { enabled: false, mode: "nonproduction", reason: "host_not_allowed" });
    }
  });

  it("never serves nonproduction on a production host, even if it is listed", () => {
    const env = { ...NONPROD, WEBSITES_NONPRODUCTION_HOSTS: "entrepreneuria.io,www.entrepreneuria.io,staging.example.com" };
    for (const host of ["entrepreneuria.io", "www.entrepreneuria.io", "ENTREPRENEURIA.IO"]) {
      assert.equal(resolveWebsitesGate(hdrs({ host }), env).enabled, false, host);
    }
    assert.deepEqual(parseNonproductionHosts(env.WEBSITES_NONPRODUCTION_HOSTS, {}), ["staging.example.com"]);
  });

  it("refuses hosts that are not listed, including look-alikes and other ports", () => {
    for (const host of ["other.example.com", "staging.example.com.attacker.example", "staging.example.com:8080", "example.com"]) {
      assert.equal(resolveWebsitesGate(hdrs({ host }), NONPROD).enabled, false, host);
    }
  });

  it("refuses a request with no host, or a malformed one", () => {
    assert.equal(resolveWebsitesGate(hdrs({}), NONPROD).enabled, false);
    for (const host of ["staging.example.com/path", "user@staging.example.com", "staging.example.com?x", "*.example.com", "staging example.com"]) {
      assert.equal(resolveWebsitesGate(hdrs({ host }), NONPROD).enabled, false, host);
    }
  });

  it("behind a proxy: a loopback Host with an allowlisted forwarded host is accepted", () => {
    const gate = resolveWebsitesGate(hdrs({ host: "localhost:3000", "x-forwarded-host": "staging.example.com" }), NONPROD);
    assert.ok(gate.enabled);
    assert.equal(gate.origin, "https://staging.example.com");
  });

  it("every host value present must be allowed: a forwarded host can't override the Host", () => {
    for (const h of [
      { host: "entrepreneuria.io", "x-forwarded-host": "staging.example.com" },
      { host: "staging.example.com", "x-forwarded-host": "entrepreneuria.io" },
      { host: "localhost:3000", "x-forwarded-host": "staging.example.com, other.example.com" },
      { host: "staging.example.com", "x-forwarded-host": "preview.example.com:8443" },
    ]) {
      assert.equal(resolveWebsitesGate(hdrs(h), NONPROD).enabled, false, JSON.stringify(h));
    }
  });

  it("loopback alone never opens the gate unless it is allowlisted", () => {
    assert.equal(resolveWebsitesGate(hdrs({ host: "localhost:3000" }), NONPROD).enabled, false);
    const local = { ...NONPROD, WEBSITES_NONPRODUCTION_HOSTS: "localhost:3000" };
    const gate = resolveWebsitesGate(hdrs({ host: "localhost:3000" }), { ...local, NODE_ENV: "development" });
    assert.ok(gate.enabled);
    assert.equal(gate.origin, "http://localhost:3000", "plain http only for local development");
  });

  it("ignores loopback allowlist entries when NODE_ENV=production", () => {
    const env = { ...NONPROD, WEBSITES_NONPRODUCTION_HOSTS: "localhost:3000", NODE_ENV: "production" };
    assert.equal(resolveWebsitesGate(hdrs({ host: "localhost:3000" }), env).enabled, false);
  });

  it("matchAllowedHost needs exactly one allowlisted host", () => {
    assert.equal(matchAllowedHost(hdrs({ host: "a.example.com" }), []), null);
    assert.equal(matchAllowedHost(hdrs({ host: "a.example.com" }), ["a.example.com"]), "a.example.com");
    assert.equal(matchAllowedHost(hdrs({ host: "A.Example.com:443" }), ["a.example.com"]), "a.example.com");
  });

  it("normalizeHost rejects anything that is not a bare authority", () => {
    assert.equal(normalizeHost("Staging.Example.com"), "staging.example.com");
    assert.equal(normalizeHost("staging.example.com:443"), "staging.example.com");
    assert.equal(normalizeHost("[::1]:3000"), "[::1]:3000");
    for (const bad of [null, "", "  ", "a/b", "a@b", "a#b", "a\\b", "*.example.com"]) assert.equal(normalizeHost(bad), null, String(bad));
  });
});

describe("websites gate: required secrets", () => {
  it("refuses to run without an IP hash salt of at least 16 characters", () => {
    for (const salt of [undefined, "", "short-salt"]) {
      const gate = resolveWebsitesGate(hdrs({ host: "staging.example.com" }), { ...NONPROD, WEBSITES_IP_HASH_SALT: salt });
      assert.deepEqual(gate, { enabled: false, mode: "nonproduction", reason: "ip_hash_salt_missing" });
    }
  });

  it("refuses to run without both Turnstile keys", () => {
    for (const over of [{ TURNSTILE_SECRET_KEY: undefined }, { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "" }]) {
      const gate = resolveWebsitesGate(hdrs({ host: "staging.example.com" }), { ...NONPROD, ...over });
      assert.deepEqual(gate, { enabled: false, mode: "nonproduction", reason: "turnstile_not_configured" });
    }
  });

  it("reports a closed configured gate once per reason, and never for mode off", () => {
    const logs: string[] = [];
    const log = (m: string) => logs.push(m);
    reportClosedGate({ enabled: false, mode: "off", reason: "mode_off" }, log);
    reportClosedGate({ enabled: false, mode: "nonproduction", reason: "host_not_allowed" }, log);
    reportClosedGate({ enabled: false, mode: "nonproduction", reason: "host_not_allowed" }, log);
    reportClosedGate({ enabled: false, mode: "nonproduction", reason: "ip_hash_salt_missing" }, log);
    assert.equal(logs.length, 2);
    assert.ok(logs.every((l) => !l.includes(SECRETS.WEBSITES_IP_HASH_SALT)));
  });
});

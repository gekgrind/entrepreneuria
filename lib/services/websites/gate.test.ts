import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isProposedFlowEnabled, resolvePaymentsMode, resolveServicesMode } from "./flags";
import {
  matchAllowedHost,
  normalizeHost,
  parseNonproductionHosts,
  reportClosedGate,
  resolveWebsitesGate,
  resolveWebsitesPageAccess,
} from "./gate";
import { PASSED_LEADS_GATES, validLeadsEnv } from "./leads.test-helper";

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

  it("behind a proxy: accepted when Host and X-Forwarded-Host name the same allowlisted host", () => {
    const gate = resolveWebsitesGate(hdrs({ host: "staging.example.com", "x-forwarded-host": "Staging.Example.com" }), NONPROD);
    assert.ok(gate.enabled);
    assert.equal(gate.origin, "https://staging.example.com");
  });

  it("a forwarded host never stands in for an upstream (loopback) Host", () => {
    for (const nodeEnv of ["production", "development"]) {
      for (const host of ["localhost:3000", "127.0.0.1:3000", "[::1]:3000"]) {
        const gate = resolveWebsitesGate(hdrs({ host, "x-forwarded-host": "staging.example.com" }), { ...NONPROD, NODE_ENV: nodeEnv });
        assert.equal(gate.enabled, false, `${nodeEnv} ${host}`);
      }
    }
  });

  it("refuses host spellings that only normalise to an allowlisted host", () => {
    for (const host of ["staging%2Eexample.com", "staging.example.com.", "0x7f.1:3000", "2130706433", "xn--stging-zra.example.com"]) {
      assert.equal(resolveWebsitesGate(hdrs({ host }), { ...NONPROD, WEBSITES_NONPRODUCTION_HOSTS: "staging.example.com,127.0.0.1:3000" }).enabled, false, host);
    }
  });

  it("builds the origin the browser reports, even for an explicit default port", () => {
    const env = { ...NONPROD, WEBSITES_NONPRODUCTION_HOSTS: "localhost:80,staging.example.com:443", NODE_ENV: "development" };
    const local = resolveWebsitesGate(hdrs({ host: "localhost:80" }), env);
    assert.ok(local.enabled);
    assert.equal(local.origin, "http://localhost");
    const staging = resolveWebsitesGate(hdrs({ host: "staging.example.com" }), env);
    assert.ok(staging.enabled);
    assert.equal(staging.origin, "https://staging.example.com");
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
    for (const bad of [null, "", "  ", "a/b", "a@b", "a#b", "a\\b", "*.example.com", "a%2eb", "-a.example.com", "0x7f.1", "a..b"]) {
      assert.equal(normalizeHost(bad), null, String(bad));
    }
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
    reportClosedGate({ enabled: false, mode: "nonproduction", reason: "host_not_allowed" }, log);
    assert.equal(logs.length, 2, "alternating reasons are each logged once");
    assert.ok(logs.every((l) => !l.includes(SECRETS.WEBSITES_IP_HASH_SALT)));
  });
});

describe("websites gate: showcase (page-only) mode", () => {
  const SHOWCASE = { WEBSITES_SERVICES_MODE: "showcase", WEBSITES_CONTACT_EMAIL: "services@example.test" };
  const apex = hdrs({ host: "entrepreneuria.io" });

  it("renders the page without the form on the canonical host, with no intake secrets or CRM settings", () => {
    assert.deepEqual(resolveWebsitesPageAccess(apex, SHOWCASE), {
      visible: true,
      mode: "showcase",
      intake: false,
      contactEmail: "services@example.test",
    });
  });

  it("never opens the intake gate, even with every leads and intake setting present", () => {
    const env = { ...validLeadsEnv(), ...SHOWCASE };
    assert.deepEqual(resolveWebsitesGate(apex, env, PASSED_LEADS_GATES), { enabled: false, mode: "showcase", reason: "intake_disabled" });
    const access = resolveWebsitesPageAccess(apex, env, PASSED_LEADS_GATES);
    assert.equal(access.visible && access.intake, false);
  });

  it("serves only the canonical host and listed nonproduction hosts; mixed or unknown hosts 404", () => {
    const env = { ...SHOWCASE, WEBSITES_NONPRODUCTION_HOSTS: "staging.example.com" };
    assert.equal(resolveWebsitesPageAccess(hdrs({ host: "staging.example.com" }), env).visible, true);
    const cases: Record<string, string>[] = [
      { host: "www.entrepreneuria.io" },
      { host: "evil.example" },
      { host: "entrepreneuria.io", "x-forwarded-host": "evil.example" },
      { host: "entrepreneuria.io:bad" },
      {},
    ];
    for (const h of cases) {
      const access = resolveWebsitesPageAccess(hdrs(h), env);
      assert.equal(access.visible, false, JSON.stringify(h));
      assert.equal(!access.visible && access.gate.reason, "host_not_allowed", JSON.stringify(h));
    }
  });

  it("refuses the page without a confirmed, well-formed inbox", () => {
    for (const email of [undefined, "", "not-an-email", "a@b", "x@example.test<script>"]) {
      const access = resolveWebsitesPageAccess(apex, { ...SHOWCASE, WEBSITES_CONTACT_EMAIL: email });
      assert.deepEqual(access, {
        visible: false,
        gate: { enabled: false, mode: "showcase", reason: "contact_email_missing", missing: ["WEBSITES_CONTACT_EMAIL"] },
      }, String(email));
    }
  });

  it("fails closed and reports unrecognised or near-miss mode values", () => {
    for (const mode of ["SHOWCASE", "Showcase", " showcase", "showcase ", "showcase,leads", "show", "on"]) {
      const env = { ...SHOWCASE, WEBSITES_SERVICES_MODE: mode };
      assert.deepEqual(resolveWebsitesGate(apex, env), { enabled: false, mode: "off", reason: "mode_unrecognized" }, mode);
      const access = resolveWebsitesPageAccess(apex, env);
      assert.equal(access.visible, false, mode);
    }
    const logs: string[] = [];
    reportClosedGate({ enabled: false, mode: "off", reason: "mode_unrecognized" }, (m) => logs.push(m));
    assert.equal(logs.length, 1);
    assert.doesNotMatch(logs[0], /SHOWCASE|leads,/, "the raw value is never echoed");
  });

  it("off (unset, empty or explicit) hides the page", () => {
    for (const mode of [undefined, "", "off"]) {
      const access = resolveWebsitesPageAccess(apex, { ...SHOWCASE, WEBSITES_SERVICES_MODE: mode });
      assert.deepEqual(access, { visible: false, gate: { enabled: false, mode: "off", reason: "mode_off" } }, String(mode));
    }
  });

  it("does not log the intended closed states", () => {
    const logs: string[] = [];
    reportClosedGate({ enabled: false, mode: "showcase", reason: "intake_disabled" }, (m) => logs.push(m));
    reportClosedGate({ enabled: false, mode: "off", reason: "mode_off" }, (m) => logs.push(m));
    assert.deepEqual(logs, []);
  });

  it("enables no payments or proposed policy flows", () => {
    const env = { ...SHOWCASE, WEBSITES_PAYMENTS_MODE: "sandbox", WEBSITES_PROPOSED_POLICY_FLOWS: "cancellation" };
    assert.equal(resolveServicesMode(env), "showcase");
    assert.equal(resolvePaymentsMode(env), "disabled");
    assert.equal(isProposedFlowEnabled("cancellation", env), false);
  });
});

describe("websites gate: page access in intake modes (regression)", () => {
  const apex = hdrs({ host: "entrepreneuria.io" });

  it("leads mode renders the form when every leads check passes", () => {
    assert.deepEqual(resolveWebsitesPageAccess(apex, validLeadsEnv(), PASSED_LEADS_GATES), {
      visible: true,
      mode: "leads",
      intake: true,
      contactEmail: "services@example.test",
    });
  });

  it("leads mode with open gates or missing config hides the page instead of falling back to showcase", () => {
    const open = resolveWebsitesPageAccess(apex, validLeadsEnv());
    assert.equal(open.visible, false);
    assert.equal(!open.visible && open.gate.reason, "leads_gates_open");
    const missing = resolveWebsitesPageAccess(apex, validLeadsEnv({ GHL_API_TOKEN: undefined }), PASSED_LEADS_GATES);
    assert.equal(missing.visible, false);
    assert.equal(!missing.visible && missing.gate.reason, "leads_config_incomplete");
  });

  it("nonproduction still needs its secrets, an allowlisted host and the inbox", () => {
    const staging = hdrs({ host: "staging.example.com" });
    const env = { ...NONPROD, WEBSITES_CONTACT_EMAIL: "services@example.test" };
    const ok = resolveWebsitesPageAccess(staging, env);
    assert.equal(ok.visible && ok.intake, true);
    assert.equal(resolveWebsitesPageAccess(staging, { ...env, TURNSTILE_SECRET_KEY: undefined }).visible, false);
    assert.equal(resolveWebsitesPageAccess(apex, env).visible, false);
    assert.equal(resolveWebsitesPageAccess(staging, { ...env, WEBSITES_CONTACT_EMAIL: undefined }).visible, false);
  });
});

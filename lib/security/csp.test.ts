import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BASELINE_CSP } from "./browser-headers.mjs";
import {
  CSP_REPORT_GROUP,
  CSP_REPORT_PATH,
  TURNSTILE_ORIGIN,
  applyContentSecurityPolicy,
  buildBaselinePolicy,
  buildContentSecurityPolicy,
  createNonce,
  getCspMode,
  getSupabaseConnectOrigins,
  prepareContentSecurityPolicy,
} from "./csp";

const SUPABASE = "https://project-ref.supabase.co";
const NONCE = "dGVzdC1ub25jZS0xMjM0NQ==";

function directives(policy: string) {
  const map = new Map<string, string[]>();

  for (const part of policy.split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) map.set(name, sources);
  }

  return map;
}

function production(mode: "report-only" | "enforce" = "report-only") {
  return directives(
    buildContentSecurityPolicy({ nonce: NONCE, mode, supabaseUrl: SUPABASE, isDevelopment: false }),
  );
}

describe("CSP mode", () => {
  it("defaults to report-only", () => {
    assert.equal(getCspMode(undefined), "report-only");
    assert.equal(getCspMode(""), "report-only");
  });

  it("accepts enforce and off, case- and space-insensitively", () => {
    assert.equal(getCspMode(" Enforce "), "enforce");
    assert.equal(getCspMode("OFF"), "off");
  });

  it("never enforces on a typo", () => {
    for (const value of ["enforced", "true", "1", "block", "report_only"]) {
      assert.equal(getCspMode(value), "report-only", value);
    }
  });
});

describe("nonce", () => {
  it("is 128 random bits, base64, and different every time", () => {
    const seen = new Set<string>();

    for (let i = 0; i < 200; i += 1) {
      const nonce = createNonce();
      assert.match(nonce, /^[A-Za-z0-9+/]{22}==$/);
      seen.add(nonce);
    }

    assert.equal(seen.size, 200);
  });
});

describe("full policy (production)", () => {
  const policy = production();

  it("authorizes scripts by nonce with strict-dynamic", () => {
    const scripts = policy.get("script-src") ?? [];
    assert.ok(scripts.includes(`'nonce-${NONCE}'`));
    assert.ok(scripts.includes("'strict-dynamic'"));
  });

  it("never allows inline or eval'd script in production", () => {
    const scripts = policy.get("script-src") ?? [];
    assert.ok(!scripts.includes("'unsafe-inline'"));
    assert.ok(!scripts.includes("'unsafe-eval'"));
  });

  it("has no wildcard or scheme-wide source for script, connect or frame", () => {
    for (const name of ["script-src", "connect-src", "frame-src", "default-src"]) {
      for (const source of policy.get(name) ?? []) {
        assert.ok(!source.includes("*"), `${name} ${source}`);
        assert.ok(!["https:", "http:", "data:", "blob:"].includes(source), `${name} ${source}`);
      }
    }
  });

  it("allows exactly the script origins login needs", () => {
    const hosts = (policy.get("script-src") ?? []).filter((source) => source.startsWith("https://"));
    assert.deepEqual(hosts, [TURNSTILE_ORIGIN]);
  });

  it("lets Turnstile render its challenge frame and nothing else frame", () => {
    assert.deepEqual(policy.get("frame-src"), [TURNSTILE_ORIGIN]);
  });

  it("lets the browser client reach Supabase over https and realtime", () => {
    const connect = policy.get("connect-src") ?? [];
    assert.ok(connect.includes(SUPABASE));
    assert.ok(connect.includes("wss://project-ref.supabase.co"));
    assert.ok(connect.includes("'self'"));
  });

  it("locks down plugins, <base>, framing and form targets", () => {
    assert.deepEqual(policy.get("object-src"), ["'none'"]);
    assert.deepEqual(policy.get("base-uri"), ["'self'"]);
    assert.deepEqual(policy.get("frame-ancestors"), ["'none'"]);
    assert.deepEqual(policy.get("form-action"), ["'self'"]);
    assert.deepEqual(policy.get("default-src"), ["'self'"]);
  });

  it("reports violations to the intake route", () => {
    assert.deepEqual(policy.get("report-uri"), [CSP_REPORT_PATH]);
    assert.deepEqual(policy.get("report-to"), [CSP_REPORT_GROUP]);
  });

  it("upgrades insecure requests only when enforced", () => {
    assert.equal(policy.has("upgrade-insecure-requests"), false);
    assert.equal(production("enforce").has("upgrade-insecure-requests"), true);
  });
});

describe("development policy", () => {
  it("adds 'unsafe-eval' for React's development build only", () => {
    const dev = directives(
      buildContentSecurityPolicy({ nonce: NONCE, mode: "report-only", supabaseUrl: SUPABASE, isDevelopment: true }),
    );
    assert.ok(dev.get("script-src")?.includes("'unsafe-eval'"));
    assert.ok(!dev.get("script-src")?.includes("'unsafe-inline'"));
  });
});

describe("Supabase origins", () => {
  it("are derived from the configured URL only", () => {
    assert.deepEqual(getSupabaseConnectOrigins("https://abc.supabase.co/rest/v1"), [
      "https://abc.supabase.co",
      "wss://abc.supabase.co",
    ]);
  });

  it("are dropped when missing, malformed or not https", () => {
    assert.deepEqual(getSupabaseConnectOrigins(undefined), []);
    assert.deepEqual(getSupabaseConnectOrigins("not a url"), []);
    assert.deepEqual(getSupabaseConnectOrigins("http://abc.supabase.co"), []);
  });
});

describe("prepareContentSecurityPolicy", () => {
  it("report-only: nonce policy reported, nonce on the request", () => {
    const headers = new Headers();
    const prepared = prepareContentSecurityPolicy(headers, {
      mode: "report-only",
      reportOrigin: "https://entrepreneuria.io",
      nonce: NONCE,
      supabaseUrl: SUPABASE,
      isDevelopment: false,
    });

    assert.equal(headers.get("x-nonce"), NONCE);
    assert.match(headers.get("content-security-policy-report-only") ?? "", new RegExp(`'nonce-${NONCE}'`));
    /* Next.js reads `content-security-policy` first; it must not shadow the nonce. */
    assert.equal(headers.get("content-security-policy"), null);

    const response = applyContentSecurityPolicy(new Response(null), prepared);
    /* Regression: Next.js copies proxy response headers onto the request
       and reads `content-security-policy` first, so a nonce-less one from
       the proxy hid the nonce and no script got one. */
    assert.equal(response.headers.get("content-security-policy"), null);
    assert.match(response.headers.get("content-security-policy-report-only") ?? "", /'strict-dynamic'/);
    assert.equal(
      response.headers.get("reporting-endpoints"),
      `${CSP_REPORT_GROUP}="https://entrepreneuria.io${CSP_REPORT_PATH}"`,
    );
  });

  it("enforce: one enforced policy carrying the nonce", () => {
    const headers = new Headers();
    const prepared = prepareContentSecurityPolicy(headers, {
      mode: "enforce",
      reportOrigin: "https://entrepreneuria.io",
      nonce: NONCE,
    });
    const response = applyContentSecurityPolicy(new Response(null), prepared);

    assert.match(response.headers.get("content-security-policy") ?? "", new RegExp(`'nonce-${NONCE}'`));
    assert.equal(response.headers.get("content-security-policy-report-only"), null);
    assert.match(headers.get("content-security-policy") ?? "", /'strict-dynamic'/);
  });

  it("off: no policy at all", () => {
    const headers = new Headers();
    const prepared = prepareContentSecurityPolicy(headers, {
      mode: "off",
      reportOrigin: "https://entrepreneuria.io",
    });
    const response = applyContentSecurityPolicy(new Response(null), prepared);

    assert.equal(response.headers.get("content-security-policy"), null);
    assert.equal(response.headers.get("content-security-policy-report-only"), null);
    assert.equal(headers.get("x-nonce"), null);
  });

  it("never emits a policy without the nonce, in any mode", () => {
    for (const mode of ["report-only", "enforce"] as const) {
      const prepared = prepareContentSecurityPolicy(new Headers(), {
        mode,
        reportOrigin: "https://entrepreneuria.io",
        nonce: NONCE,
      });

      for (const [name, value] of Object.entries(prepared.responseHeaders)) {
        if (name.startsWith("content-security-policy")) {
          assert.match(value, new RegExp(`'nonce-${NONCE}'`), `${mode} ${name}`);
        }
      }
    }
  });

  it("matches the static baseline enforced from next.config.mjs", () => {
    assert.equal(buildBaselinePolicy(), BASELINE_CSP);

    const full = directives(buildContentSecurityPolicy({ nonce: NONCE, mode: "enforce", isDevelopment: false }));
    for (const [name, sources] of directives(BASELINE_CSP)) {
      assert.deepEqual(full.get(name), sources, name);
    }
  });

  it("discards CSP and nonce headers a client sent, in every mode", () => {
    for (const mode of ["report-only", "enforce", "off"] as const) {
      const headers = new Headers({
        "content-security-policy": "script-src 'nonce-attacker'",
        "content-security-policy-report-only": "script-src 'nonce-attacker'",
        "x-nonce": "attacker",
      });

      prepareContentSecurityPolicy(headers, { mode, reportOrigin: "https://entrepreneuria.io", nonce: NONCE });

      for (const name of ["content-security-policy", "content-security-policy-report-only", "x-nonce"]) {
        assert.ok(!(headers.get(name) ?? "").includes("attacker"), `${mode} ${name}`);
      }
    }
  });
});

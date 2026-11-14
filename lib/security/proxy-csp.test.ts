import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { NextRequest, type NextResponse } from "next/server";

import { proxy } from "../../proxy";
import { installFakeAuthApi, SUPABASE_URL } from "../supabase/testing/fake-auth-api";
import { CSP_REPORT_PATH } from "./csp";

/*
 * The proxy puts the per-request policy on every response it returns,
 * and hands the same nonce to the renderer through the forwarded request
 * headers (`x-middleware-request-*`), which is how Next.js stamps it on
 * its scripts.
 */

const env = process.env as Record<string, string | undefined>;
const saved = {
  url: env.NEXT_PUBLIC_SUPABASE_URL,
  key: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  mode: env.CSP_MODE,
};
const originalFetch = globalThis.fetch;

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete env[name];
  else env[name] = value;
}

beforeEach(() => {
  globalThis.fetch = installFakeAuthApi().fetchStub;
  env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake-anon-key";
  delete env.CSP_MODE;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  restore("NEXT_PUBLIC_SUPABASE_URL", saved.url);
  restore("NEXT_PUBLIC_SUPABASE_ANON_KEY", saved.key);
  restore("CSP_MODE", saved.mode);
});

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: { host: "entrepreneuria.io", "x-forwarded-proto": "https", ...headers },
  });
}

function nonceOf(policy: string | null) {
  return policy?.match(/'nonce-([^']+)'/)?.[1] ?? null;
}

function forwarded(response: NextResponse, name: string) {
  return response.headers.get(`x-middleware-request-${name}`);
}

describe("proxy CSP", () => {
  it("reports the nonce policy on a public auth page and forwards the same nonce", async () => {
    const response = await proxy(request("/login"));
    const reported = response.headers.get("content-security-policy-report-only");
    const nonce = nonceOf(reported);

    assert.ok(nonce, "a nonce in the reported policy");
    assert.equal(forwarded(response, "x-nonce"), nonce);
    assert.equal(nonceOf(forwarded(response, "content-security-policy-report-only")), nonce);
    /* Next.js copies proxy response headers onto the request and reads
       this one first: from the proxy it must not exist in report-only. */
    assert.equal(response.headers.get("content-security-policy"), null);
    assert.equal(forwarded(response, "content-security-policy"), null);
    assert.match(response.headers.get("reporting-endpoints") ?? "", /https:\/\/entrepreneuria\.io\/api\/security\/csp-report/);
  });

  it("uses a fresh nonce per request", async () => {
    const a = nonceOf((await proxy(request("/login"))).headers.get("content-security-policy-report-only"));
    const b = nonceOf((await proxy(request("/login"))).headers.get("content-security-policy-report-only"));
    assert.notEqual(a, b);
  });

  it("covers the redirect a signed-out visitor gets from a protected route", async () => {
    const response = await proxy(request("/dashboard"));

    assert.equal(response.status, 307);
    assert.match(response.headers.get("location") ?? "", /\/login\?next=%2Fdashboard$/);
    assert.ok(nonceOf(response.headers.get("content-security-policy-report-only")));
  });

  it("covers the fail-closed answer when Supabase is not configured", async () => {
    delete env.NEXT_PUBLIC_SUPABASE_URL;
    const response = await proxy(request("/dashboard"));

    assert.equal(response.status, 503);
    assert.ok(response.headers.get("content-security-policy-report-only"));
  });

  it("does not let a client choose the nonce", async () => {
    const response = await proxy(
      request("/login", {
        "content-security-policy": "script-src 'nonce-attacker'",
        "x-nonce": "attacker",
      }),
    );

    assert.notEqual(forwarded(response, "x-nonce"), "attacker");
    assert.equal(forwarded(response, "content-security-policy"), null);
  });

  it("enforces under CSP_MODE=enforce and sends nothing under off", async () => {
    env.CSP_MODE = "enforce";
    const enforced = await proxy(request("/login"));
    assert.ok(nonceOf(enforced.headers.get("content-security-policy")));
    assert.equal(enforced.headers.get("content-security-policy-report-only"), null);

    env.CSP_MODE = "off";
    const off = await proxy(request("/login"));
    assert.equal(off.headers.get("content-security-policy"), null);
    assert.equal(off.headers.get("content-security-policy-report-only"), null);
  });

  it("leaves the report intake alone", async () => {
    const response = await proxy(request(CSP_REPORT_PATH));
    assert.equal(response.headers.get("content-security-policy-report-only"), null);
  });
});

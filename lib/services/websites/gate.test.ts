import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  intakeConfigProblems,
  isHostAllowedForMode,
  reportGateRefusal,
  resolveRequestServicesGate,
  resolveServicesMode,
} from "./flags";
import { normalizeHost, parseHostList } from "./hosts";
import { clientIpHash, proxyClientIp, readBodyCapped } from "./request";
import { createTurnstileVerifier, TURNSTILE_SITEVERIFY_URL, WEBSITES_TURNSTILE_ACTION } from "./turnstile";

/* Synthetic placeholder values only. */
const READY = {
  WEBSITES_SERVICES_MODE: "nonproduction",
  WEBSITES_NONPRODUCTION_HOSTS: "staging.example.com, localhost:3000",
  WEBSITES_IP_HASH_SALT: "test-salt-0123456789abcdef",
  TURNSTILE_SECRET_KEY: "test-secret",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test-site-key",
};

describe("release gate: off by default", () => {
  it("unset or unknown mode is off, and production still resolves to off", () => {
    assert.equal(resolveServicesMode({}), "off");
    assert.equal(resolveServicesMode({ WEBSITES_SERVICES_MODE: "on" }), "off");
    assert.equal(resolveServicesMode({ WEBSITES_SERVICES_MODE: "production" }), "off");
    assert.equal(resolveServicesMode({ WEBSITES_SERVICES_MODE: "production", WEBSITES_OWNER_RELEASE_AUTHORIZED: "true" }), "off");
  });

  it("with the mode unset, every host is off (page and route 404)", () => {
    const { WEBSITES_SERVICES_MODE: _unset, ...env } = READY;
    for (const host of ["entrepreneuria.io", "staging.example.com", "localhost:3000", null]) {
      assert.deepEqual(resolveRequestServicesGate(host, env), { mode: "off", host: null, refused: [] });
    }
  });

  it("production mode with full config is still off while release gates fail", () => {
    const env = { ...READY, WEBSITES_SERVICES_MODE: "production", WEBSITES_OWNER_RELEASE_AUTHORIZED: "true" };
    assert.equal(resolveRequestServicesGate("entrepreneuria.io", env).mode, "off");
  });
});

describe("release gate: host allowlist", () => {
  it("nonproduction runs only on an allowlisted host", () => {
    assert.deepEqual(resolveRequestServicesGate("staging.example.com", READY), { mode: "nonproduction", host: "staging.example.com", refused: [] });
    assert.equal(resolveRequestServicesGate("STAGING.example.com", READY).mode, "nonproduction");
    assert.equal(resolveRequestServicesGate("localhost:3000", READY).mode, "nonproduction");
    for (const host of ["other.example.com", "staging.example.com:8443", "localhost", "", null, undefined, "staging.example.com/evil", "a b"]) {
      const gate = resolveRequestServicesGate(host, READY);
      assert.equal(gate.mode, "off", String(host));
      assert.ok(gate.refused.some((r) => r.includes("host")), String(host));
    }
  });

  it("nonproduction never runs on a production host, even if listed", () => {
    const env = { ...READY, WEBSITES_NONPRODUCTION_HOSTS: "entrepreneuria.io,www.entrepreneuria.io,staging.example.com" };
    assert.equal(resolveRequestServicesGate("entrepreneuria.io", env).mode, "off");
    assert.equal(resolveRequestServicesGate("www.entrepreneuria.io", env).mode, "off");
    assert.equal(resolveRequestServicesGate("entrepreneuria.io:443", env).mode, "off");
    assert.equal(resolveRequestServicesGate("staging.example.com", env).mode, "nonproduction");
  });

  it("an empty or missing allowlist fails closed", () => {
    assert.equal(resolveRequestServicesGate("staging.example.com", { ...READY, WEBSITES_NONPRODUCTION_HOSTS: "" }).mode, "off");
    const { WEBSITES_NONPRODUCTION_HOSTS: _none, ...env } = READY;
    assert.equal(resolveRequestServicesGate("staging.example.com", env).mode, "off");
  });

  it("production mode is tied to the production hosts", () => {
    assert.equal(isHostAllowedForMode("entrepreneuria.io", "production", READY), true);
    assert.equal(isHostAllowedForMode("staging.example.com", "production", READY), false);
    assert.equal(isHostAllowedForMode("entrepreneuria.io", "off", READY), false);
  });

  it("host parsing drops anything that isn't a plain host", () => {
    assert.deepEqual(parseHostList(" A.example.com ,bad host,https://x.example.com,, b.example.com:8080 "), ["a.example.com", "b.example.com:8080"]);
    assert.equal(normalizeHost("example.com."), "example.com");
    assert.equal(normalizeHost("exa_mple.com"), null);
  });
});

describe("release gate: required intake configuration", () => {
  it("refuses any enabled mode without a salt, a Turnstile secret or a site key", () => {
    for (const [name, value] of [
      ["WEBSITES_IP_HASH_SALT", undefined],
      ["WEBSITES_IP_HASH_SALT", "short"],
      ["TURNSTILE_SECRET_KEY", undefined],
      ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", ""],
    ] as const) {
      const env = { ...READY, [name]: value };
      const gate = resolveRequestServicesGate("staging.example.com", env);
      assert.equal(gate.mode, "off", name);
      assert.ok(gate.refused.some((r) => r.startsWith(name)), name);
    }
    assert.deepEqual(intakeConfigProblems(READY), []);
  });

  it("refusal reasons name variables only and are logged once each", () => {
    const logs: string[] = [];
    const gate = resolveRequestServicesGate("staging.example.com", { ...READY, TURNSTILE_SECRET_KEY: undefined, WEBSITES_IP_HASH_SALT: "x" });
    reportGateRefusal(gate, (m) => logs.push(m));
    reportGateRefusal(gate, (m) => logs.push(m));
    assert.equal(logs.length, 2);
    assert.ok(logs.every((l) => !l.includes("test-") && !l.includes("staging")));
  });
});

describe("client IP from the proxy", () => {
  const h = (xff?: string) => new Headers(xff === undefined ? {} : { "x-forwarded-for": xff });

  it("uses the last X-Forwarded-For entry (the one our proxy appends), ignoring client-supplied ones", () => {
    assert.equal(proxyClientIp(h("198.51.100.7")), "198.51.100.7");
    assert.equal(proxyClientIp(h("203.0.113.1, 203.0.113.2, 198.51.100.7")), "198.51.100.7");
    assert.equal(proxyClientIp(h("2001:db8::1")), "2001:db8::1");
  });

  it("returns null for a missing or unusable value, and ignores X-Real-IP", () => {
    assert.equal(proxyClientIp(h()), null);
    assert.equal(proxyClientIp(h("")), null);
    assert.equal(proxyClientIp(h("198.51.100.7, not-an-ip")), null);
    assert.equal(proxyClientIp(new Headers({ "x-real-ip": "198.51.100.7" })), null);
  });

  it("hashes with the salt as a key, and never without one", () => {
    const a = clientIpHash(h("198.51.100.7"), "salt-one-0123456789");
    const b = clientIpHash(h("198.51.100.7"), "salt-two-0123456789");
    assert.match(a!, /^[0-9a-f]{32}$/);
    assert.notEqual(a, b);
    assert.equal(clientIpHash(h("203.0.113.9, 198.51.100.7"), "salt-one-0123456789"), a, "spoofed earlier hops don't change the bucket");
    assert.equal(clientIpHash(h("198.51.100.7"), ""), null);
    assert.equal(clientIpHash(h(), "salt-one-0123456789"), null);
  });
});

describe("request body cap", () => {
  const req = (body: BodyInit | null, headers: Record<string, string> = {}) =>
    new Request("https://staging.example.com/api/services/websites/inquiry", { method: "POST", body, headers, duplex: "half" } as RequestInit);

  it("rejects an oversize Content-Length before reading", async () => {
    let pulled = false;
    const stream = new ReadableStream(
      {
        pull() {
          pulled = true;
        },
      },
      { highWaterMark: 0 }
    );
    const r = await readBodyCapped(req(stream, { "content-length": "100000" }), 1000);
    assert.deepEqual(r, { ok: false, reason: "too_large" });
    assert.equal(pulled, false);
    assert.deepEqual(await readBodyCapped(req("x", { "content-length": "abc" }), 1000), { ok: false, reason: "malformed" });
  });

  it("counts bytes, not UTF-16 units", async () => {
    const text = "é".repeat(600); // 600 UTF-16 units, 1200 bytes
    assert.deepEqual(await readBodyCapped(req(text), 1000), { ok: false, reason: "too_large" });
    assert.deepEqual(await readBodyCapped(req(text), 1200), { ok: true, text });
  });

  it("stops reading a stream without a Content-Length at the cap", async () => {
    let chunks = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        chunks++;
        c.enqueue(new Uint8Array(400));
      },
    });
    assert.deepEqual(await readBodyCapped(req(stream), 1000), { ok: false, reason: "too_large" });
    assert.ok(chunks <= 4);
  });

  it("rejects invalid UTF-8", async () => {
    assert.deepEqual(await readBodyCapped(req(new Uint8Array([0x7b, 0xff, 0x7d])), 1000), { ok: false, reason: "malformed" });
  });
});

describe("websites Turnstile verifier", () => {
  const reply = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });
  const make = (fetch: (u: string, i?: RequestInit) => Promise<Response>, timeoutMs?: number) =>
    createTurnstileVerifier({ secret: "test-secret", expectedHostname: "staging.example.com", expectedAction: WEBSITES_TURNSTILE_ACTION, fetch, timeoutMs });
  const good = { success: true, hostname: "staging.example.com", action: WEBSITES_TURNSTILE_ACTION };

  it("accepts only a successful token for this host and action", async () => {
    let seen: { url: string; secret: unknown; response: unknown } | null = null;
    const ok = await make(async (url, init) => {
      const form = init!.body as FormData;
      seen = { url, secret: form.get("secret"), response: form.get("response") };
      return new Response(JSON.stringify(good));
    })("tok");
    assert.equal(ok, true);
    assert.deepEqual(seen, { url: TURNSTILE_SITEVERIFY_URL, secret: "test-secret", response: "tok" });

    for (const body of [
      { ...good, success: false },
      { ...good, hostname: "other.example.com" },
      { ...good, hostname: undefined },
      { ...good, action: "login" },
      { ...good, action: "" },
      { ...good, success: "true" },
    ]) {
      assert.equal(await make(reply(body))("tok"), false, JSON.stringify(body));
    }
    assert.equal(await make(reply(good, 500))("tok"), false);
    assert.equal(await make(async () => new Response("<html>"))("tok"), false);
    assert.equal(await make(async () => Promise.reject(new Error("net")))("tok"), false);
    assert.equal(await make(reply(good))(""), false);
  });

  it("times out and fails closed", async () => {
    const hang = (_u: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    const started = Date.now();
    assert.equal(await make(hang, 20)("tok"), false);
    assert.ok(Date.now() - started < 1000);
  });

  it("refuses to verify without a secret", async () => {
    const v = createTurnstileVerifier({ secret: "", expectedHostname: "x.example.com", expectedAction: "a", fetch: reply(good) });
    assert.equal(await v("tok"), false);
  });
});

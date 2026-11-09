import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { WEBSITES_TURNSTILE_ACTION } from "./content";
import { createTurnstileVerifier } from "./turnstile";

/* No network: siteverify is a fake. Placeholder secret only. */
function fakeSiteverify(reply: unknown, status = 200) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(reply), { status, headers: { "content-type": "application/json" } });
  };
  return { fetch, calls };
}

const good = { success: true, hostname: "staging.example.com", action: WEBSITES_TURNSTILE_ACTION };
const make = (fetch: (u: string, i?: RequestInit) => Promise<Response>, timeoutMs?: number) =>
  createTurnstileVerifier({ secret: "test-secret", expectedHostname: "staging.example.com", fetch, timeoutMs });

describe("websites Turnstile verifier", () => {
  it("accepts a successful token for this host and action, sending the secret and token", async () => {
    const f = fakeSiteverify(good);
    assert.equal(await make(f.fetch)("tok"), true);
    const form = f.calls[0].init!.body as FormData;
    assert.equal(form.get("secret"), "test-secret");
    assert.equal(form.get("response"), "tok");
    assert.ok(f.calls[0].init!.signal, "request carries a timeout signal");
  });

  it("rejects a token issued for another hostname or action, or without them", async () => {
    for (const reply of [
      { ...good, hostname: "other.example.com" },
      { ...good, action: "login" },
      { ...good, action: "" },
      { success: true },
      { ...good, success: false },
      { ...good, success: "true" },
    ]) {
      assert.equal(await make(fakeSiteverify(reply).fetch)("tok"), false, JSON.stringify(reply));
    }
  });

  it("rejects an empty token without calling siteverify", async () => {
    const f = fakeSiteverify(good);
    assert.equal(await make(f.fetch)(""), false);
    assert.equal(f.calls.length, 0);
  });

  it("fails closed on HTTP errors, unreadable bodies and network errors", async () => {
    assert.equal(await make(fakeSiteverify(good, 500).fetch)("tok"), false);
    assert.equal(await make(async () => new Response("<html>", { status: 200 }))("tok"), false);
    assert.equal(await make(async () => Promise.reject(new Error("offline")))("tok"), false);
  });

  it("gives up after the timeout", async () => {
    const hang = (_u: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    const started = Date.now();
    assert.equal(await make(hang, 30)("tok"), false);
    assert.ok(Date.now() - started < 2000);
  });

  it("refuses to be built without a secret", () => {
    assert.throws(() => createTurnstileVerifier({ secret: "", expectedHostname: "staging.example.com" }));
  });
});

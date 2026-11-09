import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashClientIp, isAllowedOrigin, isJsonContentType, readBodyCapped, resolveClientIp } from "./request-guards";

const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request("https://entrepreneuria.io/x", { method: "POST", body, headers });

describe("readBodyCapped", () => {
  it("reads a body within the cap", async () => {
    assert.deepEqual(await readBodyCapped(post("hello"), 10), { ok: true, text: "hello" });
  });

  it("rejects a declared length over the cap even when the actual body is small", async () => {
    // Proves the header check short-circuits: reading this body would have succeeded.
    const r = post("tiny", { "content-length": "999999" });
    assert.deepEqual(await readBodyCapped(r, 100), { ok: false, reason: "too_large" });
  });

  it("aborts a streamed body that exceeds the cap with no declared length", async () => {
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        pulls += 1;
        c.enqueue(new Uint8Array(40));
        if (pulls >= 1000) c.close();
      },
    });
    const r = new Request("https://entrepreneuria.io/x", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    assert.deepEqual(await readBodyCapped(r, 100), { ok: false, reason: "too_large" });
    assert.ok(pulls < 20, `stopped early, pulled ${pulls} chunks`);
  });

  it("treats a malformed content-length as unreadable", async () => {
    const r = post("x", {});
    Object.defineProperty(r, "headers", { value: new Headers({ "content-length": "abc" }) });
    assert.deepEqual(await readBodyCapped(r, 100), { ok: false, reason: "unreadable" });
  });
});

describe("origin and content type", () => {
  const ORIGIN = "https://entrepreneuria.io";
  it("accepts only the exact configured origin; a missing header fails closed", () => {
    assert.equal(isAllowedOrigin(post("x", { origin: ORIGIN }), ORIGIN), true);
    assert.equal(isAllowedOrigin(post("x", { origin: "https://evil.example" }), ORIGIN), false);
    assert.equal(isAllowedOrigin(post("x", { origin: "https://entrepreneuria.io.evil.example" }), ORIGIN), false);
    assert.equal(isAllowedOrigin(post("x", { origin: "http://entrepreneuria.io" }), ORIGIN), false);
    assert.equal(isAllowedOrigin(post("x"), ORIGIN), false);
  });

  it("requires application/json", () => {
    assert.equal(isJsonContentType(post("x", { "content-type": "application/json" })), true);
    assert.equal(isJsonContentType(post("x", { "content-type": "application/json; charset=utf-8" })), true);
    assert.equal(isJsonContentType(post("x", { "content-type": "text/plain" })), false);
    assert.equal(isJsonContentType(post("x", { "content-type": "application/jsonp" })), false);
    assert.equal(isJsonContentType(new Request("https://entrepreneuria.io/x", { method: "POST" })), false);
  });
});

describe("resolveClientIp", () => {
  const h = (v: Record<string, string>) => new Headers(v);

  it("takes the proxy-appended rightmost entry, so a spoofed leftmost value is ignored", () => {
    const headers = h({ "x-forwarded-for": "1.2.3.4, 9.9.9.9, 198.51.100.7" });
    assert.equal(resolveClientIp(headers, { kind: "xff-from-right", hops: 1 }), "198.51.100.7");
    assert.equal(resolveClientIp(headers, { kind: "xff-from-right", hops: 2 }), "9.9.9.9");
  });

  it("returns null when there are fewer entries than hops", () => {
    assert.equal(resolveClientIp(h({ "x-forwarded-for": "198.51.100.7" }), { kind: "xff-from-right", hops: 2 }), null);
    assert.equal(resolveClientIp(h({}), { kind: "xff-from-right", hops: 1 }), null);
  });

  it("returns null for anything that is not an IP address", () => {
    assert.equal(resolveClientIp(h({ "x-forwarded-for": "not-an-ip" }), { kind: "xff-from-right", hops: 1 }), null);
    assert.equal(resolveClientIp(h({ "x-real-ip": "<script>" }), { kind: "x-real-ip" }), null);
    assert.equal(resolveClientIp(h({ "x-real-ip": "198.51.100.7:8080" }), { kind: "x-real-ip" }), null);
  });

  it("x-real-ip source ignores x-forwarded-for entirely; both IPv4 and IPv6 work", () => {
    assert.equal(resolveClientIp(h({ "x-real-ip": "2001:db8::1", "x-forwarded-for": "1.2.3.4" }), { kind: "x-real-ip" }), "2001:db8::1");
    assert.equal(resolveClientIp(h({ "x-forwarded-for": "1.2.3.4" }), { kind: "x-real-ip" }), null);
  });
});

describe("hashClientIp", () => {
  it("is salted and stable, and does not reveal the address", () => {
    const a = hashClientIp("198.51.100.7", "salt-one-salt-one-1");
    assert.equal(a, hashClientIp("198.51.100.7", "salt-one-salt-one-1"));
    assert.notEqual(a, hashClientIp("198.51.100.7", "salt-two-salt-two-2"));
    assert.equal(a.length, 32);
    assert.ok(!a.includes("198"));
  });
});

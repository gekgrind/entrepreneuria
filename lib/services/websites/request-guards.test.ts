import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashClientIp, ipRateLimitKey, proxyClientIp, rateLimitAddress, readBodyCapped } from "./request-guards";

/* Documentation-range addresses only (RFC 5737 / RFC 3849). */
const hdrs = (values: Record<string, string>) => new Headers(values);

describe("client address", () => {
  it("uses the proxy-set X-Real-IP and ignores X-Forwarded-For", () => {
    assert.equal(proxyClientIp(hdrs({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1, 203.0.113.7" })), "203.0.113.7");
    assert.equal(proxyClientIp(hdrs({ "x-forwarded-for": "198.51.100.1" })), null);
    assert.equal(proxyClientIp(hdrs({ "x-real-ip": "2001:db8::1" })), "2001:db8::1");
  });

  it("treats a missing or non-IP value as unknown", () => {
    for (const v of ["", "unknown", "203.0.113.7, 198.51.100.1", "not-an-ip", "fe80::1%eth0", "1:2:3:4:5:6:7:8%a:b"]) {
      assert.equal(proxyClientIp(hdrs({ "x-real-ip": v })), null, v);
    }
  });

  it("unwraps IPv4-mapped IPv6 addresses", () => {
    assert.equal(proxyClientIp(hdrs({ "x-real-ip": "::ffff:203.0.113.7" })), "203.0.113.7");
    assert.equal(proxyClientIp(hdrs({ "x-real-ip": "::FFFF:203.0.113.7" })), "203.0.113.7");
  });

  it("rate-limits IPv6 clients per /64 and IPv4 clients per address", () => {
    assert.equal(rateLimitAddress("203.0.113.7"), "203.0.113.7");
    const net = rateLimitAddress("2001:db8:1:2::1");
    assert.equal(net, "2001:db8:1:2::/64");
    for (const ip of ["2001:db8:1:2:ffff:ffff:ffff:ffff", "2001:0db8:0001:0002:0:0:0:9", "2001:db8:1:2::203.0.113.1"]) {
      assert.equal(rateLimitAddress(ip), net, ip);
    }
    assert.notEqual(rateLimitAddress("2001:db8:1:3::1"), net);
    assert.equal(rateLimitAddress("::1"), "0:0:0:0::/64");
    assert.doesNotThrow(() => rateLimitAddress("1:2:3:4:5:6:7:8%a:b"));
  });

  it("unknown addresses share one rate-limit bucket", () => {
    assert.equal(ipRateLimitKey(null), ipRateLimitKey(null));
    assert.notEqual(ipRateLimitKey("abc"), ipRateLimitKey(null));
  });

  it("hashes with a salt, never without one", () => {
    const a = hashClientIp("203.0.113.7", "salt-one-0123456789");
    assert.equal(a.length, 32);
    assert.equal(a, hashClientIp("203.0.113.7", "salt-one-0123456789"));
    assert.notEqual(a, hashClientIp("203.0.113.7", "salt-two-0123456789"));
    assert.notEqual(a, hashClientIp("203.0.113.8", "salt-one-0123456789"));
    assert.throws(() => hashClientIp("203.0.113.7", ""));
  });
});

describe("body cap", () => {
  const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
    new Request("http://localhost/api", { method: "POST", body, headers, duplex: "half" } as RequestInit);

  function stream(chunks: Uint8Array[], onPull?: () => void) {
    let i = 0;
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        onPull?.();
        if (i < chunks.length) controller.enqueue(chunks[i++]);
        else controller.close();
      },
    });
  }

  it("refuses a declared Content-Length over the cap without reading the body", async () => {
    const req = post(stream([new Uint8Array(10)]), { "content-length": "17" });
    assert.deepEqual(await readBodyCapped(req, 16), { ok: false, reason: "too_large" });
    assert.equal(req.bodyUsed, false);
  });

  it("refuses a malformed Content-Length", async () => {
    assert.deepEqual(await readBodyCapped(post("{}", { "content-length": "abc" }), 16), { ok: false, reason: "malformed" });
  });

  it("counts bytes, not characters", async () => {
    const text = "é".repeat(10); // 10 characters, 20 bytes
    assert.deepEqual(await readBodyCapped(post(text), 19), { ok: false, reason: "too_large" });
    assert.deepEqual(await readBodyCapped(post(text), 20), { ok: true, text });
  });

  it("stops reading a body without Content-Length once it passes the cap", async () => {
    let pulls = 0;
    const chunks = Array.from({ length: 100 }, () => new Uint8Array(8).fill(0x61));
    const res = await readBodyCapped(post(stream(chunks, () => pulls++)), 20);
    assert.deepEqual(res, { ok: false, reason: "too_large" });
    assert.ok(pulls < 10, `read ${pulls} chunks`);
  });

  it("rejects invalid UTF-8 and accepts an empty body", async () => {
    assert.deepEqual(await readBodyCapped(post(new Uint8Array([0xff, 0xfe])), 16), { ok: false, reason: "malformed" });
    assert.deepEqual(await readBodyCapped(post(null), 16), { ok: true, text: "" });
  });
});

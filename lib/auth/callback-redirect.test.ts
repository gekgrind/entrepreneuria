import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NextRequest } from "next/server";

import { GET as oauthCallback } from "../../app/auth/callback/route";

/*
 * `next` round-trips through /auth/callback, which is where an open
 * redirect would actually fire. The provider-cancel branch needs no
 * Auth API, and it re-validates `next` exactly as a successful exchange
 * does before handing it back to /login.
 */

async function cancelledCallback(next: string) {
  const url = new URL("http://localhost:3000/auth/callback");
  url.searchParams.set("error", "access_denied");
  url.searchParams.set("next", next);

  const response = await oauthCallback(
    new NextRequest(url, { headers: { host: "entrepreneuria.io" } }),
  );
  const location = new URL(response.headers.get("location")!);

  return { origin: location.origin, next: location.searchParams.get("next") };
}

describe("/auth/callback re-validates next", () => {
  for (const hostile of [
    "/\\evil.example",
    "/\t/evil.example",
    "//evil.example",
    "https://evil.example/",
    "https://channelwright.entrepreneuria.io.evil.example/studio",
    "https://user@channelwright.entrepreneuria.io/studio",
  ]) {
    it(`drops ${JSON.stringify(hostile)}`, async () => {
      const result = await cancelledCallback(hostile);

      assert.equal(result.origin, "https://entrepreneuria.io");
      assert.equal(result.next, null);
    });
  }

  for (const trusted of [
    "/dashboard?tab=1",
    "https://channelwright.entrepreneuria.io/studio",
    "https://prospra.entrepreneuria.io/dashboard",
  ]) {
    it(`keeps ${JSON.stringify(trusted)}`, async () => {
      const result = await cancelledCallback(trusted);

      assert.equal(result.origin, "https://entrepreneuria.io");
      assert.equal(result.next, trusted);
    });
  }
});

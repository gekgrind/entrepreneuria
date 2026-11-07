import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSafeAuthRedirect, isSafeRelativePath } from "./trusted-redirect";

/* The callback route re-validates `next` with this helper before it
   redirects, so an open-redirect regression here is an auth bug. */

describe("getSafeAuthRedirect", () => {
  it("falls back to the dashboard when no destination was requested", () => {
    assert.equal(getSafeAuthRedirect(null), "/dashboard");
  });

  it("preserves a same-site path with its query string", () => {
    assert.equal(
      getSafeAuthRedirect("/settings?tab=profile"),
      "/settings?tab=profile",
    );
  });

  it("allows an absolute URL on a trusted ecosystem origin", () => {
    assert.equal(
      getSafeAuthRedirect("https://prospra.entrepreneuria.io/app"),
      "https://prospra.entrepreneuria.io/app",
    );
  });

  it("rejects a protocol-relative URL", () => {
    assert.equal(getSafeAuthRedirect("//evil.example.com"), "/dashboard");
  });

  it("rejects an untrusted origin", () => {
    assert.equal(
      getSafeAuthRedirect("https://evil.example.com/steal"),
      "/dashboard",
    );
  });

  it("rejects http, even on a trusted host", () => {
    assert.equal(
      getSafeAuthRedirect("http://entrepreneuria.io/dashboard"),
      "/dashboard",
    );
  });

  function withNodeEnv(value: string, run: () => void) {
    const previous = process.env.NODE_ENV;
    Reflect.set(process.env, "NODE_ENV", value);

    try {
      run();
    } finally {
      Reflect.set(process.env, "NODE_ENV", previous);
    }
  }

  it("trusts a loopback origin over http outside production, for local dev SSO", () => {
    const previousArchitectaUrl = process.env.NEXT_PUBLIC_ARCHITECTA_APP_URL;
    process.env.NEXT_PUBLIC_ARCHITECTA_APP_URL = "http://localhost:3000";

    try {
      withNodeEnv("development", () => {
        assert.equal(
          getSafeAuthRedirect("http://localhost:3000/dashboard"),
          "http://localhost:3000/dashboard",
        );
      });
    } finally {
      process.env.NEXT_PUBLIC_ARCHITECTA_APP_URL = previousArchitectaUrl;
    }
  });

  it("still rejects a loopback origin in production", () => {
    const previousArchitectaUrl = process.env.NEXT_PUBLIC_ARCHITECTA_APP_URL;
    process.env.NEXT_PUBLIC_ARCHITECTA_APP_URL = "http://localhost:3000";

    try {
      withNodeEnv("production", () => {
        assert.equal(
          getSafeAuthRedirect("http://localhost:3000/dashboard"),
          "/dashboard",
        );
      });
    } finally {
      process.env.NEXT_PUBLIC_ARCHITECTA_APP_URL = previousArchitectaUrl;
    }
  });
});

describe("relative destinations a URL parser reads as another host", () => {
  const hostile = [
    "/\\evil.example",
    "/\\\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "//evil.example",
    "/\u0000/evil.example",
  ];

  for (const value of hostile) {
    it(`rejects ${JSON.stringify(value)}`, () => {
      assert.equal(isSafeRelativePath(value), false);
      assert.equal(getSafeAuthRedirect(value), "/dashboard");
    });
  }

  it("the browser really would leave the site for them", () => {
    assert.equal(new URL("/\\evil.example", "https://entrepreneuria.io").host, "evil.example");
    assert.equal(new URL("/\t/evil.example", "https://entrepreneuria.io").host, "evil.example");
  });

  for (const value of ["/dashboard?tab=1", "/%0d/x", "/%5Cevil.example", "/a/b#c"]) {
    it(`keeps ${JSON.stringify(value)}, which stays a path`, () => {
      assert.equal(isSafeRelativePath(value), true);
      assert.equal(getSafeAuthRedirect(value), value);
    });
  }
});

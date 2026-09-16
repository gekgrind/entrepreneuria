import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildOAuthCallbackUrl,
  classifyProviderError,
  getOAuthErrorMessage,
  OAUTH_CALLBACK_PATH,
  OAUTH_PROVIDERS,
} from "./oauth";

describe("OAuth provider registry", () => {
  it("offers Google and GitHub, in that order", () => {
    assert.deepEqual(
      OAUTH_PROVIDERS.map((provider) => provider.id),
      ["google", "github"],
    );
  });

  it("labels both providers with the same 'Continue with' grammar", () => {
    assert.deepEqual(
      OAUTH_PROVIDERS.map((provider) => provider.label),
      ["Continue with Google", "Continue with GitHub"],
    );
  });

  it("gives every provider its own redirecting label", () => {
    for (const provider of OAUTH_PROVIDERS) {
      assert.ok(
        provider.redirectingLabel.length > 0,
        `${provider.id} has no redirecting label`,
      );
    }
  });
});

describe("buildOAuthCallbackUrl", () => {
  it("sends every provider to the shared callback route", () => {
    const url = new URL(
      buildOAuthCallbackUrl("https://entrepreneuria.io", "/command-center"),
    );

    assert.equal(url.pathname, OAUTH_CALLBACK_PATH);
    assert.equal(url.origin, "https://entrepreneuria.io");
  });

  it("carries the intended destination as `next` rather than as the target", () => {
    const url = new URL(
      buildOAuthCallbackUrl("http://localhost:3000", "/settings?tab=profile"),
    );

    assert.equal(url.searchParams.get("next"), "/settings?tab=profile");
  });

  it("preserves an absolute trusted destination", () => {
    const url = new URL(
      buildOAuthCallbackUrl(
        "https://entrepreneuria.io",
        "https://prospra.entrepreneuria.io/app",
      ),
    );

    assert.equal(
      url.searchParams.get("next"),
      "https://prospra.entrepreneuria.io/app",
    );
  });
});

describe("provider error classification", () => {
  it("reads the provider's access_denied as a cancellation", () => {
    assert.equal(classifyProviderError("access_denied"), "cancelled");
  });

  it("treats any other provider error as a provider failure", () => {
    assert.equal(classifyProviderError("server_error"), "provider");
    assert.equal(classifyProviderError("bad_verification_code"), "provider");
  });

  it("falls back to unknown when the provider sent no error", () => {
    assert.equal(classifyProviderError(null), "unknown");
  });
});

describe("getOAuthErrorMessage", () => {
  it("has no message when there is no error code", () => {
    assert.equal(getOAuthErrorMessage(null), null);
  });

  it("maps every known code to visitor-facing copy", () => {
    for (const code of ["cancelled", "provider", "exchange", "session"]) {
      const message = getOAuthErrorMessage(code);

      assert.ok(message, `${code} has no message`);
      assert.ok(message.length > 0);
    }
  });

  it("never leaks a raw provider or Supabase string", () => {
    const message = getOAuthErrorMessage("invalid_grant: PKCE verifier missing");

    assert.equal(message, getOAuthErrorMessage("unknown"));
    assert.ok(!message?.includes("PKCE"));
  });
});

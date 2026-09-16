import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveAvatarUrl,
  resolveDisplayName,
  resolveEmail,
} from "./identity-metadata";

/* Shapes taken from what Supabase copies into `user_metadata` for each
   provider. The GitHub variants are the ones that used to resolve to
   null under the Google-only fallback chain. */

const GOOGLE_METADATA = {
  avatar_url: "https://lh3.googleusercontent.com/a/abc123",
  email: "founder@entrepreneuria.io",
  email_verified: true,
  full_name: "Misti Grinder",
  name: "Misti Grinder",
  picture: "https://lh3.googleusercontent.com/a/abc123",
  provider_id: "10947",
  sub: "10947",
};

const GITHUB_METADATA = {
  avatar_url: "https://avatars.githubusercontent.com/u/4242?v=4",
  email: "founder@entrepreneuria.io",
  email_verified: true,
  full_name: "Misti Grinder",
  name: "Misti Grinder",
  preferred_username: "gekgrind",
  provider_id: "4242",
  sub: "4242",
  user_name: "gekgrind",
};

/** A GitHub account with no display name and a private email. */
const GITHUB_MINIMAL_METADATA = {
  avatar_url: "https://avatars.githubusercontent.com/u/4242?v=4",
  full_name: null,
  name: null,
  preferred_username: "gekgrind",
  provider_id: "4242",
  sub: "4242",
  user_name: "gekgrind",
};

describe("resolveDisplayName", () => {
  it("prefers the real name for Google", () => {
    assert.equal(
      resolveDisplayName(GOOGLE_METADATA, "founder@entrepreneuria.io"),
      "Misti Grinder",
    );
  });

  it("prefers the real name for GitHub when the account has one", () => {
    assert.equal(
      resolveDisplayName(GITHUB_METADATA, "founder@entrepreneuria.io"),
      "Misti Grinder",
    );
  });

  it("falls back to the GitHub handle when no name is set", () => {
    assert.equal(resolveDisplayName(GITHUB_MINIMAL_METADATA, null), "gekgrind");
  });

  it("falls back to preferred_username when user_name is absent", () => {
    assert.equal(
      resolveDisplayName({ preferred_username: "gekgrind" }, null),
      "gekgrind",
    );
  });

  it("falls back to the email local part when metadata is empty", () => {
    assert.equal(resolveDisplayName({}, "founder@entrepreneuria.io"), "founder");
  });

  it("returns null rather than an empty string when nothing is usable", () => {
    assert.equal(resolveDisplayName({}, null), null);
    assert.equal(resolveDisplayName(null, undefined), null);
    assert.equal(resolveDisplayName({ full_name: "   " }, null), null);
  });
});

describe("resolveAvatarUrl", () => {
  it("reads Google's avatar_url", () => {
    assert.equal(
      resolveAvatarUrl(GOOGLE_METADATA),
      "https://lh3.googleusercontent.com/a/abc123",
    );
  });

  it("reads GitHub's avatar_url", () => {
    assert.equal(
      resolveAvatarUrl(GITHUB_METADATA),
      "https://avatars.githubusercontent.com/u/4242?v=4",
    );
  });

  it("falls back to `picture` when avatar_url is absent", () => {
    assert.equal(
      resolveAvatarUrl({ picture: "https://example.com/p.png" }),
      "https://example.com/p.png",
    );
  });

  it("returns null for a missing or unusable avatar", () => {
    assert.equal(resolveAvatarUrl({}), null);
    assert.equal(resolveAvatarUrl(null), null);
    assert.equal(resolveAvatarUrl({ avatar_url: "not a url" }), null);
  });

  it("refuses a non-http(s) scheme", () => {
    assert.equal(resolveAvatarUrl({ avatar_url: "javascript:alert(1)" }), null);
    assert.equal(
      resolveAvatarUrl({ avatar_url: "data:image/png;base64,AAA" }),
      null,
    );
  });
});

describe("resolveEmail", () => {
  it("treats the authenticated email as canonical", () => {
    assert.equal(
      resolveEmail({ email: "stale@example.com" }, "founder@entrepreneuria.io"),
      "founder@entrepreneuria.io",
    );
  });

  it("falls back to metadata when Supabase has no email", () => {
    assert.equal(
      resolveEmail({ email: "founder@entrepreneuria.io" }, null),
      "founder@entrepreneuria.io",
    );
  });

  it("returns null for a GitHub account with a private email", () => {
    assert.equal(resolveEmail(GITHUB_MINIMAL_METADATA, null), null);
  });
});

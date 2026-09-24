import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Structural tests for the email-confirmation route. The route itself
 * calls Supabase's verifyOtp which requires a real backend, so these
 * tests verify the confirm route module exists and that the supporting
 * auth infrastructure handles the "confirm" error code correctly.
 */

describe("email confirmation route", () => {
  it("exports a GET handler", async () => {
    const mod = await import("./route");
    assert.equal(typeof mod.GET, "function");
  });
});

describe("confirm error code", () => {
  it("is mapped to a user-facing message", async () => {
    const { getOAuthErrorMessage } = await import("@/lib/auth/oauth");
    const message = getOAuthErrorMessage("confirm");

    assert.ok(message, "confirm code has no message");
    assert.ok(message.includes("expired") || message.includes("verification"));
  });

  it("does not leak internal details", async () => {
    const { getOAuthErrorMessage } = await import("@/lib/auth/oauth");
    const message = getOAuthErrorMessage("confirm");

    assert.ok(!message?.includes("token_hash"));
    assert.ok(!message?.includes("verifyOtp"));
  });
});

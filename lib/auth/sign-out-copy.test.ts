import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { SIGN_OUT_EXPLANATION } from "./sign-out-client";

/*
 * Signing out revokes the account's sessions, so none of them can
 * refresh, but an access token already issued keeps working until it
 * expires. The wording says exactly that, and every control that signs
 * out directly (without the confirmation page) carries it.
 */

const root = join(__dirname, "..", "..");

describe("sign-out explanation", () => {
  it("separates revoking sessions from access tokens expiring", () => {
    assert.equal(
      SIGN_OUT_EXPLANATION,
      "Signs out this browser and revokes your account's sessions. Other devices may retain access until their current access tokens expire."
    );
  });

  for (const file of [
    "components/Header.tsx",
    "components/UserMenu.tsx",
    "components/account/UserAccountMenu.tsx",
  ]) {
    it(`${file} attaches it to its sign-out control`, () => {
      const source = readFileSync(join(root, file), "utf8");

      assert.match(source, /SIGN_OUT_EXPLANATION/);
      assert.match(source, /title=\{SIGN_OUT_EXPLANATION\}/);
    });
  }
});

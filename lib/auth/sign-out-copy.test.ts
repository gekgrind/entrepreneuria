import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AccountSignOutForm } from "../../components/account/UserAccountMenu";
import { SIGN_OUT_DESCRIPTION_IDS } from "../../components/auth/SignOutExplanation";
import { MobileSignOut } from "../../components/Header";
import { UserMenuSignOut } from "../../components/UserMenu";
import { SIGN_OUT_EXPLANATION } from "./sign-out-client";

/*
 * Signing out revokes the account's sessions, so none of them can
 * refresh, but an access token already issued keeps working until it
 * expires. The explanation says so as visible text that the sign-out
 * control is described by (aria-describedby), so it reaches keyboard,
 * touch and screen-reader users; a title attribute alone is hover-only.
 * These tests render the real controls and follow the association.
 */

const noop = () => {};
const escape = (text: string) => text.replace(/'/g, "&#x27;");

const controls = [
  ["Header (mobile menu)", SIGN_OUT_DESCRIPTION_IDS.headerMobile,
    () => createElement(MobileSignOut, { onLogout: noop })],
  ["UserMenu", SIGN_OUT_DESCRIPTION_IDS.userMenu,
    () => createElement(UserMenuSignOut, { onLogout: noop })],
  ["UserAccountMenu", SIGN_OUT_DESCRIPTION_IDS.accountMenu,
    () => createElement(AccountSignOutForm)],
] as const;

describe("sign-out explanation", () => {
  it("separates revoking sessions from access tokens expiring", () => {
    assert.equal(
      SIGN_OUT_EXPLANATION,
      "Signs out this browser and revokes your account's sessions. Other devices may retain access until their current access tokens expire."
    );
  });

  it("uses a distinct, stable id per control", () => {
    const ids = Object.values(SIGN_OUT_DESCRIPTION_IDS);

    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(ids, [
      "header-mobile-signout-description",
      "user-menu-signout-description",
      "account-menu-signout-description",
    ]);
  });

  for (const [name, id, render] of controls) {
    describe(name, () => {
      const html = renderToStaticMarkup(render());

      it("renders the explanation as visible text in the element its action points at", () => {
        const button = html.match(/<button\b[^>]*>/)?.[0] ?? "";

        assert.match(button, new RegExp(`aria-describedby="${id}"`));

        const described = html.match(
          new RegExp(`<([a-z]+)\\b([^>]*)\\bid="${id}"([^>]*)>([^<]*)</\\1>`),
        );

        assert.ok(described, "an element with that id is rendered");
        assert.equal(described[4], escape(SIGN_OUT_EXPLANATION));
        assert.equal(html.split(`id="${id}"`).length - 1, 1, "the id is used once");
      });

      it("is not hover-only or hidden", () => {
        const described = html.match(
          new RegExp(`<[a-z]+\\b[^>]*\\bid="${id}"[^>]*>`),
        )?.[0] ?? "";

        assert.doesNotMatch(html, /\btitle=/);
        assert.doesNotMatch(
          described,
          /\bhidden\b|aria-hidden|sr-only|\bdisplay:\s*none|\binvisible\b/,
        );
      });

      it("keeps the sign-out action itself", () => {
        assert.match(html, /(Log out|Sign out) of all devices/);
        assert.match(html, /<button\b/);
      });
    });
  }

  it("the account menu action is still a POST to /auth/signout", () => {
    const html = renderToStaticMarkup(createElement(AccountSignOutForm));

    assert.match(html, /<form\b[^>]*action="\/auth\/signout"/);
    assert.match(html, /<form\b[^>]*method="post"/);
    assert.match(html, /<button\b[^>]*type="submit"/);
  });
});

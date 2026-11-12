import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReactElement } from "react";

import LoginPage from "../../app/(auth)/login/page";

/* The login page validates `next` on the server and hands the form only
   the result, which is where password sign-in redirects after success. */
async function formDestination(next: string) {
  const page = (await LoginPage({
    searchParams: Promise.resolve({ next }),
  })) as ReactElement<{ children: ReactElement<{ nextPath: string }> }>;

  return page.props.children.props.nextPath;
}

describe("login page next validation", () => {
  for (const hostile of [
    "/\\evil.example",
    "/\t/evil.example",
    "//evil.example",
    "https://evil.example/",
    "https://user@channelwright.entrepreneuria.io/studio",
  ]) {
    it(`sends password sign-in home instead of ${JSON.stringify(hostile)}`, async () => {
      assert.equal(await formDestination(hostile), "/dashboard");
    });
  }

  for (const trusted of ["/settings", "https://channelwright.entrepreneuria.io/studio"]) {
    it(`keeps ${JSON.stringify(trusted)}`, async () => {
      assert.equal(await formDestination(trusted), trusted);
    });
  }
});

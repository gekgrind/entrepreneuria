import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { PublicAiToolGate } from "./PublicAiToolGate";

describe("PublicAiToolGate", () => {
  const saved = process.env.PUBLIC_AI_TOOLS_ENABLED;

  afterEach(() => {
    if (saved === undefined) delete process.env.PUBLIC_AI_TOOLS_ENABLED;
    else process.env.PUBLIC_AI_TOOLS_ENABLED = saved;
  });

  it("renders the 404 page while the tools are disabled", () => {
    delete process.env.PUBLIC_AI_TOOLS_ENABLED;
    assert.throws(
      () => PublicAiToolGate({ children: "tool" }),
      (error: unknown) => String((error as { digest?: unknown }).digest).endsWith(";404"),
    );
  });

  it("renders the tool unchanged when enabled", () => {
    process.env.PUBLIC_AI_TOOLS_ENABLED = "true";
    assert.equal(PublicAiToolGate({ children: "tool" }), "tool");
  });
});

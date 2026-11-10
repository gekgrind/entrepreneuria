/**
 * Test-only preload for subprocess tests of scripts/ghl-sandbox-check.mts:
 * replaces the global fetch with the in-memory fake GHL, so the real CLI runs
 * end to end with no network. Not matched by the `*.test.ts` glob.
 *
 *   FAKE_GHL_STAGES=1|2       stages in the sandbox test pipeline
 *   FAKE_GHL_CALLS_FILE=path  where the method/path of every request is written on exit
 */
import { writeFileSync } from "node:fs";

import { createFakeGhl } from "./fake-ghl.test-helper";

const IDS = { style_interest: "SandboxStyleField001", package_interest: "SandboxPkgField00002" };
const stages = [{ id: "stage_sandbox", name: "New Website Inquiry" }];
if (process.env.FAKE_GHL_STAGES === "2") stages.push({ id: "stage_sent", name: "Preview Sent" });
// FAKE_GHL_DECOY=1: the configured pipeline has another name, and a one-stage decoy carries the default name.
const decoy = process.env.FAKE_GHL_DECOY === "1";
const pipelines = decoy
  ? [
      { id: "pipe_decoy", name: "Websites Sandbox Test Pipeline", stages: [{ id: "stage_decoy", name: "New Website Inquiry" }] },
      { id: "pipe_sandbox", name: "Configured Pipeline", stages },
    ]
  : [{ id: "pipe_sandbox", name: "Websites Sandbox Test Pipeline", stages }];

const fake = createFakeGhl({
  knownFieldIds: Object.values(IDS),
  location: {
    id: "loc_sandbox",
    name: "Test Sandbox",
    pipelines,
    customFields: [
      { id: IDS.style_interest, name: "style_interest", fieldKey: "contact.style_interest", dataType: "TEXT" },
      { id: IDS.package_interest, name: "package_interest", fieldKey: "contact.package_interest", dataType: "TEXT" },
    ],
  },
});
for (let i = 0; i < 5; i++) fake.seedContact(`pre-existing-${i}@example.org`, [`original-${i}`]);

globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) =>
  fake.fetch(input instanceof Request ? input.url : String(input), init)) as typeof fetch;

process.on("exit", () => {
  const file = process.env.FAKE_GHL_CALLS_FILE;
  if (file) {
    writeFileSync(
      file,
      JSON.stringify({
        calls: fake.calls.map((c) => ({ method: c.method, path: c.path })),
        contacts: fake.contacts.size,
        opportunities: fake.opportunities.length,
      })
    );
  }
});

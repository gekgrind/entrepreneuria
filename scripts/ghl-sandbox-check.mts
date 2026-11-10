/**
 * GoHighLevel sandbox check for the website-lead adapter.
 *
 *   npx tsx scripts/ghl-sandbox-check.mts            # dry run: in-memory fake, no network
 *   npx tsx scripts/ghl-sandbox-check.mts --live     # a SANDBOX sub-account (guards below)
 *   npx tsx scripts/ghl-sandbox-check.mts --live --cleanup   # also delete the contacts it created
 *
 * --live reads only GHL_SANDBOX_* variables (see docs/websites/GHL-SANDBOX-CHECK.md)
 * and refuses to run in CI, against production values, without the location
 * typed twice, or when the sub-account has active workflows. Before its first
 * write it verifies, read-only, that the token reaches a location named
 * exactly GHL_SANDBOX_EXPECT_LOCATION_NAME (which must contain "sandbox") and
 * that the pipeline, stage and field ids belong to it. Exit code is 0 only
 * when every check passes.
 */
import { createFakeGhl } from "../lib/integrations/ghl/fake-ghl.test-helper";
import { checkNoLiveWorkflows, checkSandboxEnv, runSandboxScenarios, type SandboxConfig } from "../lib/integrations/ghl/sandbox-check";
import { verifySandboxIdentity } from "../lib/integrations/ghl/sandbox-discover";

const args = new Set(process.argv.slice(2));
const live = args.has("--live");
const cleanup = args.has("--cleanup");
const runId = new Date().toISOString().replace(/\D/g, "").slice(0, 12);

let config: SandboxConfig;
let fetchImpl: (input: string, init?: RequestInit) => Promise<Response>;

if (live) {
  const guard = checkSandboxEnv(process.env);
  if (!guard.ok) {
    for (const e of guard.errors) console.error(`refused: ${e}`);
    process.exit(2);
  }
  for (const w of guard.warnings) console.warn(`note: ${w}`);
  config = guard.config;
  fetchImpl = (i, init) => fetch(i, init);
  const wf = await checkNoLiveWorkflows(config, fetchImpl, { ownerAttestsNoAutomations: process.env.GHL_SANDBOX_ATTEST_NO_AUTOMATIONS === "yes" });
  console.log(`workflow preflight: ${wf.detail}`);
  if (!wf.ok) process.exit(2);
} else {
  const ids = { style_interest: "SandboxStyleField001", package_interest: "SandboxPkgField00002" };
  const fake = createFakeGhl({
    knownFieldIds: Object.values(ids),
    location: {
      id: "loc_dry_run",
      name: "Dry Run Sandbox",
      pipelines: [{ id: "pipe_dry_run", name: "Websites Sandbox Test Pipeline", stages: [{ id: "stage_dry_run", name: "New Website Inquiry" }] }],
      customFields: [
        { id: ids.style_interest, name: "style_interest", fieldKey: "contact.style_interest", dataType: "TEXT" },
        { id: ids.package_interest, name: "package_interest", fieldKey: "contact.package_interest", dataType: "TEXT" },
      ],
    },
  });
  config = {
    token: "dry-run",
    locationId: "loc_dry_run",
    pipelineId: "pipe_dry_run",
    pipelineStageId: "stage_dry_run",
    apiVersion: "2021-07-28",
    customFieldIds: ids,
    expectedLocationName: "Dry Run Sandbox",
  };
  fetchImpl = fake.fetch;
  console.log("dry run against the in-memory fake (no network); pass --live for a sandbox sub-account");
}

// Identity gate: read-only, before any write. Any failure stops the run.
{
  const id = await verifySandboxIdentity(config, config.expectedLocationName, fetchImpl);
  if (!id.ok) {
    for (const e of id.errors) console.error(`refused: ${e}`);
    process.exit(2);
  }
  console.log(`identity: location "${id.discovery.location?.name}" verified; pipeline, stage and field ids belong to it`);
}

console.log(`run ${runId}: synthetic contacts ghl-sandbox+${runId}-*@example.com, tags sandbox-${runId}*`);
const run = await runSandboxScenarios({ config, fetch: fetchImpl, runId, log: (l) => console.log(l), reconcileDelayMs: live ? 2000 : 0, sleep: live ? undefined : async () => {} });

for (const o of run.observations) console.log(`observed: ${o}`);
const failed = run.results.filter((r) => !r.pass);
console.log(`\n${run.results.length - failed.length}/${run.results.length} checks passed`);
console.log(`contacts created: ${run.createdContactIds.join(", ") || "none"}`);

if (live && cleanup) {
  for (const id of run.createdContactIds) {
    const res = await fetchImpl(`https://services.leadconnectorhq.com/contacts/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${config.token}`, Version: config.apiVersion, Accept: "application/json" },
    });
    console.log(`cleanup ${id}: HTTP ${res.status}`);
  }
}

process.exit(failed.length ? 1 : 0);

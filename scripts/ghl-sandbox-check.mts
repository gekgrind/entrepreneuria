/**
 * GoHighLevel sandbox check for the website-lead adapter.
 *
 *   npx tsx scripts/ghl-sandbox-check.mts                      # dry run: in-memory fake, no network, all scenarios
 *   npx tsx scripts/ghl-sandbox-check.mts --live               # SANDBOX sub-account: S1 + S8 only, then verified cleanup
 *   npx tsx scripts/ghl-sandbox-check.mts --live --full        # S1–S8 (only if the owner asks for more than the minimum)
 *   npx tsx scripts/ghl-sandbox-check.mts --reconcile <runId>  # remove what an interrupted run left, from its manifest
 *
 * --live and --reconcile read only GHL_SANDBOX_* variables (see
 * docs/websites/GHL-SANDBOX-CHECK.md) and refuse to run in CI, against
 * production values, without the location typed twice, or when the
 * sub-account has active workflows. In the same invocation, before the first
 * write, the read-only identity gate must PASS: the token reaches a location
 * named exactly GHL_SANDBOX_EXPECT_LOCATION_NAME (which must contain
 * "sandbox"), and the pipeline, stage and field ids belong to it.
 *
 * Every live run writes an fsynced journal to
 * $GHL_SANDBOX_RUN_DIR/<runId>.jsonl (default output/ghl-sandbox-runs, 0600):
 * pre/post contact-id snapshots, an intent line before each create, every
 * created id, every delete and its verification. Cleanup always runs on
 * --live. Any refusal or failed delete stops the run (no retries) and exits
 * non-zero with the journal path; then review and use --reconcile.
 *
 * Exit code: 0 only when every check (including cleanup) passes; 1 a check
 * failed; 2 refused before any write.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { createFakeGhl } from "../lib/integrations/ghl/fake-ghl.test-helper";
import { checkNoLiveWorkflows, checkSandboxEnv, reconcileSandboxRun, runSandboxScenarios, type SandboxConfig } from "../lib/integrations/ghl/sandbox-check";
import { livePreflight, verifySandboxIdentity } from "../lib/integrations/ghl/sandbox-discover";
import { createMemoryManifest, openFileManifest, RUN_ID, type RunManifest } from "../lib/integrations/ghl/sandbox-ledger";

const argv = process.argv.slice(2);
const args = new Set(argv);
const reconcileId = args.has("--reconcile") ? argv[argv.indexOf("--reconcile") + 1] : null;
const live = args.has("--live") || reconcileId !== null;
const full = args.has("--full") || !live;
const runDir = process.env.GHL_SANDBOX_RUN_DIR || "output/ghl-sandbox-runs";

if (reconcileId !== null && !RUN_ID.test(reconcileId ?? "")) {
  console.error("refused: --reconcile needs the run id printed by the interrupted run");
  process.exit(2);
}

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
      pipelines: [
        {
          id: "pipe_dry_run",
          name: "Websites Sandbox Test Pipeline",
          stages: [
            { id: "stage_dry_run", name: "New Website Inquiry" },
            { id: "stage_dry_run_2", name: "Preview Sent" },
          ],
        },
      ],
      customFields: [
        { id: ids.style_interest, name: "style_interest", fieldKey: "contact.style_interest", dataType: "TEXT" },
        { id: ids.package_interest, name: "package_interest", fieldKey: "contact.package_interest", dataType: "TEXT" },
      ],
    },
  });
  // Five pre-existing contacts, as in the real sandbox, so the dry run exercises the snapshot check.
  for (let i = 0; i < 5; i++) fake.seedContact(`pre-existing-${i}@example.org`, [`original-${i}`]);
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

// Identity gate (criterion A): read-only, same invocation, before any write. Any failure stops the run.
const id = await verifySandboxIdentity(config, config.expectedLocationName, fetchImpl);
if (!id.ok) {
  for (const e of id.errors) console.error(`refused: ${e}`);
  process.exit(2);
}
console.log(`identity gate: PASS — location "${id.discovery.location?.name}"; pipeline, stage and field ids belong to it`);

if (reconcileId) {
  let manifest: RunManifest;
  try {
    manifest = await openFileManifest(runDir, reconcileId, { create: false });
  } catch (err) {
    console.error(`refused: no readable manifest for run ${reconcileId} in ${runDir} (${(err as Error).message})`);
    process.exit(2);
  }
  const rec = await reconcileSandboxRun({ config, fetch: fetchImpl, manifest, log: (l) => console.log(l) });
  console.log(`\nreconcile ${rec.ok ? "complete" : "INCOMPLETE"}; manifest: ${manifest.path}`);
  process.exit(rec.ok ? 0 : 1);
}

// Second-stage preflight: read-only, before any manifest or write. Without another stage the
// S8 capacity check cannot pass, so a live run would spend its writes on a certain failure.
const pre = livePreflight(id.discovery, config);
if (!pre.ok && live) {
  console.error(`refused: ${pre.error}`);
  process.exit(2);
}
const otherStageId = pre.ok ? pre.otherStageId : undefined;

const runId = live ? randomUUID() : "dryrun";
let gitSha = "unknown";
try {
  gitSha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
} catch {
  /* archive checkout without .git */
}
const manifest = live ? await openFileManifest(runDir, runId, { create: true }) : createMemoryManifest();

console.log(`run ${runId} (${full ? "full" : "minimal: S1 + S8"}): synthetic contacts ghl-sandbox+${runId}-*@example.com, tags sandbox-${runId}*`);
if (live) console.log(`manifest: ${manifest.path}`);
const run = await runSandboxScenarios({
  config,
  fetch: fetchImpl,
  runId,
  scope: full ? "full" : "minimal",
  manifest,
  cleanup: true,
  otherStageId,
  gitSha,
  log: (l) => console.log(l),
  reconcileDelayMs: live ? 2000 : 0,
  sleep: live ? undefined : async () => {},
});

for (const o of run.observations) console.log(`observed: ${o}`);
const failed = run.results.filter((r) => !r.pass);
console.log(`\n${run.results.length - failed.length}/${run.results.length} checks passed`);
console.log(`created: ${run.createdContactIds.length} contact(s), ${run.createdOpportunityIds.length} opportunity(ies)`);
if (run.stopped) console.log(`STOPPED by the safety guard: ${run.stopped}`);
if (failed.length && live) console.log(`review ${manifest.path}; if records remain: npx tsx scripts/ghl-sandbox-check.mts --reconcile ${runId}`);
process.exit(failed.length ? 1 : 0);

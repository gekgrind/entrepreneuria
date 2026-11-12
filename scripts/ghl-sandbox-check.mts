/**
 * GoHighLevel sandbox check for the website-lead adapter.
 *
 *   npx tsx scripts/ghl-sandbox-check.mts                      # dry run: in-memory fake, no network, all scenarios
 *   npx tsx scripts/ghl-sandbox-check.mts --live               # SANDBOX sub-account: S1 + S8 only, then verified cleanup
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
 * Every request is paced below GHL's rate limit (GHL_SANDBOX_RATE_PER_10S,
 * default 15, maximum 20); see lib/integrations/ghl/sandbox-pacer.ts.
 *
 * Exit code: 0 only when every check (including cleanup) passes; 1 a check
 * failed; 2 refused before any write; 3 every DELETE was accepted and all
 * other checks passed, but GHL's reads had not converged. Re-verify with
 * --reconcile; 4 every check passed, but something could not be established
 * and is listed as UNPROVEN.
 *
 * --full runs only against the fake: S5 and S6 exercise the adapter's write
 * retries, and a live run sends each write once.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { createFakeGhl } from "../lib/integrations/ghl/fake-ghl.test-helper";
import { checkNoLiveWorkflows, checkSandboxEnv, reconcileSandboxRun, runSandboxScenarios, type SandboxConfig } from "../lib/integrations/ghl/sandbox-check";
import { livePreflight, verifySandboxIdentity } from "../lib/integrations/ghl/sandbox-discover";
import { createPacedFetch, parseHarnessEnv, type HarnessSettings } from "../lib/integrations/ghl/sandbox-pacer";
import { createMemoryManifest, openFileManifest, RUN_ID, type RunManifest } from "../lib/integrations/ghl/sandbox-ledger";

const argv = process.argv.slice(2);
const args = new Set(argv);
const reconcileId = args.has("--reconcile") ? argv[argv.indexOf("--reconcile") + 1] : null;
const live = args.has("--live") || reconcileId !== null;
const full = args.has("--full") || !live;
const runDir = process.env.GHL_SANDBOX_RUN_DIR || "output/ghl-sandbox-runs";

if (args.has("--live") && args.has("--full")) {
  console.error("refused: --full is not allowed with --live, because S5 and S6 exercise the adapter's write retries");
  process.exit(2);
}

if (reconcileId !== null && !RUN_ID.test(reconcileId ?? "")) {
  console.error("refused: --reconcile needs the run id printed by the interrupted run");
  process.exit(2);
}

let config: SandboxConfig;
let fetchImpl: (input: string, init?: RequestInit) => Promise<Response>;
let settings: HarnessSettings | null = null;
let pacerStats: (() => { sent: number; throttled: number; retries: number }) | null = null;

if (live) {
  const guard = checkSandboxEnv(process.env);
  if (!guard.ok) {
    for (const e of guard.errors) console.error(`refused: ${e}`);
    process.exit(2);
  }
  for (const w of guard.warnings) console.warn(`note: ${w}`);
  config = guard.config;
  const harness = parseHarnessEnv(process.env);
  if (!harness.ok) {
    console.error(`refused: ${harness.error}`);
    process.exit(2);
  }
  settings = harness.settings;
  const paced = createPacedFetch((i, init) => fetch(i, init), {
    ratePer10s: settings.ratePer10s,
    onEvent: (e) => console.log(`pacer: ${JSON.stringify(e)}`),
  });
  fetchImpl = paced.fetch;
  pacerStats = paced.stats;
  console.log(`pacing: at most ${settings.ratePer10s} requests per 10 seconds`);
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
        { id: "pipe_dry_run_other", name: "Another Pipeline", stages: [{ id: "stage_dry_run_other", name: "Elsewhere" }] },
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
    const opened = await openFileManifest(runDir, reconcileId, { create: false });
    if (opened.repaired) {
      console.log(`journal: the last line was ${opened.repaired.action} after an interrupted write; the damaged original is kept at ${opened.repaired.backup}`);
    }
    manifest = opened;
  } catch (err) {
    console.error(`refused: no readable manifest for run ${reconcileId} in ${runDir} (${(err as Error).message})`);
    process.exit(2);
  }
  const rec = await reconcileSandboxRun({ config, fetch: fetchImpl, manifest, log: (l) => console.log(l), settleAttempts: settings?.settleAttempts, settleDelayMs: settings?.settleDelayMs });
  console.log(`\nreconcile ${rec.ok ? "complete" : "INCOMPLETE"} (cleanup state: ${rec.state}); manifest: ${manifest.path}`);
  if (pacerStats) console.log(`requests: ${JSON.stringify(pacerStats())}`);
  process.exit(rec.ok ? 0 : rec.state === "pending_consistency" ? 3 : 1);
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
  otherPipelineId: id.discovery.pipelines.find((p) => p.id && p.id !== config.pipelineId)?.id,
  gitSha,
  log: (l) => console.log(l),
  reconcileDelayMs: live ? 2000 : 0,
  sleep: live ? undefined : async () => {},
  syncBudgetMs: live ? 300_000 : undefined,
  settleAttempts: settings?.settleAttempts,
  settleDelayMs: settings?.settleDelayMs,
});

for (const o of run.observations) console.log(`observed: ${o}`);
const failed = run.results.filter((r) => !r.pass);
console.log(`\n${run.results.length - failed.length}/${run.results.length} checks passed`);
console.log(`created: ${run.createdContactIds.length} contact(s), ${run.createdOpportunityIds.length} opportunity(ies)`);
if (run.stopped) console.log(`STOPPED by the safety guard: ${run.stopped}`);
for (const u of run.unproven) console.log(`UNPROVEN  ${u}`);
if (run.cleanup) console.log(`cleanup state: ${run.cleanup.state}`);
if (pacerStats) console.log(`requests: ${JSON.stringify(pacerStats())}`);
if (failed.length && live) console.log(`review ${manifest.path}; if records remain: npx tsx scripts/ghl-sandbox-check.mts --reconcile ${runId}`);
const onlyPending = run.cleanup?.state === "pending_consistency" && failed.every((r) => r.scenario === "cleanup");
process.exit(failed.length ? (onlyPending ? 3 : 1) : run.unproven.length ? 4 : 0);

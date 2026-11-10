/**
 * Read-only discovery for the GHL SANDBOX sub-account. Sends GET requests only
 * (enforced in code) and prints no token, contact data or response bodies.
 *
 *   npx tsx scripts/ghl-sandbox-discover.mts
 *
 * Needs GHL_SANDBOX_TOKEN and GHL_SANDBOX_LOCATION_ID. Prints the location
 * name, each read scope's result, and env lines for the pipeline, stage and
 * custom-field ids (ids are configuration, not secrets). If the other
 * GHL_SANDBOX_* values are already set, also runs the --live identity gate.
 */
import { checkSandboxEnv } from "../lib/integrations/ghl/sandbox-check";
import { checkIdentity, discoverSandbox, findOtherStage, livePreflight, resolveIntakeStage, resolvePipeline, SANDBOX_FIELDS, SECOND_STAGE_ACTION } from "../lib/integrations/ghl/sandbox-discover";

const token = process.env.GHL_SANDBOX_TOKEN?.trim();
const locationId = process.env.GHL_SANDBOX_LOCATION_ID?.trim();
if (process.env.CI) {
  console.error("refused: refusing to run in CI");
  process.exit(2);
}
if (!token || !locationId) {
  console.error("refused: GHL_SANDBOX_TOKEN and GHL_SANDBOX_LOCATION_ID are required");
  process.exit(2);
}
if (process.env.GHL_API_TOKEN && token === process.env.GHL_API_TOKEN) {
  console.error("refused: sandbox token equals the production GHL_API_TOKEN");
  process.exit(2);
}

const PIPELINE = process.env.GHL_SANDBOX_PIPELINE_NAME ?? "Websites Sandbox Test Pipeline";
const STAGE = process.env.GHL_SANDBOX_STAGE_NAME ?? "New Website Inquiry";

const d = await discoverSandbox({ token, locationId, apiVersion: process.env.GHL_SANDBOX_API_VERSION, fetch: (u, i) => fetch(u, i) });

console.log("read scopes (GET only):");
for (const p of d.probes) console.log(`  ${p.ok ? "OK  " : "FAIL"} ${p.name.padEnd(17)} ${p.scope.padEnd(32)} ${p.detail}`);

console.log(`\nlocation: ${d.location ? `"${d.location.name}" (id matches: ${d.location.id === locationId ? "yes" : "NO"})` : "unreadable"}`);
if (d.location && !/sandbox/i.test(d.location.name)) console.log('  WARNING: name does not contain "sandbox". Stop; do not run --live.');
console.log(`workflows: ${d.workflows ? `${d.workflows.total} total, ${d.workflows.active} not in draft` : "unreadable"}`);
console.log(`contacts in location: ${d.contactTotal ?? "unknown"}${(d.contactTotal ?? 0) > 25 ? "  (WARNING: more than a fresh sandbox should hold)" : ""}`);

const out: string[] = [];
// One authoritative pipeline for every line below: the configured id when set, otherwise exactly one name match.
const pipeline = resolvePipeline(d, process.env.GHL_SANDBOX_PIPELINE_ID, PIPELINE);
console.log(`\npipelines: ${d.pipelines.length}; ${pipeline.ok ? `using "${pipeline.pipe.name}" (${pipeline.source})` : `UNRESOLVED (${pipeline.reason})`}`);
// false = not ready for --live (no second stage, or pipeline/intake stage unresolved). Never overridden below.
let secondStage = false;
if (pipeline.ok) {
  const pipe = pipeline.pipe;
  out.push(`GHL_SANDBOX_PIPELINE_ID=${pipe.id}`);
  const intake = resolveIntakeStage(pipe, process.env.GHL_SANDBOX_PIPELINE_STAGE_ID, STAGE);
  if (!intake.ok) {
    // Never claim a second stage while the intake stage itself is unknown.
    console.log(`  stages in pipeline: ${pipe.stages.length}; another stage for the S8 capacity check: UNKNOWN (${intake.reason})`);
  } else {
    out.push(`GHL_SANDBOX_PIPELINE_STAGE_ID=${intake.id}`);
    const other = findOtherStage(d, pipe.id, intake.id);
    secondStage = other !== null;
    console.log(`  stages in pipeline: ${pipe.stages.length}; another stage for the S8 capacity check: ${other ? `yes ("${other.name}")` : "NO"}`);
    if (!other) console.log(`  OWNER ACTION: ${SECOND_STAGE_ACTION}. --live refuses until then.`);
  }
}

const map: Record<string, string> = {};
for (const n of SANDBOX_FIELDS) {
  const m = d.fields[n];
  console.log(`custom field ${n}: ${m.length} match(es)${m.map((f) => ` [${f.fieldKey || f.name}, ${f.dataType || "type?"}]`).join("")}`);
  if (m.length === 1) map[n] = m[0].id;
}
if (Object.keys(map).length === SANDBOX_FIELDS.length) out.push(`GHL_SANDBOX_CUSTOM_FIELD_IDS='${JSON.stringify(map)}'`);

if (d.location && /sandbox/i.test(d.location.name)) {
  out.push(`GHL_SANDBOX_CONFIRM_LOCATION=${locationId}   # type this by hand; do not paste`);
  out.push(`GHL_SANDBOX_EXPECT_LOCATION_NAME='${d.location.name.replace(/'/g, "")}'`);
}
console.log(`\nlines for the sandbox env file (ids only, no secrets):\n${out.map((l) => `  ${l}`).join("\n") || "  none (see failures above)"}`);

const guard = checkSandboxEnv(process.env);
if (guard.ok) {
  const id = checkIdentity(d, { ...guard.config, expectedLocationName: guard.config.expectedLocationName });
  console.log(`\nidentity gate (as --live will run it): ${id.ok ? "PASS" : "FAIL"}`);
  for (const e of id.errors) console.log(`  - ${e}`);
  const pre = livePreflight(d, guard.config);
  console.log(`live preflight (second stage): ${pre.ok ? "PASS" : `FAIL - ${pre.error}`}`);
  process.exit(id.ok && pre.ok && secondStage ? 0 : 1);
}
if (!secondStage) process.exit(1);
const failed = d.probes.filter((p) => !p.ok && p.name !== "contact count").length;
process.exit(failed ? 1 : 0);

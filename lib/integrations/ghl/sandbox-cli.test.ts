/**
 * The real sandbox CLIs (`scripts/ghl-sandbox-check.mts --live` and
 * `scripts/ghl-sandbox-discover.mts`), run as subprocesses against the
 * in-memory fake GHL (sandbox-cli.test-preload.ts replaces the global fetch).
 * No network, no real credentials: placeholder values only.
 * Proves the second-stage refusal happens before any manifest or write, that a
 * valid two-stage sandbox runs the minimal live scope to a verified cleanup,
 * and that discovery reports readiness for the same pipeline --live uses.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";

import { SECOND_STAGE_ACTION } from "./sandbox-discover";

const ROOT = process.cwd();
const PRELOAD = pathToFileURL(path.join(ROOT, "lib", "integrations", "ghl", "sandbox-cli.test-preload.ts")).href;

const FULL_ENV = {
  GHL_SANDBOX_TOKEN: "placeholder-sandbox-token",
  GHL_SANDBOX_LOCATION_ID: "loc_sandbox",
  GHL_SANDBOX_CONFIRM_LOCATION: "loc_sandbox",
  GHL_SANDBOX_EXPECT_LOCATION_NAME: "Test Sandbox",
  GHL_SANDBOX_PIPELINE_ID: "pipe_sandbox",
  GHL_SANDBOX_PIPELINE_STAGE_ID: "stage_sandbox",
  GHL_SANDBOX_CUSTOM_FIELD_IDS: JSON.stringify({ style_interest: "SandboxStyleField001", package_interest: "SandboxPkgField00002" }),
};

function run(script: "ghl-sandbox-check.mts" | "ghl-sandbox-discover.mts", args: string[], vars: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), "ghl-cli-"));
  const runDir = path.join(dir, "runs");
  const callsFile = path.join(dir, "calls.json");
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    // No CI flag (the CLIs refuse in CI by design) and no production GHL values.
    if (v !== undefined && k !== "CI" && !k.startsWith("GHL_")) env[k] = v;
  }
  Object.assign(env, vars, { GHL_SANDBOX_RUN_DIR: runDir, FAKE_GHL_CALLS_FILE: callsFile });
  const r = spawnSync(process.execPath, ["--import", "tsx", "--import", PRELOAD, path.join(ROOT, "scripts", script), ...args], {
    cwd: ROOT,
    env: env as NodeJS.ProcessEnv,
    encoding: "utf8",
    timeout: 120_000,
  });
  const fake = existsSync(callsFile)
    ? (JSON.parse(readFileSync(callsFile, "utf8")) as { calls: Array<{ method: string; path: string }>; contacts: number; opportunities: number })
    : null;
  const manifests = existsSync(runDir) ? readdirSync(runDir) : [];
  const manifestText = manifests.length ? readFileSync(path.join(runDir, manifests[0]), "utf8") : "";
  rmSync(dir, { recursive: true, force: true });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, fake, manifests, manifestText };
}

const writes = (r: ReturnType<typeof run>) => r.fake!.calls.filter((c) => c.method !== "GET");

describe("ghl-sandbox-check.mts --live (subprocess, fake GHL)", () => {
  it("a one-stage sandbox pipeline is refused before any manifest or write, with the owner action", () => {
    const r = run("ghl-sandbox-check.mts", ["--live"], { ...FULL_ENV, FAKE_GHL_STAGES: "1" });
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.ok(r.stderr.includes(SECOND_STAGE_ACTION), r.stderr);
    assert.match(r.stdout, /identity gate: PASS/);
    assert.deepEqual(r.manifests, [], "no manifest was opened");
    assert.ok(r.fake && r.fake.calls.length > 0, "the preload recorded the requests");
    assert.deepEqual(writes(r), [], "only read-only requests were sent");
    assert.equal(r.fake!.contacts, 5);
  });

  it("a two-stage sandbox runs the minimal live scope (S1 + S8) and cleans up to the pre-run state", () => {
    const r = run("ghl-sandbox-check.mts", ["--live"], { ...FULL_ENV, FAKE_GHL_STAGES: "2" });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /minimal: S1 \+ S8/);
    assert.match(r.stdout, /PASS {2}S8 open-request count: another stage's count did not move/);
    assert.match(r.stdout, /PASS {2}cleanup: pre-existing contacts intact and total restored/);
    assert.equal(r.manifests.length, 1);
    assert.match(r.manifestText, /"t":"end","ok":true/);
    assert.ok(!r.manifestText.includes("placeholder-sandbox-token"), "the journal never holds the token");
    assert.equal(r.fake!.contacts, 5, "only the five pre-existing contacts remain");
    assert.equal(r.fake!.opportunities, 0);
  });
});

describe("ghl-sandbox-discover.mts (subprocess, fake GHL, read-only)", () => {
  it("reports readiness for the configured pipeline even when another pipeline has the default name", () => {
    const r = run("ghl-sandbox-discover.mts", [], { ...FULL_ENV, FAKE_GHL_STAGES: "2", FAKE_GHL_DECOY: "1" });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /using "Configured Pipeline" \(configured id\)/);
    assert.match(r.stdout, /another stage for the S8 capacity check: yes \("Preview Sent"\)/);
    assert.match(r.stdout, /GHL_SANDBOX_PIPELINE_ID=pipe_sandbox/);
    assert.match(r.stdout, /GHL_SANDBOX_PIPELINE_STAGE_ID=stage_sandbox/);
    assert.match(r.stdout, /identity gate \(as --live will run it\): PASS/);
    assert.match(r.stdout, /live preflight \(second stage\): PASS/);
    assert.deepEqual(writes(r), []);
  });

  it("a one-stage configured pipeline is NOT ready even though the identity gate passes (non-zero exit, owner action)", () => {
    const r = run("ghl-sandbox-discover.mts", [], { ...FULL_ENV, FAKE_GHL_STAGES: "1", FAKE_GHL_DECOY: "1" });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /another stage for the S8 capacity check: NO/);
    assert.ok(r.stdout.includes(SECOND_STAGE_ACTION));
    assert.match(r.stdout, /identity gate \(as --live will run it\): PASS/);
    assert.match(r.stdout, /live preflight \(second stage\): FAIL/);
    assert.deepEqual(writes(r), []);
  });

  it("with only the token and location it resolves by name; a configured pipeline that does not exist is unresolved, never reported ready", () => {
    const r = run("ghl-sandbox-discover.mts", [], {
      GHL_SANDBOX_TOKEN: "placeholder-sandbox-token",
      GHL_SANDBOX_LOCATION_ID: "loc_sandbox",
      FAKE_GHL_STAGES: "2",
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /using "Websites Sandbox Test Pipeline" \(name\)/);
    assert.match(r.stdout, /another stage for the S8 capacity check: yes/);

    const unresolved = run("ghl-sandbox-discover.mts", [], {
      GHL_SANDBOX_TOKEN: "placeholder-sandbox-token",
      GHL_SANDBOX_LOCATION_ID: "loc_sandbox",
      GHL_SANDBOX_PIPELINE_ID: "pipe_missing",
      FAKE_GHL_STAGES: "2",
    });
    assert.equal(unresolved.status, 1, unresolved.stdout + unresolved.stderr);
    assert.match(unresolved.stdout, /UNRESOLVED \(GHL_SANDBOX_PIPELINE_ID is not a pipeline in this location\)/);
    assert.doesNotMatch(unresolved.stdout, /another stage for the S8 capacity check: yes/);
  });
});

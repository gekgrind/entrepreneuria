---
Agent: Claude Code
Task: PR #52 final security remediation (root promoter, lock, approval binding, interrupted activation)
Completed: 2026-11-21
Repository: `gekgrind/entrepreneuria`, branch `ops/systemd-isolation` (worktree `C:\DevProjects\entrepreneuria-ops-systemd`)
Baseline: `main` @ `47615e4904f13e2ea94bf6123ba37019528f1a5c`. Previous reviewed head `12b7dd60c447bd768ab442f80032c6a3943f5ce6` (merge: REVISE, VPS: NO-GO).
Status: `IMPLEMENTED; TESTED IN DISPOSABLE UBUNTU 24.04 CONTAINER (172/172); NOT EXECUTED ON ANY VPS; SECURITY REVIEW REQUIRED`
Merged: NO. #49 and #51 untouched. Codex review of the exact new PR #52 head is required before merge or any VPS use.
---

# PR #52: Codex review package (round 3)

Only `ops/vps/**` and this file changed.

## Findings and corrections

**Critical: privileged archive extraction** (`lib/archive_tool.py` new, `bin/promote-release.sh` `publish_release`)

1. Root copies the artifact to root-only staging, then hashes the copy against the approved digest.
2. `archive_tool.py check` runs **read-only, before any write**. It rejects:
   - absolute paths, `..` and control characters
   - duplicates
   - hard links, devices, FIFOs and other types
   - setuid, setgid and sticky bits, and group/world-writable modes on files and dirs (symlink modes are ignored because they are meaningless)
   - unexpected pax keys
   - members under a symlinked parent
   - symlinks escaping the release, resolved through other symlink members, so chained escapes are caught
   - reserved paths (`RELEASE`, `.next/cache`, `.git`) and links into them
3. Extraction runs as the new **unprivileged `stage-<app>`** (`runuser`, `python3 -I -S`) into a fresh `0700` directory it owns, using the `tarfile` `data` filter. The extractor refuses to run as root.
4. Root copies with `cp --no-dereference` and no ownership into a fresh root `0700` directory. **`archive_tool.py compare` then proves the copy equals the approved archive** (paths, types, link targets, single-link files, exec bits, sha256 per file).
5. Modes are normalised on the root-only tree only after that.
6. Promoter metadata is created **last**, inside the all-root tree:
   - `.next/cache` → `var/cache`, only after checking it is a real `app-<app>:app-<app> 0700` directory under a trusted `var/`
   - `RELEASE` with `noclobber`
   - the record in `state/verified/<sha>`

**High: promotion lock** (`lib/common.sh` `acquire_app_lock`, `assert_trusted_dir`)

- A per-app `/var/lib/entrepreneuria/<app>/lock/promote.lock`. Every path component is checked to be a real, root-owned directory that is not group- or world-writable, and the lock dir must be `root:root 0700`.
- The lock file must be a regular `root:root 0600` file with a single link. It is created with `noclobber`, and the fd identity is re-checked after open.
- `/run/lock` is never touched.

**High: approval and source integrity**

- The record holds the app, repo, SHA, artifact digest and tree digest.
- **Every activation**, whether a new release, reuse of an existing one or `--rollback`, requires the approved digest to equal the recorded digest, and the app and repo to equal the config.
- The git manifest is written to a file, and generation must succeed, be non-empty, end with NUL, and match an independent entry count. All enumerated entries must be processed.
- Each tracked entry must match its **type** (file or symlink), **exec mode** (`100755` or `100644`), **content** and symlink target. Submodules and unknown modes fail closed, and any `cat-file` error is a mismatch.

**High: interrupted activation and reboot safety** (`promote-release.sh`)

- `live/current` is the **persistent verified boot selection**. It changes only in `approve()`, after readiness passes.
- The candidate runs via a **runtime drop-in** in `/run/systemd/system/…/zz-candidate.conf` (tmpfs), plus a marker in `/run/entrepreneuria/<app>/candidate`. **A reboot can only boot `live/current`.**
- `systemctl show WorkingDirectory` is checked to confirm the drop-in took effect.
- Every pointer swap, `daemon-reload`, restart, cleanup and enable is checked.
- **One `recover()` handles every failure**: the ERR trap, INT/TERM/HUP, restart, readiness and approval.
  1. Clear the candidate.
  2. Re-verify the selection.
  3. Restart it and re-check readiness (exit 3).
  4. Otherwise run `stop_and_confirm`: the unit must be inactive or failed **and** `ss` must show no listener on the port. Then clear and disable (exit 4).
  5. If the stop or the cleanup can't be confirmed, exit **5 UNSAFE**. It is never reported as "stopped".
- After `SIGKILL`, new promotions are refused until `--recover` runs.

**Readiness** (`lib/common.sh`)

- Every listener on the port must:
  - run as **`app-<app>`'s UID** (real, effective, saved and fs)
  - be in the unit's cgroup, compared by **exact string equality** of the `0::` line against systemd's `ControlGroup`, with cgroup v2 required and failing closed
  - have its cwd set to `releases/<sha>`
- `curl` must exit 0, return HTTP 200 and include the marker.
- `ss` failures return rc 3 and are logged.
- Note: the earlier suffix match was a workaround for a grep-regex bug (`\x2d` in the unit path). Exact equality works on the container's shared cgroup namespace.

**Verifier**

- Each `ss` output and exit status is captured before parsing, and an enumeration error is a FAIL.
- It also fails on: a pending candidate, unsafe lock or promoter dirs, an unresolvable SSH port, stage-user identity or sudo problems, and a missing `archive_tool.py` or ACME script.
- It is still strictly read-only, proven by a before/after snapshot.

**ACME**

- New `bin/prepare-acme-webroot.sh` → `entrepreneuria-acme-webroot <host>`. It creates and validates real `root:root 0755` dirs, and proves nginx serves a probe for the host before certbot runs.
- The nginx 1.24 syntax and header protections are unchanged.

## Tests

`ops/vps/test/run-in-docker.sh` runs a disposable `ubuntu:24.04` container with systemd as PID 1, nginx 1.24.0, Python 3.12 and dummy credentials. **172 passed, 0 failed** (167 in phase 1, 5 after a container restart). The log is in `ops/vps/test/last-run.log`.

Failure injection replaces binaries **in the container only**: `systemctl`, `curl`, `git`, `rm` and `ss`. The production scripts have no hooks.

**New scenarios, each asserting the specific rejection message:**

- **18 malicious archives:**
  - absolute paths and traversal
  - absolute, relative and chained-escape symlinks
  - writes through symlinked dirs, inside and escaping
  - hard links to a host file and within the archive
  - FIFO and device members
  - setuid and world-writable files
  - the reserved `RELEASE`, `.next/cache` and `.git`
  - a link into a reserved path
  - duplicate members

  The tests assert no sentinel files were written anywhere, `/etc/shadow` is unchanged and no release was published. Direct unprivileged extraction of a malicious archive is confined, and the extractor refuses to run as root.
- **Lock:**
  - a symlinked lock file (its target is untouched)
  - a lock file with the wrong mode
  - a hard-linked lock file
  - a world-writable lock dir
  - a symlinked lock dir (nothing is created through it)
  - `/run/lock` untouched
  - serialization against a held lock
- **Approval:**
  - wrong digest on an existing release
  - `--rollback` with the wrong digest
  - `--rollback` to a release that isn't the selection
  - a changed exec mode on a tracked file
  - changed tracked content
  - `git ls-tree` failing mid-enumeration
  - `ls-tree` exiting 0 with truncated output
- **Interruption by SIGKILL:**
  - after candidate selection
  - at restart
  - during readiness (the verifier flags the pending candidate)
  - at final approval

  New promotions are refused while recovery is pending, and `--recover` restores the selection.
- **Reboot after an interrupted promotion:** the candidate drop-in is gone, boot starts the verified selection rather than the candidate, health passes, and the never-activated app stays down.
- **Failed cleanup** (drop-in removal fails) → exit 5 UNSAFE. **Failed `systemctl stop`** with the unit still running → exit 5 and no "stopped" claim. `--recover` exits 4 once stop works, leaving the unit inactive with no listener.
- **Imposter as `nobody`** → rejected by the UID check. **Imposter as `app-hub`**, the right UID but outside the unit → rejected by the exact cgroup check. Both are reached through a no-listen candidate, and the selection is never approved. Because the imposter still holds the port, the result is exit 5, not "stopped".
- **Failed `ss`** → the verifier reports enumeration failed and FAILs, and `listener_pids` returns rc 3.
- **Retained:** first deployment, crash, 500, redirect, wrong app, hang and public bind each roll back to the verified A; first-deploy failure; tampered selection gives stop and clear; port gates; verifier negatives; nginx, TLS and headers (IPv6 included); the ACME webroot (including symlinked-webroot rejection); and runtime-secret absence from the artifact (now actually checked).

## Clean-VPS-only properties (not provable in a container)

- **The real combined hub release:** `next build` and `next start` under the sandbox, image optimisation, cache writes, and real `npm ci` scripts.
- External IPv4/IPv6 exposure and the firewalls.
- Let's Encrypt issuance and renewal.
- A kernel reboot and power loss.
- The `systemd-analyze security` score on the real kernel.
- The Supabase key transition.

## Residual trust (Codex: conditionally acceptable)

Generated `.next` and `node_modules` are trusted to the fresh, isolated, unprivileged build from the reviewed SHA and lockfile, with no runtime secrets and the operator verifying the digest. Python's `tarfile` parsing of the untrusted archive runs as root, but only in **read-only** mode (`check` and `compare`), with no extraction.

## Exact next step

Codex reviews PR #52 at its new head and records a verdict. Merge and VPS execution remain separate owner approvals.

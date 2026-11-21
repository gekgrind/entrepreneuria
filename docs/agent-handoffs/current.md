---
Agent: Claude Code
Task: PR #52 final two-blocker remediation (link policy after cache attach, failed-fallback boot safety)
Completed: 2026-11-21
Repository: `gekgrind/entrepreneuria`, branch `ops/systemd-isolation` (worktree `C:\DevProjects\entrepreneuria-ops-systemd`)
Baseline: `main` @ `47615e4904f13e2ea94bf6123ba37019528f1a5c`. Previous reviewed head `4e737771205465535aa3064895f8e5ec8bb5e72f` (merge: REVISE, VPS: NO-GO, no Critical).
Tested source: commit `50992b2bee076a99dba48de11b73634aa03d4725`, `ops/vps` tree `735333a94a27471243abe2dddad2b6554a5f9d63`.
Status: `IMPLEMENTED; TESTED IN DISPOSABLE UBUNTU 24.04 CONTAINER (211/211 from the identified tree); NOT EXECUTED ON ANY VPS; SECURITY REVIEW REQUIRED`
Merged: NO. #49 and #51 untouched.
---

# PR #52: Codex review package (round 4)

Only `ops/vps/**`, `ops/test-logs/` and this file changed. The PR head adds only the test log and this handoff on top of the tested commit. Confirm with `git rev-parse <head>:ops/vps`, which equals `735333a…`.

## High 1: archive links unsafe after cache attachment

- **The archive check rejects links that traverse reserved paths.** `archive_tool.py` `resolve()` now fails as soon as any resolution step enters a reserved component (`.next/cache`, `.git`, `RELEASE`), including through other link members. This applies even when the final target normalises to somewhere inside the release, for example `x -> .next/cache/../BUILD_ID`.
- **The final tree is checked after the cache link is attached.** A new `archive_tool.py policy <tree> /srv/<app>/var/cache` runs on the real filesystem and requires:
  - `.next/cache` must exist and link exactly to `/srv/<app>/var/cache`. It is the **only** link allowed to leave the release.
  - Every other link must resolve inside the release without traversing `.next/cache` or any reserved path.
  - Everything is root-owned, files have a single link, there is no setuid or group/world write, and only files, directories and symlinks are present.
- The policy runs in `publish_release` before the release is recorded, and inside `verify_release`, so it covers every activation, rollback, verifier run and boot start. `node_modules/.bin` links pass.

## High 2: failed fallback could restart at boot

- `recover()` → `quarantine_and_stop()` runs when the fallback fails readiness, fails verification, or doesn't exist. In order, it:
  1. appends `<time> <sha> <reason>` to the root-only `state/quarantine`
  2. removes `live/current`
  3. **disables boot start and checks it is disabled**
  4. `sync`s
  5. stops the unit and confirms it stopped (unit inactive and no listener)
- The result is exit `4`. If any step can't be confirmed, it exits **`5` UNSAFE**, but only after the selection has already been cleared and boot start disabled.
- **A healthy fallback still rolls back automatically** (exit 3).
- `--recover` never restores a quarantined release. Recovery needs an explicit `entrepreneuria-promote <app> <sha> <recorded-digest>` that passes readiness. This is documented under "Operator recovery" in `ops/vps/README.md`.
- **Boot and start gate:** a new `ExecStartPre=+entrepreneuria-boot-check %i` runs before **every** start, including at boot. It fully runs `verify_release` on the exact release about to start (the candidate if a runtime drop-in exists, otherwise `live/current`). An unrecorded, tampered or policy-violating release cannot start. `TimeoutStartSec=600` allows time for the digest.
- **Publication durability:**
  - The promoter `sync`s before and after the release directory is moved into place, and writes the record last.
  - A release directory without a record (interrupted publication) can't start, and is moved aside to `releases/.incomplete-<sha>-<time>` on the next promotion of that SHA.
  - `approve()` `sync`s after the pointer swap.

## Related corrections

- **Root never opens the build-controlled path.**
  - `runuser -u build-<app> archive_tool.py read` opens the artifact as the build user with `O_NOFOLLOW|O_NONBLOCK`, requires a regular file, and caps it at 4 GiB.
  - The stream goes into a fresh root `0600` file created with `noclobber`. The digest is computed over that root copy.
- **Parser:**
  - The index is built incrementally with `tf.next()`, and the 300,000-member and 6 GiB limits are enforced **while reading**.
  - Duplicate archive-root entries are rejected.
  - Sparse members (GNU type and pax `GNU.sparse.*`) are rejected.
  - **Any** parser exception becomes an explicit "unreadable archive" rejection, with no tracebacks.
- **Identified test runs.** `run-in-docker.sh` refuses to run if `ops/vps` has uncommitted changes. It tests `git archive HEAD ops/vps` and logs the commit, the `ops/vps` tree id, the image and versions, and a content digest that must match on host and container. The log is now `ops/test-logs/vps-container-suite.log`, outside `ops/vps`.

## Tests

The log is `ops/test-logs/vps-container-suite.log`: **205 + 6 = 211 passed, 0 failed.** It covers commit `50992b2`, tree `735333a`, digest `06703cad…` on both sides, Ubuntu 24.04.5, Python 3.12.3 and systemd 255.

**New:**
- **Reserved-path traversal:** `.next/cache` (direct, and through a link chain), `.git` and `RELEASE`.
- **Final-tree policy:**
  - A legitimate tree passes, including `node_modules/.bin`.
  - Rejected: a link traversing the attached cache, a link into the runtime cache, and a cache link with the wrong target.
  - `verify_release` rejects an escaping link **even when the tree-digest record was made consistent with it**.
- **Staging substitution:** the artifact replaced by a symlink to a root-only file (root never read it), a symlink to another approved artifact, a FIFO (no hang), a directory, or swapped after approval. All are rejected.
- **Parser:** 300,001 members, GNU sparse, pax `GNU.sparse`, a duplicate root entry, an unexpected pax key, and no tracebacks anywhere.
- **Interrupted publication:** killed after the release directory appears and before its record. The selection is untouched. A unit pointed at the half-published release refuses to start, and the journal shows the reason. Re-promotion quarantines it and succeeds.
- **Candidate and fallback both fail** (hub2, with every readiness request failing): exit 4, and the selection is quarantined, the unit disabled and nothing listening. A manual `systemctl start` cannot run either release. **After the container restart, neither release started**, and there is still no selection and the unit is disabled.
- **Imposter scenarios now also exercise quarantine.** With an imposter holding the port, the fallback fails, so the selection is quarantined and the result is exit 5. `--recover` alone exits 4 and restores nothing. Explicit re-approval of A exits 0.
- **Retained and passing:** first deployment; failure modes with healthy rollback; isolation; locks; approval binding; source and mode checks; manifest failures; SIGKILL at each stage; reboot after an interrupted promotion (the verified selection boots); failed stop and cleanup (UNSAFE); the UID and cgroup imposters; `ss` failure; verifier negatives; nginx, TLS and headers including IPv6; the ACME webroot.

## Still requires the clean VPS

- The real combined hub release: `next build` and `next start` under the sandbox, the tree-digest time of a real `node_modules` in `ExecStartPre`, and image and cache behaviour.
- Real power loss during publication. The container restart doesn't model unflushed writes; `sync` and the boot-check are the mitigations.
- External IPv4/IPv6 exposure, firewalls, Let's Encrypt issuance and renewal, a kernel reboot, and the Supabase key transition.

## Residual trust

Unchanged and accepted by Codex for one supervised recovery: generated `.next` and `node_modules` come from a fresh, isolated build account with no runtime secrets, and the operator approves the staged digest. Lifecycle scripts run with the build account's privileges.

## Exact next step

Codex reviews PR #52 at its new head and records a verdict. Merge and VPS execution remain separate owner approvals.

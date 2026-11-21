---
Agent: Claude Code
Task: PR #52, last High finding: the pre-start gate must verify the release systemd actually starts
Completed: 2026-11-21
Repository: `gekgrind/entrepreneuria`, branch `ops/systemd-isolation` (worktree `C:\DevProjects\entrepreneuria-ops-systemd`)
Baseline: `main` @ `47615e4904f13e2ea94bf6123ba37019528f1a5c`. Previous reviewed head `9f8a47e023cbf798a86aa739b9c02259b0c1f223` (one High remaining; archive-link and failed-fallback findings confirmed resolved).
Tested source: commit `39fb4aecbd5b8a9f5997e74158fdccc7270d882f`, `ops/vps` tree `74b030ae3a1f54d227630e351fd0f3b6921752e4`, content digest `7967fcb8…` (identical on host and in the container).
Status: `IMPLEMENTED; TESTED IN DISPOSABLE UBUNTU 24.04 CONTAINER (222/222 from the identified tree); NOT EXECUTED ON ANY VPS; SECURITY REVIEW REQUIRED`
Merged: NO. #49 and #51 untouched.
---

# PR #52: Codex review package (round 5)

The PR head adds only the test log and this handoff on top of the tested commit. Confirm that `git rev-parse <head>:ops/vps` equals `74b030a…`.

## Finding

The pre-start gate chose which release to verify from whether the candidate drop-in *file* existed. `clear_candidate()` removes the file before `daemon-reload`. If it is interrupted in between, systemd keeps the candidate's `WorkingDirectory` in memory while the gate verifies `live/current`, so the gate verifies one release and systemd runs another.

## Correction

`ops/vps/bin/boot-check.sh` (`ExecStartPre=+…`) now works as follows:

1. As its first action, it reads the **physical working directory systemd assigned to the process**, `readlink /proc/$$/cwd`. If that can't be resolved, it fails closed.
2. It requires that directory to be **canonical** `/srv/<app>/releases/<40-hex-sha>`: a real directory where `readlink -f` equals itself, and not a symlink. Anything outside the release tree is refused.
3. It requires that SHA to **equal the authorised selection**. That is the candidate marker's SHA when the candidate drop-in file exists, and otherwise exactly the target of `live/current`. On a mismatch, the log says `systemd would run <X> but the authorised … is <Y>; refusing to start`.
4. It then runs the unchanged full `verify_release` on **that exact SHA**: the root-only record for the app, repo and SHA, the tree digest, ownership and modes, and the final symlink policy.

**Cleanup ordering** in `promote-release.sh` `clear_candidate()` is unchanged: remove the drop-in and marker, then `daemon-reload`. A code comment now documents why that is safe. An interruption before the reload leaves systemd with a candidate working directory that is not `live/current`, so the gate fails closed until `--recover` reloads systemd. During approval, `live/current` is switched to the candidate **before** cleanup, so an interrupted cleanup there still starts only the approved release.

**The gate stays correct on every path:**
- **Ordinary start and boot:** there is no runtime drop-in, so the working directory must be `live/current`'s target.
- **Candidate promotion:** the drop-in and marker are present and loaded, so the working directory must be the marker's SHA.
- **Healthy rollback:** after the candidate is cleared and reloaded, the working directory is `live/current`.
- **Reboot:** `/run` is empty, so only `live/current` can start.

## Mandatory regression (real systemd start path)

Section `pre-start gate verifies the working directory systemd actually assigns` in `ops/vps/test/run-tests.sh`. All 11 assertions pass:

1. Healthy approved H2 is running.
2. A candidate override for A is installed and loaded with `daemon-reload`, and `systemctl show WorkingDirectory` reports `releases/A`.
3. The drop-in and marker are removed **without** `daemon-reload`, and systemd still reports `releases/A`.
4. `systemctl restart`: the unit does not become active, nothing listens on the port, and no `app-hub` process exists.
5. The journal shows `systemd would run A but the authorised boot selection (live/current) is H2; refusing to start`.
6. After `daemon-reload` and `reset-failed`, `WorkingDirectory` is `live/current`, H2 starts and passes full readiness, and the gate logs the matching verification.
7. Extra case: a `WorkingDirectory` outside `releases/` (`/srv/hub/var`) is refused with `is not a release of hub`. The configuration is then restored and H2 is healthy.

## Full suite

`ops/test-logs/vps-container-suite.log`: **216 + 6 = 222 passed, 0 failed.** It covers commit `39fb4ae`, tree `74b030a`, matching digests, Ubuntu 24.04.5, Python 3.12.3 and systemd 255.

Everything that passed before still passes, now running through the stricter gate:
- archive validation, including reserved traversal, the final policy, sparse members, the member-count limit and staging substitution
- locks and artifact approval
- rollback, quarantine, and both-fail then reboot
- interrupted publication and promotion
- reboot
- nginx, TLS and headers, readiness (UID and cgroup), and account isolation

## Still requires the clean VPS (unchanged)

- the real combined build under the sandbox, and the gate's digest time on a real `node_modules`
- real power loss
- external IPv4/IPv6 exposure and firewalls
- Let's Encrypt issuance and renewal
- a kernel reboot
- the Supabase key transition

## Exact next step

Codex reviews PR #52 at its new head. Merge and VPS execution remain separate owner approvals.

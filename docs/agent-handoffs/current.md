---
Agent: Claude Code
Task: PR #52 targeted remediation of Codex's NO-GO findings (VPS recovery package)
Completed: 2026-11-20
Repository: `gekgrind/entrepreneuria`, branch `ops/systemd-isolation` (worktree `C:\DevProjects\entrepreneuria-ops-systemd`)
Baseline: `main` @ `47615e4904f13e2ea94bf6123ba37019528f1a5c`. Previous reviewed head `ea7100a7759586d9cd10dad31e160069f87252b8`.
Status: `IMPLEMENTED; TESTED IN DISPOSABLE UBUNTU 24.04 CONTAINER; NOT EXECUTED ON ANY VPS; SECURITY REVIEW REQUIRED`
Merged: NO. Codex final review of the exact PR #52 head is required before any merge or VPS use.
---

# PR #52 remediation: Codex final-review package

Prior verdicts:
- #49: GO (`0d42e73`)
- #51: GO with the switch off (`ef12c6f`)
- #52: NO-GO at `ea7100a`

Neither #49 nor #51 was touched. Only `ops/vps/**` and this handoff changed.

## Findings and corrections

| Codex finding | Correction (files) |
|---|---|
| **High: build account controls what runs with secrets** | The shared `deploy` account and its sudoers rule are **removed**. Each app gets a separate unprivileged `build-<app>` user (system, `nologin`, no sudo, no SSH, no secrets) that only writes `/srv/build/<app>/out/<sha>.tar.gz`. A **root-only promoter** (`bin/promote-release.sh` → `/usr/local/sbin/entrepreneuria-promote`, mode 0700, run by the operator, never delegated through sudoers) does all of the following: <br>• checks the root-owned app config (app id, repo, port) <br>• copies the artifact into root staging and **then** checks its sha256 against the operator-approved digest <br>• rejects absolute/`..` paths, hard links, devices, FIFOs and escaping symlinks <br>• fetches the SHA from the **configured** repo into a root mirror, and requires every tracked file to match <br>• publishes the release **root-owned** with no group/world write and no setuid <br>• records a tree digest in root-only `state/verified/<sha>` <br>The live pointer lives in a root-owned dir. Runtime and build users can't write releases, the pointer or state. |
| **High: activation and rollback can strand an unhealthy release** | <br>• A global `flock` serializes all promotions. <br>• Restart failure and health failure take **one** `recover()` path. <br>• Rollback goes only to `state/last-good`, after **re-verifying** its tree digest, ownership and modes, and is **health-checked again**. <br>• With no trusted predecessor, or if the rollback also fails, the unit is stopped and `live/current` cleared (exit 4). <br>• `systemctl enable` runs only after a healthy activation. Provisioning never enables. <br>• `ConditionPathIsSymbolicLink` blocks start with no selection. <br>• `reset-failed` runs before each activation; without it, the start-limit left by a crashed release made systemd refuse the rollback restart. The container tests caught this. <br>• `StartLimit*` moved to `[Unit]`. |
| **High: readiness can validate the wrong service** | `lib/common.sh` `health_check` requires: <br>• the unit active, with no crash since the check began (NRestarts baseline) <br>• **every** listener on the port bound to `127.0.0.1` only <br>• its PID in the unit's **cgroup** <br>• its **cwd** equal to `/srv/<app>/releases/<sha>` (the immutable release identity) <br>• one bounded direct `curl --max-time 5 --max-redirs 0` returning **exactly 200** with the app's `HEALTH_MARKER` <br>• listener ownership re-checked after the request <br>Port conflicts are rejected in two ways: `PORT` must be unique across app configs, and `runtime.env` must not set `PORT`/`HOSTNAME`/`NODE_OPTIONS`. `service.env` is now read **last** by the unit. |
| **High: nginx fails on Ubuntu 24.04** | Uses `listen … ssl http2` (1.24 syntax). The new `00-entrepreneuria-http.conf` has the upgrade `map` and default servers that 444 on :80 and `ssl_reject_handshake` on :443, for IPv4 **and** IPv6. Separate bootstrap (ACME webroot) and TLS site templates document certificate bootstrap. `X-Real-IP`/`X-Forwarded-For` are overwritten and `Forwarded` cleared. |
| **Medium: verifier can pass on probe errors** | `bin/verify-app.sh` is **read-only**: no writes, and `/usr/bin/test` runs as the user via a shell that must print YES or NO, so a sudo error or missing user is an ERROR and a FAIL. <br>It fails on: <br>• missing identities <br>• non-system or login-shell accounts, or extra groups <br>• any sudo rights (`sudo -l -U`) or any sudoers mention <br>• wrong owner/mode on every path <br>• a release that doesn't match its promotion digest <br>• symlinks escaping the release <br>• **any** unexpected public TCP/UDP listener (only nginx :80/:443 and sshd on the SSH port, socket-activated included) <br>Provisioning now **refuses** unsafe pre-existing users, symlinked or wrong-mode paths, and sudoers mentions. |

## Test evidence

`ops/vps/test/run-in-docker.sh`:
- A **disposable** `ubuntu:24.04` container with systemd as PID 1, stock nginx 1.24.0, and **dummy credentials only**.
- A fixture app whose fake `next` binary has selectable failure modes.
- The container is deleted afterwards. The VPS was never contacted.

**Final run: 106 passed, 0 failed** (103 in phase 1, 3 after the container restart). The log is in `ops/vps/test/last-run.log`.

Covered:
- provisioning: dry run, idempotency, rejection of unsafe pre-existing state
- `systemd-analyze verify`
- initial deployment and enable-after-healthy
- runtime/build isolation (secrets, releases, pointer, promoter, cross-app build dirs)
- secrets delivered by PID 1
- cache write through the sandbox
- failure modes, each **rolled back to verified A**: restart crash, HTTP 500, redirect, wrong app, hang, public bind
- digest, source-tamper, traversal, escaping-symlink, `PORT`-in-secrets and cross-app port gates
- an **imposter process serving the marker on the port**, which is rejected
- lock serialization
- tampered last-good refused (stop and clear)
- rollback unhealthy (stop and clear)
- first-deploy failure (not enabled, nothing selected)
- verifier negatives: public listener, sudo grant, group-writable file, missing identity; the verifier run also leaves the disk unchanged
- nginx: `-t` on bootstrap and TLS, TLS proxy, spoofed `X-Real-IP`/`XFF` overwritten, `Host` = `X-Forwarded-Host`, unknown host (444) and unknown SNI refused, IPv6 :443
- restart of the container: unit starts at boot, healthy on the selected release; the never-activated app is not started
- `systemd-analyze security`: exposure **3.0 OK**

## Still requires the clean VPS (not covered by the container)

- Real Hostinger firewall, ufw, external IPv4/IPv6 exposure (`nmap`)
- Real Let's Encrypt issuance
- A **real hub build** (`next build` / `next start` of the combined #49+#51 SHA) under the sandbox, including image optimisation and the cache
- A kernel-level reboot
- The Supabase key transition (needs its own integration check before disabling legacy keys)

## Known residual risk (documented in `ops/vps/README.md`)

- **Build outputs aren't re-derived from source.** The promoter proves the *tracked sources* equal the SHA, but `.next` and `node_modules` are trusted to the unprivileged per-app build user: no secrets, no cross-app access, `npm ci` lockfile integrity and the audit gate. The full fix is CI-built, signed artifacts.
- `next-env.d.ts` and `tsconfig.json` are exempt from the source comparison, because `next build` rewrites them and `next start` doesn't read them.
- **The audit gate is `critical`.** The pre-existing `zod` and `source-map-js` highs are tracked separately.

## Please verify

1. No path lets `build-<app>` or `app-<app>` influence which bytes run with `runtime.env`.
2. `recover()` can't leave an unverified or unhealthy release selected.
3. The readiness identity checks (cgroup suffix match, cwd, exact 200 plus marker) are sound on a non-containerized host. In a nested cgroup namespace the path carries a prefix, hence the suffix match on the unit's unique path.
4. The nginx templates are safe for direct ingress, with no CDN.

## Exact next step

Codex reviews PR #52 at its new head and records READY FOR MERGE, NOT READY FOR MERGE, or SECURITY REVIEW REQUIRED. Merge and VPS execution remain separate owner approvals.

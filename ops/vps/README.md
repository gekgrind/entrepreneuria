# VPS per-app isolation (systemd), for the clean rebuild

**Status:** prepared and tested in a disposable Ubuntu 24.04 container (see [Testing](#testing)). **Not executed on any VPS.**

**Scope:** the clean Ubuntu 24.04 rebuild only. Never use it on the old VPS (`srv1125038`), which is treated as compromised at the shared app-account level.

**What it leaves alone:** `.github/workflows/deploy.yml` (PM2 over SSH) is unchanged and stays `disabled_manually`. This package is the manual, operator-driven path for the first restore.

## Trust model

Four roles per app. No account both chooses code and runs it with secrets.

| Role | Account | Can | Cannot |
|---|---|---|---|
| **Build** | `build-<app>`: system user, `nologin`, no sudo, no SSH | fetch the exact SHA, `npm ci`, build with **public** values only, write `/srv/build/<app>/out/<sha>.tar.gz` | read secrets; write releases, the selection, promoter state or locks; enter other apps' build dirs |
| **Stage** | `stage-<app>`: system user, `nologin`, no sudo | extract an already-validated artifact into one fresh directory it owns | anything else; the extractor refuses to run as root |
| **Promote** | the **operator** (root via their own admin sudo) running `/usr/local/sbin/entrepreneuria-promote` (root `0700`) | verify, publish, select, activate | — (it is never delegated through sudoers) |
| **Run** | `app-<app>`: system user, `nologin`, no sudo | execute the root-owned release; write only `/srv/<app>/var` | modify releases or the selection; read the secrets file (PID 1 injects the values) |

### `entrepreneuria-promote <app> <sha> <artifact-sha256>`

All of this is checked before anything runs.

1. **Lock.** A per-app lock at `/var/lib/entrepreneuria/<app>/lock/promote.lock`:
   - Every path component must be a real, root-owned directory that isn't group- or world-writable. The lock directory itself is `root:root 0700`.
   - The lock file must be a regular `root:root 0600` file with a single link.
   - `/run/lock` is never touched.
2. **Config.** The root-owned app config is parsed, never sourced. The port must be unique across apps, and `runtime.env` must not set `PORT`, `HOSTNAME` or `NODE_OPTIONS`.
3. **Approval binding.** The approval covers the app, repo, SHA and artifact digest together.
   - **New release:** the artifact is copied into root-only staging, and *then* the copy is hashed and compared with the approved digest.
   - **Existing release** (reuse, explicit `--rollback`): the approved digest must equal the artifact digest recorded at publication, along with the app, repo and SHA. Otherwise it exits 2.
4. **Archive validation** (`lib/archive_tool.py check`, read-only, before anything is written). It rejects:
   - absolute paths, `..`, control characters and duplicate members
   - hard links, devices, FIFOs and other non-file/dir/symlink types
   - setuid, setgid and sticky bits, and group/world-writable modes
   - unexpected pax headers
   - members written through a symlinked parent
   - symlinks that escape the release, including chained escapes resolved through other symlink members
   - **reserved promoter paths** (`RELEASE`, `.next/cache`, `.git`) and symlinks into them
5. **Unprivileged extraction.** `stage-<app>` extracts the validated archive, read from stdin, into a fresh `0700` directory it owns. It uses Python 3.12's `tarfile` `data` filter as defence in depth.
6. **Root-owned copy, proven identical.** The tree is copied into a fresh root-only directory with `cp --no-dereference` and no ownership preserved. `archive_tool.py compare` then proves the copy **equals the approved archive exactly**: same paths and types, same symlink targets, single-link regular files, the same exec bits and the same content hashes. Only then are modes normalised (dirs and exec files `0755`, other files `0644`).
7. **Source integrity.** The complete manifest of `<sha>` is fetched from the *configured* repo into a root mirror.
   - Generation must succeed, end with NUL, and match an independent entry count.
   - Every tracked entry must match its **type** (file vs symlink), **executable mode** (`100755`/`100644`) and **content**, and symlink targets must match.
   - Submodules and unknown modes fail closed.
   - `next-env.d.ts` and `tsconfig.json` are exempt, because `next build` rewrites them and `next start` doesn't read them.
8. **Promoter-owned metadata is created last.** Inside the now fully root-owned tree, the promoter creates `.next/cache` → `/srv/<app>/var/cache` (after checking that target is a trusted `app-<app>` `0700` directory) and `RELEASE` with `noclobber`. It then publishes `releases/<sha>` and writes the root-only record `state/verified/<sha>` (app, repo, SHA, artifact digest, tree digest).

## Activation, boot safety and recovery

- **The persistent boot selection is `live/current`.** It only ever points at a release that **passed readiness**.
- **A candidate runs through a *runtime* drop-in** (`/run/systemd/system/entrepreneuria-app@<app>.service.d/zz-candidate.conf`, on tmpfs), with a marker in `/run/entrepreneuria/<app>/candidate`. **A reboot at any point mid-promotion can only boot the verified selection.**
- **Order:** select the candidate, restart, run readiness, then **approve**: atomically swap `live/current`, clear the candidate, and enable the unit at boot. Every step's result is checked.
- **One recovery path** handles every failure, including the ERR trap, `SIGINT`/`SIGTERM`/`SIGHUP`, restart failure, readiness failure and approval failure:
  1. Clear the candidate.
  2. Re-verify `live/current` against its record and digest.
  3. Restart it and **re-check readiness**. This is exit `3`.
  4. If nothing trusted exists: **stop and prove it stopped** (unit inactive *and* nothing on the port), clear the untrusted selection, and disable the unit. This is exit `4`.
  5. If the stop or the candidate cleanup can't be confirmed, report **UNSAFE** with exit `5`. It is never reported as "stopped".
- **After an uncatchable interruption** (`SIGKILL`, power loss without a reboot), the next promotion refuses to run until `entrepreneuria-promote <app> --recover` restores the verified selection. A reboot clears the runtime candidate automatically.
- **Readiness checks all of these:**
  - The unit is active and hasn't crashed since the check began.
  - **Every** listener on the port is on `127.0.0.1`.
  - Each listener runs as **`app-<app>`'s UID** (real, effective, saved and fs).
  - Each listener is in the unit's **exact cgroup**. This is normalised against PID 1's cgroup and fails closed if it can't be normalised.
  - Each listener's **cwd** is the expected `releases/<sha>`.
  - One bounded request (`curl --max-time 5 --max-redirs 0`) completes successfully with **HTTP 200** and the app's `HEALTH_MARKER`.
  - The identity checks are repeated after the request.
- Exit codes:

  | Code | Meaning |
  |---|---|
  | `0` | activated |
  | `2` | rejected before activation |
  | `3` | rolled back to the verified selection |
  | `4` | stopped (confirmed) and cleared |
  | `5` | UNSAFE: operator action required |

## Layout (per app `<app>`)

```
/etc/entrepreneuria/apps/<app>.conf      root:root   0644   APP_ID, REPO_URL, PORT, HEALTH_PATH, HEALTH_MARKER, MEMORY_MAX
/srv/<app>/releases/<sha>/               root:root   0755/0644, no group/world write, no setuid
/srv/<app>/live/current                  root-owned symlink: the verified boot selection
/srv/<app>/state/verified/<sha>          root:root   0600   app, repo, sha, artifact digest, tree digest
/srv/<app>/var/                          app-<app>   0700   only writable runtime path (release .next/cache -> var/cache)
/srv/<app>/config/service.env            root:root   0644   PORT=… (read last by systemd)
/srv/<app>/config/build.env              root:build-<app> 0640   NEXT_PUBLIC_* only
/srv/<app>/secrets/runtime.env           root:root   0600   rotated values only; read by PID 1
/srv/build/<app>/                        build-<app> 0700
/var/lib/entrepreneuria/<app>/           root:root   0711
  lock/ (0700)  artifacts/ (0700)  mirror.git  extract/ (0711; per-run 0700 dir owned by stage-<app>)
/run/systemd/system/entrepreneuria-app@<app>.service.d/zz-candidate.conf   runtime candidate only
```

## Files

- `systemd/entrepreneuria-app@.service`: the hardened unit (loopback bind, `ProtectSystem=strict`, empty capability set).
- `bin/provision-app.sh <app> [--apply]`: dry run by default.
  - Creates or validates the users and dirs, installs the tools, and checks for Python ≥ 3.12.
  - **Refuses** unsafe pre-existing state.
  - Grants no sudo, and never starts or enables the unit.
- `bin/build-release.sh` → `entrepreneuria-build`
- `bin/promote-release.sh` → `entrepreneuria-promote`
- `bin/verify-app.sh` → `entrepreneuria-verify`: strictly read-only.
  - Each `ss` call's exit status is checked; an enumeration error is a FAIL, never an empty result.
  - It fails on a pending interrupted candidate, unsafe lock or promoter dirs, missing identities, sudo grants, unsafe paths or symlinks, and unexpected public listeners.
- `bin/prepare-acme-webroot.sh` → `entrepreneuria-acme-webroot <host>`: creates and validates `/var/www/acme/.well-known/acme-challenge` (real `root:root 0755` directories) and proves nginx serves a probe for `<host>` **before** certbot runs.
- `lib/common.sh`, `lib/archive_tool.py`
- `nginx/`: Ubuntu 24.04 (nginx 1.24) configs: `00-entrepreneuria-http.conf` (upgrade map, IPv4/IPv6 default servers), the bootstrap (ACME) template, and the TLS template (`listen … ssl http2`, overwritten forwarding headers).
- `test/`: the disposable-container suite.

## Order on the new host

Preconditions:
- Provider-console access has been verified.
- Admin user, SSH hardening, and firewalls allowing only SSH, 80 and 443 on IPv4 and IPv6.
- Node 22 LTS at `/usr/bin/node`, plus nginx, certbot, git and python3 (3.12 ships with Ubuntu 24.04).

Steps:

1. Write `/etc/entrepreneuria/apps/hub.conf` from `apps/hub.conf.example`.
2. `sudo ops/vps/bin/provision-app.sh hub`. Review the plan, then run it again with `--apply`.
3. Fill `/srv/hub/secrets/runtime.env` (rotated values) and `/srv/hub/config/build.env` (public values).
4. Build from the reviewed SHA in this fresh, isolated environment: `sudo -u build-hub /usr/local/bin/entrepreneuria-build hub <approved-sha>`. It prints `ARTIFACT_SHA256`.
5. **The operator verifies the digest**, then runs `sudo /usr/local/sbin/entrepreneuria-promote hub <approved-sha> <artifact-sha256>`. It must exit `0`.
6. nginx:
   1. Remove `sites-enabled/default`.
   2. Install `00-entrepreneuria-http.conf` and the bootstrap site, then `nginx -t` and reload.
   3. `sudo entrepreneuria-acme-webroot <host>`
   4. `certbot certonly --webroot -w /var/www/acme -d <host>`
   5. Install the TLS site, then `nginx -t` and reload.
7. `sudo /usr/local/sbin/entrepreneuria-verify hub`. It must print `RESULT: PASS`.
8. Run the external checks (`curl -4/-6`, `nmap` on v4 and v6, the one-shot integrity check), then take a Hostinger snapshot.

If a promotion is ever interrupted, run `sudo entrepreneuria-promote hub --recover` before anything else.

## Testing

`ops/vps/test/run-in-docker.sh` runs a **disposable** `ubuntu:24.04` container with systemd as PID 1, stock nginx 1.24 and **dummy credentials only**.
- The fixture app's fake `next` has selectable behaviours: healthy, crash, 500, redirect, wrong app, hang, public bind, and no listener.
- Failures and interruptions are injected by swapping **wrapper binaries** into the throwaway container (`systemctl`, `curl`, `git`, `rm`, `ss`). The production scripts contain no test hooks.
- The container is restarted to test boot behaviour, then deleted.

**Still requires the clean VPS** (not reproducible in a container):
- real external IPv4/IPv6 exposure and the firewalls
- Let's Encrypt issuance and renewal
- the **real combined hub build** (`next build`/`next start`) under the sandbox, including image optimisation and cache writes
- a kernel-level reboot and power loss
- `systemd-analyze security` on the real kernel
- the Supabase key transition

**Residual trust:** generated `.next` and `node_modules` are trusted to the controlled, unprivileged build. Codex judged this conditionally acceptable for a supervised, one-off recovery, given a fresh isolated build from the reviewed SHA and lockfile, no runtime secrets, and operator verification of the digest. The durable fix is CI-built, signed artifacts.

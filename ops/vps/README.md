# VPS per-app isolation (systemd), for the clean rebuild

**Status:** prepared and tested in a disposable Ubuntu 24.04 container (see [Testing](#testing)). **Not executed on any VPS.**

**Scope:** the clean Ubuntu 24.04 rebuild only. Never use it on the old VPS (`srv1125038`), which is treated as compromised at the shared app-account level.

**What it leaves alone:** `.github/workflows/deploy.yml` (PM2 over SSH) is unchanged and stays `disabled_manually`. This package is the manual, operator-driven path for the first restore. Re-enabling CI deploys is a separate, owner-approved change.

## Trust model

Three roles per app, and no account that both chooses code and runs it with secrets:

| Role | Account | Can | Cannot |
|---|---|---|---|
| **Build** | `build-<app>`: system user, `nologin`, no sudo, no SSH | fetch the exact SHA, `npm ci`, build with **public** values (`config/build.env`), write `/srv/build/<app>/out/<sha>.tar.gz` | read runtime secrets; write releases, the live pointer or promotion state; enter other apps' build dirs; run the promoter |
| **Promote** | the **operator** (root via their own admin sudo) running `/usr/local/sbin/entrepreneuria-promote` (root `0700`) | verify and publish a release, and activate it | — (no sudoers rule delegates this to any service account) |
| **Run** | `app-<app>`: system user, `nologin`, no sudo, no SSH | execute the root-owned release; write only `/srv/<app>/var` | modify releases or the live pointer; read the secrets file (systemd injects the values) |

**What `entrepreneuria-promote <app> <sha> <artifact-sha256>` verifies before anything runs:**

1. The **app** has a root-owned config at `/etc/entrepreneuria/apps/<app>.conf` (parsed, never sourced). It holds the repo, port and health marker.
2. **Artifact integrity:** it copies the artifact into root-only staging, *then* hashes the copy and compares it with the digest the operator approved. The build user can't swap the file after that.
3. **Archive safety:** no absolute or `..` paths, no hard links, devices or FIFOs. It extracts as root, strips write and setuid bits, and rejects symlinks that escape the release.
4. **Repo and exact SHA:** it fetches `<sha>` from the *configured* repo into a root-owned mirror, and **every tracked file in the artifact must equal that commit**. (`next-env.d.ts` and `tsconfig.json` are exempt; `next build` rewrites them and `next start` doesn't use them.)
5. **Config sanity:** the port is unique across apps, and the secrets file doesn't set `PORT`, `HOSTNAME` or `NODE_OPTIONS`.

It then publishes `/srv/<app>/releases/<sha>` owned by root and records its **tree digest** (paths, modes, symlink targets and file hashes) in root-only `state/verified/<sha>`.

**Residual trust (documented, not eliminated):**
- Build outputs (`.next`, `node_modules`) can't be re-derived from source without reproducible builds. They're trusted as far as the build user is: no secrets, no access to other apps, `npm ci` lockfile integrity, and the audit gate.
- The full mitigation is CI-built, signed artifacts (later work).

## Activation, rollback and readiness

- **One promotion at a time:** a global `flock` across all apps.
- Activation swaps the root-owned `live/current` pointer, runs `systemctl restart`, then the **readiness check**.
- **Any failure, whether the restart or the health check, takes one recovery path:**
  1. Re-verify `state/last-good` against its recorded tree digest.
  2. If it verifies, activate it and **re-check health**. Exit `3`.
  3. If there is no trusted release, or it fails too, **stop the unit and clear the pointer**. Exit `4`.
- The unit is **enabled at boot only after a healthy activation**. `ConditionPathIsSymbolicLink` keeps it from starting with no selection.
- `entrepreneuria-promote <app> --rollback` re-activates `last-good` explicitly, but only after re-verifying it.
- **Readiness** passes only when **all** of these hold:
  1. The unit is active and hasn't crashed.
  2. **Every** listener on the app port is on `127.0.0.1`, belongs to the unit's **cgroup**, and has its **cwd** set to `/srv/<app>/releases/<sha>`.
  3. One bounded direct request (`curl --max-time 5 --max-redirs 0`) to `http://127.0.0.1:<port><HEALTH_PATH>` returns **exactly 200** with the app's `HEALTH_MARKER` in the body.
  4. Listener ownership is re-checked after the request.

  Redirects, other 2xx codes, a wrong app, or another process on the port all fail.
- Exit codes: `0` activated, `2` rejected before activation, `3` rolled back, `4` stopped and cleared.

## Layout (per app `<app>`)

```
/etc/entrepreneuria/apps/<app>.conf  root:root   0644   APP_ID, REPO_URL, PORT, HEALTH_PATH, HEALTH_MARKER, MEMORY_MAX
/srv/<app>/                          root:root   0755
/srv/<app>/releases/<sha>/           root:root   0755/0644, no group/world write, no setuid
/srv/<app>/live/current              root-owned symlink → releases/<sha>  (dir root:root 0755)
/srv/<app>/state/                    root:root   0700   last-good, verified/<sha> (artifact + tree digest)
/srv/<app>/var/                      app-<app>   0700   only writable runtime path; release .next/cache → var/cache
/srv/<app>/config/service.env        root:root   0644   PORT=… (generated from the app config; read last by systemd)
/srv/<app>/config/build.env          root:build-<app> 0640   NEXT_PUBLIC_* only, never secrets
/srv/<app>/secrets/runtime.env       root:root   0600   rotated values only; read by PID 1
/srv/build/<app>/                    build-<app> 0700   build home, work tree, out/<sha>.tar.gz
/usr/local/sbin/entrepreneuria-{promote,verify}   root 0700
/usr/local/bin/entrepreneuria-build               root 0755
/usr/local/lib/entrepreneuria/common.sh           root 0644
```

## Files

- `systemd/entrepreneuria-app@.service`: the hardened instance unit (loopback bind, `ProtectSystem=strict`, empty capability set, `ReadWritePaths=/srv/<app>/var`).
- `bin/provision-app.sh <app> [--apply]`: **dry run by default.**
  - Creates or validates the users, tree, installed tools and unit.
  - **Refuses** unsafe pre-existing state: login-shell or non-system users, extra groups, sudoers mentions, symlinked or wrongly-owned paths.
  - Grants no sudo and never starts or enables the unit.
- `bin/build-release.sh`, installed as `entrepreneuria-build`: the unprivileged build.
- `bin/promote-release.sh`, installed as `entrepreneuria-promote`: verification, publication, activation and recovery.
- `bin/verify-app.sh`, installed as `entrepreneuria-verify`: **strictly read-only** checks.
  - Access probes must answer YES or NO, and a probe error is a FAIL.
  - It fails on missing identities, wrong owners or modes, escaping symlinks, any sudo rights for the service accounts, and **any unexpected public listener**. The only allowed public listeners are nginx on 80/443 and sshd/systemd on the SSH port.
- `lib/common.sh`: the config parser, release verification, tree digest and readiness check.
- `apps/hub.conf.example`: the app config template.
- `nginx/`: Ubuntu 24.04 (nginx 1.24) configs:
  - `00-entrepreneuria-http.conf`: the `$connection_upgrade` map, and default servers that drop unknown hosts on :80 (444) and refuse unknown-SNI TLS (`ssl_reject_handshake`) on **IPv4 and IPv6**.
  - `entrepreneuria-app.bootstrap.conf.example`: HTTP-only ACME webroot, for **certificate bootstrap**.
  - `entrepreneuria-app.tls.conf.example`: `listen … ssl http2` (1.24 syntax). It **overwrites** `X-Real-IP`/`X-Forwarded-For` with the TCP peer, clears `Forwarded`, and sets `Host` = `X-Forwarded-Host` (the app's gate contract).
- `test/`: the disposable-container test suite.

## Order on the new host

Preconditions:
- Provider-console access has been verified.
- Admin user, SSH hardening, and the Hostinger firewall plus ufw allowing only SSH, 80 and 443 on **IPv4 and IPv6**.
- Node 22 LTS at `/usr/bin/node`, plus nginx, certbot and git.

Steps:

1. Write `/etc/entrepreneuria/apps/hub.conf` from `apps/hub.conf.example`.
2. `sudo ops/vps/bin/provision-app.sh hub`. Review the plan, then run it again with `--apply`.
3. Fill `/srv/hub/secrets/runtime.env` (**rotated** values only) and `/srv/hub/config/build.env` (public values).
4. `sudo -u build-hub /usr/local/bin/entrepreneuria-build hub <approved-sha>`. This prints `ARTIFACT_SHA256`.
5. `sudo /usr/local/sbin/entrepreneuria-promote hub <approved-sha> <artifact-sha256>`. It must exit `0`.
6. nginx:
   1. Remove `sites-enabled/default`.
   2. Install `00-entrepreneuria-http.conf` and the bootstrap site, then `nginx -t` and reload.
   3. `certbot certonly --webroot -w /var/www/acme -d <host>`.
   4. Swap in the TLS site, then `nginx -t` and reload.
7. `sudo /usr/local/sbin/entrepreneuria-verify hub`. It must print `RESULT: PASS`.
8. External checks from the workstation:
   - `curl -4 -I` and `curl -6 -I https://<host>`
   - `nmap -Pn` against the v4 and v6 addresses shows only SSH, 80 and 443
   - the one-shot integrity check
9. Take a Hostinger snapshot.

Repeat steps 1–5 and 7 for each app. Architecta goes last, and only after its dependency remediation.

## Testing

`ops/vps/test/run-in-docker.sh` builds a **disposable** `ubuntu:24.04` container with systemd as PID 1, the stock nginx package and **dummy credentials only**. It provisions a fixture app whose fake `next` binary has selectable failure modes, runs every scenario, restarts the container to test boot start, and then deletes the container. It never contacts the VPS.

**Covered there:**
- provisioning, including the dry run, idempotency and unsafe-state rejection
- the build/promote split
- digest, source, path-traversal, escaping-symlink and port-conflict gates
- first activation and enable-at-boot
- restart crash, HTTP 500, redirect, wrong app, hang, public bind, and an imposter on the port
- verified rollback, tampered-rollback refusal, rollback-unhealthy (stop and clear), and first-deploy failure
- lock serialization
- user isolation
- verifier negatives
- nginx `-t` for bootstrap and TLS, header overwrite, unknown host and SNI
- reboot

**Still requires the clean VPS** (not reproducible in a container):
- real Hostinger firewall, ufw and external IPv4/IPv6 exposure (`nmap`)
- real Let's Encrypt issuance
- the real hub build (`next build`/`next start`) under the sandbox, including image optimisation and cache behaviour
- a kernel-level reboot
- `systemd-analyze security` on the real kernel
- the Supabase key transition (needs its own integration check before any legacy key is disabled)

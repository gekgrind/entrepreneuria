# VPS per-app isolation (systemd), for the clean rebuild

**Status:** prepared, **not executed**. Nothing here has been run on any host.

**Scope:** the clean Ubuntu 24.04 rebuild only. Never apply it to the old VPS (`srv1125038`), which is treated as compromised at the shared app-account level.

**What it leaves alone:** `.github/workflows/deploy.yml` (PM2 over SSH) is unchanged and stays `disabled_manually`. This package is the manual, reviewed path for the first restore. Re-enabling CI deploys is a separate, owner-approved change.

## Why

On the old host every app ran under one shell account (`misti`) with PM2. Once that account was abused, every app's `.env` was readable and every release was writable. This layout removes that shared blast radius:

| Property | How |
|---|---|
| One identity per app | `app-<app>`: system user, `nologin`, no home, no sudo, no SSH |
| Deploy separated from runtime | `deploy` builds and activates releases. It can't read runtime secrets and holds no app group membership. |
| Runtime can't modify code | Releases are owned by `deploy` (0755 dirs / 0644 files, `go-w`). The unit adds `ProtectSystem=strict` and makes only `/srv/<app>/var` writable. |
| Least-privilege secrets | `/srv/<app>/secrets/runtime.env` is `root:root 0600` and read by systemd (PID 1) before privileges drop. Neither `deploy` nor `app-<app>` can read the file. |
| Loopback only | `next start --hostname 127.0.0.1 --port $PORT`. nginx is the only public listener. |
| Narrow sudo | `deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart entrepreneuria-app@<app>.service`, and nothing else |
| Exact-SHA deploys | `deploy-release.sh` accepts only a 40-hex SHA, verifies `HEAD`, and builds into `releases/<sha>`. |
| Trusted rollback | It falls back only to the previous release built on this host (`DEPLOYED_SHA` present). It never copies from the old VPS. |

## Layout (per app `<app>`)

```
/srv/<app>/                    root:root          0755
/srv/<app>/releases/<sha>/     deploy:deploy      0755 / 0644, go-w
/srv/<app>/live/current        symlink → releases/<sha> (dir deploy:deploy 0755)
/srv/<app>/var/                app-<app>          0700   only writable runtime path
/srv/<app>/var/cache/          app-<app>          0700   release .next/cache → here
/srv/<app>/config/service.env  root:root          0644   PORT=… (non-secret)
/srv/<app>/config/build.env    root:deploy        0640   NEXT_PUBLIC_* only, never secrets
/srv/<app>/secrets/            root:root          0700
/srv/<app>/secrets/runtime.env root:root          0600   rotated values only
```

## Files

- `systemd/entrepreneuria-app@.service`: the hardened instance unit (`entrepreneuria-app@hub.service`, …)
- `bin/provision-app.sh <app> <port> [mem] [--apply]`: creates the users, tree, unit, limits drop-in and sudo rule. **It runs as a dry run unless you pass `--apply`.** It never writes secret values or overwrites existing config.
- `bin/deploy-release.sh <app> <repo-url> <sha>`: run as `deploy`. It fetches the exact SHA, then runs `npm ci`, `npm audit --audit-level=critical` and the build, then swaps the symlink, restarts the unit, health-checks it, and rolls back if that fails.
- `bin/verify-app.sh <app>`: read-only checks for every property above. Exits non-zero on any failure.
- `nginx/entrepreneuria-app.conf.example`: proxy block that honours the app's header contract (`Host` = `X-Forwarded-Host`, and `X-Real-IP` overwritten).

## Order on the new host (after OS, admin user, SSH hardening, firewalls)

Preconditions:
- provider-console access has been verified
- the Hostinger firewall and ufw allow only SSH, 80 and 443 for **both IPv4 and IPv6**
- Node 22 LTS is at `/usr/bin/node`
- nginx is installed

Steps:

1. `sudo ops/vps/bin/provision-app.sh hub 3000 2G`. Review the dry run, then repeat it with `--apply`.
2. Fill `/srv/hub/secrets/runtime.env` with **newly rotated** values, as an administrator. Fill `/srv/hub/config/build.env` with public values only.
3. As `deploy`, run `ops/vps/bin/deploy-release.sh hub https://github.com/gekgrind/entrepreneuria.git <approved-sha>`.
4. `sudo systemctl enable --now entrepreneuria-app@hub.service`
5. Install the nginx site from the example, then run `nginx -t` and reload.
6. `sudo ops/vps/bin/verify-app.sh hub`, which must exit 0.
7. External checks from the workstation:
   - `curl -4 -I` and `curl -6 -I https://<host>`
   - `nmap -Pn` against the v4 and v6 addresses shows only SSH, 80 and 443
   - the one-shot integrity check
8. Take a Hostinger snapshot.

Then repeat steps 1–6 per app. Architecta goes last, and only after its dependency remediation.

## Known limits / open items

- **`npm ci` runs package install scripts as `deploy`.** A malicious dependency could therefore write to `deploy`'s own releases. It still can't read runtime secrets or escalate beyond restarting the unit. Mitigation: lockfile review, and a later move to building in CI with signed artifacts.
- **`deploy-release.sh` audits at `critical`** to match the existing workflow's gate. Tighten to `high` once the known pre-existing `zod` / `source-map-js` highs are resolved.
- **Alert receiver and review store:** each runs as its own `entrepreneuria-app@<name>` instance, or with a `ReadWritePaths` drop-in, when the leads release is approved. They are not needed for showcase.
- **Not checked yet:** `systemd-analyze security` has not been scored, because no host was available. `verify-app.sh` prints it on first run.

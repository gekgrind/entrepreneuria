---
Agent: Claude Code
Task: Hub recovery patch preparation (security), with Codex review requested
Completed: 2026-11-20
Repository: `gekgrind/entrepreneuria` (local worktrees under `C:\DevProjects\entrepreneuria-*`)
Baseline: `main` @ `47615e4904f13e2ea94bf6123ba37019528f1a5c`
Status: `IMPLEMENTED (draft PRs); TESTED LOCALLY; NOT MERGED; NOT DEPLOYED; SECURITY REVIEW REQUIRED`
Merged: NO. Codex must review the exact commits below before any merge authorization.
---

# Hub recovery: Codex review package

## Context

- **Old VPS `srv1125038`:** treated as compromised at the shared app-account (`misti`) level. The evidence is the crontab backdoor and the RCE payloads in `architecta-error.log`, recorded in `architecta/output/vps-incident-response-2026-11-15.md`.
- **Not proven:** credential exfiltration, and the entry vector.
- **Recovery target:** hub online with Websites in `showcase` mode, intake and payments off. Architecta is restored last.
- **Unchanged:** deploy workflows stay `disabled_manually`. No DNS, credential, firewall, GitHub setting or production change was made.

## Commits to review

| PR | Branch | Head | Scope |
|---|---|---|---|
| #49 (draft, pre-existing) | `security/next-16.4.5` | `0d42e736ccea25b49305ebd37fc4370b0931771c` | `next` / `eslint-config-next` 16.4.3 → **16.4.5**, exact pins (`package.json`, `package-lock.json`, `pnpm-lock.yaml`) |
| #51 (draft) | `security/ai-endpoints-kill-switch` | `ef12c6f10ad67f31dc4e34e28ad193365ff521a3` | Fail-closed `PUBLIC_AI_TOOLS_ENABLED`: 7 AI `POST`s return 503 before the body is read or a provider called; 6 `/tools/*` pages return 404 |
| this PR (draft) | `ops/systemd-isolation` | see PR head | `ops/vps/**` systemd per-app isolation package (not executed) plus this handoff |

All three are independent and based on `47615e4`.

## Evidence

**#49:**
- Lockfile `next` integrity equals `npm view next@16.4.5 dist.integrity`. All `@next/*` and `eslint-config-next` are at 16.4.5. React stays 19.2.7.
- `npm ci`, `typecheck`, `npm test` (1008/1008) and `build` all pass.
- GHSA DB (`affects=next`) shows every 16.x advisory fixed at ≤ 16.4.5 as of 2026-11-19/20.
- **CVE-2026-126187 (GHSA-xqc2):**
  - It affects `react-server-dom-*` < 19.2.9. The hub has no direct `react-server-dom-*`; Next vendors it.
  - Fix marker `getBackingBlob` (react/react#37844/#37846) is absent in `react-server-dom-webpack@19.2.8` and present in `@19.2.9`.
  - The marker is present in Next's vendored `react-server-dom-{webpack,turbopack}` server builds for **both 16.4.3 and 16.4.5**.

**#51:**
- `lib/ai/public-tools-flag.test.ts` and `components/tools/PublicAiToolGate.test.ts`: 18/18 pass.
- With the route guards reverted, 7 tests fail.
- Full `npm test` 1026/1026, typecheck clean, ESLint clean on changed files, build OK.
- **Runtime** (local `next start`, dummy public Supabase env):
  - Flag off: the 7 APIs return `503 no-store`, the 6 tool pages return 404, and `/` and `/tools` return 200.
  - Flag on: the tool pages return 200 and the API reaches its handler.

**systemd package:**
- `bash -n` passes on all scripts, and argument validation was exercised locally.
- **Not executed on any host.** `provision-app.sh` defaults to a dry run.

## Please verify independently

1. **#49:** run `git diff 47615e4..0d42e73 -- package-lock.json` and confirm only the next-family packages changed, with integrities matching npm. Re-query `gh api "advisories?ecosystem=npm&affects=next"` and `…affects=react-server-dom-webpack` on review day. Then re-check the vendored-RSC fix claim against the React fix diff, not just the marker.
2. **#51:** confirm the guard is the first statement in each `POST`, that no provider can be reached while the flag is off, and that the flag cannot be enabled by anything except the exact env string. Also check whether `force-dynamic` in the tool layouts has any unintended effect on the client pages.
3. **systemd package:**
   - Confirm the runtime user can't write releases or read secrets.
   - Check whether `ProtectSystem=strict` plus `ReadWritePaths=/srv/<app>/var` is sufficient for `next start` (`.next/cache` is symlinked into `var/cache`).
   - Confirm the sudoers rule is exactly one command.
   - Check that `deploy-release.sh` rollback can only target releases built on the host.
   - Confirm the nginx header contract matches `lib/services/websites/gate.ts` / `request-guards.ts` (`Host` = `X-Forwarded-Host`, and `X-Real-IP` overwritten).

## Unresolved risks

- **`npm audit --omit=dev` (pre-existing on main, outside these PRs):**
  - `zod` 3.25.76 is affected by GHSA-mrhx-c7xc-m3w5 (fix needs a major upgrade to 4.x).
  - Transitive `source-map-js` < 1.2.2 has a DoS (non-breaking fix available).
  - These are follow-ups. The Websites inquiry body cap limits the zod exposure there.
- **Build on 16.4.3** (current main) is stopped once by Next's built-in `SecurityFatalError` upgrade nudge; a retry builds. That message also contains agent-directed instructions, which were treated as data and not acted on. #49 removes the trigger.
- **`/tools` index** still links to the six tools, which now 404 while disabled. That's a UX gap and an owner decision; it's not changed here.
- **#50** (persona-builder hardening) will need a one-line rebase onto #51's guard.
- **systemd package:**
  - `npm ci` install scripts run as `deploy`. A compromised dependency could tamper with `deploy`'s own releases, though not with secrets or root.
  - The `systemd-analyze security` score hasn't been measured yet.
- **Architecta** (not in these PRs): still `next 15.4.5` / `react 19.2.0`. A1 (→ 15.5.29 / 19.2.9) and A2 (redirect remediation) are required before its restore. V1, the vendored-RSC check, is still open for 15.5.29.

## Supabase key type (D3)

- Project `rifzbzaabkaeagyulxip` has a legacy HS256 `anon` key and a new `sb_publishable_…` key, both enabled. The apps use the legacy `anon` / `service_role` JWTs.
- **Rotation procedure (documented, not performed):**
  1. Create an `sb_secret_…` key.
  2. Switch servers to `sb_secret_…` and clients to `sb_publishable_…`, on the new host only.
  3. Verify.
  4. Disable the legacy API keys.
- This revokes the exposed `service_role` JWT without rotating the JWT signing secret, so users stay signed in. The JWT secret only needs rotating if it was present on the old host; confirm from the env inventory.

## Exact next step

Codex reviews #49 @ `0d42e73`, #51 @ `ef12c6f` and this PR's head, and records a verdict for each (`READY FOR MERGE` / `NOT READY FOR MERGE` / `SECURITY REVIEW REQUIRED`). The owner then decides on merge. Merge does not authorize deploy.

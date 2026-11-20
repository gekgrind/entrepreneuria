#!/usr/bin/env bash
# Build and activate one approved commit. Run as the `deploy` user.
#
#   ops/vps/bin/deploy-release.sh <app> <repo-https-url> <40-hex-commit-sha>
#
# - Builds only the exact approved SHA (no branches, tags or short SHAs).
# - Builds into /srv/<app>/releases/<sha>, never in place.
# - Activation is an atomic symlink swap + restart of this app's unit only.
# - On a failed health check it swaps back to the previous release, which was
#   itself built on this host from an approved SHA.
#
# Does not touch secrets: runtime.env is read by systemd; build.env holds
# NEXT_PUBLIC_* values only.
set -euo pipefail
umask 022

[[ $# -eq 3 ]] || { echo "usage: $0 <app> <repo-https-url> <40-hex-sha>" >&2; exit 2; }
APP="$1"; REPO="$2"; SHA="$3"

[[ "$(id -un)" == "deploy" ]] || { echo "run as the deploy user" >&2; exit 1; }
[[ "$APP" =~ ^[a-z][a-z0-9-]{1,30}$ ]] || { echo "invalid app name" >&2; exit 2; }
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "SHA must be a full 40-character lowercase hex commit id" >&2; exit 2; }
[[ "$REPO" =~ ^https://github\.com/gekgrind/[A-Za-z0-9._-]+(\.git)?$ ]] || { echo "unexpected repository URL" >&2; exit 2; }

BASE="/srv/$APP"
REL="$BASE/releases/$SHA"
LIVE="$BASE/live/current"
UNIT="entrepreneuria-app@$APP.service"
PORT="$(sed -n 's/^PORT=\([0-9]\+\)$/\1/p' "$BASE/config/service.env")"
HEALTH_PATH="${HEALTH_PATH:-/}"
[[ -n "$PORT" ]] || { echo "PORT missing in $BASE/config/service.env" >&2; exit 1; }

if [[ -e "$REL" ]]; then
  echo "release $SHA already exists; refusing to rebuild over it" >&2; exit 1
fi

# --- Fetch the exact commit -----------------------------------------------------
git init -q "$REL"
git -C "$REL" remote add origin "$REPO"
git -C "$REL" fetch -q --depth 1 origin "$SHA"
git -C "$REL" -c advice.detachedHead=false checkout -q --detach FETCH_HEAD
ACTUAL="$(git -C "$REL" rev-parse HEAD)"
[[ "$ACTUAL" == "$SHA" ]] || { echo "checked out $ACTUAL, expected $SHA" >&2; exit 1; }

# --- Install, audit, build ------------------------------------------------------
cd "$REL"
npm ci --no-fund
npm audit --omit=dev --audit-level=critical
(
  set -a
  # shellcheck disable=SC1091
  . "$BASE/config/build.env"
  set +a
  NEXT_TELEMETRY_DISABLED=1 npm run build
)

# Runtime cache lives outside the read-only release.
rm -rf .next/cache
ln -s "$BASE/var/cache" .next/cache
printf '%s\n' "$SHA" > DEPLOYED_SHA
chmod -R go-w "$REL"
rm -rf "$REL/.git"

# --- Activate -------------------------------------------------------------------
PREVIOUS="$(readlink -f "$LIVE" 2>/dev/null || true)"
ln -sfn "$REL" "$BASE/live/current.tmp"
mv -T "$BASE/live/current.tmp" "$LIVE"
sudo /usr/bin/systemctl restart "$UNIT"

healthy() {
  for _ in $(seq 1 30); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT$HEALTH_PATH" || true)"
    [[ "$code" =~ ^(200|204|301|302|307|308)$ ]] && return 0
    sleep 2
  done
  return 1
}

if healthy; then
  echo "deployed $APP @ $SHA"
  exit 0
fi

echo "health check failed for $SHA" >&2
if [[ -n "$PREVIOUS" && -d "$PREVIOUS" && -f "$PREVIOUS/DEPLOYED_SHA" ]]; then
  ln -sfn "$PREVIOUS" "$BASE/live/current.tmp"
  mv -T "$BASE/live/current.tmp" "$LIVE"
  sudo /usr/bin/systemctl restart "$UNIT"
  echo "rolled back to $(cat "$PREVIOUS/DEPLOYED_SHA")" >&2
else
  echo "no previous trusted release to roll back to; service left on the failed release" >&2
fi
exit 1

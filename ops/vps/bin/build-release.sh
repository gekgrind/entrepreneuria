#!/usr/bin/env bash
# Unprivileged build. Installed root-owned as /usr/local/bin/entrepreneuria-build.
# Run by the operator as the app's build user, which has no sudo, no shell, no
# SSH and no access to runtime secrets or other apps:
#
#   sudo -u build-<app> /usr/local/bin/entrepreneuria-build <app> <40-hex-sha>
#
# Fetches exactly <sha> from the repo in the root-owned app config, runs
# `npm ci`, the audit gate and `npm run build` with PUBLIC build values only,
# and writes /srv/build/<app>/out/<sha>.tar.gz. It prints the artifact sha256
# for the operator to approve; nothing becomes runnable until the operator runs
# `entrepreneuria-promote <app> <sha> <sha256>` as root.
set -Eeuo pipefail
umask 077
# shellcheck source=../lib/common.sh
. /usr/local/lib/entrepreneuria/common.sh

[[ $# -eq 2 ]] || die "usage: entrepreneuria-build <app> <40-hex-sha>"
APP="$1"; SHA="$2"
valid_app "$APP" || die "invalid app name"
valid_sha "$SHA" || die "SHA must be a full 40-character lowercase hex commit id"
[[ "$(id -un)" == "build-$APP" ]] || die "run as build-$APP (sudo -u build-$APP ...)"

load_app_conf "$APP"
ROOT="/srv/build/$APP"
WORK="$ROOT/work/$SHA"
OUT="$ROOT/out"
export HOME="$ROOT/home" npm_config_cache="$ROOT/home/.npm" NEXT_TELEMETRY_DISABLED=1 CI=1
mkdir -p "$ROOT/work" "$OUT" "$HOME"

rm -rf --one-file-system "$WORK"
git init -q "$WORK"
git -C "$WORK" fetch -q --depth 1 "$CONF_REPO_URL" "$SHA"
git -C "$WORK" -c advice.detachedHead=false checkout -q --detach FETCH_HEAD
[[ "$(git -C "$WORK" rev-parse HEAD)" == "$SHA" ]] || die "checked out commit does not match $SHA"

cd "$WORK"
npm ci --no-fund
npm audit --omit=dev --audit-level=critical
(
  set -a
  # shellcheck disable=SC1091
  . "/srv/$APP/config/build.env"
  set +a
  npm run build
)
rm -rf .git .next/cache

ARTIFACT="$OUT/$SHA.tar.gz"
rm -f "$ARTIFACT"
tar --sort=name --owner=0 --group=0 --numeric-owner -czf "$ARTIFACT" -C "$WORK" .
DIGEST="$(sha256sum "$ARTIFACT" | cut -d' ' -f1)"
printf 'app=%s\nsha=%s\nartifact_sha256=%s\nbuilt_at=%s\n' "$APP" "$SHA" "$DIGEST" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$OUT/$SHA.manifest"
rm -rf --one-file-system "$WORK"

echo "ARTIFACT=$ARTIFACT"
echo "ARTIFACT_SHA256=$DIGEST"
echo "Approve and activate as root: entrepreneuria-promote $APP $SHA $DIGEST"

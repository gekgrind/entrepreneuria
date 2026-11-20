#!/usr/bin/env bash
# Trusted promotion. Installed root-owned as /usr/local/sbin/entrepreneuria-promote.
# Run ONLY by the operator (root via their own admin sudo); no sudoers rule grants
# it to the build or runtime users.
#
#   entrepreneuria-promote <app> <40-hex-sha> <64-hex-artifact-sha256>
#   entrepreneuria-promote <app> --rollback          # re-activate state/last-good after re-verifying it
#
# Promotion of a new artifact:
#   1. takes the global promotion lock (one promotion at a time, all apps)
#   2. reads the root-owned app config (app id, repo, port, health marker)
#   3. copies the build user's artifact into root-only staging and checks its
#      sha256 against the digest the operator approved
#   4. rejects unsafe archive members, extracts as root, strips write/setuid bits
#   5. fetches <sha> from the configured repo into a root-owned mirror and
#      checks every tracked source file in the artifact matches that commit
#   6. publishes /srv/<app>/releases/<sha> root-owned and records its tree digest
# Activation (new or rollback):
#   swap the root-owned live pointer, restart the unit, then a bounded readiness
#   check bound to the unit's cgroup, the release directory and an HTTP 200 with
#   the app marker. Any failure (restart or health) takes one recovery path:
#   re-verify state/last-good and roll back to it, re-checking health; if there
#   is no trusted release, or it also fails, stop the unit and clear the pointer.
#   The unit is enabled at boot only after a successful activation.
#
# Exit codes: 0 activated | 2 rejected before activation | 3 failed, rolled back
#             to last-good | 4 failed, service stopped and pointer cleared
set -Eeuo pipefail
umask 077
# shellcheck source=../lib/common.sh
. /usr/local/lib/entrepreneuria/common.sh

EXIT_CODE=2
[[ $EUID -eq 0 ]] || die "must run as root"
[[ $# -eq 2 || $# -eq 3 ]] || die "usage: entrepreneuria-promote <app> <sha> <artifact-sha256> | <app> --rollback"
APP="$1"
valid_app "$APP" || die "invalid app name"
MODE=promote
if [[ "$2" == "--rollback" ]]; then
  [[ $# -eq 2 ]] || die "usage: entrepreneuria-promote <app> --rollback"
  MODE=rollback; SHA=""
else
  [[ $# -eq 3 ]] || die "usage: entrepreneuria-promote <app> <sha> <artifact-sha256>"
  SHA="$2"; DIGEST="$3"
  valid_sha "$SHA" || die "SHA must be a full 40-character lowercase hex commit id"
  valid_digest "$DIGEST" || die "artifact digest must be 64 lowercase hex characters"
fi

# --- Serialize all promotions ------------------------------------------------------
install -d -m 0755 -o root -g root /run/lock
exec 9>"$ENTREPRENEURIA_LOCK"
if ! flock -n 9; then
  log "another promotion is running; waiting for the lock (max 600s)"
  flock -w 600 9 || die "timed out waiting for the promotion lock"
fi

load_app_conf "$APP"
assert_unique_port "$APP" "$CONF_PORT"
assert_runtime_env_safe "$APP"
[[ "$(cat "/srv/$APP/config/service.env")" == "PORT=$CONF_PORT" ]] || die "/srv/$APP/config/service.env does not match the app config (re-run provisioning)"

BASE="/srv/$APP"
UNIT="$(unit_name "$APP")"
RELEASES="$BASE/releases"
STATE="$BASE/state"
LIVE="$BASE/live/current"

for d in "$BASE" "$RELEASES" "$BASE/live" "$STATE" "$STATE/verified"; do
  [[ -d "$d" && ! -L "$d" && "$(stat -c '%U:%G' "$d")" == "root:root" ]] || die "$d must be a root-owned directory (run provisioning)"
done

# --- Build and publish a new release ----------------------------------------------
publish_release() {
  local artifact="/srv/build/$APP/out/$SHA.tar.gz" staged stage_dir actual mirror bad path mode
  [[ ! -e "$RELEASES/$SHA" ]] || { log "release $SHA already published; re-verifying it"; verify_release "$APP" "$SHA" || die "existing release $SHA failed verification"; return 0; }
  [[ -f "$artifact" && ! -L "$artifact" ]] || die "artifact not found: $artifact"

  install -d -m 0700 -o root -g root "$ENTREPRENEURIA_STAGING" "$ENTREPRENEURIA_MIRRORS"
  staged="$ENTREPRENEURIA_STAGING/$APP-$SHA.tar.gz"
  rm -f "$staged"
  # Copy first, then hash the copy: the build user cannot swap it afterwards.
  install -m 0600 -o root -g root "$artifact" "$staged"
  actual="$(sha256sum "$staged" | cut -d' ' -f1)"
  [[ "$actual" == "$DIGEST" ]] || { rm -f "$staged"; die "artifact digest mismatch (approved $DIGEST, found $actual)"; }

  # Reject absolute paths, '..' components, hard links, devices and FIFOs.
  bad="$(tar -tvzf "$staged" | awk '{t=substr($1,1,1); if (t!="-" && t!="d" && t!="l") print "type " t ": " $0}')"
  [[ -z "$bad" ]] || die "artifact contains disallowed member types: $(head -3 <<<"$bad")"
  if tar -tzf "$staged" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then die "artifact contains absolute or parent-relative paths"; fi

  stage_dir="$RELEASES/.staging-$SHA"
  rm -rf --one-file-system "$stage_dir"
  install -d -m 0700 -o root -g root "$stage_dir"
  tar -xzf "$staged" -C "$stage_dir" --no-same-owner --no-same-permissions --no-overwrite-dir
  chown -R -h root:root "$stage_dir"
  chmod -R u-s,g-s,go-w,u+rwX,go+rX "$stage_dir"
  chmod 0755 "$stage_dir"

  # Every symlink must stay inside the release.
  while IFS= read -r -d '' path; do
    local target; target="$(realpath -m -- "$path")"
    [[ "$target" == "$stage_dir" || "$target" == "$stage_dir"/* ]] || die "symlink escapes the release: ${path#"$stage_dir"/}"
  done < <(find "$stage_dir" -type l -print0)

  [[ -f "$stage_dir/.next/BUILD_ID" ]] || die "artifact has no .next/BUILD_ID"
  [[ -f "$stage_dir/node_modules/next/dist/bin/next" ]] || die "artifact has no node_modules/next/dist/bin/next"

  # Source integrity: tracked files must equal the approved commit from the configured repo.
  mirror="$ENTREPRENEURIA_MIRRORS/$APP.git"
  [[ -d "$mirror" ]] || git init -q --bare "$mirror"
  git -C "$mirror" fetch -q --depth 1 "$CONF_REPO_URL" "$SHA" || die "cannot fetch $SHA from $CONF_REPO_URL"
  [[ "$(git -C "$mirror" rev-parse FETCH_HEAD)" == "$SHA" ]] || die "fetched commit does not match $SHA"
  local mismatches=0
  while IFS= read -r -d '' entry; do
    mode="${entry%%$'\t'*}"; path="${entry#*$'\t'}"
    case "$path" in next-env.d.ts|tsconfig.json) continue ;; esac  # rewritten by `next build`; not used by `next start`
    if [[ "$mode" == "120000" ]]; then
      [[ -L "$stage_dir/$path" && "$(readlink "$stage_dir/$path")" == "$(git -C "$mirror" cat-file blob "$SHA:$path")" ]] || { log "source mismatch: $path"; mismatches=$((mismatches+1)); }
    elif [[ "$mode" == "160000" ]]; then
      continue
    else
      git -C "$mirror" cat-file blob "$SHA:$path" | cmp -s - "$stage_dir/$path" || { log "source mismatch: $path"; mismatches=$((mismatches+1)); }
    fi
  done < <(git -C "$mirror" ls-tree -r -z --format='%(objectmode)%x09%(path)' "$SHA")
  (( mismatches == 0 )) || die "$mismatches tracked file(s) in the artifact differ from $SHA"

  # Runtime cache lives outside the immutable release.
  rm -rf --one-file-system "$stage_dir/.next/cache"
  ln -s "$BASE/var/cache" "$stage_dir/.next/cache"
  printf 'app=%s\nrepo=%s\nsha=%s\nartifact_sha256=%s\npromoted_at=%s\n' \
    "$APP" "$CONF_REPO_URL" "$SHA" "$DIGEST" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$stage_dir/RELEASE"
  chmod 0644 "$stage_dir/RELEASE"

  mv -T "$stage_dir" "$RELEASES/$SHA"
  printf 'artifact=%s\ntree=%s\n' "$DIGEST" "$(tree_digest "$RELEASES/$SHA")" > "$STATE/verified/$SHA.tmp"
  chmod 0600 "$STATE/verified/$SHA.tmp"
  mv -T "$STATE/verified/$SHA.tmp" "$STATE/verified/$SHA"
  rm -f "$staged"
  log "published release $SHA"
}

set_pointer() {  # <sha>
  ln -sfn "$RELEASES/$1" "$BASE/live/.current.tmp"
  mv -T "$BASE/live/.current.tmp" "$LIVE"
}

clear_pointer() { rm -f "$LIVE" "$BASE/live/.current.tmp"; }

start_and_check() {  # <sha>; returns 0 only if restart AND readiness succeed
  set_pointer "$1"
  # Clear failed / start-limit state left by a previous failed release, or the
  # rollback restart would be refused by systemd.
  systemctl reset-failed "$UNIT" 2>/dev/null || true
  if ! systemctl restart "$UNIT"; then log "systemctl restart $UNIT failed"; return 1; fi
  health_check "$APP" "$1"
}

recover() {  # <failed sha or empty>
  local last=""
  [[ -f "$STATE/last-good" ]] && last="$(cat "$STATE/last-good")"
  if [[ -n "$last" && "$last" != "${1:-}" ]] && verify_release "$APP" "$last"; then
    log "rolling back to last verified good release $last"
    if start_and_check "$last"; then
      log "rolled back to $last and it is healthy"
      exit 3
    fi
    log "rollback release $last is not healthy either"
  else
    log "no trusted previous release to roll back to"
  fi
  systemctl stop "$UNIT" || true
  clear_pointer
  log "stopped $UNIT and cleared the release selection"
  exit 4
}

if [[ "$MODE" == "rollback" ]]; then
  [[ -f "$STATE/last-good" ]] || die "no last-good release recorded"
  SHA="$(cat "$STATE/last-good")"
  verify_release "$APP" "$SHA" || die "last-good release $SHA failed verification; not activating"
else
  publish_release
  verify_release "$APP" "$SHA" || die "release $SHA failed verification after publishing"
fi

EXIT_CODE=4
trap 'log "unexpected error during activation"; recover "$SHA"' ERR
if start_and_check "$SHA"; then
  trap - ERR
  printf '%s\n' "$SHA" > "$STATE/.last-good.tmp"; mv -T "$STATE/.last-good.tmp" "$STATE/last-good"
  systemctl is-enabled --quiet "$UNIT" || systemctl enable --quiet "$UNIT"
  log "activated $APP @ $SHA (enabled at boot)"
  exit 0
fi
trap - ERR
log "activation of $SHA failed"
recover "$SHA"

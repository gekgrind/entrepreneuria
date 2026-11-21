#!/usr/bin/env bash
# Trusted promotion. Installed root-owned as /usr/local/sbin/entrepreneuria-promote.
# Run ONLY by the operator (root via their own admin sudo); no sudoers rule grants
# it to the build, stage or runtime users.
#
#   entrepreneuria-promote <app> <40-hex-sha> <64-hex-artifact-sha256>   promote/re-activate
#   entrepreneuria-promote <app> --rollback <sha> <artifact-sha256>      re-activate the verified boot selection
#   entrepreneuria-promote <app> --recover                               clean up an interrupted promotion
#
# Boot safety: the PERSISTENT selection is /srv/<app>/live/current and it only ever
# points at a release that passed readiness. A candidate runs through a RUNTIME drop-in
# in /run/systemd/system (tmpfs), so a reboot or crash mid-promotion can only ever
# boot the verified selection.
#
# Exit codes: 0 activated | 2 rejected before activation | 3 failed, rolled back to the
# verified selection | 4 failed, nothing trusted to run: unit stopped (confirmed) and
# selection cleared | 5 UNSAFE: stop or cleanup could not be confirmed — operator action
set -Eeuo pipefail
umask 077
# shellcheck source=../lib/common.sh
. /usr/local/lib/entrepreneuria/common.sh

EXIT_CODE=2
MAX_ARTIFACT_BYTES=$((4 * 1024 * 1024 * 1024))
[[ $EUID -eq 0 ]] || die "must run as root"
usage="usage: entrepreneuria-promote <app> <sha> <artifact-sha256> | <app> --rollback <sha> <artifact-sha256> | <app> --recover"
[[ $# -ge 2 ]] || die "$usage"
APP="$1"; valid_app "$APP" || die "invalid app name"
case "$2" in
  --recover)  [[ $# -eq 2 ]] || die "$usage"; MODE=recover; SHA=""; DIGEST="" ;;
  --rollback) [[ $# -eq 4 ]] || die "$usage"; MODE=rollback; SHA="$3"; DIGEST="$4" ;;
  *)          [[ $# -eq 3 ]] || die "$usage"; MODE=promote; SHA="$2"; DIGEST="$3" ;;
esac
if [[ "$MODE" != recover ]]; then
  valid_sha "$SHA" || die "SHA must be a full 40-character lowercase hex commit id"
  valid_digest "$DIGEST" || die "artifact digest must be 64 lowercase hex characters"
fi

load_app_conf "$APP"
BASE="/srv/$APP"; UNIT="$(unit_name "$APP")"
RELEASES="$BASE/releases"; STATE="$BASE/state"; LIVE="$BASE/live/current"
VARD="$(app_var "$APP")"; STAGE_USER="stage-$APP"
DROPIN_DIR="$(candidate_dropin_dir "$APP")"; DROPIN="$(candidate_dropin "$APP")"; MARKER="$(candidate_marker "$APP")"

assert_trusted_dir "$VARD" root:root 0711
acquire_app_lock "$APP"
assert_unique_port "$APP" "$CONF_PORT"
assert_runtime_env_safe "$APP"
[[ "$(cat "$BASE/config/service.env")" == "PORT=$CONF_PORT" ]] || die "$BASE/config/service.env does not match the app config (re-run provisioning)"
for d in "$RELEASES:root:root:0755" "$BASE/live:root:root:0755" "$STATE:root:root:0700" "$STATE/verified:root:root:0700" \
         "$VARD/artifacts:root:root:0700" "$VARD/extract:root:root:0711"; do
  IFS=: read -r p o g m <<<"$d"; assert_trusted_dir "$p" "$o:$g" "$m"
done
assert_trusted_dir "$BASE/var" "app-$APP:app-$APP" 0700
# var/ is runtime-owned by design, so its child is checked directly (real dir, exact owner/mode).
[[ -d "$BASE/var/cache" && ! -L "$BASE/var/cache" && "$(stat -c '%U:%G %a' "$BASE/var/cache")" == "app-$APP:app-$APP 700" ]] \
  || die "$BASE/var/cache must be a real app-$APP:app-$APP 0700 directory"

# --- Publication: unprivileged extraction, full validation, then root-owned copy ----------
publish_release() {
  local artifact="/srv/build/$APP/out/$SHA.tar.gz" staged="$VARD/artifacts/$SHA.tar.gz"
  local ex="$VARD/extract/$SHA" stage_dir="$RELEASES/.staging-$SHA" mirror="$VARD/mirror.git" manifest actual

  rm -f -- "$staged"
  # Root never opens the build-controlled path. The BUILD user opens its own artifact
  # (O_NOFOLLOW, regular file only, size-bounded) and streams it into a fresh root-only
  # file; the digest is then computed over that root-owned copy.
  ( set -o noclobber; umask 077
    runuser -u "build-$APP" -- python3 -I -S "$ENTREPRENEURIA_LIB_DIR/archive_tool.py" read "$artifact" "$MAX_ARTIFACT_BYTES" > "$staged" ) \
    || { rm -f -- "$staged"; die "artifact could not be read safely as build-$APP: $artifact"; }
  [[ -f "$staged" && ! -L "$staged" && "$(stat -c '%U:%G %a %h' "$staged")" == "root:root 600 1" ]] || die "staged artifact is not a private root file"
  actual="$(sha256sum "$staged" | cut -d' ' -f1)"
  [[ "$actual" == "$DIGEST" ]] || die "artifact digest mismatch (approved $DIGEST, found $actual)"

  # 1. Validate every member (read-only) before anything is written.
  python3 -I -S "$ENTREPRENEURIA_LIB_DIR/archive_tool.py" check "$staged" >/dev/null || die "artifact failed archive validation"

  # 2. Extract as the unprivileged stage user into a fresh confined directory.
  pkill -KILL -u "$STAGE_USER" 2>/dev/null || true
  rm -rf --one-file-system -- "$ex"
  install -d -m 0700 -o "$STAGE_USER" -g "$STAGE_USER" -- "$ex"
  runuser -u "$STAGE_USER" -- python3 -I -S "$ENTREPRENEURIA_LIB_DIR/archive_tool.py" extract "$ex" < "$staged" >/dev/null \
    || die "unprivileged extraction failed"
  pkill -KILL -u "$STAGE_USER" 2>/dev/null || true

  # 3. Copy into a fresh root-owned directory without following links, then prove the
  #    copy equals the approved archive exactly (paths, types, links, exec bits, content).
  rm -rf --one-file-system -- "$stage_dir"
  install -d -m 0700 -o root -g root -- "$stage_dir"
  cp -R --no-dereference --preserve=mode --no-preserve=ownership,timestamps -- "$ex/." "$stage_dir/" || die "copy of the extracted tree failed"
  rm -rf --one-file-system -- "$ex"
  python3 -I -S "$ENTREPRENEURIA_LIB_DIR/archive_tool.py" compare "$staged" "$stage_dir" >/dev/null || die "copied tree does not match the approved archive"

  # 4. Normalise modes on the root-owned tree (find does not follow symlinks).
  find "$stage_dir" -type d -exec chmod 0755 {} +
  find "$stage_dir" -type f -perm /111 -exec chmod 0755 {} +
  find "$stage_dir" -type f ! -perm /111 -exec chmod 0644 {} +
  [[ -f "$stage_dir/.next/BUILD_ID" && ! -L "$stage_dir/.next" ]] || die "artifact has no .next/BUILD_ID"
  [[ -f "$stage_dir/node_modules/next/dist/bin/next" ]] || die "artifact has no node_modules/next/dist/bin/next"

  # 5. Source integrity: the complete manifest of the approved commit from the configured repo.
  [[ -d "$mirror" ]] || git init -q --bare -- "$mirror"
  git -C "$mirror" fetch -q --depth 1 -- "$CONF_REPO_URL" "$SHA" || die "cannot fetch $SHA from $CONF_REPO_URL"
  [[ "$(git -C "$mirror" rev-parse --verify -q "FETCH_HEAD^{commit}")" == "$SHA" ]] || die "fetched commit does not match $SHA"
  manifest="$(mktemp)"
  git -C "$mirror" ls-tree -r -z --full-tree --format='%(objectmode)%x09%(path)' "$SHA" > "$manifest" \
    || { rm -f "$manifest"; die "git manifest generation failed for $SHA"; }
  [[ -s "$manifest" && "$(tail -c1 "$manifest" | od -An -c | tr -d ' ')" == '\0' ]] || { rm -f "$manifest"; die "git manifest is empty or truncated"; }
  local expected_count; expected_count="$(git -C "$mirror" ls-tree -r -z --full-tree --name-only "$SHA" | tr -cd '\0' | wc -c)" \
    || { rm -f "$manifest"; die "git manifest count failed"; }
  [[ "$expected_count" == "$(tr -cd '\0' < "$manifest" | wc -c)" && "$expected_count" -gt 0 ]] || { rm -f "$manifest"; die "git manifest incomplete"; }

  local entry mode path blob mismatches=0 n=0
  blob="$(mktemp)"
  while IFS= read -r -d '' entry; do
    n=$((n+1))
    mode="${entry%%$'\t'*}"; path="${entry#*$'\t'}"
    [[ -n "$path" && "$path" != "$entry" ]] || { log "malformed manifest entry"; mismatches=$((mismatches+1)); continue; }
    case "$path" in next-env.d.ts|tsconfig.json) continue ;; esac  # rewritten by `next build`; unused by `next start`
    local f="$stage_dir/$path"
    git -C "$mirror" cat-file blob "$SHA:$path" > "$blob" || { log "cannot read $path from $SHA"; mismatches=$((mismatches+1)); continue; }
    case "$mode" in
      100644|100755)
        if [[ -L "$f" || ! -f "$f" ]]; then log "source type mismatch (expected file): $path"; mismatches=$((mismatches+1)); continue; fi
        if [[ "$mode" == 100755 && ! -x "$f" ]] || [[ "$mode" == 100644 && -x "$f" ]]; then log "source mode mismatch ($mode): $path"; mismatches=$((mismatches+1)); continue; fi
        cmp -s -- "$blob" "$f" || { log "source content mismatch: $path"; mismatches=$((mismatches+1)); } ;;
      120000)
        [[ -L "$f" && "$(readlink -- "$f")" == "$(cat "$blob")" ]] || { log "source symlink mismatch: $path"; mismatches=$((mismatches+1)); } ;;
      *) log "unsupported tracked entry ($mode): $path"; mismatches=$((mismatches+1)) ;;
    esac
  done < "$manifest"
  rm -f "$manifest" "$blob"
  [[ "$n" == "$expected_count" ]] || die "source verification enumerated $n of $expected_count entries"
  (( mismatches == 0 )) || die "$mismatches tracked entr(y/ies) in the artifact differ from $SHA"

  # 6. Promoter-owned paths, created only now, in a tree that is entirely root-owned.
  [[ -d "$stage_dir/.next" && ! -L "$stage_dir/.next" && ! -e "$stage_dir/.next/cache" && ! -L "$stage_dir/.next/cache" ]] || die ".next/cache must not be supplied by the artifact"
  ln -s -- "$BASE/var/cache" "$stage_dir/.next/cache"
  [[ ! -e "$stage_dir/RELEASE" && ! -L "$stage_dir/RELEASE" ]] || die "RELEASE must not be supplied by the artifact"
  ( set -o noclobber; printf 'app=%s\nrepo=%s\nsha=%s\nartifact_sha256=%s\npromoted_at=%s\n' \
      "$APP" "$CONF_REPO_URL" "$SHA" "$DIGEST" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$stage_dir/RELEASE" )
  chmod 0644 "$stage_dir/RELEASE"
  chmod 0755 "$stage_dir"

  # 7. Validate the FINAL tree (cache link attached) before it can be recorded or run.
  release_policy "$APP" "$stage_dir" || die "final release tree violates the symlink policy"

  # 8. Durable publication: tree flushed before it becomes visible, record written last.
  #    A release directory without a record (interrupted publication) is never activated
  #    and is quarantined by the next promotion.
  [[ ! -e "$RELEASES/$SHA" ]] || die "release $SHA appeared concurrently"
  sync
  mv -T -- "$stage_dir" "$RELEASES/$SHA"
  sync
  ( set -o noclobber; printf 'app=%s\nrepo=%s\nsha=%s\nartifact=%s\ntree=%s\n' \
      "$APP" "$CONF_REPO_URL" "$SHA" "$DIGEST" "$(tree_digest "$RELEASES/$SHA")" > "$STATE/verified/.$SHA.tmp" )
  chmod 0600 "$STATE/verified/.$SHA.tmp"
  sync
  mv -T -- "$STATE/verified/.$SHA.tmp" "$STATE/verified/$SHA"
  sync
  rm -f -- "$staged"
  log "published release $SHA"
}

# A release directory with no verification record is an interrupted publication:
# move it aside (never selectable: not a 40-hex name) so it can be republished.
quarantine_incomplete() {  # <sha>
  local q="$RELEASES/.incomplete-$1-$(date -u +%Y%m%dT%H%M%SZ)"
  mv -T -- "$RELEASES/$1" "$q" || die "could not quarantine incomplete release $1"
  rm -f -- "$STATE/verified/.$1.tmp"
  sync
  log "quarantined incomplete publication of $1 as ${q##*/}"
}

# --- Candidate selection (runtime only) ------------------------------------------------
set_candidate() {  # <sha>
  install -d -m 0755 -o root -g root -- "$DROPIN_DIR" "$(dirname "$MARKER")" || return 1
  printf '%s\n' "$1" > "$MARKER.tmp" && mv -T -- "$MARKER.tmp" "$MARKER" || return 1
  printf '[Unit]\nConditionPathIsSymbolicLink=\nConditionPathIsDirectory=%s\n[Service]\nWorkingDirectory=%s\n' \
    "$RELEASES/$1" "$RELEASES/$1" > "$DROPIN.tmp" && mv -T -- "$DROPIN.tmp" "$DROPIN" || return 1
  systemctl daemon-reload || return 1
  [[ "$(systemctl show -p WorkingDirectory --value "$UNIT")" == "$RELEASES/$1" ]] || { log "candidate drop-in not in effect"; return 1; }
}

# Ordering: the drop-in and marker are removed BEFORE daemon-reload. If we are
# interrupted in between, systemd may still hold the candidate WorkingDirectory in
# memory; the pre-start gate then sees a working directory that is not live/current
# and refuses to start (fail closed) until `--recover` reloads systemd.
clear_candidate() {
  local ok=0
  rm -f -- "$DROPIN" "$DROPIN.tmp" "$MARKER" "$MARKER.tmp" || ok=1
  [[ ! -e "$DROPIN" && ! -e "$MARKER" ]] || ok=1
  systemctl daemon-reload || ok=1
  (( ok == 0 )) || log "could not clear the candidate selection"
  return $ok
}

# Persistently select a release that passed readiness.
approve() {  # <sha>
  ln -sfn -- "$RELEASES/$1" "$BASE/live/.current.tmp" || return 1
  mv -T -- "$BASE/live/.current.tmp" "$LIVE" || return 1
  [[ "$(readlink "$LIVE")" == "$RELEASES/$1" ]] || return 1
  sync
  clear_candidate || return 1
  systemctl is-enabled --quiet "$UNIT" || systemctl enable --quiet "$UNIT" || return 1
}

restart_unit() {
  systemctl reset-failed "$UNIT" 2>/dev/null || true
  systemctl restart "$UNIT" || { log "systemctl restart $UNIT failed"; return 1; }
}

unsafe() { log "UNSAFE: $*. Operator action required."; exit 5; }

# Take the app out of service with NO boot selection: quarantine the persistent
# selection (recorded in state/quarantine, then removed) and disable boot start FIRST,
# then stop and confirm. Any step that cannot be confirmed is reported UNSAFE (exit 5);
# the selection is cleared even when the stop itself cannot be confirmed.
quarantine_and_stop() {  # <reason>
  local problems=() sel=""
  sel="$(readlink "$LIVE" 2>/dev/null || true)"
  if [[ -n "$sel" ]]; then
    printf '%s %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${sel##*/}" "$1" >> "$STATE/quarantine" || problems+=("could not record quarantine")
    chmod 0600 "$STATE/quarantine" 2>/dev/null || true
  fi
  if [[ -e "$LIVE" || -L "$LIVE" ]]; then rm -f -- "$LIVE" || true; fi
  [[ ! -e "$LIVE" && ! -L "$LIVE" ]] || problems+=("could not clear $LIVE")
  systemctl disable --quiet "$UNIT" || problems+=("could not disable $UNIT")
  ! systemctl is-enabled --quiet "$UNIT" || problems+=("$UNIT still enabled at boot")
  sync
  stop_and_confirm "$APP" || problems+=("could not confirm $UNIT is stopped and its port closed")
  (( ${#problems[@]} == 0 )) || unsafe "$(IFS='; '; echo "${problems[*]}")"
  log "stopped $UNIT (confirmed: unit inactive, port closed); no boot selection, unit disabled${sel:+; quarantined ${sel##*/}: $1}"
}

# One recovery path for every failure: back to the verified boot selection, or stop.
recover() {
  trap - ERR INT TERM HUP
  if ! clear_candidate; then
    stop_and_confirm "$APP" || true
    unsafe "candidate selection could not be cleared; the unit was told to stop"
  fi
  local good=""; good="$(current_release "$APP" || true)"
  if [[ -n "$good" ]] && verify_release "$APP" "$good"; then
    log "rolling back to the verified selection $good"
    if restart_unit && health_check "$APP" "$good"; then
      log "rolled back to $good and it is healthy"; exit "${1:-3}"
    fi
    log "verified selection $good is not healthy either"
    quarantine_and_stop "fallback failed readiness"
    exit 4
  fi
  if [[ -n "$good" ]]; then
    log "current selection $good failed verification"
    quarantine_and_stop "failed verification"
  else
    log "no verified release selected"
    quarantine_and_stop "no selection"
  fi
  exit 4
}

# --- Main --------------------------------------------------------------------------------
if [[ "$MODE" == recover ]]; then
  [[ -e "$MARKER" ]] && log "found interrupted candidate $(cat "$MARKER" 2>/dev/null)" || log "no interrupted candidate recorded"
  recover 0
fi

if [[ -e "$MARKER" || -e "$DROPIN" ]]; then
  die "an interrupted promotion is pending (candidate $(cat "$MARKER" 2>/dev/null || echo '?')); run: entrepreneuria-promote $APP --recover"
fi

case "$MODE" in
  rollback)
    [[ "$(current_release "$APP" || true)" == "$SHA" ]] || die "$SHA is not the verified boot selection"
    verify_release "$APP" "$SHA" "$DIGEST" || die "release $SHA failed verification against the approved digest" ;;
  promote)
    if [[ -d "$RELEASES/$SHA" && ! -L "$RELEASES/$SHA" && ! -e "$STATE/verified/$SHA" ]]; then
      quarantine_incomplete "$SHA"
    fi
    if [[ -e "$RELEASES/$SHA" || -L "$RELEASES/$SHA" ]]; then
      log "release $SHA already published; verifying it against the approved digest"
      verify_release "$APP" "$SHA" "$DIGEST" || die "existing release $SHA does not match the approved artifact"
    else
      publish_release
      verify_release "$APP" "$SHA" "$DIGEST" || die "release $SHA failed verification after publishing"
    fi ;;
esac

EXIT_CODE=4
trap 'log "unexpected error during activation"; recover' ERR
trap 'log "interrupted"; recover' INT TERM HUP
if set_candidate "$SHA" && restart_unit && health_check "$APP" "$SHA"; then
  if approve "$SHA"; then
    trap - ERR INT TERM HUP
    log "activated $APP @ $SHA (verified boot selection, enabled at boot)"
    exit 0
  fi
  log "approval of $SHA failed"
else
  log "activation of $SHA failed"
fi
recover

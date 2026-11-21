#!/usr/bin/env bash
# Provision one app's isolated runtime on the CLEAN rebuilt VPS. Run as root.
#
#   ops/vps/bin/provision-app.sh <app>            # dry run: validate and print the plan
#   ops/vps/bin/provision-app.sh <app> --apply    # make changes
#
# Precondition: the operator has written /etc/entrepreneuria/apps/<app>.conf
# (root:root 0644, see ops/vps/apps/*.conf.example).
#
# Creates or validates:
#   - runtime user app-<app> and build user build-<app>: system users, nologin,
#     no sudo, no SSH, no supplementary groups
#   - /srv/<app> (root-owned releases, live pointer and state; runtime-only var;
#     root-only secrets) and /srv/build/<app> (build user only)
#   - root-owned copies of the scripts in /usr/local/{lib/entrepreneuria,sbin,bin}
#   - the systemd template unit and a MemoryMax drop-in
# It grants NO sudo rights, never writes secret values, never overwrites an
# existing secrets/config file, and never starts or enables the service.
# It REFUSES to continue if a pre-existing user, path or sudoers entry does not
# match the expected safe state; it does not "repair" unexpected states.
set -Eeuo pipefail

usage() { echo "usage: $0 <app> [--apply]" >&2; exit 2; }
APPLY=0
[[ $# -ge 1 && $# -le 2 ]] || usage
APP="$1"
[[ $# -eq 2 ]] && { [[ "$2" == "--apply" ]] || usage; APPLY=1; }

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../lib/common.sh
. "$SRC/lib/common.sh"

valid_app "$APP" || die "invalid app name: $APP"
[[ $EUID -eq 0 ]] || die "must run as root"
[[ -x /usr/bin/node ]] || die "/usr/bin/node not found (install Node 22 LTS first)"
for cmd in git curl ss flock systemctl sha256sum tar realpath runuser python3; do command -v "$cmd" >/dev/null || die "missing $cmd"; done
python3 -I -S -c 'import tarfile, sys; tarfile.data_filter; sys.exit(0 if sys.version_info >= (3, 12) else 1)' 2>/dev/null \
  || die "python3 >= 3.12 with tarfile data filters is required (Ubuntu 24.04 ships 3.12)"
load_app_conf "$APP"
assert_unique_port "$APP" "$CONF_PORT"

RUN_USER="app-$APP"
BUILD_USER="build-$APP"
STAGE_USER="stage-$APP"
VARD="/var/lib/entrepreneuria/$APP"
BASE="/srv/$APP"
BROOT="/srv/build/$APP"
UNIT="$(unit_name "$APP")"

run() { if (( APPLY )); then "$@"; else printf '[dry-run]'; printf ' %q' "$@"; echo; fi; }

# --- Identities: create, or accept only an exactly-safe existing account ----------
check_or_create_user() {
  local user="$1" home="$2" entry uid shell groups
  if entry="$(getent passwd "$user")"; then
    IFS=: read -r _ _ uid _ _ _ shell <<<"$entry"
    (( uid > 0 && uid < 1000 )) || die "existing $user is not a system account (uid $uid)"
    [[ "$shell" == "/usr/sbin/nologin" ]] || die "existing $user has login shell $shell"
    groups="$(id -nG "$user")"
    [[ "$groups" == "$user" ]] || die "existing $user has unexpected groups: $groups"
    [[ ! -e "/home/$user/.ssh" ]] || die "existing $user has SSH configuration"
    echo "ok: existing $user"
  else
    run useradd --system --user-group --no-create-home --home-dir "$home" --shell /usr/sbin/nologin "$user"
  fi
}
check_or_create_user "$RUN_USER" /nonexistent
check_or_create_user "$BUILD_USER" "$BROOT/home"
check_or_create_user "$STAGE_USER" /nonexistent

# No sudo for either account, anywhere.
if grep -RqsE "(^|[^a-z0-9-])($RUN_USER|$BUILD_USER|$STAGE_USER)([^a-z0-9-]|$)" /etc/sudoers /etc/sudoers.d; then
  die "sudoers mentions $RUN_USER, $BUILD_USER or $STAGE_USER; remove that entry first"
fi

# --- Paths: create, or accept only exact owner/mode; never follow symlinks --------
ensure_dir() {  # <path> <mode> <owner:group>
  local path="$1" mode="$2" owner="$3"
  if [[ -L "$path" ]]; then die "$path is a symlink"; fi
  if [[ -e "$path" ]]; then
    [[ -d "$path" ]] || die "$path exists and is not a directory"
    [[ "$(stat -c '%U:%G %a' "$path")" == "$owner ${mode#0}" ]] || die "$path is $(stat -c '%U:%G %a' "$path"), expected $owner ${mode#0}"
    echo "ok: $path"
  else
    run install -d -m "$mode" -o "${owner%%:*}" -g "${owner##*:}" "$path"
  fi
}
ensure_file() {  # <path> <mode> <owner:group> <initial content>
  local path="$1" mode="$2" owner="$3" content="$4"
  if [[ -L "$path" ]]; then die "$path is a symlink"; fi
  if [[ -e "$path" ]]; then
    [[ "$(stat -c '%U:%G %a' "$path")" == "$owner ${mode#0}" ]] || die "$path is $(stat -c '%U:%G %a' "$path"), expected $owner ${mode#0}"
    echo "ok: $path (kept)"
  elif (( APPLY )); then
    local tmp; tmp="$(mktemp)"; printf '%s' "$content" > "$tmp"
    install -m "$mode" -o "${owner%%:*}" -g "${owner##*:}" "$tmp" "$path"; rm -f "$tmp"
  else
    echo "[dry-run] write $path ($mode $owner)"
  fi
}

# In dry-run the new users may not exist yet; ownership checks run on --apply.
ensure_dir /srv                     0755 root:root
ensure_dir "$BASE"                  0755 root:root
ensure_dir "$BASE/releases"         0755 root:root
ensure_dir "$BASE/live"             0755 root:root
ensure_dir "$BASE/state"            0700 root:root
ensure_dir "$BASE/state/verified"   0700 root:root
ensure_dir "$BASE/config"           0755 root:root
ensure_dir "$BASE/secrets"          0700 root:root
ensure_dir "$BASE/var"              0700 "$RUN_USER:$RUN_USER"
ensure_dir "$BASE/var/cache"        0700 "$RUN_USER:$RUN_USER"
ensure_dir /srv/build               0755 root:root
ensure_dir "$BROOT"                 0700 "$BUILD_USER:$BUILD_USER"
# Promoter-private state: lock, staged artifact copies, source mirror, confined extraction.
ensure_dir /var/lib/entrepreneuria  0755 root:root
ensure_dir "$VARD"                  0711 root:root
ensure_dir "$VARD/lock"             0700 root:root
ensure_dir "$VARD/artifacts"        0700 root:root
ensure_dir "$VARD/extract"          0711 root:root

ensure_file "$BASE/config/build.env"    0640 "root:$BUILD_USER" "# Build-time PUBLIC values only (NEXT_PUBLIC_*). Never secrets.
"
ensure_file "$BASE/secrets/runtime.env" 0600 root:root "# Runtime secrets for $APP. NEW (rotated) values only. Must not set PORT, HOSTNAME or NODE_OPTIONS.
"
# service.env is derived from the app config on every run.
if (( APPLY )); then
  printf 'PORT=%s' "$CONF_PORT" > "$BASE/config/.service.env.tmp"
  chown root:root "$BASE/config/.service.env.tmp"; chmod 0644 "$BASE/config/.service.env.tmp"
  mv -T "$BASE/config/.service.env.tmp" "$BASE/config/service.env"
else
  echo "[dry-run] write $BASE/config/service.env (PORT=$CONF_PORT)"
fi

# --- Root-owned installed tooling (what actually runs) -----------------------------
run install -d -m 0755 -o root -g root /usr/local/lib/entrepreneuria
run install -m 0644 -o root -g root "$SRC/lib/common.sh"            /usr/local/lib/entrepreneuria/common.sh
run install -m 0644 -o root -g root "$SRC/lib/archive_tool.py"      /usr/local/lib/entrepreneuria/archive_tool.py
run install -m 0700 -o root -g root "$SRC/bin/prepare-acme-webroot.sh" /usr/local/sbin/entrepreneuria-acme-webroot
run install -m 0700 -o root -g root "$SRC/bin/promote-release.sh"   /usr/local/sbin/entrepreneuria-promote
run install -m 0700 -o root -g root "$SRC/bin/verify-app.sh"        /usr/local/sbin/entrepreneuria-verify
run install -m 0700 -o root -g root "$SRC/bin/boot-check.sh"        /usr/local/sbin/entrepreneuria-boot-check
run install -m 0755 -o root -g root "$SRC/bin/build-release.sh"     /usr/local/bin/entrepreneuria-build

# --- systemd ------------------------------------------------------------------------
run install -m 0644 -o root -g root "$SRC/systemd/entrepreneuria-app@.service" /etc/systemd/system/entrepreneuria-app@.service
run install -d -m 0755 -o root -g root "/etc/systemd/system/$UNIT.d"
if (( APPLY )); then
  printf '[Service]\nMemoryMax=%s\n' "$CONF_MEMORY_MAX" > "/etc/systemd/system/$UNIT.d/limits.conf"
  chmod 0644 "/etc/systemd/system/$UNIT.d/limits.conf"
else
  echo "[dry-run] write /etc/systemd/system/$UNIT.d/limits.conf (MemoryMax=$CONF_MEMORY_MAX)"
fi
run systemctl daemon-reload

echo
echo "Next (manual, as an administrator):"
echo "  1. fill $BASE/secrets/runtime.env (rotated values) and $BASE/config/build.env (public values)"
echo "  2. sudo -u $BUILD_USER /usr/local/bin/entrepreneuria-build $APP <approved-sha>"
echo "  3. sudo /usr/local/sbin/entrepreneuria-promote $APP <approved-sha> <artifact-sha256>"
echo "  4. sudo /usr/local/sbin/entrepreneuria-verify $APP"
(( APPLY )) || echo "Dry run only. Re-run with --apply to make these changes."

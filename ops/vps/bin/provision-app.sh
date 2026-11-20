#!/usr/bin/env bash
# Provision one app's isolated runtime on the CLEAN rebuilt VPS.
#
#   sudo ops/vps/bin/provision-app.sh <app> <port> [memory_max]          # dry run (default)
#   sudo ops/vps/bin/provision-app.sh <app> <port> [memory_max] --apply  # make changes
#
# Creates: runtime user app-<app> (no sudo, no shell, no home), the shared
# `deploy` user if missing, the /srv/<app> tree with the permissions in
# ops/vps/README.md, the systemd unit + limits drop-in, and ONE narrow sudoers
# rule letting `deploy` restart only this app's unit.
#
# It never writes secret values: it creates an empty root-only runtime.env and
# leaves it for an administrator to fill. It never overwrites an existing
# secrets or config file. It does not start or enable the service.
#
# NOT EXECUTED during recovery planning. Run only on the freshly provisioned
# host, as root, after the README's preconditions are met.
set -euo pipefail

usage() { echo "usage: $0 <app> <port> [memory_max e.g. 2G] [--apply]" >&2; exit 2; }

APPLY=0
ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--apply" ]]; then APPLY=1; else ARGS+=("$arg"); fi
done
[[ ${#ARGS[@]} -ge 2 && ${#ARGS[@]} -le 3 ]] || usage
APP="${ARGS[0]}"
PORT="${ARGS[1]}"
MEMORY_MAX="${ARGS[2]:-2G}"

[[ "$APP" =~ ^[a-z][a-z0-9-]{1,30}$ ]] || { echo "invalid app name: $APP" >&2; exit 2; }
[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 1024 && PORT <= 65535 )) || { echo "invalid port: $PORT" >&2; exit 2; }
[[ "$MEMORY_MAX" =~ ^[0-9]+[KMG]$ ]] || { echo "invalid memory_max: $MEMORY_MAX" >&2; exit 2; }
[[ $EUID -eq 0 ]] || { echo "must run as root" >&2; exit 1; }
command -v /usr/bin/node >/dev/null || { echo "/usr/bin/node not found (install Node 22 LTS first)" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNIT_SRC="$SCRIPT_DIR/../systemd/entrepreneuria-app@.service"
[[ -f "$UNIT_SRC" ]] || { echo "unit template not found: $UNIT_SRC" >&2; exit 1; }

RUN_USER="app-$APP"
BASE="/srv/$APP"
UNIT="entrepreneuria-app@$APP.service"

run() {
  if (( APPLY )); then "$@"; else printf '[dry-run]'; printf ' %q' "$@"; echo; fi
}

# write_file <path> <mode> <owner:group> <content>  — skips existing files.
write_file() {
  local path="$1" mode="$2" owner="$3" content="$4"
  if [[ -e "$path" ]]; then echo "keep existing $path"; return; fi
  if (( APPLY )); then
    local tmp; tmp="$(mktemp)"
    printf '%s' "$content" > "$tmp"
    install -m "$mode" -o "${owner%%:*}" -g "${owner##*:}" "$tmp" "$path"
    rm -f "$tmp"
  else
    echo "[dry-run] write $path ($mode $owner)"
  fi
}

ensure_dir() { run install -d -m "$2" -o "${3%%:*}" -g "${3##*:}" "$1"; }

# --- Identities -----------------------------------------------------------------
if ! id deploy >/dev/null 2>&1; then
  run useradd --create-home --shell /bin/bash --user-group deploy
fi
if id "$RUN_USER" >/dev/null 2>&1; then
  echo "keep existing user $RUN_USER"
else
  run useradd --system --user-group --no-create-home --home-dir /nonexistent \
    --shell /usr/sbin/nologin "$RUN_USER"
fi
# Neither user may hold sudo/admin group membership.
for u in deploy "$RUN_USER"; do
  if id "$u" >/dev/null 2>&1 && id -nG "$u" | grep -Eqw 'sudo|admin|wheel'; then
    echo "REFUSING: $u is in an administrative group" >&2; exit 1
  fi
done

# --- Filesystem -----------------------------------------------------------------
ensure_dir "$BASE"            0755 root:root
ensure_dir "$BASE/releases"   0755 deploy:deploy
ensure_dir "$BASE/live"       0755 deploy:deploy
ensure_dir "$BASE/config"     0755 root:root
ensure_dir "$BASE/secrets"    0700 root:root
ensure_dir "$BASE/var"        0700 "$RUN_USER:$RUN_USER"
ensure_dir "$BASE/var/cache"  0700 "$RUN_USER:$RUN_USER"

write_file "$BASE/config/service.env" 0644 root:root "PORT=$PORT
"
write_file "$BASE/config/build.env" 0640 root:deploy "# Build-time PUBLIC values only (NEXT_PUBLIC_*). Never secrets.
"
write_file "$BASE/secrets/runtime.env" 0600 root:root "# Runtime secrets for $APP. Fill from the NEW (rotated) values only.
"

# --- systemd --------------------------------------------------------------------
run install -m 0644 -o root -g root "$UNIT_SRC" /etc/systemd/system/entrepreneuria-app@.service
run install -d -m 0755 -o root -g root "/etc/systemd/system/$UNIT.d"
if (( APPLY )); then
  printf '[Service]\nMemoryMax=%s\n' "$MEMORY_MAX" > "/etc/systemd/system/$UNIT.d/limits.conf"
  chmod 0644 "/etc/systemd/system/$UNIT.d/limits.conf"
else
  echo "[dry-run] write /etc/systemd/system/$UNIT.d/limits.conf (MemoryMax=$MEMORY_MAX)"
fi
run systemctl daemon-reload

# --- One narrow sudo rule for deploy ---------------------------------------------
SUDOERS="/etc/sudoers.d/entrepreneuria-deploy-$APP"
RULE="deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart $UNIT"
if (( APPLY )); then
  tmp="$(mktemp)"; printf '%s\n' "$RULE" > "$tmp"
  visudo -cf "$tmp" >/dev/null
  install -m 0440 -o root -g root "$tmp" "$SUDOERS"
  rm -f "$tmp"
else
  echo "[dry-run] write $SUDOERS (0440): $RULE"
fi

echo
echo "Next (manual): fill $BASE/secrets/runtime.env and $BASE/config/build.env,"
echo "deploy a release with ops/vps/bin/deploy-release.sh as 'deploy', then:"
echo "  systemctl enable --now $UNIT && ops/vps/bin/verify-app.sh $APP"
(( APPLY )) || echo "Dry run only. Re-run with --apply to make these changes."

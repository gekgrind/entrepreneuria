# shellcheck shell=bash
# Shared helpers for the Entrepreneuria VPS scripts.
# Installed root-owned at /usr/local/lib/entrepreneuria/common.sh by
# provision-app.sh; the installed copies are what run, never a checkout.

ENTREPRENEURIA_CONF_DIR="${ENTREPRENEURIA_CONF_DIR:-/etc/entrepreneuria/apps}"
ENTREPRENEURIA_LIB_DIR="/usr/local/lib/entrepreneuria"
ENTREPRENEURIA_LOCK="/run/lock/entrepreneuria-promote.lock"
ENTREPRENEURIA_STAGING="/var/lib/entrepreneuria/staging"
ENTREPRENEURIA_MIRRORS="/var/lib/entrepreneuria/mirrors"

die() { echo "ERROR: $*" >&2; exit "${EXIT_CODE:-1}"; }
log() { echo "[$(date -u +%H:%M:%S)] $*" >&2; }

valid_app() { [[ "$1" =~ ^[a-z][a-z0-9-]{1,30}$ ]]; }
valid_sha() { [[ "$1" =~ ^[0-9a-f]{40}$ ]]; }
valid_digest() { [[ "$1" =~ ^[0-9a-f]{64}$ ]]; }

unit_name() { echo "entrepreneuria-app@$1.service"; }

# Strict KEY=VALUE parser for /etc/entrepreneuria/apps/<app>.conf (never sourced).
# Sets CONF_APP_ID CONF_REPO_URL CONF_PORT CONF_HEALTH_PATH CONF_HEALTH_MARKER CONF_MEMORY_MAX.
load_app_conf() {
  local app="$1" file="$ENTREPRENEURIA_CONF_DIR/$1.conf" line key value
  [[ -f "$file" && ! -L "$file" ]] || die "missing app config $file"
  [[ "$(stat -c '%U %a' "$file")" =~ ^root\ (600|640|644)$ ]] || die "$file must be root-owned and not group/world writable"
  CONF_APP_ID="" CONF_REPO_URL="" CONF_PORT="" CONF_HEALTH_PATH="" CONF_HEALTH_MARKER="" CONF_MEMORY_MAX="2G"
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" =~ ^([A-Z_]+)=(.*)$ ]] || die "$file: malformed line"
    key="${BASH_REMATCH[1]}" value="${BASH_REMATCH[2]}"
    case "$key" in
      APP_ID) CONF_APP_ID="$value" ;;
      REPO_URL) CONF_REPO_URL="$value" ;;
      PORT) CONF_PORT="$value" ;;
      HEALTH_PATH) CONF_HEALTH_PATH="$value" ;;
      HEALTH_MARKER) CONF_HEALTH_MARKER="$value" ;;
      MEMORY_MAX) CONF_MEMORY_MAX="$value" ;;
      *) die "$file: unknown key $key" ;;
    esac
  done < "$file"
  [[ "$CONF_APP_ID" == "$app" ]] || die "$file: APP_ID must equal '$app'"
  [[ "$CONF_REPO_URL" =~ ^(https://github\.com/gekgrind/[A-Za-z0-9._-]+\.git|file:///[A-Za-z0-9._/-]+)$ ]] || die "$file: REPO_URL not allowed"
  [[ "$CONF_PORT" =~ ^[0-9]+$ ]] && (( CONF_PORT >= 1024 && CONF_PORT <= 65535 )) || die "$file: invalid PORT"
  [[ "$CONF_HEALTH_PATH" =~ ^/[A-Za-z0-9._~/-]*$ ]] || die "$file: invalid HEALTH_PATH"
  [[ -n "$CONF_HEALTH_MARKER" && ${#CONF_HEALTH_MARKER} -ge 8 ]] || die "$file: HEALTH_MARKER must be at least 8 characters"
  [[ "$CONF_MEMORY_MAX" =~ ^[0-9]+[KMG]$ ]] || die "$file: invalid MEMORY_MAX"
}

# Every configured app must have a distinct port.
assert_unique_port() {
  local app="$1" port="$2" f other
  for f in "$ENTREPRENEURIA_CONF_DIR"/*.conf; do
    [[ -e "$f" ]] || continue
    other="$(basename "$f" .conf)"
    [[ "$other" == "$app" ]] && continue
    if grep -Eq "^PORT=${port}\$" "$f"; then die "port $port is also configured for $other"; fi
  done
}

# The secrets file must not redefine the listener (service.env is the only source).
assert_runtime_env_safe() {
  local file="/srv/$1/secrets/runtime.env"
  [[ -f "$file" && ! -L "$file" ]] || die "missing $file"
  [[ "$(stat -c '%U:%G %a' "$file")" == "root:root 600" ]] || die "$file must be root:root 0600"
  if grep -Eq '^[[:space:]]*(export[[:space:]]+)?(PORT|HOSTNAME|NODE_OPTIONS)[[:space:]]*=' "$file"; then
    die "$file must not set PORT, HOSTNAME or NODE_OPTIONS (conflicts with the service configuration)"
  fi
}

# Content digest of a release tree: paths, types, modes, symlink targets and file hashes.
tree_digest() {
  local dir="$1"
  (
    cd "$dir" || exit 1
    {
      find . \( -type d -printf 'D %m %p\n' \) -o \( -type l -printf 'L %p -> %l\n' \) -o \( -type f -printf 'F %m %p\n' \) -o -printf 'X %p\n' | LC_ALL=C sort
      find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum
    } | sha256sum | cut -d' ' -f1
  )
}

# A release is trusted only if it is root-owned, unmodified since promotion
# (tree digest recorded at promotion) and recorded for this app.
verify_release() {
  local app="$1" sha="$2" rel="/srv/$1/releases/$2" state="/srv/$1/state/verified/$2" expected actual
  valid_sha "$sha" || return 1
  [[ -d "$rel" && ! -L "$rel" && -f "$state" && ! -L "$state" ]] || { log "release $sha: missing or no verification record"; return 1; }
  [[ "$(stat -c '%U:%G' "$rel")" == "root:root" ]] || { log "release $sha: not root-owned"; return 1; }
  if [[ -n "$(find "$rel" \( ! -user root -o ! -group root -o -perm /022 -o -perm /6000 \) ! -type l -print -quit)" ]]; then
    log "release $sha: ownership or permissions changed"; return 1
  fi
  expected="$(sed -n 's/^tree=\([0-9a-f]\{64\}\)$/\1/p' "$state")"
  actual="$(tree_digest "$rel")"
  [[ -n "$expected" && "$expected" == "$actual" ]] || { log "release $sha: tree digest mismatch"; return 1; }
  grep -qx "app=$app" "$rel/RELEASE" && grep -qx "sha=$sha" "$rel/RELEASE" || { log "release $sha: RELEASE identity mismatch"; return 1; }
  return 0
}

# PIDs listening on 127.0.0.1:<port>; fails if anything listens on another address for that port.
listener_pids() {
  local port="$1" lines
  lines="$(ss -Htlnp "sport = :$port" 2>/dev/null)" || return 1
  [[ -n "$lines" ]] || return 1
  if awk '{print $4}' <<<"$lines" | grep -Ev "^127\.0\.0\.1:${port}\$" >/dev/null; then
    log "port $port is bound beyond 127.0.0.1: $(awk '{print $4}' <<<"$lines" | xargs)"; return 2
  fi
  grep -o 'pid=[0-9]\+' <<<"$lines" | cut -d= -f2 | sort -u
}

# Readiness: unit active; every listener on the port belongs to this unit's cgroup
# and runs from the expected release; one bounded direct GET returns exactly 200
# with the app's marker; listener ownership is re-checked after the request.
check_listener_identity() {
  local app="$1" sha="$2" port="$3" unit cg pids pid
  unit="$(unit_name "$app")"
  cg="$(systemctl show -p ControlGroup --value "$unit")"
  [[ -n "$cg" ]] || return 1
  pids="$(listener_pids "$port")" || return 1
  for pid in $pids; do
    # cgroup v2 path of the listener must be this unit's cgroup. Suffix match, because
    # inside a nested cgroup namespace (containers) the path carries a parent prefix;
    # the unit's own path segment is unique either way.
    local line; line="$(grep '^0::' "/proc/$pid/cgroup" 2>/dev/null)"
    [[ -n "$line" && "$line" == *"$cg" ]] || { log "pid $pid on :$port is not in $unit"; return 1; }
    [[ "$(readlink "/proc/$pid/cwd" 2>/dev/null)" == "/srv/$app/releases/$sha" ]] || { log "pid $pid is not running release $sha"; return 1; }
  done
  return 0
}

health_check() {
  local app="$1" sha="$2" timeout="${3:-90}" deadline code body unit base_restarts
  unit="$(unit_name "$app")"
  load_app_conf "$app"
  body="$(mktemp)"
  # Restart counter at the moment the check starts; an increase means the process crashed.
  base_restarts="$(systemctl show -p NRestarts --value "$unit" 2>/dev/null || echo 0)"
  deadline=$(( SECONDS + timeout ))
  while (( SECONDS < deadline )); do
    if systemctl is-failed --quiet "$unit" || (( $(systemctl show -p NRestarts --value "$unit" 2>/dev/null || echo 0) > base_restarts )); then
      log "health: $unit exited after start"; rm -f "$body"; return 1
    fi
    if systemctl is-active --quiet "$unit" && check_listener_identity "$app" "$sha" "$CONF_PORT"; then
      code="$(curl --silent --noproxy '*' --connect-timeout 2 --max-time 5 --max-redirs 0 \
        -o "$body" -w '%{http_code}' "http://127.0.0.1:${CONF_PORT}${CONF_HEALTH_PATH}" 2>/dev/null || true)"
      if [[ "$code" == "200" ]] && grep -qF -- "$CONF_HEALTH_MARKER" "$body" \
         && check_listener_identity "$app" "$sha" "$CONF_PORT"; then
        rm -f "$body"; return 0
      fi
      [[ "$code" == "200" ]] && log "health: 200 without the expected app marker" || log "health: HTTP ${code:-none}"
    fi
    sleep 2
  done
  rm -f "$body"
  return 1
}

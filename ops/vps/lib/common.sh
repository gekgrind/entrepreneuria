# shellcheck shell=bash
# Shared helpers for the Entrepreneuria VPS scripts.
# Installed root-owned at /usr/local/lib/entrepreneuria/common.sh by
# provision-app.sh; the installed copies are what run, never a checkout.

export PATH=/usr/sbin:/usr/bin:/sbin:/bin
ENTREPRENEURIA_CONF_DIR="${ENTREPRENEURIA_CONF_DIR:-/etc/entrepreneuria/apps}"
ENTREPRENEURIA_LIB_DIR="/usr/local/lib/entrepreneuria"
ENTREPRENEURIA_VAR="/var/lib/entrepreneuria"

die() { echo "ERROR: $*" >&2; exit "${EXIT_CODE:-1}"; }
log() { echo "[$(date -u +%H:%M:%S)] $*" >&2; }

valid_app() { [[ "$1" =~ ^[a-z][a-z0-9-]{1,30}$ ]]; }
valid_sha() { [[ "$1" =~ ^[0-9a-f]{40}$ ]]; }
valid_digest() { [[ "$1" =~ ^[0-9a-f]{64}$ ]]; }

unit_name() { echo "entrepreneuria-app@$1.service"; }
app_var() { echo "$ENTREPRENEURIA_VAR/$1"; }
candidate_dropin_dir() { echo "/run/systemd/system/$(unit_name "$1").d"; }
candidate_dropin() { echo "$(candidate_dropin_dir "$1")/zz-candidate.conf"; }
candidate_marker() { echo "/run/entrepreneuria/$1/candidate"; }

# Every component from / down to <path> must be a real directory (not a symlink),
# owned by root and not writable by group/other. <path> itself must also match
# the exact owner:group and mode given.
assert_trusted_dir() {  # <path> <owner:group> <mode>
  local path="$1" want_owner="$2" want_mode="$3" cur="" comp
  [[ "$path" == /* ]] || die "not an absolute path: $path"
  IFS=/ read -r -a comps <<<"${path#/}"
  for comp in "${comps[@]}"; do
    cur="$cur/$comp"
    [[ -d "$cur" && ! -L "$cur" ]] || die "unsafe path: $cur is not a real directory"
    if [[ "$cur" != "$path" ]]; then
      [[ "$(stat -c '%u' "$cur")" == 0 && -z "$(find "$cur" -maxdepth 0 -perm /022)" ]] || die "unsafe path: $cur is not root-owned or is group/world writable"
    fi
  done
  [[ "$(stat -c '%U:%G %a' "$path")" == "$want_owner ${want_mode#0}" ]] || die "unsafe path: $path is $(stat -c '%U:%G %a' "$path"), expected $want_owner ${want_mode#0}"
}

# Strict KEY=VALUE parser for /etc/entrepreneuria/apps/<app>.conf (never sourced).
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

assert_unique_port() {
  local app="$1" port="$2" f other
  for f in "$ENTREPRENEURIA_CONF_DIR"/*.conf; do
    [[ -e "$f" ]] || continue
    other="$(basename "$f" .conf)"
    [[ "$other" == "$app" ]] && continue
    if grep -Eq "^PORT=${port}\$" "$f"; then die "port $port is also configured for $other"; fi
  done
}

assert_runtime_env_safe() {
  local file="/srv/$1/secrets/runtime.env"
  [[ -f "$file" && ! -L "$file" ]] || die "missing $file"
  [[ "$(stat -c '%U:%G %a' "$file")" == "root:root 600" ]] || die "$file must be root:root 0600"
  if grep -Eq '^[[:space:]]*(export[[:space:]]+)?(PORT|HOSTNAME|NODE_OPTIONS)[[:space:]]*=' "$file"; then
    die "$file must not set PORT, HOSTNAME or NODE_OPTIONS (conflicts with the service configuration)"
  fi
}

# --- Per-app promotion lock ----------------------------------------------------------
# /var/lib/entrepreneuria/<app>/lock is root:root 0700; the lock file inside must be a
# regular, root-owned, single-link file. Only root can create entries there, and the
# checks below reject anything planted before that directory was secured.
acquire_app_lock() {  # <app>  (opens fd 9)
  local dir; dir="$(app_var "$1")/lock"
  local file="$dir/promote.lock"
  assert_trusted_dir "$dir" root:root 0700
  if [[ -e "$file" || -L "$file" ]]; then
    [[ -f "$file" && ! -L "$file" && "$(stat -c '%U:%G %a %h' "$file")" == "root:root 600 1" ]] \
      || die "unsafe lock file $file (must be a regular root:root 0600 file with one link)"
  else
    ( set -o noclobber; umask 077; : > "$file" ) || die "cannot create lock file $file"
  fi
  # Re-check after open: the fd must be the same regular file we validated.
  exec 9<"$file" || die "cannot open $file"
  [[ "$(stat -L -c '%d:%i' /proc/self/fd/9)" == "$(stat -c '%d:%i' "$file")" && ! -L "$file" ]] || die "lock file changed while opening"
  if ! flock -n 9; then
    log "another promotion of $1 is running; waiting for the lock (max 600s)"
    flock -w 600 9 || die "timed out waiting for the promotion lock"
  fi
}

# --- Release integrity ----------------------------------------------------------------
tree_digest() {
  local dir="$1"
  (
    cd "$dir" || exit 1
    set -o pipefail
    {
      find . \( -type d -printf 'D %m %p\n' \) -o \( -type l -printf 'L %p -> %l\n' \) -o \( -type f -printf 'F %m %p\n' \) -o -printf 'X %p\n' | LC_ALL=C sort
      find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum
    } | sha256sum | cut -d' ' -f1
  )
}

# record_field <file> <key>
record_field() { sed -n "s/^$2=//p" "$1" | head -1; }

# A release is trusted only if its root-only record exists for this exact app, repo
# and SHA, the tree is root-owned with safe modes, and its digest is unchanged.
# With a 3rd argument, the recorded artifact digest must also equal it.
verify_release() {  # <app> <sha> [expected-artifact-digest]
  local app="$1" sha="$2" want="${3:-}" rel="/srv/$1/releases/$2" rec="/srv/$1/state/verified/$2"
  valid_sha "$sha" || return 1
  [[ -d "$rel" && ! -L "$rel" && -f "$rec" && ! -L "$rec" ]] || { log "release $sha: missing or no verification record"; return 1; }
  [[ "$(stat -c '%U:%G %a' "$rec")" == "root:root 600" ]] || { log "release $sha: record not root-only"; return 1; }
  [[ "$(record_field "$rec" app)" == "$app" && "$(record_field "$rec" sha)" == "$sha" ]] || { log "release $sha: record identity mismatch"; return 1; }
  [[ "$(record_field "$rec" repo)" == "$CONF_REPO_URL" ]] || { log "release $sha: recorded repo differs from the configured repo"; return 1; }
  if [[ -n "$want" && "$(record_field "$rec" artifact)" != "$want" ]]; then
    log "release $sha: approved digest $want does not match the recorded artifact $(record_field "$rec" artifact)"; return 1
  fi
  [[ "$(stat -c '%U:%G' "$rel")" == "root:root" ]] || { log "release $sha: not root-owned"; return 1; }
  if [[ -n "$(find "$rel" \( ! -user root -o ! -group root -o -perm /022 -o -perm /6000 \) ! -type l -print -quit)" ]]; then
    log "release $sha: ownership or permissions changed"; return 1
  fi
  local actual; actual="$(tree_digest "$rel")" || { log "release $sha: cannot compute tree digest"; return 1; }
  [[ "$(record_field "$rec" tree)" == "$actual" ]] || { log "release $sha: tree digest mismatch"; return 1; }
  # Final symlink policy: only .next/cache -> /srv/<app>/var/cache may leave the release;
  # no other link may escape or traverse the cache link or any reserved path.
  release_policy "$app" "$rel" || { log "release $sha: final tree policy failed"; return 1; }
  return 0
}

release_policy() {  # <app> <release-dir>
  python3 -I -S "$ENTREPRENEURIA_LIB_DIR/archive_tool.py" policy "$2" "/srv/$1/var/cache" >/dev/null
}

# The verified boot selection: live/current, changed only after readiness approval.
current_release() {
  local t; t="$(readlink "/srv/$1/live/current" 2>/dev/null)" || return 1
  [[ "$t" == "/srv/$1/releases/"* ]] || return 1
  t="${t##*/}"; valid_sha "$t" || return 1
  echo "$t"
}

# --- Listener identity and readiness ----------------------------------------------------
# PIDs listening on <port>. Fails (non-zero) if `ss` fails, nothing listens, or anything
# listens on an address other than 127.0.0.1.
listener_pids() {
  local port="$1" lines rc
  lines="$(ss -Htlnp "sport = :$port" 2>&1)"; rc=$?
  (( rc == 0 )) || { log "ss failed (rc=$rc): $lines"; return 3; }
  [[ -n "$lines" ]] || return 1
  if awk '{print $4}' <<<"$lines" | grep -Ev "^127\.0\.0\.1:${port}\$" >/dev/null; then
    log "port $port is bound beyond 127.0.0.1: $(awk '{print $4}' <<<"$lines" | xargs)"; return 2
  fi
  grep -o 'pid=[0-9]\+' <<<"$lines" | cut -d= -f2 | sort -u
}

# The unit's cgroup v2 path exactly as systemd reports it. systemd reports it in the
# same namespace view as /proc/<pid>/cgroup (cgroup v2 "0::" line), so the comparison
# is exact string equality: no regex, no suffix or prefix matching. Fails closed if
# cgroup v2 is not in use or the unit has no cgroup.
expected_cgroup() {  # <unit>
  local cg
  [[ "$(stat -fc %T /sys/fs/cgroup 2>/dev/null)" == cgroup2fs ]] || { log "cgroup v2 not mounted"; return 1; }
  cg="$(systemctl show -p ControlGroup --value "$1")" || return 1
  [[ "$cg" == /*"/$1" ]] || { log "unexpected ControlGroup for $1: '$cg'"; return 1; }
  printf '%s\n' "$cg"
}

check_listener_identity() {  # <app> <sha> <port>
  local app="$1" sha="$2" port="$3" unit want_cg uid pids pid cg uids
  unit="$(unit_name "$app")"
  want_cg="$(expected_cgroup "$unit")" || return 1
  uid="$(id -u "app-$app")" || return 1
  pids="$(listener_pids "$port")" || return 1
  for pid in $pids; do
    uids="$(awk '/^Uid:/{print $2, $3, $4, $5}' "/proc/$pid/status" 2>/dev/null)"
    [[ "$uids" == "$uid $uid $uid $uid" ]] || { log "pid $pid on :$port runs as uid(s) '$uids', expected app-$app ($uid)"; return 1; }
    cg="$(sed -n 's/^0:://p' "/proc/$pid/cgroup" 2>/dev/null)"
    [[ "$cg" == "$want_cg" ]] || { log "pid $pid on :$port is in cgroup '$cg', not $unit ($want_cg)"; return 1; }
    [[ "$(readlink "/proc/$pid/cwd" 2>/dev/null)" == "/srv/$app/releases/$sha" ]] || { log "pid $pid is not running release $sha"; return 1; }
  done
  return 0
}

health_check() {  # <app> <sha> [timeout]
  local app="$1" sha="$2" timeout="${3:-90}" deadline code body unit base_restarts rc
  unit="$(unit_name "$app")"
  load_app_conf "$app"
  body="$(mktemp)"
  base_restarts="$(systemctl show -p NRestarts --value "$unit" 2>/dev/null || echo 0)"
  deadline=$(( SECONDS + timeout ))
  while (( SECONDS < deadline )); do
    if systemctl is-failed --quiet "$unit" || (( $(systemctl show -p NRestarts --value "$unit" 2>/dev/null || echo 0) > base_restarts )); then
      log "health: $unit exited after start"; rm -f "$body"; return 1
    fi
    if systemctl is-active --quiet "$unit" && check_listener_identity "$app" "$sha" "$CONF_PORT"; then
      : > "$body"
      code="$(curl --silent --show-error --noproxy '*' --connect-timeout 2 --max-time 5 --max-redirs 0 \
        -o "$body" -w '%{http_code}' "http://127.0.0.1:${CONF_PORT}${CONF_HEALTH_PATH}" 2>/dev/null)"; rc=$?
      if (( rc == 0 )) && [[ "$code" == "200" ]] && grep -qF -- "$CONF_HEALTH_MARKER" "$body" \
         && check_listener_identity "$app" "$sha" "$CONF_PORT"; then
        rm -f "$body"; return 0
      fi
      if (( rc != 0 )); then log "health: HTTP transfer failed (curl rc=$rc)"
      elif [[ "$code" == "200" ]]; then log "health: 200 without the expected app marker"
      else log "health: HTTP $code"; fi
    fi
    sleep 2
  done
  rm -f "$body"
  return 1
}

# Stop the unit and PROVE it is stopped: unit inactive/failed and nothing on the port.
# Returns 0 only when both hold.
stop_and_confirm() {  # <app>
  local app="$1" unit state lines rc
  unit="$(unit_name "$app")"
  load_app_conf "$app"
  systemctl stop "$unit" || log "systemctl stop $unit returned an error"
  state="$(systemctl show -p ActiveState --value "$unit" 2>/dev/null)" || state="unknown"
  [[ "$state" == inactive || "$state" == failed ]] || { log "$unit is still '$state' after stop"; return 1; }
  lines="$(ss -Htln "sport = :$CONF_PORT" 2>&1)"; rc=$?
  (( rc == 0 )) || { log "cannot confirm the port is closed: ss failed (rc=$rc)"; return 1; }
  [[ -z "$lines" ]] || { log "port $CONF_PORT still has a listener after stop"; return 1; }
  return 0
}

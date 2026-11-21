#!/usr/bin/env bash
# Read-only isolation checks for one provisioned app. Installed as
# /usr/local/sbin/entrepreneuria-verify. Run as root. Makes no changes.
#
#   entrepreneuria-verify <app> [--allow-public tcp:<port>[,udp:<port>...]]
#
# Every check reports PASS or FAIL; a probe that cannot run is a FAIL, never a
# pass. Exit status is non-zero if any check fails.
set -uo pipefail
# shellcheck source=../lib/common.sh
. /usr/local/lib/entrepreneuria/common.sh

[[ $# -eq 1 || $# -eq 3 ]] || { echo "usage: $0 <app> [--allow-public tcp:PORT,...]" >&2; exit 2; }
APP="$1"; EXTRA_ALLOW="${3:-}"
[[ $# -eq 1 || "$2" == "--allow-public" ]] || { echo "usage: $0 <app> [--allow-public tcp:PORT,...]" >&2; exit 2; }
valid_app "$APP" || { echo "invalid app name" >&2; exit 2; }
[[ $EUID -eq 0 ]] || { echo "must run as root" >&2; exit 2; }
( load_app_conf "$APP" ) || exit 1
load_app_conf "$APP"

BASE="/srv/$APP"; RUN_USER="app-$APP"; BUILD_USER="build-$APP"; STAGE_USER="stage-$APP"; UNIT="$(unit_name "$APP")"
VARD="$(app_var "$APP")"
FAIL=0
pass() { echo "PASS  $*"; }
fail() { echo "FAIL  $*"; FAIL=1; }
check() { local desc="$1"; shift; if "$@"; then pass "$desc"; else fail "$desc"; fi; }

# Ask whether <user> can <r|w|x> <path>, without changing anything. The probe
# must answer exactly YES or NO; any other outcome (missing user, sudo error)
# is reported as an error, never as "denied".
can() {  # <user> <r|w|x> <path>  -> prints YES / NO / ERROR
  local out
  getent passwd "$1" >/dev/null || { echo ERROR; return; }
  # Only the shell run AS the user prints YES/NO; a sudo failure prints nothing.
  out="$(sudo -n -u "$1" -- /bin/sh -c 'if test "-$1" "$2"; then echo YES; else echo NO; fi' probe "$2" "$3" 2>/dev/null)"
  [[ "$out" == YES || "$out" == NO ]] && echo "$out" || echo ERROR
}
expect_access() {  # <desc> <user> <op> <path> <YES|NO>
  local got; got="$(can "$2" "$3" "$4")"
  if [[ "$got" == "$5" ]]; then pass "$1"; elif [[ "$got" == ERROR ]]; then fail "$1 (probe error)"; else fail "$1 (got $got)"; fi
}
owner_mode_is() { [[ -e "$1" && ! -L "$1" && "$(stat -c '%U:%G %a' "$1")" == "$2" ]]; }

# --- Identities -------------------------------------------------------------------
for u in "$RUN_USER" "$BUILD_USER" "$STAGE_USER"; do
  if ! entry="$(getent passwd "$u")"; then fail "user $u exists"; continue; fi
  IFS=: read -r _ _ uid _ _ _ shell <<<"$entry"
  check "$u is a system account" test "$uid" -gt 0 -a "$uid" -lt 1000
  check "$u has no login shell" test "$shell" = /usr/sbin/nologin
  check "$u has no supplementary groups" test "$(id -nG "$u")" = "$u"
  out="$(sudo -n -l -U "$u" 2>&1)"
  if grep -q "is not allowed to run sudo" <<<"$out"; then pass "$u has no sudo rights"; else fail "$u has sudo rights or sudo -l failed: $(head -1 <<<"$out")"; fi
done
if grep -RqsE "(^|[^a-z0-9-])($RUN_USER|$BUILD_USER|$STAGE_USER)([^a-z0-9-]|$)" /etc/sudoers /etc/sudoers.d; then fail "sudoers mentions a service account of $APP"; else pass "sudoers does not mention $RUN_USER/$BUILD_USER/$STAGE_USER"; fi

# --- Layout -----------------------------------------------------------------------
check "$BASE root:root 755"               owner_mode_is "$BASE" "root:root 755"
check "releases root:root 755"            owner_mode_is "$BASE/releases" "root:root 755"
check "live root:root 755"                owner_mode_is "$BASE/live" "root:root 755"
check "state root:root 700"               owner_mode_is "$BASE/state" "root:root 700"
check "secrets root:root 700"             owner_mode_is "$BASE/secrets" "root:root 700"
check "runtime.env root:root 600"         owner_mode_is "$BASE/secrets/runtime.env" "root:root 600"
check "service.env root:root 644"         owner_mode_is "$BASE/config/service.env" "root:root 644"
check "service.env PORT matches config"   test "$(cat "$BASE/config/service.env" 2>/dev/null)" = "PORT=$CONF_PORT"
check "build.env root:$BUILD_USER 640"    owner_mode_is "$BASE/config/build.env" "root:$BUILD_USER 640"
check "var $RUN_USER 700"                 owner_mode_is "$BASE/var" "$RUN_USER:$RUN_USER 700"
check "build dir $BUILD_USER 700"         owner_mode_is "/srv/build/$APP" "$BUILD_USER:$BUILD_USER 700"
for spec in "$VARD:root:root 711" "$VARD/lock:root:root 700" "$VARD/artifacts:root:root 700" "$VARD/extract:root:root 711"; do
  if ( assert_trusted_dir "${spec%%:*}" "$(cut -d: -f2-3 <<<"$spec" | cut -d' ' -f1)" "${spec##* }" ) 2>/dev/null; then pass "${spec%%:*} trusted path, ${spec#*:}"; else fail "${spec%%:*} is not a trusted ${spec#*:} directory"; fi
done
lock="$VARD/lock/promote.lock"
if [[ ! -e "$lock" && ! -L "$lock" ]] || [[ -f "$lock" && ! -L "$lock" && "$(stat -c '%U:%G %a %h' "$lock")" == "root:root 600 1" ]]; then pass "promotion lock file safe"; else fail "promotion lock file unsafe"; fi
if ( assert_runtime_env_safe "$APP" ) 2>/dev/null; then pass "runtime.env does not set PORT/HOSTNAME/NODE_OPTIONS"; else fail "runtime.env sets PORT/HOSTNAME/NODE_OPTIONS or is unsafe"; fi
( assert_unique_port "$APP" "$CONF_PORT" ) 2>/dev/null && pass "port $CONF_PORT unique across apps" || fail "port $CONF_PORT shared with another app"
for f in /usr/local/lib/entrepreneuria/common.sh /usr/local/lib/entrepreneuria/archive_tool.py /usr/local/sbin/entrepreneuria-acme-webroot /usr/local/sbin/entrepreneuria-boot-check /usr/local/sbin/entrepreneuria-promote /usr/local/sbin/entrepreneuria-verify /usr/local/bin/entrepreneuria-build /etc/systemd/system/entrepreneuria-app@.service; do
  if [[ -f "$f" && ! -L "$f" && "$(stat -c '%U' "$f")" == root && -z "$(find "$f" -perm /022)" ]]; then pass "$f root-owned, not group/world writable"; else fail "$f ownership/permissions"; fi
done

# --- Access (read-only probes) ----------------------------------------------------
expect_access "$RUN_USER cannot read runtime secrets"     "$RUN_USER"   r "$BASE/secrets/runtime.env" NO
expect_access "$BUILD_USER cannot read runtime secrets"   "$BUILD_USER" r "$BASE/secrets/runtime.env" NO
expect_access "$RUN_USER cannot write releases"           "$RUN_USER"   w "$BASE/releases" NO
expect_access "$BUILD_USER cannot write releases"         "$BUILD_USER" w "$BASE/releases" NO
expect_access "$RUN_USER cannot repoint live"             "$RUN_USER"   w "$BASE/live" NO
expect_access "$BUILD_USER cannot repoint live"           "$BUILD_USER" w "$BASE/live" NO
expect_access "$BUILD_USER cannot read promotion state"   "$BUILD_USER" x "$BASE/state" NO
expect_access "$RUN_USER can write its cache"             "$RUN_USER"   w "$BASE/var/cache" YES
expect_access "$RUN_USER cannot enter the build dir"      "$RUN_USER"   x "/srv/build/$APP" NO
for other in /srv/build/*/; do
  other="${other%/}"; [[ "$other" == "/srv/build/$APP" || ! -d "$other" ]] && continue
  expect_access "$BUILD_USER cannot enter $other" "$BUILD_USER" x "$other" NO
done

# --- Active release ---------------------------------------------------------------
if [[ -L "$BASE/live/current" ]]; then
  target="$(readlink "$BASE/live/current")"
  sha="${target##*/}"
  if [[ "$target" == "$BASE/releases/$sha" ]] && valid_sha "$sha"; then pass "live/current -> releases/$sha"; else fail "live/current points outside releases: $target"; fi
  if verify_release "$APP" "$sha" 2>/dev/null; then pass "release $sha matches its promotion record (ownership, modes, tree digest)"; else fail "release $sha failed verification"; fi
  bad="$(find "$BASE/releases/$sha" -type l -print0 2>/dev/null | while IFS= read -r -d '' l; do t="$(realpath -m -- "$l")"; [[ "$t" == "$BASE/releases/$sha"* || "$l" == "$BASE/releases/$sha/.next/cache" ]] || echo "$l"; done)"
  check "no symlink escapes the release (except .next/cache)" test -z "$bad"
  check ".next/cache -> var/cache" test "$(readlink "$BASE/releases/$sha/.next/cache" 2>/dev/null)" = "$BASE/var/cache"
  expect_access "$RUN_USER cannot write the active release" "$RUN_USER" w "$BASE/releases/$sha/package.json" NO
  check "no interrupted candidate pending" test ! -e "$(candidate_marker "$APP")" -a ! -e "$(candidate_dropin "$APP")"
  if systemctl is-active --quiet "$UNIT"; then
    pass "$UNIT active"
    check "$UNIT runs as $RUN_USER" test "$(systemctl show -p User --value "$UNIT")" = "$RUN_USER"
    check "$UNIT enabled at boot" systemctl is-enabled --quiet "$UNIT"
    if health_check "$APP" "$sha" 20 2>/dev/null; then pass "readiness: listener in $UNIT cgroup, cwd = release $sha, HTTP 200 with app marker"; else fail "readiness check failed"; fi
  else
    fail "$UNIT not active"
  fi
else
  fail "no active release selected (live/current missing)"
fi

# --- Public listeners ---------------------------------------------------------------
SSH_PORTS="$(sshd -T 2>/dev/null | awk '$1=="port"{print $2}' | xargs)"
# Ubuntu 24.04 socket-activates ssh: fall back to the socket unit's listen addresses.
[[ -n "$SSH_PORTS" ]] || SSH_PORTS="$(systemctl show -p Listen --value ssh.socket 2>/dev/null | grep -oE ':[0-9]+ \(Stream\)|^[0-9]+ \(Stream\)' | grep -oE '[0-9]+' | sort -u | xargs)"
allowed_tcp() {  # <port> <process>
  [[ "$1" == 80 || "$1" == 443 ]] && [[ "$2" == nginx ]] && return 0
  # Ubuntu 24.04 socket-activates ssh, so the listener may be reported as systemd.
  for p in $SSH_PORTS; do [[ "$1" == "$p" && ( "$2" == sshd || "$2" == systemd ) ]] && return 0; done
  [[ ",$EXTRA_ALLOW," == *",tcp:$1,"* ]]
}
[[ -n "$SSH_PORTS" ]] && pass "SSH port(s) identified: $SSH_PORTS" || fail "could not determine the SSH port (sshd -T and ssh.socket both failed)"
unexpected=""
# Capture each enumeration and its exit status first: a failed `ss` is a FAIL, never an empty result.
tcp_out="$(ss -Htlnp 2>&1)"; tcp_rc=$?
udp_out="$(ss -Hulnp 2>&1)"; udp_rc=$?
if (( tcp_rc != 0 )); then
  fail "TCP listener enumeration failed (ss rc=$tcp_rc): $(head -1 <<<"$tcp_out")"
else
  while read -r local proc; do
    [[ -z "$local" ]] && continue
    addr="${local%:*}"; port="${local##*:}"
    [[ "$addr" =~ ^(127\.|\[::1\]|\[::ffff:127\.) ]] && continue
    name="$(grep -o '(("[^"]*"' <<<"$proc" | head -1 | tr -d '("')"
    allowed_tcp "$port" "$name" || unexpected+=" tcp:$local($name)"
  done < <(awk '{print $4, $6}' <<<"$tcp_out")
fi
if (( udp_rc != 0 )); then
  fail "UDP listener enumeration failed (ss rc=$udp_rc): $(head -1 <<<"$udp_out")"
else
  while read -r local proc; do
    [[ -z "$local" ]] && continue
    addr="${local%:*}"; port="${local##*:}"
    [[ "$addr" =~ ^(127\.|\[::1\]|\[::ffff:127\.) ]] && continue
    [[ "$port" == 68 || "$port" == 546 ]] && continue   # DHCP clients
    [[ ",$EXTRA_ALLOW," == *",udp:$port,"* ]] && continue
    unexpected+=" udp:$local($(grep -o '(("[^"]*"' <<<"$proc" | head -1 | tr -d '("'))"
  done < <(awk '{print $4, $6}' <<<"$udp_out")
fi
if (( tcp_rc == 0 && udp_rc == 0 )); then
  check "no unexpected public listeners (allowed: nginx :80/:443, sshd :${SSH_PORTS:-?})${unexpected:+ — found$unexpected}" test -z "$unexpected"
fi

echo
(( FAIL )) && echo "RESULT: FAIL" || echo "RESULT: PASS"
exit $FAIL

#!/usr/bin/env bash
# Read-only isolation checks for one provisioned app. Run as root on the VPS.
#
#   ops/vps/bin/verify-app.sh <app>
#
# Exits non-zero if any check fails. Makes no changes.
set -uo pipefail

[[ $# -eq 1 ]] || { echo "usage: $0 <app>" >&2; exit 2; }
APP="$1"
[[ "$APP" =~ ^[a-z][a-z0-9-]{1,30}$ ]] || { echo "invalid app name" >&2; exit 2; }
[[ $EUID -eq 0 ]] || { echo "must run as root" >&2; exit 1; }

BASE="/srv/$APP"; RUN_USER="app-$APP"; UNIT="entrepreneuria-app@$APP.service"
FAIL=0
pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; FAIL=1; }
expect_denied() { # <desc> <user> <cmd...>
  local desc="$1" user="$2"; shift 2
  if sudo -n -u "$user" "$@" >/dev/null 2>&1; then fail "$desc"; else pass "$desc"; fi
}

PORT="$(sed -n 's/^PORT=\([0-9]\+\)$/\1/p' "$BASE/config/service.env" 2>/dev/null)"
[[ -n "$PORT" ]] && pass "PORT configured ($PORT)" || fail "PORT missing in $BASE/config/service.env"

# Identities
[[ "$(getent passwd "$RUN_USER" | cut -d: -f7)" == "/usr/sbin/nologin" ]] && pass "$RUN_USER has no login shell" || fail "$RUN_USER login shell"
for u in deploy "$RUN_USER"; do
  id -nG "$u" | grep -Eqw 'sudo|admin|wheel' && fail "$u in an admin group" || pass "$u not in an admin group"
done
id -nG deploy | grep -qw "$RUN_USER" && fail "deploy is in $RUN_USER group" || pass "deploy not in $RUN_USER group"

# Secrets: root-only, unreadable by deploy and the runtime user
[[ "$(stat -c '%U:%G %a' "$BASE/secrets/runtime.env")" == "root:root 600" ]] && pass "runtime.env root:root 0600" || fail "runtime.env ownership/mode"
expect_denied "deploy cannot read runtime secrets" deploy cat "$BASE/secrets/runtime.env"
expect_denied "$RUN_USER cannot read runtime secrets" "$RUN_USER" cat "$BASE/secrets/runtime.env"

# Releases: runtime user cannot modify executable code
CUR="$(readlink -f "$BASE/live/current" 2>/dev/null)"
if [[ -n "$CUR" && -d "$CUR" ]]; then
  pass "current -> $CUR ($(cat "$CUR/DEPLOYED_SHA" 2>/dev/null || echo 'no DEPLOYED_SHA'))"
  expect_denied "$RUN_USER cannot write the release" "$RUN_USER" test -w "$CUR/package.json"
  expect_denied "$RUN_USER cannot create files in the release" "$RUN_USER" touch "$CUR/.probe"
  expect_denied "$RUN_USER cannot repoint current" "$RUN_USER" test -w "$BASE/live"
  [[ -z "$(find "$CUR" -perm -o+w -not -type l -print -quit)" ]] && pass "no world-writable files in release" || fail "world-writable files in release"
else
  fail "no current release"
fi

# Sudo: deploy may restart only this unit
SUDO_RULES="$(sudo -n -l -U deploy 2>/dev/null)"
echo "$SUDO_RULES" | grep -q "/usr/bin/systemctl restart $UNIT" && pass "deploy may restart $UNIT" || fail "deploy restart rule missing"
echo "$SUDO_RULES" | grep -Eq '\(ALL( : ALL)?\) (NOPASSWD: )?ALL' && fail "deploy has broad sudo" || pass "deploy has no broad sudo"

# Network: Node on loopback only
LISTEN="$(ss -Htlnp "sport = :$PORT" 2>/dev/null)"
if [[ -z "$LISTEN" ]]; then
  fail "nothing listening on :$PORT (service running?)"
elif echo "$LISTEN" | awk '{print $4}' | grep -Ev '^(127\.0\.0\.1|\[::1\]):' >/dev/null; then
  fail "port $PORT bound beyond loopback: $(echo "$LISTEN" | awk '{print $4}' | xargs)"
else
  pass "port $PORT bound to loopback only"
fi
PUBLIC="$(ss -Htlnp | awk '{print $4}' | grep -Ev '^(127\.|\[::1\]|\[::ffff:127\.)' | sort -u | xargs)"
echo "INFO  all non-loopback TCP listeners: ${PUBLIC:-none} (expect only :22/<ssh>, :80, :443)"

# Unit
systemctl is-active --quiet "$UNIT" && pass "$UNIT active" || fail "$UNIT not active"
[[ "$(systemctl show -p User --value "$UNIT")" == "$RUN_USER" ]] && pass "$UNIT runs as $RUN_USER" || fail "$UNIT user"
echo "INFO  $(systemd-analyze security "$UNIT" 2>/dev/null | tail -1)"

exit $FAIL

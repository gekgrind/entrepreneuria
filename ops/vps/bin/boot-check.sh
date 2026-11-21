#!/usr/bin/env bash
# Pre-start gate for entrepreneuria-app@<app>.service. Installed root-owned as
# /usr/local/sbin/entrepreneuria-boot-check and run by systemd as root
# (ExecStartPre=+...) before EVERY start, including at boot.
#
# The unit may start only the release it is about to run, and only if that release
# is fully verified: root-only record for this app/repo/SHA (so an interrupted
# publication, which has no record, can never start), unchanged tree digest,
# safe ownership/modes, and the final symlink policy.
#   - With a runtime candidate drop-in (promotion in progress): the candidate.
#   - Otherwise: the persistent selection live/current.
# Exit non-zero = the unit does not start.
set -Eeuo pipefail
. /usr/local/lib/entrepreneuria/common.sh

[[ $# -eq 1 ]] && valid_app "$1" || die "usage: entrepreneuria-boot-check <app>"
APP="$1"
load_app_conf "$APP"

if [[ -e "$(candidate_dropin "$APP")" ]]; then
  SHA="$(cat "$(candidate_marker "$APP")" 2>/dev/null || true)"
  what="candidate"
else
  SHA="$(current_release "$APP" || true)"
  what="boot selection"
fi
valid_sha "${SHA:-}" || die "no valid $what for $APP; refusing to start"
verify_release "$APP" "$SHA" || die "$what $SHA failed verification; refusing to start"
log "$what $SHA verified; starting"

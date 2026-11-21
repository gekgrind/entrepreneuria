#!/usr/bin/env bash
# Pre-start gate for entrepreneuria-app@<app>.service. Installed root-owned as
# /usr/local/sbin/entrepreneuria-boot-check and run by systemd as root
# (ExecStartPre=+...) before EVERY start, including at boot.
#
# What is verified is the directory systemd ACTUALLY assigned to this process
# (its physical working directory, read from /proc/$$/cwd before anything else),
# not what the files on disk say should be loaded. That directory must be:
#   1. a canonical release directory /srv/<app>/releases/<40-hex-sha>, and
#   2. the authorised selection for this start:
#        - candidate drop-in file present: the SHA in the candidate marker;
#        - otherwise: exactly the target of the persistent selection live/current;
#   3. a fully verified release (root-only record for this app/repo/SHA, so an
#      interrupted publication can never start; tree digest; ownership/modes;
#      final symlink policy).
# If systemd still has a candidate WorkingDirectory loaded after the drop-in file
# was removed (cleanup interrupted before `daemon-reload`), (2) fails: the gate
# refuses rather than verify one release and run another. Exit non-zero = no start.
set -Eeuo pipefail
# Capture the physical cwd first: nothing below may change it before it is read.
PHYS_CWD="$(readlink "/proc/$$/cwd" 2>/dev/null || true)"
. /usr/local/lib/entrepreneuria/common.sh

[[ $# -eq 1 ]] && valid_app "$1" || die "usage: entrepreneuria-boot-check <app>"
APP="$1"
load_app_conf "$APP"
RELEASES="/srv/$APP/releases"

# 1. The real working directory must be a canonical release directory.
[[ -n "$PHYS_CWD" ]] || die "cannot resolve the working directory systemd assigned; refusing to start"
[[ "$PHYS_CWD" =~ ^/srv/$APP/releases/([0-9a-f]{40})$ ]] \
  || die "systemd working directory '$PHYS_CWD' is not a release of $APP; refusing to start"
RUN_SHA="${BASH_REMATCH[1]}"
[[ -d "$PHYS_CWD" && ! -L "$PHYS_CWD" && "$(readlink -f "$PHYS_CWD")" == "$PHYS_CWD" ]] \
  || die "working directory '$PHYS_CWD' is not a canonical directory; refusing to start"

# 2. It must be exactly the release authorised for this start.
if [[ -e "$(candidate_dropin "$APP")" ]]; then
  AUTH_SHA="$(cat "$(candidate_marker "$APP")" 2>/dev/null || true)"
  what="candidate"
else
  AUTH_SHA="$(current_release "$APP" || true)"
  what="boot selection (live/current)"
fi
valid_sha "${AUTH_SHA:-}" || die "no valid $what for $APP; refusing to start"
[[ "$RUN_SHA" == "$AUTH_SHA" ]] \
  || die "systemd would run $RUN_SHA but the authorised $what is $AUTH_SHA (stale unit configuration?); refusing to start"

# 3. Full verification of exactly that release.
verify_release "$APP" "$RUN_SHA" || die "$what $RUN_SHA failed verification; refusing to start"
log "$what $RUN_SHA verified and matches the working directory systemd assigned; starting"

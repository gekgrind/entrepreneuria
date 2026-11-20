#!/usr/bin/env bash
# Runs the ops/vps scenario tests in a DISPOSABLE Ubuntu 24.04 container with
# systemd as PID 1 and dummy credentials. Never point this at the VPS.
#   ops/vps/test/run-in-docker.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OPS="$(cd "$HERE/.." && pwd)"
NAME="entrepreneuria-ops-test-$$"
# Git Bash on Windows: hand docker native paths and stop MSYS rewriting container paths.
if command -v cygpath >/dev/null; then HERE="$(cygpath -m "$HERE")"; OPS="$(cygpath -m "$OPS")"; export MSYS_NO_PATHCONV=1; fi
IMAGE="entrepreneuria-ops-test:ubuntu24.04"

docker build -q -t "$IMAGE" "$HERE" >/dev/null
docker run -d --name "$NAME" --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
  --tmpfs /run --tmpfs /run/lock "$IMAGE" >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
for _ in $(seq 1 30); do
  state="$(docker exec "$NAME" systemctl is-system-running 2>/dev/null || true)"
  [[ "$state" == running || "$state" == degraded ]] && break; sleep 1
done
docker cp "$OPS/." "$NAME:/opt/ops-vps"
docker exec "$NAME" bash -c 'find /opt/ops-vps -name "*.sh" -exec sed -i "s/\r$//" {} + ; sed -i "s/\r$//" /opt/ops-vps/test/fixture/fake-next/dist/bin/next; chmod +x /opt/ops-vps/bin/*.sh /opt/ops-vps/test/*.sh /opt/ops-vps/test/fixture/*.sh'

rc=0
docker exec "$NAME" /opt/ops-vps/test/run-tests.sh phase1 || rc=1
docker restart "$NAME" >/dev/null
for _ in $(seq 1 30); do
  state="$(docker exec "$NAME" systemctl is-system-running 2>/dev/null || true)"
  [[ "$state" == running || "$state" == degraded ]] && break; sleep 1
done
docker exec "$NAME" /opt/ops-vps/test/run-tests.sh phase2 || rc=1
exit $rc

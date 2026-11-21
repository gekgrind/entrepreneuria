#!/usr/bin/env bash
# Runs the ops/vps scenario tests in a DISPOSABLE Ubuntu 24.04 container with
# systemd as PID 1 and dummy credentials. Never point this at the VPS.
#   ops/vps/test/run-in-docker.sh            # tests the COMMITTED ops/vps tree at HEAD
#
# The tested source is exactly `git archive HEAD ops/vps`; the run refuses to start if
# ops/vps has uncommitted changes. The log header records the commit, the git tree id
# of ops/vps and a content digest computed both on the host and inside the container.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$HERE" rev-parse --show-toplevel)"
NAME="entrepreneuria-ops-test-$$"
IMAGE="entrepreneuria-ops-test:ubuntu24.04"

[[ -z "$(git -C "$REPO" status --porcelain -- ops/vps)" ]] || { echo "ops/vps has uncommitted changes; commit first so the tested tree is identifiable" >&2; exit 2; }
COMMIT="$(git -C "$REPO" rev-parse HEAD)"
TREE="$(git -C "$REPO" rev-parse HEAD:ops/vps)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"; docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
git -C "$REPO" archive --format=tar HEAD ops/vps | tar -x -C "$WORK"
content_digest() { (cd "$1" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sed "s/ [*]/  /" | sha256sum | cut -d' ' -f1); }
HOST_DIGEST="$(content_digest "$WORK/ops/vps")"

DOCKER_HERE="$HERE"; DOCKER_SRC="$WORK/ops/vps"
# Git Bash on Windows: hand docker native paths and stop MSYS rewriting container paths.
if command -v cygpath >/dev/null; then DOCKER_HERE="$(cygpath -m "$HERE")"; DOCKER_SRC="$(cygpath -m "$DOCKER_SRC")"; export MSYS_NO_PATHCONV=1; fi

docker build -q -t "$IMAGE" "$DOCKER_HERE" >/dev/null
docker run -d --name "$NAME" --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
  --tmpfs /run --tmpfs /run/lock "$IMAGE" >/dev/null
for _ in $(seq 1 30); do
  state="$(docker exec "$NAME" systemctl is-system-running 2>/dev/null || true)"
  [[ "$state" == running || "$state" == degraded ]] && break; sleep 1
done
docker cp "$DOCKER_SRC/." "$NAME:/opt/ops-vps"
CONTAINER_DIGEST="$(docker exec "$NAME" bash -c 'cd /opt/ops-vps && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum | cut -d" " -f1')"

echo "== tested source"
echo "commit:            $COMMIT"
echo "ops/vps tree id:   $TREE   (verify: git rev-parse $COMMIT:ops/vps)"
echo "content digest:    host $HOST_DIGEST / container $CONTAINER_DIGEST"
echo "image:             $(docker image inspect --format '{{.Id}}' "$IMAGE")  ($(docker exec "$NAME" sh -c '. /etc/os-release; echo $PRETTY_NAME'); $(docker exec "$NAME" python3 --version); systemd $(docker exec "$NAME" systemctl --version | head -1 | cut -d' ' -f2))"
echo "started:           $(date -u +%Y-%m-%dT%H:%M:%SZ)"
[[ "$HOST_DIGEST" == "$CONTAINER_DIGEST" ]] || { echo "content digest mismatch between host archive and container copy" >&2; exit 2; }

rc=0
docker exec "$NAME" /opt/ops-vps/test/run-tests.sh phase1 || rc=1
docker restart "$NAME" >/dev/null
for _ in $(seq 1 30); do
  state="$(docker exec "$NAME" systemctl is-system-running 2>/dev/null || true)"
  [[ "$state" == running || "$state" == degraded ]] && break; sleep 1
done
docker exec "$NAME" /opt/ops-vps/test/run-tests.sh phase2 || rc=1
echo; echo "finished: $(date -u +%Y-%m-%dT%H:%M:%SZ)  commit $COMMIT  ops/vps tree $TREE  result $([[ $rc -eq 0 ]] && echo PASS || echo FAIL)"
exit $rc

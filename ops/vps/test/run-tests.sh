#!/usr/bin/env bash
# Scenario tests for ops/vps, run as root INSIDE the disposable Ubuntu 24.04
# container started by run-in-docker.sh. Dummy credentials only.
#   run-tests.sh phase1   # everything except reboot
#   run-tests.sh phase2   # after a container restart: boot-time start
set -uo pipefail
OPS="${OPS:-/opt/ops-vps}"
PASSES=0; FAILS=0
ok()   { echo "  PASS  $*"; PASSES=$((PASSES+1)); }
bad()  { echo "  FAIL  $*"; FAILS=$((FAILS+1)); }
assert() { local d="$1"; shift; if "$@"; then ok "$d"; else bad "$d"; fi; }
section() { echo; echo "== $*"; }
sha_of() { sed -n "s/^$1=//p" /opt/fixture.shas; }
current() { readlink /srv/"$1"/live/current 2>/dev/null | xargs -r basename; }
build() {  # <app> <sha> -> sets DIGEST
  local out
  DIGEST=""
  out="$(sudo -u "build-$1" /usr/local/bin/entrepreneuria-build "$1" "$2" 2>&1)" || { echo "$out" | tail -5; return 1; }
  DIGEST="$(sed -n 's/^ARTIFACT_SHA256=//p' <<<"$out")"
}
promote() {  # <args...> -> sets RC, OUT
  OUT="$(/usr/local/sbin/entrepreneuria-promote "$@" 2>&1)"; RC=$?
  echo "$OUT" | sed 's/^/      | /' | tail -6
}
write_conf() {  # <app> <port>
  install -d -m 0755 /etc/entrepreneuria/apps
  cat > "/etc/entrepreneuria/apps/$1.conf" <<EOF
APP_ID=$1
REPO_URL=file:///opt/fixture.git
PORT=$2
HEALTH_PATH=/
HEALTH_MARKER=<title>Entrepreneuria Fixture
MEMORY_MAX=512M
EOF
  chmod 0644 "/etc/entrepreneuria/apps/$1.conf"
}

phase1() {
  section "setup: fixture repo and provisioning"
  "$OPS/test/fixture/make-fixture.sh" >/dev/null && ok "fixture repo created" || { bad "fixture repo"; return; }
  write_conf hub 3000
  "$OPS/bin/provision-app.sh" hub >/tmp/dry.txt 2>&1; assert "provision dry run succeeds" test $? -eq 0
  assert "dry run changes nothing" test ! -e /srv/hub
  "$OPS/bin/provision-app.sh" hub --apply >/tmp/prov.txt 2>&1; assert "provision --apply succeeds" test $? -eq 0 || cat /tmp/prov.txt
  "$OPS/bin/provision-app.sh" hub --apply >/dev/null 2>&1; assert "provision is idempotent on a safe host" test $? -eq 0
  echo 'API_SECRET=dummy-not-real' >> /srv/hub/secrets/runtime.env
  echo 'NEXT_PUBLIC_FIXTURE=public-value' >> /srv/hub/config/build.env
  assert "unit not enabled by provisioning" bash -c '! systemctl is-enabled --quiet entrepreneuria-app@hub.service'
  assert "systemd-analyze verify (instance)" bash -c 'systemd-analyze verify entrepreneuria-app@hub.service 2>&1 | grep -v "^$" | grep -viE "ConditionPath|No such file" ; true'
  systemd-analyze verify entrepreneuria-app@hub.service >/tmp/verify-unit.txt 2>&1
  assert "systemd-analyze verify reports no errors" bash -c '! grep -iE "error|invalid|unknown" /tmp/verify-unit.txt'

  section "unsafe pre-existing state is rejected by provisioning"
  write_conf evil 3990
  useradd --create-home --shell /bin/bash app-evil
  "$OPS/bin/provision-app.sh" evil --apply >/tmp/evil.txt 2>&1
  assert "rejects pre-existing login-shell runtime user" grep -q "login shell\|not a system account" /tmp/evil.txt
  userdel -r app-evil 2>/dev/null; useradd --system --user-group --no-create-home --shell /usr/sbin/nologin app-evil
  mkdir -p /srv/evil && ln -s /tmp /srv/evil/releases
  "$OPS/bin/provision-app.sh" evil --apply >/tmp/evil2.txt 2>&1
  assert "rejects symlinked release path" grep -q "is a symlink" /tmp/evil2.txt
  rm -rf /srv/evil; mkdir -m 0777 /srv/evil
  "$OPS/bin/provision-app.sh" evil --apply >/tmp/evil3.txt 2>&1
  assert "rejects wrong-mode existing dir" grep -q "expected root:root 755" /tmp/evil3.txt
  rm -rf /srv/evil /etc/entrepreneuria/apps/evil.conf; userdel app-evil 2>/dev/null

  local A B C D E F G P H2
  A="$(sha_of healthy)"; B="$(sha_of crash)"; C="$(sha_of http500)"; D="$(sha_of redirect)"
  E="$(sha_of wrongapp)"; F="$(sha_of hang)"; P="$(sha_of public)"; H2="$(sha_of healthy2)"

  section "initial deployment"
  build hub "$A" && ok "build as build-hub" || bad "build"
  assert "artifact owned by build user, not runnable" test "$(stat -c %U /srv/build/hub/out/$A.tar.gz)" = build-hub
  promote hub "$A" "$DIGEST"
  assert "first promotion exits 0" test "$RC" -eq 0
  assert "live/current -> A" test "$(current hub)" = "$A"
  assert "unit enabled only after healthy activation" systemctl is-enabled --quiet entrepreneuria-app@hub.service
  assert "last-good = A" test "$(cat /srv/hub/state/last-good)" = "$A"
  assert "release tree root-owned, no group/world write" test -z "$(find /srv/hub/releases/$A ! -type l \( ! -user root -o -perm /022 \) -print -quit)"
  assert "runtime cache written through sandbox (.next/cache -> var/cache)" test -f /srv/hub/var/cache/runtime-probe
  assert "build-only cache not shipped" test ! -e /srv/hub/var/cache/build-only
  assert "public build value baked, secret not present in build" grep -q public-value /srv/hub/releases/$A/.next/public-env
  assert "app process runs as app-hub" test "$(ps -o user= -p "$(systemctl show -p MainPID --value entrepreneuria-app@hub.service)")" = app-hub
  assert "app process sees runtime secret from PID 1" bash -c "tr '\0' '\n' < /proc/$(systemctl show -p MainPID --value entrepreneuria-app@hub.service)/environ | grep -q '^API_SECRET=dummy-not-real$'"

  section "runtime and build user isolation"
  for u in app-hub build-hub; do
    assert "$u cannot read runtime.env" bash -c "! sudo -u $u cat /srv/hub/secrets/runtime.env 2>/dev/null"
    assert "$u cannot create files in releases" bash -c "! sudo -u $u touch /srv/hub/releases/x 2>/dev/null"
    assert "$u cannot modify the active release" bash -c "! sudo -u $u sh -c 'echo x >> /srv/hub/releases/$A/package.json' 2>/dev/null"
    assert "$u cannot repoint live/current" bash -c "! sudo -u $u ln -sfn /tmp /srv/hub/live/current 2>/dev/null"
    assert "$u cannot run the promoter" bash -c "! sudo -n -u $u sudo -n /usr/local/sbin/entrepreneuria-promote hub --rollback 2>/dev/null"
  done
  assert "app-hub cannot read build dir" bash -c "! sudo -u app-hub ls /srv/build/hub 2>/dev/null"
  assert "promoter not executable by non-root" test "$(stat -c %a /usr/local/sbin/entrepreneuria-promote)" = 700

  section "verifier on a healthy host"
  /usr/local/sbin/entrepreneuria-verify hub >/tmp/v1.txt 2>&1; RCV=$?
  grep -E "^(FAIL|RESULT)" /tmp/v1.txt | sed 's/^/      | /'
  assert "verifier passes" test "$RCV" -eq 0

  section "failure modes roll back to the verified last-good release"
  for case in "crash:$B" "http500:$C" "redirect:$D" "wrongapp:$E" "hang:$F" "public-bind:$P"; do
    name="${case%%:*}"; sha="${case#*:}"
    build hub "$sha" || { bad "build $name"; continue; }
    local t0=$SECONDS
    promote hub "$sha" "$DIGEST"
    assert "$name: exits 3 (rolled back)" test "$RC" -eq 3
    assert "$name: live/current back on A" test "$(current hub)" = "$A"
    assert "$name: A healthy after rollback" curl -fsS --max-time 5 http://127.0.0.1:3000/ -o /dev/null
    assert "$name: last-good still A" test "$(cat /srv/hub/state/last-good)" = "$A"
    echo "      ($name took $((SECONDS - t0))s)"
  done

  section "promotion gates (rejected before activation)"
  build hub "$H2"
  promote hub "$H2" "$(printf '0%.0s' {1..64})"
  assert "wrong artifact digest -> exit 2" test "$RC" -eq 2
  assert "...and nothing published or activated" bash -c "test ! -e /srv/hub/releases/$H2 && test \"\$(readlink /srv/hub/live/current | xargs basename)\" = $A"
  # Build user tampers with a tracked source file and re-packs; operator approves the new digest.
  sudo -u build-hub bash -c "set -e; d=\$(mktemp -d); tar -xzf /srv/build/hub/out/$H2.tar.gz -C \$d; echo wrongapp > \$d/mode.txt; tar -czf /srv/build/hub/out/$H2.tar.gz -C \$d ."
  TD="$(sha256sum /srv/build/hub/out/$H2.tar.gz | cut -d' ' -f1)"
  promote hub "$H2" "$TD"
  assert "tampered source -> exit 2" test "$RC" -eq 2
  assert "...reported as source mismatch" grep -q "differ from" <<<"$OUT"
  # Path traversal member.
  sudo -u build-hub bash -c "set -e; d=\$(mktemp -d); mkdir \$d/x; echo pwn > \$d/evil; tar -czf /srv/build/hub/out/$H2.tar.gz -C \$d/x --transform 's,^,../,' -C \$d evil"
  TD="$(sha256sum /srv/build/hub/out/$H2.tar.gz | cut -d' ' -f1)"
  promote hub "$H2" "$TD"
  assert "parent-relative archive member -> exit 2" test "$RC" -eq 2
  # Escaping symlink.
  sudo -u build-hub bash -c "set -e; d=\$(mktemp -d); tar -xzf /srv/build/hub/out/$A.tar.gz -C \$d 2>/dev/null || true; ln -s /etc/shadow \$d/leak; tar -czf /srv/build/hub/out/$H2.tar.gz -C \$d ."
  TD="$(sha256sum /srv/build/hub/out/$H2.tar.gz | cut -d' ' -f1)"
  promote hub "$H2" "$TD"
  assert "symlink escaping the release -> exit 2" test "$RC" -eq 2
  # Conflicting port in the secrets file.
  build hub "$H2"
  echo 'PORT=4444' >> /srv/hub/secrets/runtime.env
  promote hub "$H2" "$DIGEST"
  assert "PORT in runtime.env -> exit 2" test "$RC" -eq 2
  sed -i '/^PORT=/d' /srv/hub/secrets/runtime.env
  # Conflicting port across apps.
  write_conf other 3000
  promote hub "$H2" "$DIGEST"
  assert "port shared with another app config -> exit 2" test "$RC" -eq 2
  rm -f /etc/entrepreneuria/apps/other.conf

  section "imposter on the port is not accepted"
  systemctl stop entrepreneuria-app@hub.service
  mkdir -p /tmp/imp && echo '<title>Entrepreneuria Fixture</title>' > /tmp/imp/index.html
  (cd /tmp/imp && setsid sudo -u nobody python3 -m http.server 3000 --bind 127.0.0.1 >/dev/null 2>&1 &)
  sleep 1
  promote hub "$H2" "$DIGEST"
  assert "imposter serving the marker: not healthy (exit 3/4)" test "$RC" -eq 3 -o "$RC" -eq 4
  assert "...imposter rejected by cgroup/cwd check" grep -qE "not in entrepreneuria-app@hub|exited after start" <<<"$OUT"
  pkill -f "http.server 3000"; sleep 1
  promote hub --rollback
  assert "explicit --rollback re-activates verified last-good" test "$RC" -eq 0 -a "$(current hub)" = "$A"

  section "successful upgrade and serialization"
  ( flock /run/lock/entrepreneuria-promote.lock sleep 6 ) & sleep 0.5
  local t0=$SECONDS
  promote hub "$H2" "$DIGEST"
  assert "upgrade to second healthy release exits 0" test "$RC" -eq 0
  assert "promotion waited for the held lock" bash -c "grep -q 'waiting for the lock' <<<\"\$0\" && (( $SECONDS - $t0 >= 5 ))" "$OUT"
  assert "last-good = H2" test "$(cat /srv/hub/state/last-good)" = "$H2"
  wait

  section "rollback target must verify"
  echo tampered >> /srv/hub/releases/$H2/package.json   # simulate tampering of the last-good release
  build hub "$B"
  promote hub "$B" "$DIGEST"
  assert "rollback target fails verification -> exit 4" test "$RC" -eq 4
  assert "...service stopped" bash -c '! systemctl is-active --quiet entrepreneuria-app@hub.service'
  assert "...release selection cleared" test ! -e /srv/hub/live/current
  promote hub --rollback
  assert "explicit --rollback refuses a tampered last-good" test "$RC" -eq 2
  sed -i '$ d' /srv/hub/releases/$H2/package.json
  promote hub --rollback
  assert "restored last-good verifies and activates" test "$RC" -eq 0 -a "$(current hub)" = "$H2"

  section "rollback fails health -> stop and clear"
  # Healthy-at-promotion release becomes unhealthy (e.g. a dependency outage): simulate by blocking its port.
  build hub "$C"
  systemctl stop entrepreneuria-app@hub.service
  (setsid sudo -u nobody python3 -c 'import socket,time; s=socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1); s.bind(("127.0.0.1",3000)); s.listen(); time.sleep(300)' >/dev/null 2>&1 &)
  sleep 1
  promote hub "$C" "$DIGEST"
  assert "new release and rollback both unhealthy -> exit 4" test "$RC" -eq 4
  assert "...service stopped and selection cleared" bash -c '! systemctl is-active --quiet entrepreneuria-app@hub.service && test ! -e /srv/hub/live/current'
  pkill -f 'time\.sleep\(300\)'; sleep 1
  promote hub --rollback
  assert "recovered with --rollback" test "$RC" -eq 0

  section "first deployment failure on a new app"
  write_conf hub2 3001
  "$OPS/bin/provision-app.sh" hub2 --apply >/dev/null 2>&1 || bad "provision hub2"
  build hub2 "$B"
  promote hub2 "$B" "$DIGEST"
  assert "failed first activation -> exit 4" test "$RC" -eq 4
  assert "...not enabled at boot" bash -c '! systemctl is-enabled --quiet entrepreneuria-app@hub2.service'
  assert "...no release selected, unit stopped" bash -c 'test ! -e /srv/hub2/live/current && ! systemctl is-active --quiet entrepreneuria-app@hub2.service'
  assert "build-hub cannot enter build-hub2's dir" bash -c "! sudo -u build-hub ls /srv/build/hub2 2>/dev/null"

  section "verifier detects unsafe states (read-only)"
  # Read-only: a verifier run must not change ownership, modes, sizes or mtimes
  # anywhere it inspects (the app's own runtime cache under var/ is excluded).
  snap() { find /srv /etc/entrepreneuria /etc/sudoers.d /etc/systemd/system /usr/local -path '/srv/*/var' -prune -o -printf '%p %m %U %G %s %T@\n' 2>/dev/null | sort | sha256sum; }
  before="$(snap)"
  /usr/local/sbin/entrepreneuria-verify hub >/tmp/v2.txt 2>&1; assert "baseline verifier pass" test $? -eq 0
  after="$(snap)"
  assert "verifier run changed nothing on disk" test "$before" = "$after"
  (setsid python3 -m http.server 9999 --bind 0.0.0.0 >/dev/null 2>&1 &); sleep 1
  /usr/local/sbin/entrepreneuria-verify hub >/tmp/v3.txt 2>&1; assert "unexpected public listener -> FAIL" test $? -ne 0
  grep "unexpected public" /tmp/v3.txt | sed 's/^/      | /'
  pkill -f "http.server 9999"; sleep 1
  echo 'build-hub ALL=(root) NOPASSWD: /usr/bin/true' > /etc/sudoers.d/zz-test; chmod 0440 /etc/sudoers.d/zz-test
  /usr/local/sbin/entrepreneuria-verify hub >/tmp/v4.txt 2>&1; assert "sudo grant to build user -> FAIL" test $? -ne 0
  rm -f /etc/sudoers.d/zz-test
  chmod g+w "/srv/hub/releases/$(current hub)/package.json"
  /usr/local/sbin/entrepreneuria-verify hub >/tmp/v5.txt 2>&1; assert "group-writable release file -> FAIL" test $? -ne 0
  chmod g-w "/srv/hub/releases/$(current hub)/package.json"
  userdel build-hub2 2>/dev/null
  /usr/local/sbin/entrepreneuria-verify hub2 >/tmp/v6.txt 2>&1; assert "missing identity -> FAIL (not treated as denied)" test $? -ne 0
  assert "...reported as missing user / probe error" grep -qE "FAIL  user build-hub2 exists|probe error" /tmp/v6.txt
  /usr/local/sbin/entrepreneuria-verify hub >/tmp/v7.txt 2>&1; assert "verifier passes again after reverting" test $? -eq 0

  section "nginx (Ubuntu 24.04 stock package)"
  echo "      nginx $(nginx -v 2>&1 | sed 's/.*\///')"
  install -m 0644 "$OPS/nginx/00-entrepreneuria-http.conf" /etc/nginx/conf.d/
  install -d /var/www/acme
  sed 's/<host>/hub.test/g; s/<owner-email>/x@example.invalid/' "$OPS/nginx/entrepreneuria-app.bootstrap.conf.example" > /etc/nginx/sites-enabled/hub.test.conf
  assert "bootstrap (HTTP-only) config passes nginx -t" nginx -t -q
  install -d /etc/letsencrypt/live/hub.test
  openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj /CN=hub.test -keyout /etc/letsencrypt/live/hub.test/privkey.pem -out /etc/letsencrypt/live/hub.test/fullchain.pem >/dev/null 2>&1
  sed 's/<host>/hub.test/g; s/<port>/3000/g' "$OPS/nginx/entrepreneuria-app.tls.conf.example" > /etc/nginx/sites-enabled/hub.test.conf
  nginx -t >/tmp/nginx-t.txt 2>&1; assert "TLS config (listen ... ssl http2) passes nginx -t" test $? -eq 0 || cat /tmp/nginx-t.txt
  systemctl restart nginx
  body="$(curl -sk --resolve hub.test:443:127.0.0.1 -H 'X-Real-IP: 6.6.6.6' -H 'X-Forwarded-For: 6.6.6.6' -H 'X-Forwarded-Host: evil.test' https://hub.test/)"
  assert "proxied over TLS to the app" grep -q "Entrepreneuria Fixture" <<<"$body"
  assert "spoofed X-Real-IP/X-Forwarded-For overwritten" bash -c "grep -q 'xri=127.0.0.1 xff=127.0.0.1' <<<\"\$0\"" "$body"
  assert "Host and X-Forwarded-Host both = visitor host" bash -c "grep -q 'host=hub.test xfh=hub.test' <<<\"\$0\"" "$body"
  assert "unknown host on :80 dropped (444)" bash -c '! curl -s -o /dev/null -H "Host: unknown.test" http://127.0.0.1/'
  assert "unknown SNI on :443 handshake refused" bash -c '! curl -sk --resolve unknown.test:443:127.0.0.1 https://unknown.test/ -o /dev/null'
  if ip -6 addr show lo | grep -q '::1'; then
    assert "IPv6 :443 serves the site" bash -c "curl -sk -g --resolve 'hub.test:443:[::1]' https://hub.test/ | grep -q 'Entrepreneuria Fixture'"
  else
    echo "      (IPv6 unavailable in this container: v6 listeners not exercised)"
  fi
  /usr/local/sbin/entrepreneuria-verify hub >/tmp/v8.txt 2>&1; assert "verifier passes with nginx on :80/:443" test $? -eq 0
  grep -E "^FAIL" /tmp/v8.txt | sed 's/^/      | /'

  section "systemd hardening score (informational)"
  systemd-analyze security entrepreneuria-app@hub.service 2>/dev/null | tail -1 | sed 's/^/      /'
}

phase2() {
  section "after container restart (boot)"
  sleep 3
  local sha; sha="$(current hub)"
  assert "hub unit started at boot" systemctl is-active --quiet entrepreneuria-app@hub.service
  . /usr/local/lib/entrepreneuria/common.sh
  assert "hub healthy at boot on the selected release" health_check hub "$sha" 60
  assert "hub2 (never activated) not started at boot" bash -c '! systemctl is-active --quiet entrepreneuria-app@hub2.service'
}

"${1:-phase1}"
echo; echo "SUMMARY: $PASSES passed, $FAILS failed"
(( FAILS == 0 ))

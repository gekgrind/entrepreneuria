#!/usr/bin/env bash
# Scenario tests for ops/vps, run as root INSIDE the disposable Ubuntu 24.04
# container started by run-in-docker.sh. Dummy credentials only.
#   run-tests.sh phase1   # everything except reboot (ends with an interrupted promotion pending)
#   run-tests.sh phase2   # after a container restart: boot selects only the verified release
#
# Failure injection uses wrapper binaries swapped in for real ones inside this
# throwaway container (systemctl, curl, git, rm, ss). The production scripts
# contain no test hooks.
set -uo pipefail
OPS="${OPS:-/opt/ops-vps}"
PASSES=0; FAILS=0
ok()   { echo "  PASS  $*"; PASSES=$((PASSES+1)); }
bad()  { echo "  FAIL  $*"; FAILS=$((FAILS+1)); }
assert() { local d="$1"; shift; if "$@"; then ok "$d"; else bad "$d"; fi; }
section() { echo; echo "== $*"; }
sha_of() { sed -n "s/^$1=//p" /opt/fixture.shas; }
current() { readlink /srv/"$1"/live/current 2>/dev/null | xargs -r basename; }
running_release() { local p; p="$(systemctl show -p MainPID --value "entrepreneuria-app@$1.service")"; [[ "$p" != 0 ]] && readlink "/proc/$p/cwd" | xargs -r basename; }
P=/usr/local/sbin/entrepreneuria-promote
build() {  # <app> <sha> -> sets DIGEST
  local out; DIGEST=""
  out="$(sudo -u "build-$1" /usr/local/bin/entrepreneuria-build "$1" "$2" 2>&1)" || { echo "$out" | tail -5; return 1; }
  DIGEST="$(sed -n 's/^ARTIFACT_SHA256=//p' <<<"$out")"
}
promote() {  # <args...> -> sets RC, OUT
  OUT="$("$P" "$@" 2>&1)"; RC=$?
  echo "$OUT" | sed 's/^/      | /' | tail -6
}
write_conf() {  # <app> <port>
  install -d -m 0755 /etc/entrepreneuria/apps
  printf 'APP_ID=%s\nREPO_URL=file:///opt/fixture.git\nPORT=%s\nHEALTH_PATH=/\nHEALTH_MARKER=<title>Entrepreneuria Fixture\nMEMORY_MAX=512M\n' "$1" "$2" > "/etc/entrepreneuria/apps/$1.conf"
  chmod 0644 "/etc/entrepreneuria/apps/$1.conf"
}
# --- failure injection: replace a binary with a wrapper; unwrap restores it ---
wrap()   { local bin="$1"; [[ -e "$bin.real" ]] || mv "$bin" "$bin.real"; cat > "$bin"; chmod 0755 "$bin"; }
unwrap() { [[ -e "$1.real" ]] && mv -f "$1.real" "$1"; }
KILL_PROMOTER='pkill -KILL -f "sbin/entrepreneuria-promote" ; sleep 0.2'
# --- malicious artifacts: written by the build user, approved by digest -------------
SENTINELS="/tmp/pwned-abs /tmp/pwned-trav /tmp/pwned-through /srv/hub/pwned /srv/pwned /var/lib/entrepreneuria/pwned /etc/pwned"
sentinels_absent() { local s; for s in $SENTINELS; do [[ ! -e "$s" && ! -L "$s" ]] || { echo "      sentinel present: $s"; return 1; }; done; }
make_tar() {  # <sha> <python statements using tf, add_file, add_dir, add_sym>; written as build-hub
  sudo -u build-hub python3 - "/srv/build/hub/out/$1.tar.gz" "$2" <<'PY'
import io, sys, tarfile
out, body = sys.argv[1], sys.argv[2]
tf = tarfile.open(out, "w:gz", format=tarfile.PAX_FORMAT)
def add_file(name, data=b"x", mode=0o644, **kw):
    ti = tarfile.TarInfo(name); ti.size = len(data); ti.mode = mode
    for k, v in kw.items(): setattr(ti, k, v)
    tf.addfile(ti, io.BytesIO(data))
def add_dir(name, mode=0o755):
    ti = tarfile.TarInfo(name); ti.type = tarfile.DIRTYPE; ti.mode = mode; tf.addfile(ti)
def add_sym(name, target):
    ti = tarfile.TarInfo(name); ti.type = tarfile.SYMTYPE; ti.linkname = target; ti.mode = 0o777; tf.addfile(ti)
def add_raw(name, typ, linkname=""):
    ti = tarfile.TarInfo(name); ti.type = typ; ti.linkname = linkname; ti.mode = 0o644; tf.addfile(ti)
add_dir("./")
exec(body)
tf.close()
PY
  sha256sum "/srv/build/hub/out/$1.tar.gz" | cut -d' ' -f1
}

phase1() {
  section "setup: fixture repo and provisioning"
  "$OPS/test/fixture/make-fixture.sh" >/dev/null && ok "fixture repo created" || { bad "fixture repo"; return; }
  write_conf hub 3000
  "$OPS/bin/provision-app.sh" hub >/tmp/dry.txt 2>&1; assert "provision dry run succeeds" test $? -eq 0
  assert "dry run changes nothing" test ! -e /srv/hub -a ! -e /var/lib/entrepreneuria/hub
  "$OPS/bin/provision-app.sh" hub --apply >/tmp/prov.txt 2>&1; assert "provision --apply succeeds" test $? -eq 0 || cat /tmp/prov.txt
  "$OPS/bin/provision-app.sh" hub --apply >/dev/null 2>&1; assert "provision is idempotent on a safe host" test $? -eq 0
  echo 'API_SECRET=dummy-not-real' >> /srv/hub/secrets/runtime.env
  echo 'NEXT_PUBLIC_FIXTURE=public-value' >> /srv/hub/config/build.env
  assert "stage user created (system, nologin)" bash -c '[[ "$(getent passwd stage-hub | cut -d: -f7)" == /usr/sbin/nologin ]]'
  assert "promoter-private dirs root-owned" bash -c '[[ "$(stat -c "%U:%G %a" /var/lib/entrepreneuria/hub/lock)" == "root:root 700" ]]'
  assert "unit not enabled by provisioning" bash -c '! systemctl is-enabled --quiet entrepreneuria-app@hub.service'
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
  rm -rf /srv/evil /etc/entrepreneuria/apps/evil.conf; userdel app-evil 2>/dev/null; userdel build-evil 2>/dev/null; userdel stage-evil 2>/dev/null

  local A B C D E F PB NL H2 DA DH2; declare -A DG
  A="$(sha_of healthy)"; B="$(sha_of crash)"; C="$(sha_of http500)"; D="$(sha_of redirect)"
  E="$(sha_of wrongapp)"; F="$(sha_of hang)"; PB="$(sha_of public)"; NL="$(sha_of nolisten)"; H2="$(sha_of healthy2)"

  section "initial deployment"
  build hub "$A" && ok "build as build-hub" || bad "build"; DA="$DIGEST"
  assert "runtime secret absent from the build artifact" bash -c "! tar -xzOf /srv/build/hub/out/$A.tar.gz | grep -qa dummy-not-real"
  assert "public build value present in the artifact" bash -c "tar -xzOf /srv/build/hub/out/$A.tar.gz ./.next/public-env | grep -q public-value"
  local runlock_before; runlock_before="$(stat -c '%U:%G %a %i' /run/lock)"
  promote hub "$A" "$DA"
  assert "first promotion exits 0" test "$RC" -eq 0
  assert "/run/lock untouched by the promoter" test "$(stat -c '%U:%G %a %i' /run/lock)" = "$runlock_before"
  assert "live/current (verified boot selection) -> A" test "$(current hub)" = "$A"
  assert "unit enabled only after healthy activation" systemctl is-enabled --quiet entrepreneuria-app@hub.service
  assert "no candidate drop-in left behind" test ! -e /run/systemd/system/entrepreneuria-app@hub.service.d/zz-candidate.conf
  assert "release tree root-owned, no group/world write" test -z "$(find /srv/hub/releases/$A ! -type l \( ! -user root -o -perm /022 \) -print -quit)"
  assert "tracked executable kept 0755, others 0644" bash -c "[[ \$(stat -c %a /srv/hub/releases/$A/fake-next/dist/bin/next) == 755 && \$(stat -c %a /srv/hub/releases/$A/package.json) == 644 ]]"
  assert "runtime cache written through sandbox (.next/cache -> var/cache)" test -f /srv/hub/var/cache/runtime-probe
  assert "build-only cache not shipped" test ! -e /srv/hub/var/cache/build-only
  assert "app process runs as app-hub" test "$(ps -o user= -p "$(systemctl show -p MainPID --value entrepreneuria-app@hub.service)")" = app-hub
  assert "app process gets the secret from PID 1" bash -c "tr '\0' '\n' < /proc/$(systemctl show -p MainPID --value entrepreneuria-app@hub.service)/environ | grep -q '^API_SECRET=dummy-not-real$'"

  section "runtime, build and stage user isolation"
  for u in app-hub build-hub stage-hub; do
    assert "$u cannot read runtime.env" bash -c "! sudo -u $u cat /srv/hub/secrets/runtime.env 2>/dev/null"
    assert "$u cannot create files in releases" bash -c "! sudo -u $u touch /srv/hub/releases/x 2>/dev/null"
    assert "$u cannot modify the active release" bash -c "! sudo -u $u sh -c 'echo x >> /srv/hub/releases/$A/package.json' 2>/dev/null"
    assert "$u cannot repoint live/current" bash -c "! sudo -u $u ln -sfn /tmp /srv/hub/live/current 2>/dev/null"
    assert "$u cannot touch the promotion lock" bash -c "! sudo -u $u ls /var/lib/entrepreneuria/hub/lock 2>/dev/null"
    assert "$u cannot read staged artifacts" bash -c "! sudo -u $u ls /var/lib/entrepreneuria/hub/artifacts 2>/dev/null"
  done
  assert "promoter not executable by non-root" test "$(stat -c %a /usr/local/sbin/entrepreneuria-promote)" = 700

  section "verifier on a healthy host (read-only)"
  snap() { find /srv /etc/entrepreneuria /etc/sudoers.d /etc/systemd/system /usr/local /var/lib/entrepreneuria -path '/srv/*/var' -prune -o -printf '%p %m %U %G %s %T@\n' 2>/dev/null | sort | sha256sum; }
  local before after; before="$(snap)"
  /usr/local/sbin/entrepreneuria-verify hub >/tmp/v1.txt 2>&1; RCV=$?
  after="$(snap)"
  grep -E "^(FAIL|RESULT)" /tmp/v1.txt | sed 's/^/      | /'
  assert "verifier passes" test "$RCV" -eq 0
  assert "verifier run changed nothing on disk" test "$before" = "$after"

  section "promotion lock: adversarial paths"
  local LK=/var/lib/entrepreneuria/hub/lock
  echo original > /root/lock-target; local tgt_before; tgt_before="$(sha256sum /root/lock-target)"
  rm -f "$LK/promote.lock"; ln -s /root/lock-target "$LK/promote.lock"
  promote hub --rollback "$A" "$DA"
  assert "symlinked lock file -> rejected (exit 2)" test "$RC" -eq 2
  assert "...symlink target untouched" test "$(sha256sum /root/lock-target)" = "$tgt_before"
  rm -f "$LK/promote.lock"; install -m 0644 /dev/null "$LK/promote.lock"
  promote hub --rollback "$A" "$DA"
  assert "lock file with wrong mode -> rejected" test "$RC" -eq 2
  rm -f "$LK/promote.lock"; touch /root/hl-target; ln /root/hl-target "$LK/promote.lock"; chmod 0600 "$LK/promote.lock"
  promote hub --rollback "$A" "$DA"
  assert "hard-linked lock file -> rejected" test "$RC" -eq 2
  rm -f "$LK/promote.lock"
  chmod 0777 "$LK"; promote hub --rollback "$A" "$DA"
  assert "group/world-writable lock dir -> rejected" test "$RC" -eq 2
  chmod 0700 "$LK"
  mv "$LK" "$LK.real"; mkdir -m 0700 /root/fake-lock; ln -s /root/fake-lock "$LK"
  promote hub --rollback "$A" "$DA"
  assert "symlinked lock dir -> rejected" test "$RC" -eq 2
  assert "...nothing created through it" test -z "$(ls -A /root/fake-lock)"
  rm "$LK"; mv "$LK.real" "$LK"
  [[ -e "$LK/promote.lock" ]] || install -m 0600 -o root -g root /dev/null "$LK/promote.lock"
  ( flock "$LK/promote.lock" sleep 6 ) & sleep 0.5
  local t0=$SECONDS
  promote hub --rollback "$A" "$DA"
  assert "explicit --rollback with the right digest re-activates the selection" test "$RC" -eq 0
  assert "...after waiting for the held lock (serialized)" bash -c "grep -q 'waiting for the lock' <<<\"\$0\" && (( $SECONDS - $t0 >= 5 ))" "$OUT"
  wait

  section "malicious artifacts never write outside staging"
  local shadow_before; shadow_before="$(sha256sum /etc/shadow)"
  local rel_before; rel_before="$(ls -A /srv/hub/releases | sort | xargs)"
  local name body TD
  while IFS='|' read -r name body; do
    TD="$(make_tar "$H2" "$body")"
    promote hub "$H2" "$TD"
    assert "$name -> rejected before publication (exit 2)" test "$RC" -eq 2
  done <<'CASES'
absolute path member|add_file("/tmp/pwned-abs")
parent traversal member|add_file("../../../../tmp/pwned-trav")
absolute symlink|add_sym("leak", "/etc/shadow")
escaping relative symlink|add_sym("up", "../../../../etc")
chained symlink escape|add_sym("e", "."); add_sym("f", "e/../../../../tmp")
write through symlinked dir|add_sym("d", "."); add_file("d/pwned-through")
write through escaping dir link|add_sym("d", "../../../../tmp"); add_file("d/pwned-through")
hard link to a host file|add_raw("hl", tarfile.LNKTYPE, "/etc/shadow")
hard link inside archive|add_file("a"); add_raw("b", tarfile.LNKTYPE, "a")
FIFO member|add_raw("fifo", tarfile.FIFOTYPE)
character device|add_raw("dev", tarfile.CHRTYPE)
setuid file|add_file("suid", mode=0o4755)
world-writable file|add_file("ww", mode=0o666)
reserved RELEASE|add_file("RELEASE", b"app=hub")
reserved .next/cache link|add_dir(".next"); add_sym(".next/cache", "/")
reserved .git|add_dir(".git"); add_file(".git/config")
symlink into reserved path|add_sym("c", ".next/cache")
duplicate member|add_file("dup"); add_file("dup", b"y")
CASES
  assert "no sentinel file written anywhere" sentinels_absent
  assert "/etc/shadow unchanged" test "$(sha256sum /etc/shadow)" = "$shadow_before"
  assert "no release published or staged" test "$(ls -A /srv/hub/releases | sort | xargs)" = "$rel_before"
  # Defence in depth: even if `check` were bypassed, the unprivileged extractor stays confined.
  TD="$(make_tar "$H2" 'add_file("../../../../tmp/pwned-trav"); add_sym("leak", "/etc"); add_file("/tmp/pwned-abs")')"
  install -d -m 0700 -o stage-hub -g stage-hub /var/lib/entrepreneuria/hub/extract/direct-test
  runuser -u stage-hub -- python3 -I -S /usr/local/lib/entrepreneuria/archive_tool.py extract /var/lib/entrepreneuria/hub/extract/direct-test < "/srv/build/hub/out/$H2.tar.gz" >/dev/null 2>&1
  assert "direct unprivileged extraction of a malicious archive fails" test $? -ne 0
  assert "...and writes nothing outside its directory" sentinels_absent
  rm -rf /var/lib/entrepreneuria/hub/extract/direct-test
  install -d -m 0700 -o root -g root /var/lib/entrepreneuria/hub/extract/rootdir
  python3 -I -S /usr/local/lib/entrepreneuria/archive_tool.py extract /var/lib/entrepreneuria/hub/extract/rootdir < "/srv/build/hub/out/$H2.tar.gz" >/dev/null 2>&1
  assert "extractor refuses to run as root" test $? -ne 0
  rm -rf /var/lib/entrepreneuria/hub/extract/rootdir

  section "approval binding and source integrity"
  build hub "$H2"; DH2="$DIGEST"
  # Changed tracked file mode (100644 -> executable), repacked by the build user.
  sudo -u build-hub bash -c "set -e; d=\$(mktemp -d); tar -xzf /srv/build/hub/out/$H2.tar.gz -C \$d; chmod +x \$d/package.json; tar -czf /srv/build/hub/out/$H2.tar.gz -C \$d ."
  TD="$(sha256sum /srv/build/hub/out/$H2.tar.gz | cut -d' ' -f1)"
  promote hub "$H2" "$TD"
  assert "changed executable mode on a tracked file -> exit 2" test "$RC" -eq 2
  assert "...reported as a source mode mismatch" grep -q "source mode mismatch" <<<"$OUT"
  # Changed tracked content.
  build hub "$H2"
  sudo -u build-hub bash -c "set -e; d=\$(mktemp -d); tar -xzf /srv/build/hub/out/$H2.tar.gz -C \$d; echo wrongapp > \$d/mode.txt; tar -czf /srv/build/hub/out/$H2.tar.gz -C \$d ."
  TD="$(sha256sum /srv/build/hub/out/$H2.tar.gz | cut -d' ' -f1)"
  promote hub "$H2" "$TD"
  assert "changed tracked content -> exit 2" test "$RC" -eq 2
  # Failed / incomplete git manifest generation.
  build hub "$H2"; DH2="$DIGEST"
  wrap /usr/bin/git <<'W'
#!/bin/bash
if [[ " $* " == *" ls-tree "* && "$*" == *"--format"* ]]; then
  /usr/bin/git.real "$@" | head -c 40; exit 1
fi
exec /usr/bin/git.real "$@"
W
  promote hub "$H2" "$DH2"
  assert "git ls-tree failing mid-enumeration -> exit 2" test "$RC" -eq 2
  assert "...reported as manifest failure" grep -q "manifest" <<<"$OUT"
  wrap /usr/bin/git <<'W'
#!/bin/bash
if [[ " $* " == *" ls-tree "* && "$*" == *"--format"* ]]; then
  /usr/bin/git.real "$@" | head -z -n 2; exit 0
fi
exec /usr/bin/git.real "$@"
W
  promote hub "$H2" "$DH2"
  assert "truncated manifest reported as success -> exit 2" test "$RC" -eq 2
  unwrap /usr/bin/git
  assert "no release published by any rejected artifact" test ! -e "/srv/hub/releases/$H2"

  section "failure modes roll back to the verified selection"
  for case in "crash:$B" "http500:$C" "redirect:$D" "wrongapp:$E" "hang:$F" "public-bind:$PB"; do
    local cname="${case%%:*}" csha="${case#*:}" t1=$SECONDS
    build hub "$csha" || { bad "build $cname"; continue; }; DG[$csha]="$DIGEST"
    promote hub "$csha" "$DIGEST"
    assert "$cname: exits 3 (rolled back)" test "$RC" -eq 3
    assert "$cname: selection still A, A running" test "$(current hub)" = "$A" -a "$(running_release hub)" = "$A"
    assert "$cname: A healthy after rollback" curl -fsS --max-time 5 http://127.0.0.1:3000/ -o /dev/null
    echo "      ($cname took $((SECONDS - t1))s)"
  done

  section "listener identity: wrong UID and wrong cgroup are rejected"
  build hub "$NL"; local DNL="$DIGEST"
  for who in nobody app-hub; do
    # Imposter keeps retrying the bind so it takes the port as soon as A is restarted away.
    runuser -u "$who" -- python3 -c '
import http.server, socketserver, time
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(s):
        s.send_response(200); s.end_headers(); s.wfile.write(b"<title>Entrepreneuria Fixture</title>")
    def log_message(s, *a): pass
while True:
    try: srv = socketserver.TCPServer(("127.0.0.1", 3000), H); break
    except OSError: time.sleep(0.1)
srv.serve_forever()' >/dev/null 2>&1 &
    local imp=$!
    promote hub "$NL" "$DNL"
    if [[ "$who" == nobody ]]; then
      assert "imposter as $who: rejected by the UID check" grep -q "runs as uid" <<<"$OUT"
    else
      assert "imposter as $who (right UID): rejected by the exact cgroup check" grep -q "is in cgroup" <<<"$OUT"
    fi
    assert "...never approved: selection still A" test "$(current hub)" = "$A"
    assert "...not reported as safely stopped while the imposter holds the port (exit 5)" test "$RC" -eq 5
    pkill -f "socketserver.TCPServer" ; kill "$imp" 2>/dev/null; sleep 1
    promote hub --recover
    assert "...--recover restores A (exit 0)" test "$RC" -eq 0 -a "$(running_release hub)" = "$A"
  done

  section "promotion gates"
  echo 'PORT=4444' >> /srv/hub/secrets/runtime.env
  promote hub "$H2" "$DH2"; assert "PORT in runtime.env -> exit 2" test "$RC" -eq 2
  sed -i '/^PORT=/d' /srv/hub/secrets/runtime.env
  write_conf other 3000
  promote hub "$H2" "$DH2"; assert "port shared with another app config -> exit 2" test "$RC" -eq 2
  rm -f /etc/entrepreneuria/apps/other.conf

  section "upgrade, then digest binding on existing releases"
  promote hub "$H2" "$DH2"
  assert "upgrade to H2 exits 0" test "$RC" -eq 0 -a "$(current hub)" = "$H2"
  promote hub "$H2" "$DA"
  assert "existing release with a different approved digest -> exit 2" test "$RC" -eq 2
  assert "...reported as artifact mismatch" grep -q "does not match the approved artifact" <<<"$OUT"
  promote hub --rollback "$H2" "$DA"
  assert "--rollback with the wrong digest -> exit 2" test "$RC" -eq 2
  promote hub --rollback "$A" "$DA"
  assert "--rollback to a release that is not the selection -> exit 2" test "$RC" -eq 2
  promote hub "$A" "$DA"
  assert "re-activating existing A with its own digest -> exit 0" test "$RC" -eq 0 -a "$(current hub)" = "$A"
  promote hub "$H2" "$DH2"
  assert "back to H2 -> exit 0" test "$RC" -eq 0

  section "interrupted promotion (SIGKILL at each stage)"
  # (1) after candidate selection, before restart
  wrap /usr/bin/systemctl <<W
#!/bin/bash
/usr/bin/systemctl.real "\$@"; rc=\$?
[[ "\$1" == daemon-reload && -e /run/systemd/system/entrepreneuria-app@hub.service.d/zz-candidate.conf ]] && { $KILL_PROMOTER; }
exit \$rc
W
  promote hub "$A" "$DA"; unwrap /usr/bin/systemctl
  assert "killed after candidate selection" test "$RC" -eq 137
  assert "...selection still H2, H2 still running" test "$(current hub)" = "$H2" -a "$(running_release hub)" = "$H2"
  promote hub "$A" "$DA"
  assert "...new promotion refused while interrupted state is pending" bash -c "[[ $RC -eq 2 ]] && grep -q 'interrupted promotion' <<<\"\$0\"" "$OUT"
  promote hub --recover
  assert "...--recover -> H2 healthy, candidate cleared" test "$RC" -eq 0 -a "$(running_release hub)" = "$H2" -a ! -e /run/entrepreneuria/hub/candidate
  # (2) at service restart (candidate now running, never approved)
  wrap /usr/bin/systemctl <<W
#!/bin/bash
/usr/bin/systemctl.real "\$@"; rc=\$?
[[ "\$1" == restart ]] && { $KILL_PROMOTER; }
exit \$rc
W
  promote hub "$A" "$DA"; unwrap /usr/bin/systemctl
  assert "killed at restart: candidate running but selection still H2" test "$RC" -eq 137 -a "$(running_release hub)" = "$A" -a "$(current hub)" = "$H2"
  promote hub --recover
  assert "...--recover returns to the verified selection H2" test "$RC" -eq 0 -a "$(running_release hub)" = "$H2"
  # (3) during readiness verification
  wrap /usr/bin/curl <<W
#!/bin/bash
$KILL_PROMOTER
exec /usr/bin/curl.real "\$@"
W
  promote hub "$A" "$DA"; unwrap /usr/bin/curl
  assert "killed during readiness: selection unchanged (H2)" test "$RC" -eq 137 -a "$(current hub)" = "$H2"
  /usr/local/sbin/entrepreneuria-verify hub >/tmp/v-int.txt 2>&1
  assert "...verifier flags the pending candidate" grep -q "FAIL  no interrupted candidate pending" /tmp/v-int.txt
  promote hub --recover
  assert "...--recover -> H2" test "$RC" -eq 0 -a "$(running_release hub)" = "$H2"
  # (4) during final approval (after the selection switched, before enable)
  wrap /usr/bin/systemctl <<W
#!/bin/bash
[[ "\$1" == is-enabled ]] && { $KILL_PROMOTER; }
exec /usr/bin/systemctl.real "\$@"
W
  promote hub "$A" "$DA"; unwrap /usr/bin/systemctl
  assert "killed at final approval: the approved release is the selection" test "$RC" -eq 137 -a "$(current hub)" = "$A" -a "$(running_release hub)" = "$A"
  assert "...candidate drop-in already cleared" test ! -e /run/systemd/system/entrepreneuria-app@hub.service.d/zz-candidate.conf
  promote hub --recover
  assert "...--recover keeps the approved A" test "$RC" -eq 0 -a "$(running_release hub)" = "$A"
  promote hub "$H2" "$DH2"; assert "back to H2" test "$RC" -eq 0

  section "failed cleanup and failed stop are reported as UNSAFE, never as stopped"
  local DB="${DG[$B]}"
  wrap /usr/bin/rm <<'W'
#!/bin/bash
for a in "$@"; do [[ "$a" == *zz-candidate.conf ]] && { echo "rm: injected failure" >&2; exit 1; }; done
exec /usr/bin/rm.real "$@"
W
  promote hub "$B" "$DB"; unwrap /usr/bin/rm
  assert "candidate drop-in cannot be removed -> exit 5 (UNSAFE)" bash -c "[[ $RC -eq 5 ]] && grep -q UNSAFE <<<\"\$0\"" "$OUT"
  assert "...selection unchanged (H2)" test "$(current hub)" = "$H2"
  promote hub --recover
  assert "...--recover after the fault clears -> H2 (exit 0)" test "$RC" -eq 0 -a "$(running_release hub)" = "$H2"
  write_conf hub2 3001
  "$OPS/bin/provision-app.sh" hub2 --apply >/dev/null 2>&1 || bad "provision hub2"
  build hub2 "$NL"
  wrap /usr/bin/systemctl <<'W'
#!/bin/bash
[[ "$1" == stop && "$2" == entrepreneuria-app@hub2.service ]] && { echo "stop: injected failure" >&2; exit 1; }
exec /usr/bin/systemctl.real "$@"
W
  promote hub2 "$NL" "$DIGEST"; unwrap /usr/bin/systemctl
  assert "systemctl stop fails, unit still running -> exit 5, not 'stopped'" bash -c "[[ $RC -eq 5 ]] && ! grep -q 'stopped entrepreneuria-app@hub2' <<<\"\$0\"" "$OUT"
  promote hub2 --recover
  assert "...--recover once stop works -> exit 4, unit inactive, no listener" bash -c "[[ $RC -eq 4 ]] && ! systemctl is-active --quiet entrepreneuria-app@hub2.service && [[ -z \$(ss -Htln 'sport = :3001') ]]"

  section "first deployment failure on a new app"
  build hub2 "$B"
  promote hub2 "$B" "$DIGEST"
  assert "failed first activation -> exit 4" test "$RC" -eq 4
  assert "...not enabled at boot, nothing selected, unit stopped" bash -c '! systemctl is-enabled --quiet entrepreneuria-app@hub2.service && test ! -e /srv/hub2/live/current && ! systemctl is-active --quiet entrepreneuria-app@hub2.service'
  assert "build-hub cannot enter build-hub2's dir" bash -c "! sudo -u build-hub ls /srv/build/hub2 2>/dev/null"

  section "tampered verified selection -> stop and clear"
  echo tampered >> "/srv/hub/releases/$H2/package.json"
  promote hub "$B" "$DB"
  assert "rollback target fails verification -> exit 4" test "$RC" -eq 4
  assert "...unit stopped, selection cleared, disabled" bash -c '! systemctl is-active --quiet entrepreneuria-app@hub.service && test ! -e /srv/hub/live/current && ! systemctl is-enabled --quiet entrepreneuria-app@hub.service'
  sed -i '$ d' "/srv/hub/releases/$H2/package.json"
  promote hub "$H2" "$DH2"
  assert "restored H2 re-verified against its digest and activated" test "$RC" -eq 0 -a "$(running_release hub)" = "$H2"

  section "failed ss enumeration is a failure, never an empty result"
  wrap /usr/bin/ss <<'W'
#!/bin/bash
echo "ss: injected failure" >&2; exit 1
W
  /usr/local/sbin/entrepreneuria-verify hub >/tmp/v-ss.txt 2>&1; local rcss=$?
  ( . /usr/local/lib/entrepreneuria/common.sh; listener_pids 3000 >/dev/null 2>&1; echo $? ) > /tmp/lp.txt
  unwrap /usr/bin/ss
  assert "verifier FAILs when ss fails" test "$rcss" -ne 0
  assert "...with an explicit enumeration failure" grep -q "enumeration failed" /tmp/v-ss.txt
  assert "readiness listener lookup reports the ss failure (rc 3)" test "$(cat /tmp/lp.txt)" = 3

  section "verifier detects unsafe states"
  (setsid python3 -m http.server 9999 --bind 0.0.0.0 >/dev/null 2>&1 &); sleep 1
  /usr/local/sbin/entrepreneuria-verify hub >/tmp/v3.txt 2>&1; assert "unexpected public listener -> FAIL" test $? -ne 0
  pkill -f "http.server 9999"; sleep 1
  echo 'stage-hub ALL=(root) NOPASSWD: /usr/bin/true' > /etc/sudoers.d/zz-test; chmod 0440 /etc/sudoers.d/zz-test
  /usr/local/sbin/entrepreneuria-verify hub >/tmp/v4.txt 2>&1; assert "sudo grant to the stage user -> FAIL" test $? -ne 0
  rm -f /etc/sudoers.d/zz-test
  chmod g+w "/srv/hub/releases/$(current hub)/package.json"
  /usr/local/sbin/entrepreneuria-verify hub >/tmp/v5.txt 2>&1; assert "group-writable release file -> FAIL" test $? -ne 0
  chmod g-w "/srv/hub/releases/$(current hub)/package.json"
  userdel build-hub2 2>/dev/null
  /usr/local/sbin/entrepreneuria-verify hub2 >/tmp/v6.txt 2>&1; assert "missing identity -> FAIL (not treated as denied)" test $? -ne 0
  /usr/local/sbin/entrepreneuria-verify hub >/tmp/v7.txt 2>&1; assert "verifier passes again after reverting" test $? -eq 0
  grep -E "^FAIL" /tmp/v7.txt | sed 's/^/      | /'

  section "nginx (Ubuntu 24.04 stock package) and ACME webroot"
  echo "      nginx $(nginx -v 2>&1 | sed 's/.*\///')"
  install -m 0644 "$OPS/nginx/00-entrepreneuria-http.conf" /etc/nginx/conf.d/
  sed 's/<host>/hub.test/g' "$OPS/nginx/entrepreneuria-app.bootstrap.conf.example" > /etc/nginx/sites-enabled/hub.test.conf
  rm -rf /var/www/acme
  assert "bootstrap (HTTP-only) config passes nginx -t" nginx -t -q
  systemctl restart nginx
  /usr/local/sbin/entrepreneuria-acme-webroot hub.test >/tmp/acme.txt 2>&1
  assert "ACME webroot created and served for the host before issuance" grep -q "ACME webroot ready" /tmp/acme.txt
  assert "...webroot root-owned 0755, probe removed" bash -c '[[ "$(stat -c "%U:%G %a" /var/www/acme/.well-known/acme-challenge)" == "root:root 755" && -z "$(ls -A /var/www/acme/.well-known/acme-challenge)" ]]'
  mv /var/www/acme /var/www/acme.real; ln -s /tmp /var/www/acme
  /usr/local/sbin/entrepreneuria-acme-webroot hub.test >/tmp/acme2.txt 2>&1
  assert "...symlinked webroot rejected" grep -q "is a symlink" /tmp/acme2.txt
  rm /var/www/acme; mv /var/www/acme.real /var/www/acme
  install -d /etc/letsencrypt/live/hub.test
  openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj /CN=hub.test -keyout /etc/letsencrypt/live/hub.test/privkey.pem -out /etc/letsencrypt/live/hub.test/fullchain.pem >/dev/null 2>&1
  sed 's/<host>/hub.test/g; s/<port>/3000/g' "$OPS/nginx/entrepreneuria-app.tls.conf.example" > /etc/nginx/sites-enabled/hub.test.conf
  nginx -t >/tmp/nginx-t.txt 2>&1; assert "TLS config (listen ... ssl http2) passes nginx -t" test $? -eq 0 || cat /tmp/nginx-t.txt
  systemctl restart nginx
  local body; body="$(curl -sk --resolve hub.test:443:127.0.0.1 -H 'X-Real-IP: 6.6.6.6' -H 'X-Forwarded-For: 6.6.6.6' -H 'X-Forwarded-Host: evil.test' https://hub.test/)"
  assert "proxied over TLS to the app" grep -q "Entrepreneuria Fixture" <<<"$body"
  assert "spoofed X-Real-IP/X-Forwarded-For overwritten" bash -c "grep -q 'xri=127.0.0.1 xff=127.0.0.1' <<<\"\$0\"" "$body"
  assert "Host and X-Forwarded-Host both = visitor host" bash -c "grep -q 'host=hub.test xfh=hub.test' <<<\"\$0\"" "$body"
  assert "unknown host on :80 dropped (444)" bash -c '! curl -s -o /dev/null -H "Host: unknown.test" http://127.0.0.1/'
  assert "unknown SNI on :443 handshake refused" bash -c '! curl -sk --resolve unknown.test:443:127.0.0.1 https://unknown.test/ -o /dev/null'
  if ip -6 addr show lo | grep -q '::1'; then
    assert "IPv6 :443 serves the site" bash -c "curl -sk -g --resolve 'hub.test:443:[::1]' https://hub.test/ | grep -q 'Entrepreneuria Fixture'"
  fi
  /usr/local/sbin/entrepreneuria-verify hub >/tmp/v8.txt 2>&1; assert "verifier passes with nginx on :80/:443" test $? -eq 0
  grep -E "^FAIL" /tmp/v8.txt | sed 's/^/      | /'

  section "leave an interrupted promotion pending for the reboot test"
  wrap /usr/bin/curl <<W
#!/bin/bash
$KILL_PROMOTER
exec /usr/bin/curl.real "\$@"
W
  promote hub "$A" "$DA"; unwrap /usr/bin/curl
  assert "candidate A running unapproved; selection H2" test "$RC" -eq 137 -a "$(running_release hub)" = "$A" -a "$(current hub)" = "$H2"
  echo "$H2" > /root/expected-boot-release

  section "systemd hardening score (informational)"
  systemd-analyze security entrepreneuria-app@hub.service 2>/dev/null | tail -1 | sed 's/^/      /'
}

phase2() {
  section "after container restart (boot)"
  sleep 3
  local want; want="$(cat /root/expected-boot-release)"
  . /usr/local/lib/entrepreneuria/common.sh
  assert "candidate drop-in and marker gone after reboot" test ! -e /run/systemd/system/entrepreneuria-app@hub.service.d/zz-candidate.conf -a ! -e /run/entrepreneuria/hub/candidate
  assert "boot started the verified selection, not the interrupted candidate" bash -c "for i in \$(seq 1 30); do p=\$(systemctl show -p MainPID --value entrepreneuria-app@hub.service); [[ \$p != 0 && \$(readlink /proc/\$p/cwd) == /srv/hub/releases/$want ]] && exit 0; sleep 1; done; exit 1"
  assert "selected release healthy at boot (UID, cgroup, cwd, HTTP 200 + marker)" health_check hub "$want" 60
  assert "hub2 (failed first promotion) not started at boot" bash -c '! systemctl is-active --quiet entrepreneuria-app@hub2.service'
  /usr/local/sbin/entrepreneuria-promote hub --recover >/tmp/rec.txt 2>&1; local rrc=$?
  assert "--recover after reboot keeps the verified selection (exit 0)" test "$rrc" -eq 0 -a "$(readlink /srv/hub/live/current | xargs basename)" = "$want"
}

"${1:-phase1}"
echo; echo "SUMMARY: $PASSES passed, $FAILS failed"
(( FAILS == 0 ))

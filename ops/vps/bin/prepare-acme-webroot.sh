#!/usr/bin/env bash
# Create and validate the ACME webroot BEFORE certificate issuance. Run as root
# after the bootstrap (HTTP-only) nginx site for <host> is enabled and reloaded.
# Installed as /usr/local/sbin/entrepreneuria-acme-webroot.
#
#   entrepreneuria-acme-webroot <host>
#
# Ensures /var/www/acme/.well-known/acme-challenge exists as real root-owned 0755
# directories (no symlinks), then proves nginx serves a probe token from it for
# <host> over local HTTP, and removes the probe. Only then run:
#   certbot certonly --webroot -w /var/www/acme -d <host>
set -Eeuo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
die() { echo "ERROR: $*" >&2; exit 1; }

[[ $# -eq 1 && "$1" =~ ^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$ ]] || die "usage: $0 <host>"
[[ $EUID -eq 0 ]] || die "must run as root"
HOST="$1"
ROOT=/var/www/acme
CHAL="$ROOT/.well-known/acme-challenge"

for d in /var /var/www "$ROOT" "$ROOT/.well-known" "$CHAL"; do
  if [[ -L "$d" ]]; then die "$d is a symlink"; fi
  if [[ ! -e "$d" ]]; then install -d -m 0755 -o root -g root "$d"; fi
  [[ -d "$d" ]] || die "$d is not a directory"
  [[ "$(stat -c '%u' "$d")" == 0 && -z "$(find "$d" -maxdepth 0 -perm /022)" ]] || die "$d must be root-owned and not group/world writable"
done
for d in "$ROOT" "$ROOT/.well-known" "$CHAL"; do
  [[ "$(stat -c '%U:%G %a' "$d")" == "root:root 755" ]] || die "$d must be root:root 0755"
done

TOKEN="probe-$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')"
trap 'rm -f -- "$CHAL/$TOKEN"' EXIT
( set -o noclobber; umask 022; printf '%s\n' "$TOKEN" > "$CHAL/$TOKEN" )
got="$(curl -fsS --max-time 5 --noproxy '*' -H "Host: $HOST" "http://127.0.0.1/.well-known/acme-challenge/$TOKEN")" \
  || die "nginx did not serve the ACME probe for $HOST (is the bootstrap site enabled and reloaded?)"
[[ "$got" == "$TOKEN" ]] || die "nginx served unexpected content for the ACME probe"
echo "ACME webroot ready: certbot certonly --webroot -w $ROOT -d $HOST"

#!/usr/bin/env bash
# Creates /opt/fixture.git with one commit per behaviour and writes their SHAs to /opt/fixture.shas.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
W="$(mktemp -d)"; rm -rf /opt/fixture.git; git init -q --bare /opt/fixture.git
cd "$W"; git init -q; git config user.email t@example.invalid; git config user.name fixture
cp -r "$SRC/fake-next" ./fake-next; chmod +x fake-next/dist/bin/next
cat > package.json <<'J'
{ "name": "fixture-app", "version": "1.0.0", "private": true,
  "scripts": { "build": "node build.js" },
  "dependencies": { "next": "file:./fake-next" } }
J
cat > build.js <<'J'
const fs = require("fs");
fs.mkdirSync(".next/cache", { recursive: true });
fs.writeFileSync(".next/BUILD_ID", "fixture-" + require("crypto").randomBytes(4).toString("hex"));
fs.writeFileSync(".next/cache/build-only", "x");
fs.writeFileSync(".next/public-env", process.env.NEXT_PUBLIC_FIXTURE || "none");
J
npm install --package-lock-only --no-audit --no-fund >/dev/null
: > /opt/fixture.shas
for mode in healthy crash http500 redirect wrongapp hang public healthy2; do
  echo "${mode%2}" > mode.txt
  git add -A; git commit -q -m "fixture: $mode"
  echo "$mode=$(git rev-parse HEAD)" >> /opt/fixture.shas
done
git push -q /opt/fixture.git HEAD:refs/heads/main
# Test-only: the fixture repo is root-owned but read by the build users.
git config --system --get-all safe.directory 2>/dev/null | grep -qx /opt/fixture.git || git config --system --add safe.directory /opt/fixture.git
cat /opt/fixture.shas

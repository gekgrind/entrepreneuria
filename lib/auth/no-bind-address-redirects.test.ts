import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

/* Behind nginx, `next start` reports `request.url` / `nextUrl.origin` as
   http://localhost:3000. Any absolute redirect or URL built from them
   is followed by the visitor's browser as a loopback request, which is
   what made Chrome ask for local-network access on entrepreneuria.io
   (first the OAuth callback, then POST /auth/signout). Route handlers
   must build public URLs through lib/auth/public-origin instead.

   proxy.ts is deliberately not scanned: middleware `nextUrl` is built
   from the Host header, and its /login redirect is verified to resolve
   to https://entrepreneuria.io in production. */

const ROOT = join(__dirname, "..", "..");

function routeHandlers(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) {
      return routeHandlers(path);
    }

    return /^route\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

const BIND_ADDRESS_URL = [
  /* new URL("/login", request.url) — a path resolved against it. */
  /new URL\([^)]*,\s*(request|req)\.url\s*\)/,
  /\b(request|req)\.nextUrl\.origin\b/,
  /NextResponse\.redirect\(\s*(request|req)\.url\b/,
];

describe("route handlers never redirect to the server bind address", () => {
  const files = routeHandlers(join(ROOT, "app"));

  it("finds the route handlers", () => {
    assert.ok(files.some((file) => file.includes("signout")));
  });

  for (const file of files) {
    it(relative(ROOT, file).replaceAll("\\", "/"), () => {
      const source = readFileSync(file, "utf8")
        /* Comments explaining the bug may name the bad pattern. */
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");

      for (const pattern of BIND_ADDRESS_URL) {
        assert.doesNotMatch(source, pattern);
      }
    });
  }
});

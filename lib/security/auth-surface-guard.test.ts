import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

/*
 * Defense-in-depth guard over the source of every authentication
 * surface: the pages, the routes behind them, and the components they
 * render. It fails if any of them ever contains ClickFix-style
 * "paste this into PowerShell / Run" instructions, writes to the
 * clipboard, or loads script from an origin other than Cloudflare
 * Turnstile.
 *
 * It proves the CODE in this repository does not contain such content.
 * It says nothing about what a browser extension, a compromised network
 * path, or another application might inject at runtime — the CSP and
 * the e2e check (e2e/auth-security.spec.ts) cover the rendered page.
 */

const ROOT = join(__dirname, "..", "..");

const AUTH_SURFACES = [
  "app/(auth)",
  "app/auth",
  "app/api/auth",
  "components/auth",
  "lib/auth",
];

const SOURCE = /\.(ts|tsx|js|jsx|mjs)$/;

function files(dir: string): string[] {
  const absolute = join(ROOT, dir);

  return readdirSync(absolute).flatMap((name) => {
    const path = join(absolute, name);
    const rel = relative(ROOT, path);

    if (statSync(path).isDirectory()) return files(rel);
    return SOURCE.test(name) && !/\.test\./.test(name) ? [rel] : [];
  });
}

const sources = AUTH_SURFACES.flatMap(files).map((path) => ({
  path,
  text: readFileSync(join(ROOT, path), "utf8"),
}));

/* Phrases ClickFix / fake-CAPTCHA lures use to get a visitor to run a
   pasted command. None has a legitimate place on an auth surface. */
const CLICKFIX_PATTERNS: [string, RegExp][] = [
  ["PowerShell", /powershell/i],
  ["cmd.exe", /\bcmd(\.exe)?\b\s*(\/c|\/k)/i],
  ["mshta", /\bmshta\b/i],
  ["Invoke-Expression", /invoke-expression|\biex\b\s*\(/i],
  ["Windows+R", /(win(dows)?\s*(key)?\s*\+\s*r\b)|(⊞\s*\+?\s*r\b)/i],
  ["Run dialog", /\brun dialog\b/i],
  ["paste-and-run", /(ctrl|control|cmd)\s*\+\s*v[^.]{0,80}(enter|run)/i],
  ["press Enter to verify", /press\s+enter\s+to\s+(verify|confirm|complete)/i],
  ["Verification ID", /verification\s+id\s*:/i],
  ["Terminal command lure", /open\s+(the\s+)?terminal\s+and\s+paste/i],
  ["base64 command", /-e(nc(odedcommand)?)?\s+[A-Za-z0-9+/]{40,}={0,2}/],
];

describe("auth surfaces contain no ClickFix lures", () => {
  it("found the auth sources to scan", () => {
    assert.ok(sources.length >= 15, `scanned ${sources.length} files`);
    assert.ok(sources.some(({ path }) => path.includes("TurnstileWidget")));
  });

  for (const [label, pattern] of CLICKFIX_PATTERNS) {
    it(`no "${label}" instruction`, () => {
      const hits = sources.filter(({ text }) => pattern.test(text)).map(({ path }) => path);
      assert.deepEqual(hits, []);
    });
  }

  it("never writes to the clipboard", () => {
    const hits = sources
      .filter(({ text }) => /clipboard\s*\.\s*write|execCommand\s*\(\s*["']copy/i.test(text))
      .map(({ path }) => path);
    assert.deepEqual(hits, []);
  });
});

describe("auth surfaces load script only from approved origins", () => {
  const ALLOWED_SCRIPT_URLS = new Set([
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  ]);

  it("every <Script>/<script> src is first-party or Turnstile", () => {
    const found: string[] = [];

    for (const { path, text } of sources) {
      for (const match of text.matchAll(/<script\b[^>]*\bsrc\s*=\s*\{?\s*["'`]([^"'`]+)["'`]/gi)) {
        found.push(`${path}: ${match[1]}`);
      }
    }

    const unapproved = found.filter((entry) => {
      const src = entry.slice(entry.indexOf(": ") + 2);
      return !src.startsWith("/") && !ALLOWED_SCRIPT_URLS.has(src);
    });

    assert.deepEqual(unapproved, []);
    assert.ok(found.length >= 1, "the Turnstile loader is still found by this scan");
  });

  it("builds no script element or eval at runtime", () => {
    const hits = sources
      .filter(({ text }) =>
        /createElement\(\s*["']script["']|\beval\s*\(|new\s+Function\s*\(|document\.write\s*\(/.test(text),
      )
      .map(({ path }) => path);
    assert.deepEqual(hits, []);
  });
});

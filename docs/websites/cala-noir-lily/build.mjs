// Assembles the three deliverables from src/. Run: node build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(root, 'src', f), 'utf8');
const engine = read('lily.js').replace('/* eslint-disable */\n', '');
const css = read('demo.css');
const body = read('demo.html');
const FONTS = 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,600;1,6..96,400&family=IBM+Plex+Mono:wght@400;500&display=swap';
const MONO_ONLY = 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,600&family=IBM+Plex+Mono:wght@500&display=swap';

const autoMount = `
  function boot() {
    var hosts = document.querySelectorAll('[data-cala-lily]:not([data-lily-mounted])');
    for (var i = 0; i < hosts.length; i++) {
      hosts[i].setAttribute('data-lily-mounted', '');
      (window.calaLilies = window.calaLilies || []).push(mountCalaLily(hosts[i], window.CALA_LILY_OPTIONS || {}));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();`;

const demoScript = `<script>
(function () {
${engine}
  var lily = mountCalaLily(document.querySelector('[data-cala-lily]'), {
    onReady: function (info) {
      var el = document.querySelector('[data-lily-count]');
      if (el) el.textContent = info.letters.toLocaleString('en-US');
    }
  });
  window.calaLily = lily;
  var replay = document.getElementById('cn-replay');
  if (replay) replay.addEventListener('click', function () { lily.replay(); });
})();
</script>`;

mkdirSync(join(root, 'dist'), { recursive: true });

// 1 — standalone page: open in any browser
writeFileSync(join(root, 'dist', 'index.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>CALA NOIR — Typographic Calla Lily</title>
<meta name="description" content="A calla lily drawn entirely from the letters of CALA NOIR.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>
${css}</style>
</head>
<body>
${body}
${demoScript}
</body>
</html>
`);

// 2 — the same page in the shape the Claude artifact viewer expects (no document shell)
writeFileSync(join(root, 'dist', 'artifact.html'), `<title>Cala Noir Lily</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="${FONTS}">
<style>
${css}</style>
${body}
${demoScript}
`);

// 3 — paste-in block for a GoHighLevel Custom Code / Custom HTML element
writeFileSync(join(root, 'dist', 'ghl-custom-code-embed.html'), `<!-- CALA NOIR typographic calla lily — paste this whole block into one Custom Code element -->
<link rel="stylesheet" href="${MONO_ONLY}">
<style>
  .cala-lily { position: relative; width: 100%; height: min(100svh, 920px); min-height: 520px; background: #0b0a09; overflow: hidden;
    --lily-x: 0.5; --lily-y: 0.5; --lily-fit: 0.9; }
  @media (max-width: 820px) { .cala-lily { height: 78svh; --lily-fit: 0.86; } }
</style>
<div class="cala-lily" data-cala-lily></div>
<script>
(function () {
${engine}${autoMount}
})();
</script>
`);

// 4 — React component for AI Studio (TypeScript / JSX project)
writeFileSync(join(root, 'dist', 'CalaLily.tsx'), `/* eslint-disable */
// @ts-nocheck
// CALA NOIR typographic calla lily — self-contained React component, no dependencies.
// Usage: <CalaLily className="h-screen w-full" />   (the parent must have a height)
import React, { useEffect, useRef } from 'react';

${engine}
export default function CalaLily({ className, style, ...options }) {
  const host = useRef(null);
  useEffect(() => {
    if (!host.current) return;
    const lily = mountCalaLily(host.current, options);
    return () => lily.destroy();
    // mount once: options are read at mount time
  }, []);
  // createElement rather than JSX so the file works under either JSX runtime
  return React.createElement('div', {
    ref: host, className, style: { position: 'relative', width: '100%', height: '100%', ...style }
  });
}
`);

console.log('built dist/: index.html, artifact.html, ghl-custom-code-embed.html, CalaLily.tsx');

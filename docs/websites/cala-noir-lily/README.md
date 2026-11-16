# CALA NOIR — typographic calla lily

A calla lily modelled as a 3D parametric surface and drawn on a 2D canvas using only
the letters C·A·L·A·N·O·I·R. No libraries, no images. ~13 KB gzipped as a full page.

Prototype for the CALA NOIR salon demo (Entrepreneuria Websites). Not part of the
Entrepreneuria Next.js app — nothing in `app/` imports it.

## Files

| File | Use |
| --- | --- |
| `dist/index.html` | Standalone demo page. Open it in a browser. |
| `dist/CalaLily.tsx` | Self-contained React component for GoHighLevel AI Studio. |
| `dist/ghl-custom-code-embed.html` | Paste-in block for a classic GHL Custom Code element. |
| `dist/artifact.html` | Same demo in the shape the Claude artifact viewer expects. |
| `src/lily.js` | The engine: `mountCalaLily(host, options)`. Edit this, then `node build.mjs`. |
| `src/demo.css`, `src/demo.html` | Placeholder hero around the flower. |

## Behaviour

- **Load** — the stem rises, letters swirl up into a furled bud, the spathe opens, the spadix arrives last (~4 s).
- **Pointer** — the flower turns toward the cursor, letters drag with a stroke and spring back, a click or tap sends a ripple.
- **Idle / touch devices** — breathing, sway, slow drift and a ripple from the throat every few seconds; takes over 2.6 s after the last input.
- **Reduced motion** — one static, fully formed frame; no animation loop, no pointer response.
- **Performance** — glyph atlas + `drawImage`, DPR capped at 2, pauses off-screen, steps quality down if frames run long.

## Placement and options

The canvas fills its host element. Position the flower from CSS on the host:

```css
.hero-stage { --lily-x: 0.64; --lily-y: 0.53; --lily-fit: 0.83; } /* centre x, centre y, height — fractions of the host */
```

`mountCalaLily(host, { word, font, weight, glyphSize, yaw, pitch, roll, quality, interactive, motion: 'static', onReady })`
returns `{ destroy(), replay(), ripple(x, y) }`.

## GoHighLevel

**AI Studio** (a TypeScript/JSX project with a code editor):

1. In the Code Editor add `src/components/CalaLily.tsx` and paste `dist/CalaLily.tsx` into it.
   If the editor cannot create files, ask the AI for an empty `CalaLily` component, then replace that file's contents by hand.
   Paste through the editor, not the prompt box, so the AI does not rewrite it.
2. In the hero component:
   ```tsx
   import CalaLily from './components/CalaLily';
   // inside a hero that is position: relative and has a height
   <div style={{ position: 'absolute', inset: 0, zIndex: 0, '--lily-x': 0.64, '--lily-y': 0.53, '--lily-fit': 0.83 }}>
     <CalaLily />
   </div>
   ```
3. Load IBM Plex Mono (500) in the project's global CSS, or accept the system monospace fallback.
4. Save, check the live preview, bookmark the version.

**Classic Funnels/Websites builder**: drop a Custom Code element into a full-width section and
paste `dist/ghl-custom-code-embed.html`. Check it on the preview/published URL, not the editor canvas.

## Verified / not verified

Verified in headless Chromium (Playwright): assembly, pointer rotation, stroke, ripple, mobile
viewport, reduced-motion static frame, React mount/unmount under StrictMode (both JSX runtimes),
embed inside a host page, off-screen pause, no console errors, 57–59 fps on desktop viewports.

Not verified: any real GoHighLevel account, real iOS/Android devices, Safari, Firefox.

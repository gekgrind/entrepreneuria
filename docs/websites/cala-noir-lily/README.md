# CALA NOIR — typographic calla lily

A calla lily modelled as a 3D parametric surface and drawn on a 2D canvas using only
the letters C·A·L·A·N·O·I·R. Every letter is small monospace. A seeded noise field decides where letters keep to the
petal's contours and where they loosen, cluster, swell, tilt or thin out, so the surface is
irregular but identical on every load. No libraries, no images.

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

- **Load** — the letters hang as a loose cloud, condense into the stem and a furled bud, and the spathe opens (~4.3 s).
- **Texture** — letter size, position, tilt, opacity and density vary by a fixed seed, with no per-frame randomness. Letters on the lip follow its contour at uneven intervals and a few fray past the edge.
- **Optional serif lip** — `{ lip: true }` restores the round-two display lettering along the rim (off by default; load Bodoni Moda 600 if you use it).
- **Pointer** — the flower turns toward the cursor and the key light follows it; a stroke combs the letters aside and they settle back; a click or tap sends a damped wave through the surface and knocks a few letters loose.
- **Idle / touch devices** — breathing, sway, slow drift, an occasional wave from the throat, and a single letter shedding from the tip every few seconds; takes over 2.6 s after the last input.
- **Reduced motion** — one static, fully formed frame; no animation loop, no pointer response, no loose letters.
- **Performance** — glyph atlas + `drawImage`, DPR capped at 2, pauses off-screen, steps quality down if frames run long.

## Placement and options

The canvas fills its host element. Position the flower from CSS on the host:

```css
.hero-stage {
  --lily-x: 0.79; --lily-y: 0.60; --lily-fit: 0.95;  /* centre x, centre y, height: fractions of the host */
  --lily-width: 3;     /* widest it may be, as a fraction of host width; above 1 lets the bloom crop */
}
@media (max-width: 820px) {
  .hero-stage { --lily-x: 0.47; --lily-top: 92px; --lily-fit: 0.78; --lily-width: 0.80; }  /* --lily-top pins the bloom below a header */
}
```

`mountCalaLily(host, { word, font, weight, lip, lipFont, lipWeight, lipScale, glyphSize, yaw, pitch, roll, quality, interactive, motion: 'static', onReady })`
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
   <div style={{ position: 'absolute', inset: 0, zIndex: 0, '--lily-x': 0.79, '--lily-y': 0.60, '--lily-fit': 0.95, '--lily-width': 3 }}>
     <CalaLily />
   </div>
   ```
3. Load IBM Plex Mono (500) in the project's global CSS, or accept the system monospace fallback.
4. Save, check the live preview, bookmark the version.

**Classic Funnels/Websites builder**: drop a Custom Code element into a full-width section and
paste `dist/ghl-custom-code-embed.html`. Check it on the preview/published URL, not the editor canvas.

## Verified / not verified

Verified in headless Chromium (Playwright): assembly, pointer rotation, stroke, ripple, phone
viewports at two heights, reduced-motion static frame, React mount/unmount under StrictMode,
embed inside a host page, off-screen pause, no console errors. Script time is about 3–4 ms per
frame at 1440×900; the sandbox's software compositor held 54–56 fps idle and 46–50 fps while the
pointer was driven.

Not verified: any real GoHighLevel account, real iOS/Android devices, Safari, Firefox.

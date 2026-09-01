# Journey Preview — Phase 2 Handoff (Scenes 4–6)

Status: Scenes 1–6 implemented at `/journey-preview`, awaiting HUMAN VISUAL
REVIEW before Scene 7 begins. Production homepage (`/`) is untouched.

## What exists now

One persistent world, one 250-unit scrubbed timeline, one 1100vh stage:

| Units | Scene |
|---|---|
| 0–42 | Scene 1 — CHAOS (approved POC, unchanged) |
| 42–70 | Scene 2 — TUNNEL (approved POC, unchanged) |
| 70–100 | Scene 3 — THE TURN (approved POC, unchanged) |
| 100–150 | Scene 4 — THE ECOSYSTEM FORMS |
| 150–205 | Scene 5 — PRODUCT EXPLORATION |
| 205–250 | Scene 6 — MEET PROSPRA |

Key architecture notes:

- `refs.overall.current` is progress in TIMELINE UNITS (0–250), not 0..1.
  Scenes 1–3 math is numerically identical to the approved POC (rescaled,
  not redesigned).
- The master particle field carries galaxy + brain homes as attributes
  (`aGalaxy`, `aBrain`, …); assembly/departure/brain formation are shader
  mixes driven by `uGalaxyT` / `uDepart` / `uBrainT` — all scrubbed, all
  reversible. One Points draw call for all particle chapters.
- Galaxy layout derives from the ecosystem registry orbit math
  (`lib/ecosystem/orbits`) via `components/journey/world/ecosystem-shapes.ts`.
  Product data flows from the registry (`page.tsx` → props). Never
  hardcode a second product list.
- The brain point cloud is deterministic (`brain-shape.ts`, seeded PRNG);
  axon lines connect the same points the particles land on.
- Scene 5 interaction: galaxy nodes project onto real DOM hotspot buttons
  every frame (keyboard/touch accessible, canvas stays
  `pointer-events: none`); product cards are the semantic truth and carry
  the real links. Hotspot click scrolls the card into its reading plane.
- Responsive: `refs.stacked` (low tier / small viewport) switches galaxy +
  brain transforms (`getGalaxyTransform` / `getBrainTransform` in
  `journey-math.ts`); DOM uses stacked layouts (galaxy top, cards bottom).
- Fallbacks: reduced-motion / kill-switch / no-WebGL all render
  `JourneyNarrative` (static sections for all six scenes, reuses
  `ConstellationStatic`).

## Deferred requirements (do not lose)

1. **Navigation redesign: bottom-to-top reveal behavior.** Main nav
   visible initially, recedes during the cinematic journey, can reappear
   on deliberate upward scroll, and reappears/expands approaching the
   page end. The nav itself also gets a broader redesign. Explicitly
   DEFERRED until the primary page journey is complete — do not build
   Scene 4–9 content that depends on a permanently visible navbar.
2. **New sharp product screenshots + Scene 7 screenshot stack.**
   Current Prospra/Architecta captures are known-blurry; Scene 7
   (screenshot stack) is the NEXT phase after human review of Scenes 1–6.

## Next step

Human visual review of Scenes 1–6. Then Scene 7 (screenshot stack),
Scenes 8–9, full-journey review, and only then any promotion to `/`.

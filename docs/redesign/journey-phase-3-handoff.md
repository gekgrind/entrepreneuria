# Journey Preview — Phase 3 Handoff (Scenes 7–9)

Status: the complete 9-scene cinematic journey exists at `/journey-preview`,
awaiting FULL-JOURNEY HUMAN VISUAL REVIEW. Production homepage (`/`) is
untouched. No push, no deploy, no merge.

## What exists now

One persistent world, one 450-unit scrubbed timeline, one sticky stage
(1980vh = 450 units × 4.4vh — pacing density identical to the approved
Scenes 1–6):

| Units | Scene |
|---|---|
| 0–42 | Scene 1 — CHAOS (approved, unchanged) |
| 42–70 | Scene 2 — TUNNEL (approved, unchanged) |
| 70–100 | Scene 3 — THE TURN (approved, unchanged) |
| 100–150 | Scene 4 — THE ECOSYSTEM FORMS (approved, unchanged) |
| 150–205 | Scene 5 — PRODUCT EXPLORATION (approved, unchanged) |
| 205–250 | Scene 6 — MEET PROSPRA (copy now exits 250.5–255) |
| 250–320 | Scene 7 — PROOF (screenshot stack) |
| 320–385 | Scene 8 — BELIEF (glass value cards → disintegration) |
| 385–450 | Scene 9 — RESOLUTION (ecosystem reforms, statement, CTA) |

## Architecture notes (Phase 3 additions)

- **Scene 6 → 7:** the brain doesn't fade — it migrates. The brain-role
  subset of the master particle field retargets onto a deterministic
  proof-frame perimeter (`aProof` attribute, `proof-shapes.ts`,
  `PROOF_FRAME` in journey-math) driven by `uProofT`, with directional
  streak rendering mid-flight. The frame is sized slightly larger than
  the DOM screenshot card so the trace reads as a luminous edge around
  it. The axon/glow layer (ParticleBrain) fades and unmounts visually.
- **Scene 7:** three REAL screenshot cards (Prospra → Architecta →
  Command Center) rise from lower/deeper space, dwell fully settled,
  and recede into a visible stack. All DOM/CSS + GSAP — zero WebGL cost.
  Card content: `components/journey/proof-cards.ts` (single swap point
  for asset replacement). Copy: kicker "The proof" + one line, gone
  before the first card arrives.
- **Scene 7 → 8:** the stack compresses/recedes (`autoAlpha 0`, deep z)
  while `uProofOut` spreads the frame dust and `uStarReturn` (already
  settled in Scene 7) keeps the dome calm (`vAlpha` calmer than Scene 3's
  full dome; restored at the reform).
- **Scene 8:** three glass cards (canonical /prospra benefits copy,
  `belief-cards.ts`) progress left → right through a center focus state
  (cyan emphasis via a scrubbed `--focus` CSS var on a scoped
  `[data-j-bsurface]` style). Released cards recede to a dim side plane
  and WAIT — all three disintegrate together: surface blurs/fades,
  heading chars scatter (SplitText, the approved Scene 3 pattern), 14
  deterministic border shards peel away per card, and `uBurst` flares
  the frame dust outward into depth. All scrubbed, all reversible.
- **Scene 8 → 9:** `uReformT` streams ALL particles back to their Scene 4
  galaxy homes (`aGalaxy`), now at the final centered transform
  (`getFinalGalaxyTransform`). EcosystemGalaxy's rings/links/nodes/halos
  ramp back slightly MORE luminous (×1.18); FounderCore glides back to
  the heart at ~full brightness. Same system, resolved.
- **Scene 9 copy sequence:** reform (→411) → quiet → kicker+H2 (412.5)
  → dwell → lede (425.5) → CTA (430.5) → final dwell to 450. Canonical
  SceneClose copy; primary CTA via `getPrimaryCta()` launch-state.
- **Camera:** Scene 7 centered presentation plane (z 7.0), Scene 8
  intimate push (z 6.85), Scene 9 wide calm pull-back (z 8.4) with the
  gaze lifted toward the reformed galaxy.

## Screenshot asset status

**HIGH-RES SCREENSHOT ASSET REPLACEMENT REQUIRED** (pre-existing, from
the Phase 2 handoff): Command Center capture is sharp at 3200×2100;
Prospra + Architecta captures are real but soft at text level. Scene 7
serves deterministic 2400w/1600w/1200w/800w webp derivatives
(`npm run assets:optimize`, manifest extended). To replace: swap the
source PNGs in `public/marketing-screenshots/`, re-run the pipeline.
No code changes needed. Source PNGs remain uncommitted (pre-existing
decision); the webp derivatives used by the journey ARE committed with
Phase 3.

## Measured state (headless mid-tier harness, relative before/after)

- Settled FPS: 58–61 every scene (was 59–60)
- Active-scroll avg: ~51–53 FPS (was ~38–41; longer timeline = less
  state change per wheel tick)
- Draw calls: 8 (S1–2), 14 (S3–5), 17 (S6), 14 (S7–9 — brain layer
  retires after its fade)
- Particles: 25k mid / 45k high tier — one field, one Points draw
- 1 WebGL context; zero console errors; full-journey DOM-state
  reversibility probe: 0 mismatches across 13 waypoints (down + up)

## Deferred requirements (do not lose)

1. **Navigation redesign: bottom-to-top reveal behavior.** Nav visible
   at entry, recedes during the journey, reappears on deliberate upward
   scroll and approaching the page end; the nav itself gets a broader
   redesign. Scene 9's composition (galaxy upper-center, copy lower,
   generous final dwell) leaves room for the bottom/end reappearance.
   NOT built in Phase 3.
2. **High-res screenshot replacement** (see above).
3. **Stakeholder's minor Scene 1–6 visual adjustments** (verbally
   deferred until the complete page exists).
4. **Footer integration** for the journey route (the site footer follows
   the stage; final integration is a polish-phase decision).
5. **Detailed pacing pass** (only structural pacing was verified).
6. **Final performance hardening + production `/` promotion** — only
   after full-journey human review.

## Next step

Full-journey human visual review of Scenes 1–9 at `/journey-preview`,
followed by a dedicated stakeholder-guided polish plan.

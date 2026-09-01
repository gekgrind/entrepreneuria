# Marketing Regression Matrix — Constellation Redesign

Defined in Stage 2 (Amendment 1). Run whenever shared tokens, global CSS,
fonts, header/footer, or shared marketing primitives change.

## Routes

| Route | Why it's in the matrix |
|---|---|
| `/` | The redesign itself — full capture every stage |
| `/prospra` | Shares marketing primitives, PageShell, fonts, tokens |
| `/pricing` | Shares primitives + comparison tables (token-sensitive) |
| `/about` | Shares paper sections, founder assets |
| `/waitlist` | Primary conversion destination — must never break |
| `/command-center` | Authenticated route — catches global-CSS leakage into the app |

## Per-route checks

1. Page renders without console errors.
2. Header + footer intact (logo, nav, CTAs).
3. No unintended visual change vs. baseline capture (spot review).
4. Fonts render (Playfair headings / DM Sans body / DM Mono labels).

## Method

- Desktop 1440×900 capture per route; homepage also 390×844.
- Full matrix: Playwright capture script (Stage 14 formalizes it).
- Intermediate stages: homepage + at least `/prospra` and `/pricing`.

## Baseline

Pre-redesign baselines live in git history on `main`. The redesign branch
must not alter non-homepage routes except:
- logo path repairs (`/logos/*`) — restores images broken by asset moves
- Stage 9 chrome changes (flag-driven header CTA, footer restyle) —
  approved explicitly

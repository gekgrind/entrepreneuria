# AGENTS.md

## Entrepreneuria project guidance

Entrepreneuria is a premium, founder-focused brand and product ecosystem. All code, UI, and page work should feel cohesive with the existing site and product direction.

## Core rules
- Prefer existing shared components over creating one-off components.
- Prefer existing design tokens, theme variables, typography primitives, spacing conventions, and layout wrappers over hardcoded values.
- Do not paste standalone HTML/CSS into the app unless explicitly requested.
- Do not introduce hardcoded colors if brand/theme tokens already exist.
- Keep implementations maintainable, reusable, and consistent with the codebase.

## Visual/brand direction
- The visual style should feel premium, modern, founder-focused, and polished.
- Aim for a VC-grade product-marketing feel, not a generic template look.
- Favor clean hierarchy, strong spacing rhythm, crisp typography, elevated cards, subtle depth, and refined CTA presentation.
- Match the existing Entrepreneuria brand palette, font choices, and interaction patterns already present in the codebase.
- Keep pages visually consistent with the existing Entrepreneuria site and app ecosystem.

## For marketing and product pages
- Reuse existing page shells, section wrappers, containers, and CTA/button components whenever possible.
- Follow existing heading scale, body text styles, max-width conventions, and spacing rhythm.
- Preserve strong content hierarchy and conversion-focused flow.
- Build responsive layouts for desktop, tablet, and mobile.
- Use semantic HTML and accessible structure.

## Implementation preferences
- Reuse existing utilities, components, and patterns before creating new ones.
- If a new component is necessary, make it reusable and keep it scoped cleanly.
- Avoid duplicate versions of buttons, headings, cards, badges, or section patterns if equivalent shared components exist.
- Keep copy edits minimal unless needed for clarity or consistency.
- Keep code easy for a founder-maintainer to understand and update later.

## Quality checks
- Before finalizing, review for:
  - responsiveness
  - visual consistency with Entrepreneuria
  - clean CTA destinations
  - accessibility basics
  - lint/type/build issues if available

## Output expectations
When completing a task:
- summarize files changed
- note shared components/tokens/patterns reused
- list assumptions
- flag anything that needs manual review
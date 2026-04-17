# AGENTS.md

## Scope

This file defines global rules for all Entrepreneuria repositories and apps.

App-specific AGENTS.md files may extend these rules but must not override:
- UI protection rules
- security rules
- brand consistency

## Entrepreneuria project guidance

Entrepreneuria is a premium, founder-focused brand and product ecosystem. All code, UI, and page work should feel cohesive with the existing site and product direction.

This repository supports multiple products:
- Directorium (AI Board of Directors)
- Prospra (AI mentor/coach)
- Architecta (growth/content engine)
- Entrepreneuria marketing site

All work must maintain a cohesive, high-end product and brand experience.

---

## 🚫 CRITICAL RULE: UI PROTECTION

Unless explicitly instructed, DO NOT change:

- layout
- spacing
- typography
- copy
- Tailwind classes
- colors
- gradients
- shadows
- animations
- component structure
- visual hierarchy

This rule overrides all others.

If a UI change is absolutely required:
- keep it minimal
- preserve the existing design language
- clearly explain it in your final summary

---

## Core rules

- Prefer existing shared components over creating one-off components.
- Prefer existing design tokens, theme variables, typography primitives, spacing conventions, and layout wrappers over hardcoded values.
- Do not paste standalone HTML/CSS into the app unless explicitly requested.
- Do not introduce hardcoded colors if brand/theme tokens already exist.
- Keep implementations maintainable, reusable, and consistent with the codebase.
- Prefer logic changes over visual changes.

---

## 🧠 Product context

### Directorium
- AI-powered Board of Directors
- multi-model decision system
- structured debate, consensus, and tension
- not a chatbot

### Prospra
- AI mentor/coach
- supportive, strategic, founder-aware
- focused on clarity and guidance

### Architecta
- founder’s growth engine
- content + execution system
- structured marketing workflows

### Entrepreneuria site
- premium marketing experience
- editorial, cinematic, conversion-focused
- not a generic SaaS template

Do not replace these identities with generic product behavior.

---

## Visual/brand direction

- The visual style should feel premium, modern, founder-focused, and polished.
- Aim for a VC-grade product-marketing feel, not a generic template look.
- Favor clean hierarchy, strong spacing rhythm, crisp typography, elevated cards, subtle depth, and refined CTA presentation.
- Match the existing Entrepreneuria brand palette, font choices, and interaction patterns already present in the codebase.
- Keep pages visually consistent with the existing Entrepreneuria site and app ecosystem.

---

## For marketing and product pages

- Reuse existing page shells, section wrappers, containers, and CTA/button components whenever possible.
- Follow existing heading scale, body text styles, max-width conventions, and spacing rhythm.
- Preserve strong content hierarchy and conversion-focused flow.
- Build responsive layouts for desktop, tablet, and mobile.
- Use semantic HTML and accessible structure.
- Do not rewrite marketing copy unless explicitly instructed.

---

## ⚙️ Engineering rules

- Reuse existing utilities, components, and patterns before creating new ones.
- If a new component is necessary, make it reusable and scoped cleanly.
- Avoid duplicate versions of buttons, headings, cards, badges, or section patterns.
- Keep code readable for a solo founder-maintainer.
- Keep logic centralized where appropriate.
- Avoid unnecessary refactors outside the scope of the task.

---

## 🔐 Security & backend rules

- Never expose service-role keys client-side.
- Keep privileged logic server-side.
- Reuse existing Supabase helpers and patterns.
- Associate data with the correct user/workspace.
- Follow existing auth/session patterns.
- Prefer server actions or existing API patterns used in the repo.

---

## 🧩 Architecture preferences

- Prefer small, focused files over large complex ones.
- Extract reusable hooks/services when logic repeats.
- Maintain clean separation between:
  - UI
  - state
  - data fetching
  - backend logic
- Respect Next.js App Router patterns and client/server boundaries.

---

## 🤖 Sub-agent rules (Codex)

Sub-agents should be used for:
- codebase discovery
- identifying patterns
- locating reusable components
- reviewing architecture

Sub-agents should NOT:
- perform competing write-heavy edits
- modify the same feature area simultaneously

Preferred workflow:
1. parallel discovery (sub-agents)
2. centralized implementation (parent agent)

---

## 🧪 Quality checks

Before finalizing, review for:

- responsiveness (desktop/tablet/mobile)
- visual consistency with Entrepreneuria
- no unintended UI changes
- clean CTA destinations
- accessibility basics
- no broken imports
- no type errors
- no duplicated logic
- no exposed secrets
- correct route behavior

---

## 📦 Output expectations

When completing a task:

- summarize files changed
- note shared components/tokens/patterns reused
- list assumptions
- flag anything that needs manual review
- explicitly call out ANY UI changes (even minor ones)

---

## 🧠 Guiding principle

Make the app more powerful without making it look different.

If a change improves logic but alters the visual experience, it is likely incorrect unless explicitly requested.

deploy 2
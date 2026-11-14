# Entrepreneuria Websites: legal review package

**Status:** draft for owner review, prepared 2026-11-11.
**Not legal advice. Not reviewed by an attorney. Not privileged.** An AI assistant prepared this from repository evidence and public sources. It does not guarantee compliance and does not remove legal liability. Nothing here is published, deployed or switched on.

## Scope

Entrepreneuria Websites, **Website Starter only**: the `/services/websites` page, lead intake (form or email), the free homepage concept, proposal acceptance, the $199 setup fee, the $75/month subscription, GoHighLevel (GHL) intake and payment collection, hosting, and ownership.

Approved business terms used throughout:

| Term | Value |
|---|---|
| Package | Website Starter only |
| Setup fee | $199, due when the customer approves their personalized preview and accepts the proposal (see LGL-08) |
| Subscription | $75/month, starting at website launch |
| Minimum | One month |
| Hosting | Included |
| Ownership | Customer owns their content and domain |
| Service model | Entrepreneuria-managed website service |
| Payments | Collected on GHL-hosted payment pages |

## Evidence base

- **Code and docs:** branch `review/ghl-s8-remediation` (head `2a12dac`, 2026-11-11). It is the most complete Websites branch and contains PRs #33–#36. PR #37 (`feat/websites-showcase-mode`) is checked separately. Live legal pages were read on `main` (`c75c06b`).
- **Codex launch-readiness audit:** **not found.** I searched every remote branch and the open and closed PR comments, and no Codex launch-readiness audit file or comment exists. The newest launch-readiness record in the repo is `docs/websites/LAUNCH-READINESS.md` (2026-11-09), together with `release-gates.ts` and `DECISION-REGISTER.md`. I used those as the audit baseline. If a separate Codex report exists outside the repo, compare it against `CONSOLIDATED_LEGAL_FINDINGS.md`.
- **Legal sources:** web search only. This session's network blocks direct fetches of primary-law sites (Cornell LII, Justia). Every citation therefore carries a verification tag (see below).

## Skills used

The prompt names `governance-compliance-review` and `product-legal-launch-review`. **Neither is installed under those names.** I searched the filesystem, the synced skills and the claude.ai skill catalog. The closest installed equivalents were loaded and followed:

| Requested | Used instead | Location |
|---|---|---|
| product-legal-launch-review | `launch-review` (product-legal) | `~/.claude/skills/synced/…/launch-review/SKILL.md` |
| governance-compliance-review | `gc-review` (General Counsel forcing questions) | `~/.claude/skills/synced/…/gc-review/SKILL.md` |

Gaps in following them:

- **Calibration file:** `launch-review` expects one at `~/.claude/plugins/config/claude-for-legal/product-legal/CLAUDE.md`. It doesn't exist. Per the skill, severity was therefore calibrated with the prompt's P0/P1/P2 rules and the zero-budget instruction, and novel items are flagged.
- **Privileged header:** `launch-review` would add one. It was replaced with a "not privileged" notice, as the prompt instructs.
- **Vendor scripts:** `gc-review` references vendor scripts (`contract_risk_scanner.py` and others). They are not installed, so they were not run.

## Files

| File | Purpose |
|---|---|
| `ZERO_BUDGET_LEGAL_LAUNCH_PLAN.md` | **Start here.** What can be done now, what needs an owner decision, and what can wait |
| `LEGAL_LAUNCH_BLOCKERS.md` | P0 items by launch stage |
| `LEGAL_OWNER_DECISIONS.md` | Decisions only the owner can make |
| `CONSOLIDATED_LEGAL_FINDINGS.md` | Deduplicated matrix (LGL-01 to LGL-25) |
| `PRODUCT_LEGAL_LAUNCH_REVIEW.md` | `launch-review` memo, category by category |
| `GOVERNANCE_COMPLIANCE_REVIEW.md` | `gc-review` six questions plus the governance evaluation |
| `LEGAL_UX_IMPLEMENTATION.md` | Implementation-ready placement, wording and acceptance specs |
| `drafts/` | Draft legal documents. Unpublished; every `[OWNER: …]` marker needs a decision |
| `SOURCES.md` | Links to every legal source consulted, all needing verification |

## Citation tags

| Tag | Meaning |
|---|---|
| `[repo]` | Verified in this repository at the path given |
| `[web search — verify]` | Found by web search and not read from the primary source. Check the official text before relying on it |
| `[settled]` | Stable, well-known statute. Still verify before relying on it |
| `[inference]` | Reasoning from the evidence, not a sourced fact |
| `[unverified]` | Could not be established |

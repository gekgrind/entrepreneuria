# Websites Starter: customer journey audit

Audit date 2026-11-12. Documentation only: no application code, PR #38, pricing, GHL or deployment was touched.

## What was audited

| Source | Ref | Why |
|---|---|---|
| `review/ghl-s8-remediation` | `2a12dac` (2026-11-11) | **The newest Websites implementation.** It merges #34, #35 and #36 and adds later copy and UX work: hosting commitment, proposal step, "What happens after I request a preview?", setup price in the phone dock, and manual intake. It has no open PR. |
| `feat/websites-showcase-mode` (PR #37) | `d95e974` | The page-only showcase mode. It's based on #34, **not** on the s8 branch, so it doesn't have the s8 copy (see UX-07). |
| `claude/pensive-archimedes-7rcktm` (PR #38) | `0f5ce77` | Legal findings LGL-01 to LGL-25 and engineering tasks E-1 to E-12. Read only, not modified. |
| `docs/websites/LAUNCH-READINESS.md`, `DECISION-REGISTER.md`, `MANUAL-INTAKE.md`, `e2e/websites.spec.ts` | s8 branch | Existing readiness work. This audit doesn't repeat it. |

Method:
- **Code review** of the page, form, chrome, registries, lifecycle and gates.
- **Local render** of both builds with `next dev`:
  - s8 in `nonproduction` mode with Turnstile test keys
  - #37 in `showcase` mode
- **Playwright (Chromium)** at 1440×900, 1024×768, 390×844 and 375×667: screenshots, DOM geometry probes and axe-core (WCAG 2.2 AA tags).

Evidence is in `evidence/`. Visual details are in `WEBSITES_MOBILE_UX_FINDINGS.md`.

**Not verified:**
- real iOS or Android devices and real mail clients
- the live `vibepreview.app` demos (the sandbox's egress proxy blocked them)
- Turnstile in the browser (blocked the same way)
- GHL
- anything in production

## Journey status

Key: **Implemented** = in code and rendered locally. **Proposed** = designed or drafted, not built or operating. **Missing** = no design, no code and no documented procedure.

| # | Step | Status | Evidence | Gap |
|---|---|---|---|---|
| 1 | Visitor arrives at `/services/websites` | **Implemented, gated off.** It returns 404 unless the mode is on, the host is allowlisted and `WEBSITES_CONTACT_EMAIL` is set | `app/services/websites/page.tsx`, `gate.ts`. Rendered 200 locally in both modes. `noindex` | Inbox not confirmed (D-20). Privacy policy doesn't cover the page yet (LGL-01). Both are already tracked |
| 2 | Understands offer and pricing | **Implemented** | H1 "$75/month.", "Plus $199 one-time setup. Hosting included." on phones, offer card at ≥960px, Pricing section, FAQ (s8) | Doesn't say **when the $75 starts** (at launch) or that the **customer owns their domain and content** (UX-04). #37 has none of the s8 hosting or proposal copy (UX-07) |
| 3 | Views fictional demos | **Implemented** | Three demos: tabs on phones, grid at 1000px and up. "All three are fictional" plus a per-card badge | Demo links go to `preview-<id>.vibepreview.app` (UX-10, extends LGL-15/E-9) |
| 4a | Requests a preview: form (s8 `leads` mode) | **Implemented, gated off** | Form with 4 required fields; Turnstile; email fallback on every failure state (e2e covered). Manual delivery stores to a private review directory | On phones the first field is **1,110px below** where every CTA lands (UX-05). The phone CTA dock **never appears** (UX-02). Service area and services aren't asked for (UX-08) |
| 4b | Requests a preview: email (#37 `showcase` mode) | **Implemented, gated off** | Primary CTA is `mailto:` with subject plus one line of body | Template is empty. The style and package the visitor picked are dropped. Copy still refers to a form (UX-06) |
| 5 | Reply within 2 business days | **Proposed (operational)** | `REPLY_WITHIN` constant. Manual intake sends a reference-only alert; the owner reads records over SSH (`MANUAL-INTAKE.md`) | No reply template and no checklist of what to collect. Missing information means a second round trip before concept work can start (UX-01, UX-08) |
| 6 | Prospect reviews and approves the concept | **Missing** | `lifecycle.ts` starts at `preview_requested`, then goes straight to `proposal_sent`. There is no "concept delivered" state. No document defines how the concept reaches the prospect (link, image or PDF), when, or what "approve" means | **P0 for the first paid sale** (UX-01) |
| 7 | Accepts agreement and pays $199 | **Proposed / blocked** | Agreement draft (LGL-02), checkout spec (LGL-03 / E-8), entity reinstatement (LGL-04). No payment provider (D-07). Sandbox provider only | Legal P0s already tracked in #38. Not repeated here |
| 8 | Website built and launched | **Proposed** | `lifecycle.ts`: `in_progress → customer_review → launch_approved → live`. No customer-facing onboarding: nothing asks for logo, photos, domain access or service details | Onboarding checklist **missing** (UX-01, part C) |
| 9 | $75/month starts at launch | **Proposed** | `billing.ts` guards and the sandbox only. The legal draft says to create the subscription at the Launch Date (E-8 §4.4) | Not stated on the page (UX-04). GHL setup tracked by E-8 |

## Verdict on the journey

- **Steps 1–4 are in good shape.** The page is honest, the fictional demos are clearly labelled, pricing is visible on the first screen at every width, there's no horizontal overflow at any tested width, and axe reports 0 violations in both builds.
- **Three page defects cost leads:**
  1. The phone CTA dock is broken (UX-02).
  2. The global header advertises a different product's waitlist, in the same orange as this page's primary action (UX-03).
  3. On phones the form sits more than a screen below every "Request" tap (UX-05).
- **Steps 5–9 are where the first paying customer is won or lost, and they barely exist as customer experience.** The engineering and legal scaffolding is thorough: lifecycle states, billing guards, agreement and checkout drafts. But nobody has designed what the prospect *receives and clicks* between "we got your request" and "pay $199". That's UX-01. It's mostly a writing and process task, not code.

## Findings index

Detail, evidence and acceptance criteria are in `WEBSITES_CONVERSION_OPPORTUNITIES.md` and `WEBSITES_MOBILE_UX_FINDINGS.md`. Engineering tickets are in `WEBSITES_LAUNCH_UX_HANDOFF.md`.

| ID | P | Finding | New vs. existing work |
|---|---|---|---|
| UX-01 | **P0** (Stage B) | No defined concept-delivery, proposal and acceptance experience. No reply template or onboarding checklist | New. The legal review covers checkout terms (LGL-03) but not how the prospect gets the concept or proposal, or what they click |
| UX-02 | P1 | Phone CTA dock never reaches the screen: a `perspective` ancestor traps `position: fixed` | New. The e2e test checks attributes only, not geometry |
| UX-03 | P1 | Global header on this page: orange "Join the Waitlist" (Prospra) and a "Pricing" link to AI-product pricing | New |
| UX-04 | P1 | When billing starts and who owns the site aren't stated | New. LGL-11 covers the contract side of ownership |
| UX-05 | P1 | Phones: the form starts 1,110px below the `#preview` anchor | New |
| UX-06 | P1 (showcase) | Empty `mailto:` template, lost selections, copy that refers to a form | Extends #37's open-questions list with 4 more lines and the template issue |
| UX-07 | P1 (showcase) | #37 isn't based on the s8 branch, so showcase would ship older copy | New |
| UX-08 | P1 | The request doesn't capture service area or services list | New |
| UX-09 | P2 | When the concept arrives isn't stated | New |
| UX-10 | P1 | Demo links are unbranded third-party preview URLs | Extends LGL-15/E-9 with the trust angle |
| UX-11 | P2 | Desktop: single package card leaves most of the row empty | New |
| UX-12 | P2 | FAQ length and overlapping hosting questions (s8) | New |
| UX-13 | P2 | Hero: the preview request is a text link, below the fold at 375×667 | New. Defer until data |
| UX-14 | P2 | No named person behind the service | Related to LGL-24 |
| UX-15 | P2 | Success state doesn't say what to prepare | New |
| UX-16 | P2 | Footer LinkedIn icon links to linkedin.com, not a profile (site-wide) | New |

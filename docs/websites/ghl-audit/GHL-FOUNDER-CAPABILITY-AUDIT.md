# GHL Founder Plan: capability audit

Audit date: 2026-11-07. Read-only. No account settings, subscriptions, tokens or code were changed.
Branch: `feat/websites-commercial-foundation` (commits `e75bcd6`, `87e0b68`).

## Evidence levels

| Label | Meaning |
|---|---|
| **DOCUMENTED** | Stated in HighLevel's help center, developer docs or OpenAPI specs (read 2026-11-07) |
| **MARKETING** | Stated on a HighLevel sales page. That's evidence of intent, not a contractual entitlement |
| **THIRD-PARTY** | Only found in non-HighLevel sources. Not relied on |
| **ACCOUNT VERIFICATION REQUIRED** | Can only be confirmed inside the Entrepreneuria account. The check is listed at the end |

## Plan identity

| Finding | Evidence |
|---|---|
| "Founder" is the renamed $497/month Agency Pro plan. Existing Agency Pro customers moved over automatically. | MARKETING: founder.gohighlevel.com ("Formerly the Agency Pro Plan", "Already a $497 Agency Pro Plan customer? No action needed") |
| HighLevel's three tiers are Starter ($97), Unlimited ($297) and Founder ($497). | DOCUMENTED: Pricing Guide (modified 2026-10-29) |
| The Founder plan is "Everything in Unlimited Plan and..." Exclusive items: rebilling with markup, SaaS Mode, HighLevel Industries, Custom Navs, Events, Workflow Maps, Project Management, User Reports, Advanced API access, Ticketing, Meeting Rooms, Loyalty, A2P Console. Custom Onboarding and Email Health Console are marked "Coming Soon". | MARKETING: founder.gohighlevel.com |
| Founder perks include Payment Commissions on the new native payment provider, the AdFuel program, the Founders Club, the Partner Network and the Founder Support Plan. | MARKETING only. No published rates, eligibility rules or SLA. **Don't model any revenue from these.** |
| Trial: 14 days, then $497/month. | MARKETING and pricing page FAQ. **ACCOUNT VERIFICATION REQUIRED** for the actual trial end date and the first charge date. |

## 1. Sub-account entitlements

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Unlimited client sub-accounts? | **Yes.** Unlimited and higher plans include unlimited sub-accounts, and Founder includes everything in Unlimited. | MARKETING: pricing page FAQ ("On the Unlimited and Pro plans, you also get unlimited Sub-Accounts"). One third-party summary claimed the Founder card shows "3 Sub-Accounts", but the live page (read 2026-11-07) doesn't say that. Confirm the limit shown in Agency Billing (**ACCOUNT VERIFICATION REQUIRED**). |
| 2 | Fees for extra sub-accounts? | **None documented** for the sub-account itself. Charges come from per-enabled-sub-account add-ons and usage, listed below. | DOCUMENTED: Pricing Guide lists no per-sub-account platform fee. Starred items are "per enabled sub-account". |
| 3 | One sub-account per website customer? | **Recommended.** Each customer is a separate business with its own contacts, A2P 10DLC brand, domain, payment connection and transfer path. Sub-account transfer ("eject") and snapshots both work per sub-account. | DOCUMENTED: Sub-account eject article; Snapshots overview. The recommendation is an inference. |
| 4 | Do sub-accounts get hosting, CRM, forms and automation? | **Yes**, as standard sub-account features: website and funnel builder, domain management, CRM, forms, calendars and workflows. Usage-based services (email, phone, AI, premium workflow actions) are charged to the agency wallet. | DOCUMENTED: Pricing Guide ("Email sending works out of the box for every sub-account"; the Phone System is "available on all HighLevel plan levels"). Pricing page lists "Website & Funnel Builder" and "Domain Management". |
| 5 | Does each sub-account need its own payment method? | **Not for the agency-paid model.** The Agency Wallet is charged to the agency card and pays sub-account usage. A sub-account payment method is only needed if Entrepreneuria rebills usage through HighLevel or uses SaaS Mode. | DOCUMENTED: Pricing Guide, "What is an Agency Wallet" and the Rebilling FAQ. How rebilling collects from a sub-account (card on file vs SaaS subscription) is **ACCOUNT VERIFICATION REQUIRED**. |
| 6 | What needs SaaS Mode, rebilling or add-ons? | See the next table. | DOCUMENTED |
| 7 | Founder-specific or grandfathered terms? | **None found in documentation.** Grandfathering only applies to existing Agency Pro customers, and Entrepreneuria is on a new trial. Fair-use AI allowances are "increased" for higher tiers, but the amounts aren't published. | **ACCOUNT VERIFICATION REQUIRED**: read the plan terms shown at checkout and in Agency Billing. |

### What depends on plan tier or add-ons

| Capability | Plan / cost | Evidence |
|---|---|---|
| Rebill usage **at cost** (phone, email, email validation) | $297 and $497 | DOCUMENTED (Pricing Guide) |
| Rebill usage **with markup** | $497 only, part of SaaS Mode | DOCUMENTED |
| SaaS Mode (self-serve signup that creates sub-accounts) | $497 only | DOCUMENTED and MARKETING |
| Rebill AI Employee usage | $497 only | DOCUMENTED |
| AI Employee Starter, $20/month per sub-account | $497 only | DOCUMENTED (AI Product Pricing, modified 2026-11-06) |
| Domain purchase rebilling | "$497 SaaS agencies" | DOCUMENTED (How to Enable and Rebill Domain Purchase) |
| Dedicated sending IP, $59/month | $297 and $497 | DOCUMENTED |
| "Advanced API access" vs "Basic API access" | Founder vs Unlimited | MARKETING. The difference isn't documented. **ACCOUNT VERIFICATION REQUIRED** that private integrations with contacts and opportunities scopes work on the plan Entrepreneuria keeps. |
| WordPress hosting | $10/month per site, $220/month for 25 sites, $497/month for unlimited | DOCUMENTED |
| HIPAA compliance | $297/month, can't be deactivated once enabled | DOCUMENTED. **Not needed. Don't enable.** |

### Plan decision (settled)

**Owner decision, 2026-11-07: keep the Founder plan.** The audit is based on Founder entitlements. The Founder-only features (rebilling with markup, SaaS Mode, AI Employee Starter, Advanced API access) are available for later packaging decisions, but the three packages don't depend on them.

## 2. Hosting and domains (summary; full comparison in GHL-HOSTING-ARCHITECTURE.md)

| Item | Finding | Evidence |
|---|---|---|
| Native Sites/Funnels hosting | Included. No per-site or per-sub-account hosting fee is documented. | DOCUMENTED (only WordPress hosting has a price) |
| Page, bandwidth, storage and traffic limits | **Not documented.** Third-party sources say pages are unlimited, which doesn't establish a contractual limit. AI features run under a fair-use policy. | **ACCOUNT VERIFICATION REQUIRED**: ask HighLevel support in writing |
| Custom domains | Supported, free to connect. Use an A record or a CNAME for a hostname, not both. Cloudflare proxy must be "DNS only". Propagation can take up to 24 hours. | DOCUMENTED (Set Up a Root Domain or Subdomain for HighLevel Sites) |
| SSL | Provisioned automatically after the domain connects. | DOCUMENTED in HighLevel's domain articles. Renewal mechanics aren't documented and are assumed automatic, so **verify**. |
| Domain purchase | Available. Price depends on TLD and is charged to the wallet. Transfer-in is supported. Getting a domain back out after cancellation needs a release-request form. | DOCUMENTED (Domain Purchase rebill article; "Releasing purchased domains from a cancelled account") |
| Customer keeps the domain at their own registrar | Supported: connecting needs only DNS records. | DOCUMENTED |
| Native site export | **No HTML export.** Portability is limited to HighLevel snapshots, which only load into HighLevel, and sub-account eject to another HighLevel agency, after which domains must be reconfigured. | DOCUMENTED (Snapshots overview; Sub-account eject) |
| AI Studio projects | Code-based (React/Vite, TanStack Start). Git Sync with GitHub works both ways and accepts external commits. A "Download AI Studio Codebase as ZIP" feature exists. Projects publish straight to a custom domain, and forms and calendars connect to the sub-account CRM. Projects can't be moved into Sites/Funnels. | DOCUMENTED (AI Studio in HighLevel; How to Use Git Sync in AI Studio, modified 2026-10-21) |
| External HTML/CSS/JS | Native builder: a Custom Code element for snippets only. WordPress hosting: single-file HTML page upload. AI Studio: external code through Git Sync. | DOCUMENTED |

## 3. API (summary; detail in GHL-API-COMPATIBILITY.md)

Private integrations are available for agencies and sub-accounts. Tokens are static and scoped, and HighLevel recommends rotating them every 90 days with a 7-day overlap. Rate limits are 100 requests per 10 s per integration per location, plus a 200,000-request daily counter shared per location. API version `2021-07-28` is still supported. `v3` was released 2026-06-11, and older versions move into maintenance with no retirement date published.

## 4. Usage prices (detail in WEBSITES-COST-MODEL.md)

All prices are DOCUMENTED and US-only. Email is $0.675 per 1,000. Email validation is $2.50 per 1,000. SMS is $0.00747 per segment each way, plus carrier fees of $0.0025–$0.0100. A local number is $1.15/month. A2P registration is $22.50 one-time (low volume), plus a campaign fee of $1.50–$10.50/month. Premium workflow actions are $0.01 per execution. AI Employee plans are $20, $50 or $97 per sub-account per month. Where rebilling is enabled, a fixed 5% markup is added to pass-through charges (A2P and carrier fees).

## Manual verification checklist (read-only; nothing to click except navigation)

| # | Where | What to record |
|---|---|---|
| V-1 | Agency View > Settings > Billing | Plan name, price, trial end date, next charge date, sub-account limit shown |
| V-2 | Agency View > Settings > Billing > Wallet & Transactions | Wallet balance, auto-recharge amount and threshold, existing charges |
| V-3 | Agency View > Sub-Accounts > "Create sub-account" dialog (open, read, **cancel**) | Whether any price or charge notice is shown |
| V-4 | Agency View > Reselling > Core Services | Which rebilling options the trial account shows |
| V-5 | Settings > Private Integrations (agency and the intake sub-account) | That the feature is present. If not, check Labs (enabling Labs is a change, so ask first). |
| V-6 | Intake sub-account > Settings > Business Profile / General | "Allow Duplicate Contact" setting and the email/phone priority order |
| V-7 | Intake sub-account > Opportunities > Pipelines settings | "Allow duplicate opportunities" setting; pipeline and stage ids |
| V-8 | Intake sub-account > Settings > Custom Fields | Each field's **id**, `fieldKey` and type, and the dropdown option values for `package_interest` and `style_interest` |
| V-9 | Intake sub-account > AI Studio | Whether AI Studio is enabled, whether Git Sync appears under More > Git, and what the publish screen says about cost |
| V-10 | Support chat or ticket (written answer) | Page, bandwidth and storage limits for Sites and AI Studio publishing; SSL renewal; trial restrictions on LC Email, LC Phone and A2P; how domains purchased in HighLevel are released |

## Sources (accessed 2026-11-07)

- HighLevel Founder Plan page: https://founder.gohighlevel.com/
- HighLevel pricing page: https://www.gohighlevel.com/pricing
- HighLevel Pricing Guide: https://help.gohighlevel.com/support/solutions/articles/155000001156-highlevel-pricing-guide
- Phone System Pricing & Billing Guide: https://help.gohighlevel.com/support/solutions/articles/48001223556-lc-phone-pricing
- AI Product Pricing: https://help.gohighlevel.com/support/solutions/articles/155000006652-ai-product-pricing
- AI Studio in HighLevel: https://help.gohighlevel.com/support/solutions/articles/155000007587-ai-studio-in-highlevel
- Git Sync in AI Studio: https://help.gohighlevel.com/support/solutions/articles/155000009214-how-to-use-git-sync-in-ai-studio
- AI Studio Cloud Pricing: https://help.gohighlevel.com/support/solutions/articles/155000009207-ai-studio-cloud-pricing
- Root domain / subdomain setup: https://help.gohighlevel.com/support/solutions/articles/48001153720-set-up-a-root-domain-or-subdomain-for-highlevel-sites
- Domain purchase rebilling: https://help.gohighlevel.com/support/solutions/articles/155000003454-how-to-enable-and-rebill-domain-purchase-
- Releasing purchased domains: https://help.gohighlevel.com/support/solutions/articles/155000008062-releasing-purchased-domains-from-a-cancelled-account
- Snapshots overview: https://help.gohighlevel.com/support/solutions/articles/48000982511-snapshots-overview
- Sub-account eject: https://help.gohighlevel.com/support/solutions/articles/155000003465-sub-account-transfers-eject-sub-account-to-a-new-agency
- Private Integrations: https://marketplace.gohighlevel.com/docs/Authorization/PrivateIntegrationsToken
- Rate limits: https://marketplace.gohighlevel.com/docs/other/rate-limits/
- API versioning: https://marketplace.gohighlevel.com/docs/Versioning
- OpenAPI specs and scope table: https://github.com/GoHighLevel/highlevel-api-docs (`apps/contacts.json`, `apps/opportunities.json`, `apps/custom-fields.json`, `apps/locations.json`, `docs/oauth/Scopes.md`)

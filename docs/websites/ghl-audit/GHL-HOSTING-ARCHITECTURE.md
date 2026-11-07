# Website delivery architecture: native GHL vs external vs hybrid

Audit date: 2026-11-07. Evidence labels match GHL-FOUNDER-CAPABILITY-AUDIT.md.

## The constraint that decides it

Entrepreneuria makes its personalized previews as **code**, with AI-assisted development tools. The approved commercial terms also promise that **customers own their content and domain** and that **transfer rights will be defined**. So the delivery architecture has to answer two questions:

1. Can the approved preview become the live site without being rebuilt by hand?
2. Can the site leave with the customer in a portable form?

The native GHL Sites builder fails both (DOCUMENTED: no HTML export; Custom Code is for snippets only). AI Studio and external hosting can both meet them.

## Options

### A. Native GHL Sites/Funnels builder

- **How it works:** Rebuild each approved preview in the drag-and-drop builder, inside the customer's sub-account.
- **Hosting cost:** $0 extra (DOCUMENTED: no per-site fee).
- **Domain/SSL:** Native. DNS records only, SSL automatic.
- **Forms/CRM:** Native.
- **Design flexibility:** Limited to builder elements plus Custom Code snippets. A code-built preview **cannot be imported**.
- **Labor:** Highest. Every preview is rebuilt by hand, and the preview the customer approved isn't the artifact that ships.
- **Transfer:** HighLevel-only (snapshot or sub-account eject). No HTML export. A customer leaving HighLevel takes their content but not a working site.
- **Verdict:** Not recommended as the primary path. Acceptable only for Starter customers who accept a template rebuild.

### B. External hosting + GHL CRM

- **How it works:** Deploy the code-built site to static hosting run by Entrepreneuria (for example the existing VPS/nginx, Hostinger or a static CDN). Lead capture goes to GHL in one of two ways:
  - **B1.** Embed the native GHL form or calendar widget from the customer's sub-account. No API token is needed per customer.
  - **B2.** The site posts to an Entrepreneuria API, which calls the GHL API for that sub-account. This needs a stored token for each customer.
- **Hosting cost:** About $0–$10 per site per month (vendor-dependent; not GHL). Labor costs extra.
- **Domain/SSL:** Entrepreneuria operates it: certificates, renewals, uptime and security patching.
- **Design flexibility:** Full. The approved preview ships as-is.
- **Labor:** Low per build. Ongoing operations are higher, and Entrepreneuria owns availability.
- **Transfer:** Best. Hand over the repository or ZIP, and the customer re-points DNS.
- **Risks:** A new production surface with its own SLA, monitoring and incident load. B2 adds multi-tenant credential storage. The existing nginx reliability work (D-18) is unresolved.

### C. Hybrid: per-customer GHL sub-account + code-based site (recommended)

Each customer gets a **dedicated GHL sub-account**. It is the system of record for contacts, forms, calendars, workflows, notifications, A2P brand and domain records. The website is **code**, kept in a Git repository Entrepreneuria controls, and published through one of two channels:

- **C1 (primary, subject to the spike below): GHL AI Studio + Git Sync.** AI Studio creates a private GitHub repository per project. It pulls external commits automatically, publishes to a custom domain from Domain Hub, connects forms and calendars to the sub-account CRM, and supports "Download AI Studio Codebase as ZIP" (DOCUMENTED, help articles modified 2026-10-21). It supports React (Vite) and TanStack Start. A static HTML preview would need to be wrapped as a Vite project.
- **C2 (fallback): option B1.** External static hosting with embedded GHL forms and calendars from the customer's sub-account.

| Criterion | A. Native | B. External | C. Hybrid (C1 → C2 fallback) |
|---|---|---|---|
| Preview → live without a rebuild | No | Yes | Yes |
| Hosting cost per site | $0 | ~$0–10 + ops | C1: $0 documented for Tiny/no backend (**verify** publishing cost) · C2: as B |
| SSL/domain operations | GHL | Entrepreneuria | C1: GHL · C2: Entrepreneuria |
| Forms/booking → CRM | Native | B1 embed / B2 API | Native (C1) / embed (C2) |
| Per-customer API credentials | None | B2: yes | None for the website. Only the Entrepreneuria intake integration has a token. |
| Design flexibility | Low | High | High |
| Scales to 25+ customers | Labor-bound | Ops-bound | Template repo + Git workflow |
| Transfer rights | GHL-only | Full code | Full code (ZIP / repo) + sub-account eject for CRM data |
| Vendor lock-in | High | Low | Medium (C1) / Low (C2) |
| Maturity risk | Low | Medium (our ops) | C1: AI Studio and Git Sync are recent features, and Git Sync is documented for GitHub only |

## Recommendation

**Adopt C (hybrid).** Make C1 the default only after a successful spike. Until then, plan on C2.

Reasons:
- It is the only option where the approved free preview is literally the delivered site.
- It keeps CRM, automations and SMS compliance inside per-customer sub-accounts. That isolates data and A2P brands, and gives a clean eject path.
- It delivers on transfer rights with portable code instead of a HighLevel-only snapshot.
- C1 removes Entrepreneuria-operated hosting and SSL from the critical path.

### Spike to approve before C1 becomes the default (needs owner approval: creates a test sub-account and project)

1. Create a test sub-account. This is free, but it's a change, so get approval first.
2. Create an AI Studio project. Connect Git Sync to a GitHub organization Entrepreneuria owns. Push one Sprint 2 demo as a Vite project. Confirm the auto-pull, the build and the preview.
3. Publish to a preview domain, then to a test subdomain on an Entrepreneuria-owned domain. Record the SSL time-to-issue.
4. Connect a native form and calendar. Submit a test lead and confirm the contact, workflow trigger and notification.
5. Download the codebase ZIP. Confirm it builds outside GHL, which is the transfer-rights test.
6. Record every wallet charge during steps 2–5 (V-2) and any publish or hosting cost shown. Confirm whether agency users editing inside a sub-account count as "agency users" (free AI Studio, fair use) or as sub-account users (pay-per-use).
7. Measure performance (Lighthouse) and SEO indexability with "Advanced SEO Support" on.

**Exit criteria for C1:** every step passes, there are no unexplained wallet charges, and the ZIP builds outside GHL. Otherwise use C2.

## Per-customer operating model under C

| Element | Where |
|---|---|
| Lead intake from entrepreneuria.io (previews) | Entrepreneuria's **own** intake sub-account (current adapter, one location) |
| Customer CRM, forms, calendars, workflows, notifications | The customer's sub-account |
| Website source of truth | Git repository per customer (Entrepreneuria GitHub org), template-derived |
| Domain | Registered by the **customer** at their own registrar. Only DNS records point at GHL or the host. Avoid buying domains through GHL, because release after cancellation needs a request form. |
| SMS | Only after the customer's A2P brand and campaign are approved in their sub-account |
| Offboarding | Repository/ZIP handover + DNS handover + optional sub-account eject to the customer's own HighLevel agency, or a contacts CSV export |

## Sources

See GHL-FOUNDER-CAPABILITY-AUDIT.md. The ones used here:
- AI Studio in HighLevel: https://help.gohighlevel.com/support/solutions/articles/155000007587-ai-studio-in-highlevel
- Git Sync: https://help.gohighlevel.com/support/solutions/articles/155000009214-how-to-use-git-sync-in-ai-studio
- AI Studio Cloud Pricing: https://help.gohighlevel.com/support/solutions/articles/155000009207-ai-studio-cloud-pricing
- Domain setup: https://help.gohighlevel.com/support/solutions/articles/48001153720-set-up-a-root-domain-or-subdomain-for-highlevel-sites
- Snapshots: https://help.gohighlevel.com/support/solutions/articles/48000982511-snapshots-overview
- Sub-account eject: https://help.gohighlevel.com/support/solutions/articles/155000003465-sub-account-transfers-eject-sub-account-to-a-new-agency
- WordPress custom HTML pages: https://help.gohighlevel.com/support/solutions/articles/155000006571-wordpress-custom-html-pages
- Custom code troubleshooting: https://help.gohighlevel.com/support/solutions/articles/48001159729-script-not-working-custom-javascript-html-code-validation-error-troubleshooting

# Delivering template websites to paying customers through GoHighLevel

Assessment, 2026-11-16, revised 2026-11-17. No GHL account was opened and nothing in GHL was created or changed.

**Owner decision (2026-11-17):** AI Studio is the source of truth for demo and customer websites, and customer delivery is by cloning reusable AI Studio projects. **This is subject to verifying the actual hosting costs and account limits** (see "AI Studio Cloud hosting charges" and "Open questions"). Not authorized: plan upgrades, customer sub-accounts, DNS changes, intake or payments.

Sources are HighLevel's own help center and pricing page, read on 2026-11-16 and 2026-11-17 (links at the end). Each claim is marked **[V]** verified in a HighLevel source, **[I]** inferred, or **[U]** unverified.

## The fact that reframes the question

The demos are **already GHL AI Studio projects**: every demo URL is a `vibepreview.app` AI Studio preview domain **[V]**. AI Studio is not the classic Sites/Funnels drag-and-drop builder:

- It generates real code (React/Vite or TanStack Start) and has a code editor **[V]**.
- Projects **cannot be moved into the standard Sites or Funnels builders** **[V]**.
- Projects can be **cloned into another sub-account in the same agency**, with or without chat and version history, and packaged into **snapshots** **[V]**.
- Forms and calendars connect to the sub-account's CRM and calendars on request (not automatically). A workflow trigger "AI Studio Form Submitted" exists **[V]**.
- A project can be published to a custom domain **[V]**.
- Git Sync is two-way, but it starts from an AI Studio project: AI Studio *creates* a new private repo and pushes to it **[V]**. **It does not import an existing GitHub repo [V]**. Codebase ZIP export exists **[V]**.
- Usage cost: free for agency users "subject to fair use". Sub-account users need an AI Employee plan ($20, $50 or $97/mo) or pay-per-use **[V]**.
- **Hosting is billed separately from building.** "AI Studio Cloud Hosting is billed separately from AI Studio generation usage. Nano hosting is free, while Micro and higher cloud tiers have additional charges, regardless of the AI Employee subscription." **[V]** Details below.

So path A splits in two: **A1** the classic builder, and **A2** AI Studio, which is where the work already lives.

## Comparison

Ratings: ●●● strong · ●● workable · ● weak.

| Criterion | A1: Classic GHL builder (recreate) | A2: AI Studio (current demos, clone per customer) | B: Custom code in GHL builder, or GHL WordPress hosting | C: External hosting + GHL CRM/forms/calendar |
|---|---|---|---|---|
| Visual fidelity | ● Rebuild by hand. Editorial type, layered layouts and motion get simplified. | ●●● It *is* the demo. Clones are pixel-identical. | ●● Custom-code blocks can match the look but stop being editable in the builder. WordPress is a full rebuild. | ●●● Any code. |
| Mobile | ●● Builder breakpoints, tuned per element | ●●● Code-level responsive. Each template still needs QA (Aurelle's header bug, §3 of TEMPLATE-GALLERY) | ● Code blocks inside builder sections often fight the builder's own responsive rules **[I]** | ●●● |
| Reuse across customers | ●●● Snapshots and templates **[V]** | ●●● Clone to the customer's sub-account, or snapshot **[V]** | ●● Copy and paste code per page; WordPress needs its own tooling | ●● Repo template per customer, our own pipeline |
| Personalization effort | ●● Manual edits in the builder, non-dev friendly | ●● Prompt AI Studio or edit code. Drops to ●●● if each template keeps business data in one content file (recommended below) **[I]** | ● Edit raw HTML per customer | ●● Edit config and redeploy |
| Hosting cost per customer | Included in the plan **[I]** | Free on the free Cloud tier. Paid tiers are about $11 to $242/mo per project, billed hourly to the wallet **[V]** (see below) | WordPress: **$10/mo per site** (Standard) **[V]**, 13% of the $75 fee | Our infrastructure (VPS or Vercel) plus the GHL sub-account anyway |
| Maintenance | ●●● GHL runs it | ●●● GHL runs it. Edits stay as drafts until republished **[V]** | ● WordPress core, plugins and security updates are ours **[I]** | ● Uptime, TLS, deploys, security and form plumbing are ours |
| Security and customer isolation | ●●● One sub-account per customer | ●●● One sub-account per customer. Per-project secrets **[V]** | ●● WordPress expands the attack surface | ●● Two systems; CRM keys must stay server-side |
| GHL integration | ●●● Native forms, calendars, workflows | ●●● Native once connected **[V]**. Must be connected explicitly per clone **[V]** | ●● Embedded forms/calendars via iframe or HTML **[I]** | ●● Embeds plus external form tracking; more failure points |
| Fits $75/mo Starter package | ●● | ●●● | ● (WordPress fee) | ● (two platforms per customer) |
| Lock-in | High | High, but mitigated by ZIP export and Git Sync **[V]** | Low (WordPress) / high (code blocks) | Low |

## AI Studio Cloud hosting charges

AI Studio *Cloud* is billed separately from AI Studio generation (building), through the HighLevel wallet **[V]**.

**HighLevel's two pages name the tiers differently.** The AI Studio pricing article says "**Nano** hosting is free, while **Micro** and higher cloud tiers have additional charges". The AI Studio Cloud pricing guide's table has no Nano or Micro row: it starts at **Tiny** (free), then Mini, and so on. The free tier is presumably the same one under two names. **[U]**: confirm the labels the account shows.

| Tier (Cloud pricing guide) | CPU / memory | Price | ≈ per month (730 h) | Share of $75/mo |
|---|---|---|---|---|
| Tiny (= "Nano"?) | shared / up to 0.5 GB | **free** | $0 | 0% |
| Mini (= "Micro"?) | 2-core ARM shared / 1 GB | $0.015456/h | $11.28 | 15% |
| Small | 2-core ARM shared / 2 GB | $0.02369/h | $17.29 | 23% |
| Medium | 2-core ARM shared / 4 GB | $0.09453/h | $69.01 | 92% |
| Large | 2-core dedicated / 8 GB | $0.174455/h | $127.35 | over the package price |
| X-Large | 4-core dedicated / 16 GB | $0.330855/h | $241.52 | over the package price |

Every project also includes, free: **2 GB of database storage** and **1 GB of file storage**. Above that, database storage is $0.14/GB-month, billed on the *reserved* size. It **cannot be reduced**, and the smallest increase is to 8 GB, which costs about $0.84/mo for the 6 GB above the free 2. File storage is $0.034/GB-month on actual use **[V]**.

Billing is per hour. A size change bills the change hour at both rates. Pausing stops instance charges, but not storage charges **[V]**.

**What this means for the $75 package:**

- **Every customer site must run on the free tier.** A paid instance takes 15% (Mini) to 23% (Small) of revenue before the GHL plan, domain or usage is paid for. Medium and above make the package unprofitable.
- HighLevel describes Cloud as the backend for apps that need **databases, user authentication or file storage** (member portals, uploads). A brochure site whose forms and calendars connect to the **GHL CRM** (not to a Cloud database) should not need a paid tier **[I]**. Confirm that our templates run on the free tier with Cloud features off.
- **Template rule:** no Cloud database, auth or file uploads in any template. Sizing a template up is a pricing decision, not a build choice.
- Set a **wallet spending limit / low-balance alert**, so a tier change on one customer project can't run up charges unnoticed **[V]**: the Cloud pricing guide has a "Low Balance and Spending Limits" section.

## Recommendation: A2, one sub-account per customer, clone from a template sub-account

1. **Template sub-account.** Keep every demo in one "Templates" sub-account. Treat each demo as a template: fictional content, a "fictional" bar, and no live form or calendar connections.
2. **Per customer:** create the customer's own sub-account, clone the chosen template into it **without history** (no demo chat log leaks to the customer), and personalize it. Then connect that sub-account's own form and calendar, connect the customer's domain, publish, and remove the fictional bar.
3. **Make personalization deterministic.** Ask AI Studio, or edit the code once per template, so that business name, phone, address, hours, services, prices, staff and image URLs live in **one content file**. Personalizing then becomes a reviewed data edit rather than a long AI chat, which keeps clones consistent and cuts AI usage **[I]**.
4. **Keep customers out of AI Studio.** Sub-account users have no AI Studio access without a paid AI Employee plan **[V]**, and AI edits by customers would undo the guarantees above. Changes go through us, as the proposal's change terms say.
5. **Paths B and C stay off the table** unless a specific customer needs WordPress (B, add $10/mo to their price) or a capability AI Studio can't host (C).

### Economics against the $75/month package

| Agency plan | Sub-accounts | Platform cost | What it means |
|---|---|---|---|
| Starter | 3 **[V]** | $97/mo **[V]** | If one sub-account holds templates, **2 customers maximum**. No pass-through rebilling. Doesn't scale. |
| Unlimited | unlimited **[V]** | $297/mo **[V]** | Platform cost is covered at **4 customers** ($300/mo). Adds pass-through billing for usage and add-ons **[V]**, so email/SMS usage can be rebilled. |

Per-customer variable costs on top:

- the domain (customer-owned, or registered by us per the proposal);
- email and SMS usage (rebillable on Unlimited);
- **AI Studio Cloud hosting: $0 on the free tier, about $11.28/mo or more on any paid tier** (above);
- AI Studio building: nothing, as long as agency users do the building, within fair use **[V]**. Moving from Starter to Unlimited is an owner decision. It becomes necessary at the third customer.

## Open questions to verify in the account (read-only)

1. Which agency plan is active, and how many sub-accounts are in use?
2. **Hosting:** which Cloud tier does each demo project run on (the Nano/Tiny naming)? Is Cloud on at all for a brochure site? Is there any per-site, bandwidth or custom-domain charge beyond the Cloud tiers? (Nothing found in the help center.) Does cloning preserve the source project's tier, or reset it to free?
3. Which sub-account owns the four demos today? If it's a customer-facing or production account, move the demos to a templates sub-account by cloning.
4. Does cloning carry generated images, or do clones still load from the source project's `vibe.filesafe.space` paths? This matters for isolation if the template is later edited or deleted **[U]**.
5. Can AI Studio's "fair use" for agency users absorb roughly N personalizations a month? Ask HighLevel support before scaling.

No GHL write operations were performed. The owner approved the direction on 2026-11-17, subject to these checks. Every account change it implies (plan upgrade, sub-accounts, DNS) still needs a separate, explicit approval.

## Sources

- [AI Studio in HighLevel](https://help.gohighlevel.com/support/solutions/articles/155000007587-ai-studio-in-highlevel): publishing, cloning across sub-accounts, snapshots, limitations (modified 2026-11-10)
- [AI Studio pricing](https://help.gohighlevel.com/support/solutions/articles/155000008322-ai-studio-pricing): usage by plan, fair use, "Nano hosting is free, while Micro and higher cloud tiers have additional charges" (modified 2026-11-10)
- [AI Studio Cloud pricing](https://help.gohighlevel.com/support/solutions/articles/155000009207-ai-studio-cloud-pricing): instance table (Tiny free, Mini $11.28/mo … X-Large $241.52/mo), storage allowances and rates, hourly billing, pausing (modified 2026-10-17)
- [Connect forms, calendars and automations in AI Studio](https://help.gohighlevel.com/support/solutions/articles/155000007599-connect-forms-and-calendars-in-ai-studio) (modified 2026-10-09)
- [Git Sync in AI Studio](https://help.gohighlevel.com/support/solutions/articles/155000009214-how-to-use-git-sync-in-ai-studio) (modified 2026-10-21)
- [Download AI Studio codebase as ZIP](https://help.gohighlevel.com/support/solutions/articles/155000008639-download-ai-studio-codebase-as-zip) (modified 2026-09-07)
- [Clone projects in AI Studio (changelog)](https://ideas.gohighlevel.com/changelog/clone-projects-in-ai-studio)
- [Creating snapshots](https://help.gohighlevel.com/support/solutions/articles/48000982512-creating-new-snapshots-in-highlevel)
- [HighLevel pricing](https://www.gohighlevel.com/pricing): Starter $97 / 3 sub-accounts, Unlimited $297 / unlimited, WordPress hosting from $10/mo per site

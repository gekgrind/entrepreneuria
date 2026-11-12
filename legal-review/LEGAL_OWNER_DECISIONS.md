# Owner decisions: Entrepreneuria Websites legal launch

> Draft, 2026-11-11. Not legal advice. These are business decisions that the drafts need and only the owner can make. Each has a recommended default chosen for low risk and zero cost. Once decided, record each one in `docs/websites/DECISION-REGISTER.md` as D-23 onward, then fill the matching `[OWNER: D-OWN-xx]` markers in `drafts/`.

## Needed before Stage 0/A (showcase or leads-only)

| ID | Decision | Finding | Recommended default | Alternatives | Where it lands |
|---|---|---|---|---|---|
| D-OWN-02 | Retention of lead data | LGL-07 | Non-converted leads: delete from GHL, the review store and the mailbox **12 months after last contact**. Resolved review-store files: delete **90 days after resolution** (the GHL copy, if any, remains) | 6 or 24 months. Keep indefinitely (not recommended: harder to justify) | Privacy section §W6 |
| D-OWN-03 | Postal address for privacy contact and CAN-SPAM | LGL-09 | A PO box or commercial mailbox, not a home address | Home or business street address | Privacy §W9, GHL email footer |
| D-OWN-04 | Review-store backup and access | LGL-07, LGL-23 | Owner-only SSH (key-based). No off-server backup of review files, because they are short-lived and the email or GHL copy covers loss | Encrypted backup with the same retention | Private ops notes; incident note |
| D-OWN-09 | Do lead or customer details go into AI tools (concept or site generation, copywriting)? | LGL-15 | **Yes, limited:** business name, services, service area and style only. Never phone, email or message text. Name the tools in the privacy section | No AI tools with personal data (then delete the bracketed AI clause) | Privacy §W4, agreement §6.3 |
| D-OWN-14 | Redefine the "approved by counsel" release gates | LGL-18 | Change `leads-privacy` and `legal-approved` to "owner-approved against `legal-review/` requirements, with date". Engineering makes the code change afterward | Keep counsel wording (blocks launch until counsel is funded) | `release-gates.ts` (engineering task E-7) |
| D-OWN-16 | Confirm the monitored inboxes | LGL-17 | Send a test to `privacy@`, `legal@` and the public inbox. If any isn't monitored, point all three policies at the one confirmed inbox | — | Privacy, Terms, Cookies, Subprocessors pages |
| D-OWN-17 | Demo hosting | LGL-15 | Read the `vibepreview.app` terms. If commercial use or permanence is unclear, keep the screenshots (already in the repo) and remove the live-demo links | Self-host the demos | `demos.ts` (engineering task E-9) |
| D-OWN-20 | "Georgia-based team" / "Based in Georgia" | LGL-24 | Keep "Based in Georgia" if true. If the business is one person, change "a Georgia-based team" to "a Georgia-based studio" or similar (owner copy ruling) | Keep as is if a team exists | `WebsitesPage.tsx:452` (copy change; owner-ruled) |
| D-OWN-15 | Outreach channels | LGL-10 | **Email and in-person only** at launch. No cold calls or texts | Phone with DNC scrub and manual dialing | Outreach checklist |

## Needed before Stage B (first paid customer)

| ID | Decision | Finding | Recommended default | Alternatives | Where it lands |
|---|---|---|---|---|---|
| D-OWN-01 | Legal name and entity type of the contracting party | LGL-04 | **RESOLVED (owner-confirmed 2026-11-12):** Entrepreneuria Global, LLC, a Georgia domestic limited liability company. It replaces "Entrepreneuria Global, Inc.", which appears on the live pages in error | — | Every draft now names Entrepreneuria Global, LLC |
| D-OWN-01a | **Entity status checkpoint: OUTSTANDING** | LGL-04 | The owner reports the LLC is **administratively dissolved** and is handling reinstatement separately. Before Stage B: verify reinstatement on the Georgia SOS registry and record the status and date in `LEGAL_LAUNCH_BLOCKERS.md`. Then confirm the GHL and processor accounts are in the LLC's name. Don't describe the LLC as active or in good standing until verified | — | `LEGAL_LAUNCH_BLOCKERS.md` LGL-04 checklist |
| D-OWN-21 | Setup-fee trigger wording | LGL-08 | "Due when you accept your written proposal and this Agreement, after you approve your homepage concept." The fee is never charged for the free concept itself | — | Agreement §4.1, order summary |
| D-OWN-05 | Setup-fee refunds | LGL-02 | **Full refund if you cancel before work starts** (before `implementationStartedAt`). **No refund once build work has started**, except if Entrepreneuria can't deliver. Then a full refund | Pro-rata; or non-refundable from payment (higher dispute risk) | Agreement §4.3 |
| D-OWN-06 | Cancellation method and effective date | LGL-03 | Cancel by email to `[inbox]` or by replying to any invoice. Confirmation in writing within 2 business days. **Effective at the end of the current paid month, but not before one month after launch** (D-08). No cancellation fee | A GHL customer-portal cancel button, if GHL supports it (better, still free) | Agreement §5.4, order summary |
| D-OWN-13 | Customer delay before launch | LGL-02 | No monthly charge until launch. If the customer is unresponsive for **60 days** after the build is ready, Entrepreneuria may close the project and the setup fee isn't refunded. Restart possible later | "Deemed launch" with billing start (riskier; not recommended) | Agreement §3.5 |
| D-OWN-10 | Failed payment and suspension | LGL-14 | Adopt D-15 as proposed: retries on days 1, 3 and 7, grace to day 14, **written notice at least 3 days before suspension**, and the site restored within 1 business day of payment | Shorter or longer grace | Agreement §5.5 |
| D-OWN-11 | Hosting scope and post-launch changes | LGL-13 | Hosting, SSL, and platform/security updates included. **No uptime guarantee.** Reasonable efforts plus prompt notice of extended outages. Small text and photo updates: `[OWNER: e.g., up to 30 min/month]`; larger work quoted separately | Offer an uptime target with a service credit | Agreement §3.3, §9 |
| D-OWN-07 | Exit package when a customer leaves | LGL-11 | On request within 30 days after cancellation: (a) all customer-supplied content and images; (b) page text as delivered; (c) domain transfer help (auth code or DNS change); (d) site kept live through the final paid period. **The GHL build itself is not transferable** | Charge a fee for a static HTML export, if technically possible | Agreement §6.5, §10.3 |
| D-OWN-08 | Design, template and code ownership | LGL-11 | Entrepreneuria keeps its templates, code and design systems. The customer gets a licence to use the site while subscribed, and permanently owns its own content, logo and domain. Custom graphics made just for the customer are assigned to the customer, to the extent copyright exists | Assign all custom design on full payment | Agreement §6 |
| D-OWN-12 | Domain registration | LGL-11 | The domain is **always registered in the customer's name** (registrant). Customer pays the registrar fee, at cost or directly. Entrepreneuria may be a technical contact | Entrepreneuria registers on the customer's behalf. Still name the customer as registrant | Agreement §6.2 |
| D-OWN-18 | Legal pages on customer sites | LGL-12 | Starter **does not** include legal pages written for the customer. Entrepreneuria can place a privacy page the customer supplies, or a generic template marked "not legal advice" `[OWNER choose]` | Include a template as standard | Agreement §7 |
| D-OWN-19 | Liability cap, governing law and venue | LGL-02, LGL-21 | Cap at **fees paid in the 12 months before the claim**. Georgia law. Venue in `[OWNER: county]` County, Georgia. No arbitration clause (simpler; small-claims court remains available) | Add binding arbitration (needs care) | Agreement §11, §13 |
| D-OWN-22 | Monthly price changes | LGL-02 | At least **30 days' written notice**. The customer may cancel before the change takes effect | Price locked for 12 months | Agreement §4.4 |
| D-OWN-23 | Taxes wording | LGL-22 | "Prices exclude any applicable taxes." Collect only if the owner or an accountant confirms Georgia taxes the service | Ask GA DOR for a letter ruling (free; takes time) | Agreement §4.5 |

## Decided already (inputs, not open)

| Term | Source |
|---|---|
| Legal entity: Entrepreneuria Global, LLC (Georgia domestic LLC). Status: administratively dissolved; reinstatement outstanding (D-OWN-01a) | Owner confirmation, 2026-11-12 |
| Starter only; $199 setup; $75/mo from launch; one-month minimum; hosting included; customer-owned content and domain; managed service; GHL-hosted payments | Prompt + D-02, D-16, D-19 |
| Preview = free homepage concept, no purchase required | D-19, approved copy C2 |
| Reply within 2 business days (a reply, not delivery) | D-19, C3 |
| SMS off until wording approved | D-05, `policies.ts` |
| Returning GHL contacts never written | D-22 |

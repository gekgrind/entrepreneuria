# Websites package recommendations (PROPOSED: not approved, not for publication)

Audit date: 2026-11-07. Prices are the approved ones. **Every inclusion and limit below is a proposal** for owner sign-off. Nothing here may be added to `lib/services/websites/packages.ts` as `verified`, or shown on the page, until the owner approves it and the capability column says VERIFIED for the chosen architecture.

**Capability column:**
- **VERIFIED**: documented by HighLevel.
- **VERIFY**: documented, but must be proven in the spike or the account.
- **EXTERNAL**: delivered outside GHL.

## Design principles

1. **Cap what costs money:** labor hours, premium workflow executions, SMS segments and AI. The cost model shows these, not hosting, are the margin risk.
2. **No AI agents in the base packages.** Offer them as a separately priced add-on (pay-per-use is uncapped by default).
3. **SMS only after A2P approval** for the customer's own brand, and only once the `sms_consent` policy is approved (D-05).
4. **The customer owns the domain** and registers it at their own registrar.
5. **Unused allowances don't roll over.**

## Feature matrix

| Feature | Starter $75/month | Growth $149/month | Business Growth $249/month | Capability |
|---|---|---|---|---|
| Setup fee (approved) | $199 | $249 | $399 | — |
| Pages | Up to 5 | Up to 10 | Up to 20 | VERIFIED (no limit documented; caps are commercial) |
| Design | One of 3 approved styles, template-based | Style + light customization | Style + custom sections | Commercial |
| Hosting + SSL | Included | Included | Included | VERIFIED native / VERIFY AI Studio publish |
| Domain connection (customer-owned domain) | Included, 1 domain | Included, 1 domain + www | Up to 2 domains (e.g. a campaign subdomain) | VERIFIED |
| Mobile-responsive | Included | Included | Included | Delivery standard |
| Contact forms → CRM | 1 form | Up to 3 forms | Up to 5 forms | VERIFIED native forms / VERIFY AI Studio connect |
| Dedicated CRM sub-account | Included | Included | Included | VERIFIED |
| Lead notification to the business owner | Email + GHL mobile app | Email + mobile app | Email + mobile app + SMS to the owner (after A2P) | VERIFIED email · VERIFY mobile push · SMS needs A2P |
| Lead auto-reply email | 1 template | 1 template | 1 template | VERIFIED |
| Appointment booking | — | 1 calendar | Up to 3 calendars | VERIFIED |
| Email automations | — | Up to 2 workflows (e.g. auto-reply + 3-email nurture) | Up to 5 workflows (nurture, reminder, review request, reactivation) | VERIFIED |
| Email volume (fair use) | 1,000 sends/month | 3,000 sends/month | 8,000 sends/month | Commercial cap, cost $0.675/1k |
| SMS automations | — | Optional after A2P: appointment reminders, 250 segments/month | After A2P: reminders, missed-call text-back, review requests, 750 segments/month | VERIFIED capability · A2P approval per customer |
| Phone number | — | 1 local number if SMS is enabled | 1 local number | VERIFIED |
| Premium workflow actions | Not included | Up to 500 executions/month | Up to 2,000 executions/month | Commercial cap ($0.01 each) |
| Analytics | Basic traffic + form-conversion report | Monthly report: traffic, leads, sources | Monthly report + pipeline summary + 30-min review call per quarter | VERIFY which analytics the delivery channel provides (AI Studio/native vs external tool) |
| Maintenance (hosting, uptime watch, security, platform updates) | Included | Included | Included | Commercial |
| Content edits after launch | 30 min/month | 1 h/month | 2 h/month | Commercial (labor cap) |
| Launch revisions (included in setup) | 2 rounds | 2 rounds | 3 rounds | Commercial |
| AI capabilities | None in package | None in package | None in package. AI agents (Conversation/Voice AI) are a quoted add-on. | VERIFIED pricing; excluded for margin |
| Support | Email, 2 business days | Email, 1 business day | Email/phone, 1 business day + priority queue | Commercial |
| Overage handling | Quote additional work hourly | Quote extra work; SMS overage billed at cost + markup (or the next package) | Same | Needs the A-04 decision |

## Why these limits

- **Labor caps** (30 min / 1 h / 2 h) keep moderate-usage contribution positive after labor: $44.87 / $73.72 / $84.32 per customer per month in the cost model. Moderate contribution disappears at 1.4 / 2.5 / 3.7 h per month, so the caps leave headroom for support.
- **SMS caps** (250 / 750 segments) cost about $3.12 and $9.35 per month at documented rates, plus a number and A2P fee of up to $11.65. Inbound replies count against the cap.
- **Premium workflow caps** keep the worst case at $5 / $20 per month. Without a cap, 10,000 executions cost $100.
- **AI excluded** because an AI Employee plan costs $20–$97 per sub-account and pay-per-use is metered and uncapped. A package price of $75–$249 can't absorb Unlimited at $97.
- **Setup fees** only cover about 3.9 / 4.4 / 7.3 hours of build at $50/hour. Templated builds and capped revision rounds are a commercial necessity, not a preference.

## Claims that must not be published until verified

- "Unlimited" anything (pages, bandwidth, emails).
- Uptime percentages or SLA language (no GHL SLA is documented).
- SMS features before the customer's A2P approval and approval of the `sms_consent` policy.
- "AI-powered" features in a package.
- "You can take your website with you" until the transfer-rights policy (A-06) and the export mechanism (spike step 5) are both settled.

## Registry note (no change made)

When approved, each row becomes an `entitlement` with `status: "verified"` and an optional `limit`. Example ids: `pages` (5/10/20), `forms` (1/3/5), `calendars` (0/1/3), `email-sends` (1000/3000/8000), `sms-segments` (0/250/750), `edit-minutes` (30/60/120). Then `entitlementsStatus` flips to `approved`, and release gate `features-verified` can pass with evidence.

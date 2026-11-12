# Websites cost model

Audit date: 2026-11-07. All prices are USD and exclude tax. The model is reproducible: the script is described under "Method".

**Labels:** **[D]** documented provider price · **[A]** modeling assumption (owner to confirm) · **[U]** unknown, so excluded and flagged.

## 1. Cost categories

### 1.1 Fixed agency subscription

| Item | Cost | Label |
|---|---|---|
| GHL Founder plan | $497/month ($4,970/year per third-party sources; annual price not verified) | [D] pricing guide / founder page |
| Plan choice | Founder is kept (owner decision 2026-11-07, A-01 settled) | — |
| Premium Support, Whitelabel app, etc. | Not needed. Excluded. | [D] |

### 1.2 Fixed per-client

| Item | Cost | Label |
|---|---|---|
| Sub-account | $0 | [D] (no fee documented) |
| Native or AI Studio site hosting, SSL, domain connection | $0 | [D] native; AI Studio Tiny/no-backend is free [D]. Publishing cost not shown [U]; see spike step 6. |
| Local phone number (Growth/Business, for SMS) | $1.15/month | [D] |
| A2P campaign fee (Growth/Business, for SMS) | $1.50–$10.50/month (low volume); up to $2.10 (sole proprietor) | [D] |
| A2P one-time registration | $22.50 (low volume / sole proprietor), $64 (high volume), including the $3 fast-track fee. Charged on submission whatever the outcome. | [D] |
| Customer domain | $0 to Entrepreneuria. The customer registers and owns it. | [A] approved ownership terms |
| External host (fallback C2 only) | ~$0–$10/site/month | [A] vendor-dependent |

### 1.3 Variable usage

| Item | Unit price | Label |
|---|---|---|
| Email (LC Email) | $0.675 per 1,000 | [D] |
| Email validation | $2.50 per 1,000 | [D] |
| SMS, US/CA | $0.00747 per segment, **outbound and inbound** | [D] |
| SMS carrier fee | $0.0025–$0.0100 per segment (the model uses $0.0050) | [D] |
| MMS | $0.022 out / $0.0165 in, plus carrier fees | [D] |
| Voice | $0.0166/min out, $0.01165/min in, $0.02/min forwarded; recording $0.0025/min; transcription $0.024/min | [D] |
| Premium workflow actions | $0.01 per execution, or Workflow Pro at $10/$25/$50 for 10k/30k/65k executions | [D]. The table marks Workflow Pro "per enabled sub-account" while the prose says "for the agency" [U] |
| Number Intelligence | $0.005 per validation | [D] (not used) |
| 5% pass-through markup | On A2P and carrier fees, **only when rebilling is enabled** | [D] |

### 1.4 Optional add-ons (exclude from packages unless sold separately)

| Item | Cost | Label |
|---|---|---|
| AI Employee Starter / Growth / Unlimited | $20 (Founder only) / $50 / $97 per sub-account per month | [D] |
| Conversation AI / Voice AI pay-per-use | Token-based; voice model $0.10–$0.20/min **plus** phone charges | [D] |
| Online Listings | $30/month per sub-account | [D] |
| SEO (Search Atlas) | $79/month per sub-account | [D] |
| WhatsApp | $10/month + usage | [D] |
| Dedicated IP | $59/month | [D] |
| WordPress hosting | $10/site/month | [D] (not recommended) |
| Domain purchase through GHL | Varies by TLD | [D] (not recommended; see hosting doc) |

### 1.5 Payment processing

| Item | Cost | Label |
|---|---|---|
| Stripe US card | 2.9% + $0.30 per successful charge | [D] stripe.com/pricing (verify current) |
| Stripe Billing (if subscriptions run on Stripe Billing) | +0.7% of recurring volume | [D] stripe.com/billing/pricing |
| HighLevel native payment provider | **No published rate.** Founder "payment commissions" have no published terms. | [U]. Don't model any. |

Per-charge fees: $199 → $6.07 · $249 → $7.52 · $399 → $11.87 · $75 → $2.48 · $149 → $4.62 · $249 → $7.52. Billing adds $0.53 / $1.04 / $1.74 per month.

### 1.6 Implementation and support labor

**[A] Every figure here is an assumption.** Labor is valued at **$50/hour** (the owner should set the real rate or opportunity cost).

| Package | Setup hours (build, revisions, launch) | Monthly hours (low / moderate / high) |
|---|---|---|
| Starter | 4 | 0.25 / 0.5 / 1.5 |
| Growth | 6 | 0.5 / 1.0 / 2.5 |
| Business | 10 | 1.0 / 2.0 / 4.0 |

## 2. Usage scenarios per client per month [A]

| Package | Scenario | Emails | Validations | SMS segments (in+out) | Premium workflow executions | Phone + A2P | AI |
|---|---|---|---|---|---|---|---|
| Starter | low / mod / high | 200 / 600 / 2,000 | 50 / 100 / 300 | 0 | 50 / 200 / 1,000 | none | none |
| Growth | low / mod / high | 500 / 1,500 / 5,000 | 100 / 200 / 600 | 50 / 200 / 1,000 | 200 / 500 / 3,000 | $1.15 + $1.50 / $10.50 / $10.50 | 0 / 0 / $20 |
| Business | low / mod / high | 1,000 / 3,000 / 10,000 | 200 / 400 / 1,500 | 200 / 600 / 3,000 | 500 / 1,500 / 10,000 | $1.15 + $1.50 / $10.50 / $10.50 | 0 / $20 / $50 |

## 3. Per-client monthly unit economics

| Package | Scenario | Price | Platform usage | Stripe | Contribution before labor | Labor h | Labor $ | Contribution after labor |
|---|---|---|---|---|---|---|---|---|
| Starter | low | $75 | $0.76 | $2.48 | $71.77 | 0.25 | $12.50 | $59.27 |
| Starter | mod | $75 | $2.66 | $2.48 | $69.87 | 0.5 | $25.00 | $44.87 |
| Starter | high | $75 | $12.10 | $2.48 | $60.42 | 1.5 | $75.00 | **−$14.58** |
| Growth | low | $149 | $5.86 | $4.62 | $138.52 | 0.5 | $25.00 | $113.52 |
| Growth | mod | $149 | $20.66 | $4.62 | $123.72 | 1.0 | $50.00 | $73.72 |
| Growth | high | $149 | $79.00 | $4.62 | $65.38 | 2.5 | $125.00 | **−$59.62** |
| Business | low | $249 | $11.32 | $7.52 | $230.16 | 1.0 | $50.00 | $180.16 |
| Business | mod | $249 | $57.16 | $7.52 | $184.32 | 2.0 | $100.00 | $84.32 |
| Business | high | $249 | $209.56 | $7.52 | $31.92 | 4.0 | $200.00 | **−$168.08** |

**What this shows:** platform usage is small at low and moderate usage. **Labor and uncapped high usage are what drive margin.** The high-usage losses come mostly from premium workflow executions (10,000 × $0.01 = $100) and labor, not from hosting.

## 4. Setup fees (one-time, reported separately)

| Package | Setup fee | Stripe | A2P one-time | Setup labor | Net setup margin |
|---|---|---|---|---|---|
| Starter | $199 | $6.07 | — | 4 h / $200 | **−$7.07** |
| Growth | $249 | $7.52 | $22.50 | 6 h / $300 | **−$81.02** |
| Business | $399 | $11.87 | $22.50 | 10 h / $500 | **−$135.37** |

At $50/hour, the setup fees cover about **3.9 / 4.4 / 7.3 hours** of build labor after fees and A2P. Setup is only self-funding if builds are template-driven, from the three approved styles, with capped revision rounds. Free previews add unpaid labor before any fee, and conversion rate is the biggest unknown here [U].

## 5. Portfolio scenarios (moderate usage) with the $497 GHL allocation

| Package | Customers | MRR | Setup revenue (cohort) | Contribution before labor | GHL per customer | Net after GHL, before labor | Net after GHL and labor |
|---|---|---|---|---|---|---|---|
| Starter | 1 | $75 | $199 | $69.87 | $497.00 | −$427.13 | −$452.13 |
| Starter | 5 | $375 | $995 | $349.35 | $99.40 | −$147.65 | −$272.65 |
| Starter | 10 | $750 | $1,990 | $698.70 | $49.70 | $201.70 | −$48.30 |
| Starter | 25 | $1,875 | $4,975 | $1,746.75 | $19.88 | $1,249.75 | $624.75 |
| Growth | 1 | $149 | $249 | $123.72 | $497.00 | −$373.28 | −$423.28 |
| Growth | 5 | $745 | $1,245 | $618.61 | $99.40 | $121.61 | −$128.39 |
| Growth | 10 | $1,490 | $2,490 | $1,237.23 | $49.70 | $740.23 | $240.23 |
| Growth | 25 | $3,725 | $6,225 | $3,093.06 | $19.88 | $2,596.06 | $1,346.06 |
| Business | 1 | $249 | $399 | $184.32 | $497.00 | −$312.68 | −$412.68 |
| Business | 5 | $1,245 | $1,995 | $921.61 | $99.40 | $424.61 | −$75.39 |
| Business | 10 | $2,490 | $3,990 | $1,843.22 | $49.70 | $1,346.22 | $346.22 |
| Business | 25 | $6,225 | $9,975 | $4,608.05 | $19.88 | $4,111.05 | $1,611.05 |

**Blended mix [A]: 40% Starter, 40% Growth, 20% Business.** Average MRR is $139.40 per customer.

| Usage | Contribution per customer before / after labor | Break-even before / after labor | N=5 net after labor | N=10 | N=25 |
|---|---|---|---|---|---|
| Low | $130.15 / $105.15 | 4 / 5 | $28.73 | $554.45 | $2,131.63 |
| Moderate | $114.30 / $64.30 | 5 / 8 | −$175.49 | $146.01 | $1,110.54 |
| High | $56.71 / −$63.29 | 9 / never | −$813.46 | −$1,129.93 | −$2,079.32 |

## 6. Break-even customer counts (to cover $497/month)

| Package | Low (before / after labor) | Moderate | High |
|---|---|---|---|
| Starter | 7 / 9 | 8 / 12 | 9 / never |
| Growth | 4 / 5 | 5 / 7 | 8 / never |
| Business | 3 / 3 | 3 / 6 | 16 / never |
## 7. Sensitivity

| Driver | Effect |
|---|---|
| SMS | +$12.47 per extra 1,000 segments (in+out, worst carrier fee). Inbound replies are billed too. |
| Email | +$6.75 per extra 10,000 sends |
| Premium workflow actions | +$100 per extra 10,000 executions on pay-as-you-go, or $10 for 10k on Workflow Pro Starter. **The biggest usage risk, so cap or meter it.** |
| AI agents | +$20 / $50 / $97 per sub-account if an AI Employee plan is included. Conversation/Voice AI pay-per-use is uncapped by default. **Exclude AI agents from base packages.** |
| Labor | Each extra hour is −$50. Moderate contribution disappears at **1.4 h** (Starter), **2.5 h** (Growth) and **3.7 h** (Business) per month. |
| Stripe Billing | −$0.53 / −$1.04 / −$1.74 per month |
| Rebilling SMS/AI at markup (Founder only) | Turns SMS and AI from a cost risk into a margin line, but needs a sub-account payment method and extra customer disclosures |

## Method

Each row is: price − (usage × documented unit prices) − Stripe fee − labor hours × $50. Break-even is `ceil(497 / contribution)`. The calculation was run as a throwaway script outside the repo and isn't committed. Rerun it with the owner's labor rate and real usage once the first customers are live.

## Sources

- Pricing Guide: https://help.gohighlevel.com/support/solutions/articles/155000001156-highlevel-pricing-guide
- Phone System Pricing: https://help.gohighlevel.com/support/solutions/articles/48001223556-lc-phone-pricing
- AI Product Pricing: https://help.gohighlevel.com/support/solutions/articles/155000006652-ai-product-pricing
- AI Studio Cloud Pricing: https://help.gohighlevel.com/support/solutions/articles/155000009207-ai-studio-cloud-pricing
- Stripe pricing: https://stripe.com/pricing · Stripe Billing: https://stripe.com/billing/pricing

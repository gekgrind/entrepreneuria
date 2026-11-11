# DRAFT: Order Summary and billing, cancellation and refund terms

> **DRAFT. Not published. Not legal advice.**
>
> **Purpose:** the short disclosure every customer sees **above the payment fields** on the GHL-hosted payment page or invoice, and again in the confirmation email. It's written to meet ROSCA's three elements (15 U.S.C. §8403 `[web search — verify]`):
> 1. clear and conspicuous material terms before billing information;
> 2. express informed consent;
> 3. a simple way to stop recurring charges.
>
> ROSCA's reach to business buyers is uncertain. Complying costs nothing. Values come from the approved terms; `[OWNER]` items come from `LEGAL_OWNER_DECISIONS.md`.

---

## A. Order Summary (on the GHL payment page or invoice, above payment fields)

**Your Entrepreneuria Websites order: Website Starter**

| | |
|---|---|
| **Today** | **$199 one-time setup fee** |
| **Then** | **$75 per month**, starting on the day your website goes live (your Launch Date), charged automatically each month on that date |
| **Minimum** | One month after launch. After that, month to month |
| **Hosting** | Included in the $75/month. Domain registration isn't included `[OWNER: unless…]` |
| **Cancel anytime** | Email `[inbox]` or reply "cancel" to any receipt. We confirm within 2 business days. Cancellation takes effect at the end of your paid month, after the one-month minimum. No cancellation fee |
| **Setup fee refund** | Full refund if you cancel before we start building. Not refundable once building starts, unless we can't deliver |
| **Ownership** | You own your content and your domain |
| **Taxes** | Prices exclude any applicable taxes |

☐ **I agree to the [Entrepreneuria Websites Service Agreement](link to versioned PDF) (version `[v]`). I authorize a one-time $199 charge today and $75 per month starting on my website's Launch Date until I cancel.**

`[ENG/OWNER: the checkbox starts unticked; payment can't be submitted without it; the link opens the exact accepted version.]`

**Pay $199** ← button label states the amount charged now.

## B. Confirmation email (sent after setup-fee payment)

> **Subject:** Your Entrepreneuria Websites order: receipt and terms
>
> Thanks, [Name]. We received your $199 setup fee for Website Starter.
>
> - **Next:** we'll start building your website and show it to you before it goes live.
> - **Monthly fee:** $75/month starts on the day your website goes live. We'll email you on launch day with your billing date.
> - **Minimum:** one month after launch, then month to month.
> - **Cancel anytime:** reply "cancel" to this email or write to [inbox]. Cancellation takes effect at the end of your paid month (after the one-month minimum). No fee.
> - **Your agreement:** [link to the accepted version PDF].
>
> [LEGAL ENTITY NAME] · [postal address]

## C. Launch-day email (when the subscription starts)

> **Subject:** Your website is live. Your monthly plan starts today
>
> Your website is live at [domain]. Your $75/month plan starts today, [Launch Date], and renews on the [day] of each month. The first charge is today. Your one-month minimum ends on [Launch Date + 1 month]. To cancel any time, reply "cancel" to this email.

## D. Cancellation confirmation email

> **Subject:** Cancellation confirmed
>
> We've received your cancellation for [business]. Your last charge was [date, amount]. Your service ends on [effective date], and you won't be charged again. Your website stays live until then. To get your content and domain-transfer help, reply within 30 days after [effective date].

## E. Failed-payment notice (per D-OWN-10)

> Your $75 payment on [date] didn't go through. We'll retry on [dates]. Your website stays live until [date + 14]. Update your payment method here: [link]. If we can't collect payment by then, we may pause your website after giving you 3 days' notice.

## Implementation checks

These go to engineering and the owner, and are tracked in `LEGAL_UX_IMPLEMENTATION.md` §4.

- [ ] The setup fee is charged once only, with the GHL product configured as a one-time charge
- [ ] The subscription is **created on launch**, not at checkout (owner-triggered in GHL, or a scheduled start date)
- [ ] The cancellation inbox is monitored, and cancellations stop the GHL subscription within 2 business days
- [ ] A copy of the accepted agreement version is stored with the customer record

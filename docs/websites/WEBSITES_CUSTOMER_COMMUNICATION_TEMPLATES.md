# Websites customer communication templates

> **ALL TEMPLATES ARE DRAFTS. NONE MAY BE SENT.**
> - Operational templates need owner approval of the wording, then Gate D.
> - Templates marked **LEGAL DRAFT, PENDING ACTIVATION** or **PAYMENT DRAFT, PENDING ACTIVATION** also need the final agreement (PR #38) and Gate A, B or C. See `WEBSITES_LEGAL_PAYMENT_ACTIVATION_GATES.md`.
> - Not legal advice. Wording that describes contract terms must match the final signed agreement, which wins on any conflict.

Registry: `lib/services/websites/communications.ts`. Each template is tied to the lifecycle event that calls for it. Processing that event records an **intent** (`delivery: "not_sent"`) and never sends anything. Templates are meant to be configured as GHL email templates, so GHL stays the sending system.

**Merge fields:** `{{first_name}}`, `{{business_name}}`, `{{owner_name}}`, `{{preview_link}}`, `{{proposal_link}}`, `{{agreement_link}}`, `{{payment_link}}`, `{{site_url}}`, `{{launch_date}}`, `{{reply_inbox}}`.
**Owner placeholders:** `[OWNER: …]` marks wording the owner must supply or rule on. Leave none in a sent message.

**Approved terms used here:** Website Starter only. $199 one-time setup fee, due after preview approval and acceptance of the proposal and service agreement. $75/month managed website subscription, starting only when the site launches. One-month minimum. Hosting included. The customer owns their domain and business content. Entrepreneuria keeps its underlying templates and reusable code, subject to the final agreement. The first personalized preview is free, with no obligation to buy. The preview is a **homepage concept, not a complete website** (D-19). A reply comes within 2 business days, and that's a reply, not delivery of the concept (D-19).

**Not promised anywhere below**, because none of these is approved yet: number of revisions (`revisions`: verify), build timeline, refund terms (`setup_fee_refund`: proposed), cancellation mechanics (`cancellation`: proposed), uptime.

---

## 1. Request acknowledgment
`request_acknowledgment` · trigger `acknowledge_request` · operational

**Subject:** We received your website preview request

Hi {{first_name}},

Thanks for asking us to create a free homepage concept for {{business_name}}. We've received your request.

What happens next:
- We'll look at your business and how customers find you today.
- If we have questions, we'll reply within 2 business days.
- When your concept is ready, we'll send you a private link to review it.

The preview is free, and there's no obligation to buy anything.

To help us get it right, reply with anything you'd like us to know: the services you offer, the areas you serve, and your logo or photos if you have them.

{{owner_name}}
Entrepreneuria Websites

---

## 2. Preview delivery
`preview_delivery` · trigger `deliver_preview` (sent for each revision) · operational

**Subject:** Your homepage concept for {{business_name}} is ready

Hi {{first_name}},

Your free homepage concept is ready: {{preview_link}}

It's a concept of your homepage, built to show the direction we'd take. It isn't a finished website yet. Look at it on your phone too, since that's where most of your customers will see it.

When you've had a look, just reply:
- **"Approved"** if you'd like to move forward with this direction, or
- tell us what you'd change, and we'll revise it.

There's still no obligation. If it isn't right for you, a one-line reply saying so is perfectly fine.

{{owner_name}}

---

## 3. Preview feedback received
`preview_feedback` · trigger `request_revision` · operational

**Subject:** Got your notes on the concept

Hi {{first_name}},

Thanks for the feedback. We're working on the changes and will send the updated concept to this address. [OWNER: optional expected timing, e.g. "within X business days". Don't send until the owner sets it.]

{{owner_name}}

---

## 4. Preview approval confirmation
`preview_approval_confirmation` · trigger `approve_preview` · operational

**Subject:** Concept approved: here's what happens next

Hi {{first_name}},

Great: you've approved the homepage concept for {{business_name}}.

Approving the concept doesn't commit you to anything or charge you anything. Next, we'll send you a short proposal with the price and the service agreement. You decide from there.

{{owner_name}}

---

## 5. Proposal introduction
`proposal_introduction` · trigger `send_proposal` · **LEGAL DRAFT, PENDING ACTIVATION** · Gate A

**Subject:** Your Website Starter proposal

Hi {{first_name}},

Here's your proposal to build and run the website for {{business_name}}, based on the concept you approved: {{proposal_link}}

**Website Starter**
- **$199 one-time setup fee.** Due only after you accept this proposal and the service agreement.
- **$75/month managed website subscription.** Starts only when your website launches, not before. One-month minimum.
- **Hosting is included.**
- **You own your domain and your business content.** Entrepreneuria keeps the underlying templates and reusable code it uses to build sites, as set out in the agreement.

Prices exclude any applicable taxes. [OWNER: confirm the tax wording, D-OWN-23]

This proposal is valid until [OWNER: proposal validity, e.g. "{{proposal_expiry_date}}"]. Cancellation and refund terms are in the service agreement. [Do not summarize them here until the `cancellation` and `setup_fee_refund` policies are approved.]

The contracting party is Entrepreneuria Global, LLC.

{{owner_name}}

---

## 6. Agreement acceptance instructions
`agreement_acceptance_instructions` · trigger `send_proposal` · **LEGAL DRAFT, PENDING ACTIVATION** · Gate A

**Subject:** How to accept your proposal

Hi {{first_name}},

To go ahead:

1. Read the service agreement (version [OWNER: agreement version]): {{agreement_link}}
2. [OWNER: choose one, PR #38 legal UX §5.2]
   - **Checkbox:** on the order page, tick "I have read and agree to the Entrepreneuria Website Service Agreement", then continue; or
   - **E-signature:** sign the agreement through the GHL document link.
3. After you accept, we'll send a separate secure GHL payment page for the $199 setup fee.

Accepting the agreement doesn't start your monthly subscription. The $75/month starts only when your website launches.

Questions? Reply to this email before accepting.

{{owner_name}}

---

## 7. Setup payment instructions
`setup_payment_instructions` · trigger `request_setup_payment` · **PAYMENT DRAFT, PENDING ACTIVATION** · Gate B

**Subject:** Your $199 setup payment

Hi {{first_name}},

Thanks for accepting the agreement. Your one-time setup fee is **$199**.

Pay securely on our GHL payment page: {{payment_link}}

- This is the only payment due now.
- Your **$75/month** subscription does **not** start until your website launches.
- We start building as soon as the payment is confirmed.

We'll never ask for card details by email or phone. Use only the link above.

{{owner_name}}

---

## 8. Build kickoff
`build_kickoff` · trigger `start_implementation` · operational

**Subject:** We're building your website

Hi {{first_name}},

Your setup payment is confirmed, and we've started building the website for {{business_name}}.

To keep things moving, please send us (reply to this email):
- your logo, if you have one
- photos of your work, team or location
- your services and the areas you serve
- your domain name and who it's registered with, if you already have one. The domain stays registered in your name.
- [OWNER: anything else on the onboarding checklist, UX-01 deliverable C]

We'll send you the finished site to review before anything goes live. [OWNER: optional expected timing]

{{owner_name}}

---

## 9. Launch approval request
`launch_approval_request` · trigger `submit_for_review` · operational

**Subject:** Your website is ready for review

Hi {{first_name}},

Your website is ready for you to review: {{preview_link}}

Please check the details: names, phone number, services, service areas and photos.

When you're happy, reply **"Approved for launch"** and we'll put it live. If anything needs changing, tell us what and we'll update it before launch.

Your $75/month subscription starts only once the site is live.

{{owner_name}}

---

## 10. Launch confirmation
`launch_confirmation` · trigger `verify_launch` · operational

**Subject:** {{business_name}} is live

Hi {{first_name}},

Your website is live at {{site_url}}. We checked it after launch on {{launch_date}}.

Hosting is included, and we'll keep the site running. If you need anything, reply to this email or write to {{reply_inbox}}.

{{owner_name}}

---

## 11. Monthly subscription start notification
`subscription_start_notification` · trigger `subscription_activated` · **PAYMENT DRAFT, PENDING ACTIVATION** · Gate C

**Subject:** Your $75/month website subscription has started

Hi {{first_name}},

Now that {{business_name}}'s website is live, your managed website subscription has started:

- **$75/month**, starting from your launch date, {{launch_date}}
- billed monthly through GHL [OWNER: confirm the billing day wording once GHL's anchor behaviour is verified]
- one-month minimum
- hosting included

To cancel or ask about billing, see your service agreement or reply to this email. [Do not describe cancellation mechanics until the `cancellation` policy is approved, D-OWN-06.]

{{owner_name}}
Entrepreneuria Global, LLC

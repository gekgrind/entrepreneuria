# DRAFT: Privacy Policy, Entrepreneuria Websites section and required edits

> **DRAFT. Not published. Not legal advice. Not attorney-reviewed.** Every statement of fact was checked against the code on `review/ghl-s8-remediation` @ `2a12dac` unless marked `[OWNER]`. Fill each `[OWNER: …]` marker before publishing. Remove this box and every bracket before going live.
>
> **Placement:** a new section on the existing `/privacy` page, with anchor `#websites`, after "Information We Collect". The existing sections are kept, except for the edits in Part 2. This is the lowest-change way to make one posted policy cover the site (CalOPPA expects one conspicuous policy) `[web search — verify]`.

---

## Part 1: Text to insert

### Entrepreneuria Websites

This section explains how we handle information when you ask about or buy our website service, Entrepreneuria Websites. It applies to the page at entrepreneuria.io/services/websites, the preview request form, emails you send us about a website, and our work with you as a customer.

#### W1. What we collect

**When you request a free homepage concept**, by our form or by email, we collect:

- your name and email address;
- your phone number, if you give one;
- your business name, type of business, and existing website address, if any;
- the package and design style you are interested in, and how you prefer to be contacted;
- anything you write in your message.

**Automatically, when you submit the form**, we record:

- the date and time;
- the page you submitted from;
- campaign tags in the page address (such as `utm_source`), if present;
- your browser's user-agent string;
- a scrambled code made from your IP address. We store this code, not your IP address. It is created with a secret key so it can't be easily reversed, and we use it only to prevent abuse and keep a record of your submission.

**If you become a customer**, we also collect:

- the information needed to build your website (text, photos, logos, service areas, hours);
- your acceptance of our agreement (version, date and time);
- billing records.

**Your card or bank details are entered on our payment provider's page.** They are handled by our payment provider, not stored on our servers. `[OWNER: confirm GHL-hosted payment page; name the processor — D-OWN-01/LGL-06]`

#### W2. How we use it

We use this information to:

- respond to your request and prepare your free homepage concept;
- send you a written proposal if you want one;
- build, host and support your website if you become a customer;
- bill you;
- keep records of what you agreed to;
- protect the form from spam and abuse;
- meet our legal obligations.

We may email you about your request and, if you become a customer, about your service. `[OWNER: if follow-up marketing emails will be sent to people who requested a preview, say so here: "We may also send you occasional emails about our website service. Every such email has an unsubscribe link."]`

We do **not** send text messages through the preview form at this time.

#### W3. Who we share it with

We don't sell your personal information, and we don't share it for cross-context behavioral advertising. We share it only with service providers that help us run Entrepreneuria Websites:

| Provider | What they do | What they receive |
|---|---|---|
| HighLevel, Inc. / LeadConnector (GoHighLevel) | Customer relationship management, email, payments `[OWNER: and website hosting, if customer sites are hosted on GHL]` | Your request details and, for customers, project and billing records |
| Cloudflare, Inc. (Turnstile) | Checks that a form submission comes from a person, not a bot | Technical signals from your browser and device during the check. Cloudflare describes this in its Turnstile Privacy Addendum |
| Google (Google Workspace) | Our business email | Emails you send us and internal notices about new requests. Our automated notices contain a reference number only, not your details |
| `[OWNER: VPS/hosting provider name, e.g. Hostinger]` | Hosts the server that runs the form | Your request, stored on our server when it needs manual review |
| `[OWNER: payment processor behind GHL]` | Processes card or bank payments | Payment details you enter on the payment page |

We may also disclose information if the law requires it, to protect our rights or the safety of others, or as part of a sale or reorganization of our business.

#### W4. AI tools

`[OWNER: D-OWN-09. Keep ONE option, delete the other.]`

- **Option A:** To prepare homepage concepts and website content, we may use AI design and writing tools. We give these tools only your business details: business name, services, service area and style preferences. We never give them your phone number, email address or personal message. We review all AI-assisted work before showing it to you, and you approve your website before it goes live. Tools we currently use: `[OWNER: list]`.
- **Option B:** We don't enter the personal information you send us into AI tools.

#### W5. Cookies and similar technology on this page

The services page doesn't use advertising or analytics cookies. The preview form loads Cloudflare Turnstile to block automated spam. `[OWNER/ENG: confirm in a live test whether Turnstile sets a cookie such as cf_clearance in our deployment, then state it here.]` See our Cookie Policy.

#### W6. How long we keep it

`[OWNER: D-OWN-02. Recommended default below.]`

- **Preview requests that don't become projects:** deleted from our systems within 12 months after our last contact with you.
- **Records kept on our server for manual review:** deleted within 90 days after we finish handling them. A copy may remain in our CRM under the rule above.
- **Customer records**, including agreement acceptance and billing records: kept for as long as you are a customer and for `[OWNER: 7]` years afterward, for tax, accounting and legal purposes.
- We may keep information longer if the law requires it or to resolve a dispute.

#### W7. How we protect it

We use reasonable safeguards for a business of our size:

- encrypted connections;
- access limited to the people who need it;
- a scrambled code instead of your IP address;
- notices about new requests that contain no personal details.

No system is perfectly secure.

#### W8. Your choices

You can ask us to:

- tell you what information we hold about you;
- correct it;
- delete it, unless we must keep it, for example billing records of a customer.

You can unsubscribe from marketing emails with the link in any of them. To make a request, email `[OWNER: confirmed inbox — D-OWN-16]`. We'll reply within `[OWNER: 30]` days. We won't treat you differently for making a request.

#### W9. Contact

`[LEGAL ENTITY NAME — D-OWN-01]`
`[OWNER: postal address — D-OWN-03]`
Email: `[OWNER: confirmed inbox]`

---

## Part 2: Edits to existing sections of `/privacy`

These are needed for accuracy. They change only statements this review could verify.

| Section | Current text | Change | Reason |
|---|---|---|---|
| Header | `Effective June 24, 2026` | New effective date on publication | CalOPPA requires an effective date `[web search — verify]` |
| Intro | "…including Architecta, Prospra, Synceri, Directorium, and any future Entrepreneuria products…" | Add "and Entrepreneuria Websites (see the Entrepreneuria Websites section below)" | Scope |
| Information We Collect | "Usage analytics" | Remove, **or** keep only if the owner confirms analytics run on another surface (for example, the product apps). No analytics code exists in this repository `[repo]` | Accuracy (FTC §5) |
| Data Sharing | "…authentication providers, AI providers, and analytics platforms." | Add "customer relationship management and email providers, and spam-prevention services". Remove "analytics platforms" unless the owner confirms (above) | Accuracy |
| Data Sharing | (none) | Add: "We do not sell personal information." (already present) and "We do not knowingly allow other companies to track you across websites through our site." `[ENG: true for the Websites page; confirm for the product apps]` | CalOPPA's cross-site tracking disclosure `[web search — verify]` |
| Cookies | "…analyze usage…" | Replace with the short paragraph from `COOKIE_AND_TRACKING_DISCLOSURE_DRAFT.md` §1 | Accuracy |
| Do Not Track | (only in the Cookie Policy) | Add one sentence: "Our sites do not change their behavior in response to Do Not Track signals, and we do not track you across other websites." | CalOPPA requires a DNT disclosure in the privacy policy `[web search — verify]` |
| Changes | "Material changes will be posted on this page with an updated effective date." | Add "For material changes affecting Entrepreneuria Websites customers, we will also email active customers." | CalOPPA (process for notifying changes) |
| Contact | `privacy@entrepreneuria.io` | Keep only if D-OWN-16 confirms it is monitored | Must reach a person |
| Entity | "Entrepreneuria Global, Inc." (every section) | Replace with the verified name (D-OWN-01) | LGL-04 |

## Part 3: Form notice

The sentence beside the submit button is drafted in `LEAD_INTAKE_DISCLOSURES_DRAFT.md`.

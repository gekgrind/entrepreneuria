# DRAFT: Lead intake disclosures (preview form and email requests)

> **DRAFT. Not published. Not legal advice.** The code already has a slot for each item; nothing here changes code. Wording that is approved goes into `lib/services/websites/legal-copy.ts`, together with a version bump of the matching policy in `policies.ts` (engineering task E-5).

## 1. Privacy sentence beside the submit button

**Current:**
- Unapproved, server-side only: "We will use your details to respond to this request." (`legal-copy.ts:15`)
- Always shown: "See our Privacy Policy." (`InquiryForm.tsx:741`)

**Proposed** (policy `privacy_notice`, new version, e.g. `2026-12-01.v1`):

> We use your details to reply to this request and prepare your free homepage concept. They're stored with our CRM and email providers. We don't sell them. See how we handle your information in our [Privacy Policy](/privacy#websites).

Why:

- **Purpose is named.** It tells the visitor why the data is collected.
- **Categories of recipient are named.** This matches CalOPPA's third-party disclosure requirement `[web search — verify]`.
- **"Don't sell" is accurate.**
- **The link goes to the Websites section**, not the top of a long SaaS policy.

**If D-OWN-09 = Option A (AI tools):** add "Some design work is AI-assisted using your business details only." Keep it only if true.

## 2. Showcase mode (email request, no form)

Put this text next to the "Request My Free Website Preview" `mailto:` button (PR #37). Wording to approve:

> Your email goes to our business inbox. We use it only to reply to your request. [Privacy Policy](/privacy#websites)

## 3. Preferred contact method: phone

**Current help text:** "Only used if you choose phone below." This is accurate today.

No consent language is needed for a person-to-person call answering the visitor's own request `[inference]`. **Don't** add the number to an automated calling or texting workflow (LGL-10, LGL-19).

## 4. SMS consent (keep OFF)

**Status:** `sms_consent` is `legal_review`. The text option and checkbox are hidden, and the server rejects them (`intake.ts:211`). **Recommendation:** leave texting off at launch.

For later only, to be used if the owner enables GHL texting. **Not approved; P2.**

> ☐ Text me about my website request. Entrepreneuria will send up to [N] messages about this request. Consent is not a condition of purchase. Message and data rates may apply. Reply STOP to stop, HELP for help. [Privacy Policy](/privacy#websites)

Requirements to check before enabling:

- the TCPA's written-consent rule for marketing texts `[settled]`;
- the FCC's one-to-one consent rule status `[verify]`;
- carrier A2P 10DLC brand and campaign registration in GHL `[web search — verify]`;
- the checkbox must stay unticked and optional. The code already enforces this.

## 5. Success-state confirmation

After a successful submit, add one line to the existing success message (an owner copy ruling):

> We'll reply within 2 business days. You can ask us to delete your request at any time by emailing [inbox].

## 6. Capacity or paused state

No legal wording needed. The existing copy offers an email fallback and promises no delivery date.

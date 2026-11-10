# Reconciling PR #29 with PR #33 (GoHighLevel existing contacts)

> **SUPERSEDED (2026-11-09).** The owner chose stricter handling: no tags or notes at all on returning contacts, durable review outside the CRM, and no capacity slot. It is implemented in **PR #36**; see `docs/websites/RETURNING-CONTACTS.md` and DECISION-REGISTER D-22 on that branch. The plan below is kept for history only. Do not implement it.

Owner decision (2026-11-09, subject to final confirmation): **conservative handling of existing CRM contacts.** Identify returning contacts and flag them for manual review. Never overwrite their details. Never create opportunities or add tags for unverified matches. Keep the approved new-contact flow. No production CRM until the sandbox run passes.

## Recommendation: port the behaviour, don't merge #29

#29 and #30/#33 are two parallel hardening lines. Their GHL adapters differ by about 500 lines (`client.ts`), and the intakes by about 200. #29 also carries a different gate, client-IP and Turnstile design, which #30 superseded and the leads mode is built on. Merging #29 means a large conflict resolution across security-sensitive code for little gain.

**Smallest safe reconciliation:** keep #33's adapter and port only #29's existing-contact behaviour into it, as one small PR on `feat/websites-leads-only-v2`. Then close #29 unmerged with a link to that PR.

## Behaviour today vs. required

`lib/integrations/ghl/client.ts` on #33:

| Existing contact (upsert `new` ≠ true) | #33 today | Required (and #29) |
|---|---|---|
| Contact details/custom fields | Not written ✔ | Not written |
| Consent tags | Withheld ✔ | Withheld |
| Regular tags (`web-preview-request`, `pkg-*`, `style:*`) | **Added** ✘ (can fire GHL workflows) | **None**. Only a review tag. |
| Opportunity | **Created or reused** ✘ (enters the pipeline, starts automations, counts toward capacity) | **None** |
| Note | "Submitted details (not applied…)" | Starts `UNVERIFIED:` and explains why; carries every submitted detail |
| Retry after a lost upsert response | Treated as existing, with a warning ✔ | Same (fails safe into review) |

The new-contact path is unchanged: email-only upsert → details → note → tags → opportunity.

## Changes (one PR on #33)

**`lib/integrations/ghl/client.ts`** (about 60 lines)

1. `CrmLead` gains `existingContactTags?: string[]`. Default `[]`.
2. Step 2 (tags): `const tags = created ? [...lead.tags, ...newContactTags] : (lead.existingContactTags ?? [])`. Add warning `regular_tags_skipped_existing_contact` when `lead.tags.length`.
3. Step 4 (opportunity): run only when `created`. Otherwise skip it and add warning `opportunity_skipped_unverified_match`. `CrmSyncResult.opportunityId` becomes `string | null`, plus `existingContact: boolean`, as in #29.
4. Note for an existing contact: export `UNVERIFIED_NOTE_PREFIX = "UNVERIFIED:"`. The note starts with *"UNVERIFIED: this web form submission matched an existing contact by email only. The contact's details were not changed and no opportunity was created. Review the submitted details below before acting on it."* (#29's wording). If the upsert was retried, use #29's "could not confirm whether it created this contact" variant.
5. Use a distinct marker for review notes (`Review: <ref>`), and check markers with **ends-with on the note's last line** instead of `includes`. A visitor controls the free-text message and can type a marker into it (#29 commit `70cdfb1`).
6. Write the note **before** the tags (#29 commit `8e1a693`). A failure at the tags step then can't leave a tagged contact with no record of the submission.

**`lib/services/websites/intake.ts`** (about 5 lines)

7. Pass `existingContactTags: ["web-preview-unverified-match"]`.
8. Store `crm_opportunity_id: null` when the opportunity was skipped. The visitor still gets the normal success response, because the lead is captured in the note.

**Tests**

9. `client.test.ts`: change the existing-contact cases to assert no regular tags, no opportunity calls, one `UNVERIFIED:` note, and the review tag only. Add: a typed marker in the message doesn't suppress the note; the note is written before the tags.
10. `intake.test.ts` and `leads-route.test.ts`: fixtures for a returning contact.
11. `sandbox-check.ts` scenario **S2**: assert no opportunity, no `web-preview-request` tag, the review tag present, and the note starts with `UNVERIFIED:`. **S5** (lost upsert response) now lands as a review item.

Not ported, on purpose:
- #29's step 0 (`GET /contacts/search/duplicate` before the upsert). It adds an endpoint whose response format is unverified. #33's email-only upsert already leaves an existing contact untouched in principle. **Sandbox S2 must confirm that the upsert changes no field on an existing contact.** Port step 0 only if it doesn't.
- #29's in-process "this submission created it" memory. Without it, a retry after a lost response becomes a review item rather than a normal lead: rare, and it fails safe.
- #29's gate, host and IP changes. #30's design replaced them.

## Side effects the owner should know about

- **Returning contacts don't fire the new-lead workflow.** The GHL notification on `web-preview-request` won't trigger for them. Add a second GHL workflow on `web-preview-unverified-match` that notifies the owner. Gate `leads-notification` already says "new **and returning** leads".
- **Returning contacts don't use a capacity slot.** Capacity counts open opportunities, and review items create none. Recommendation: accept this; review items are triaged by hand.
- If the review tag itself triggers nothing, a returning lead is visible only in GHL's tag view and the owner notification above. Without that workflow, a returning lead could go unseen.

## Order of work

1. Owner confirms this plan.
2. One engineer PR on `feat/websites-leads-only-v2` with the changes above (about half a day including tests).
3. Close #29 unmerged, linking to that PR.
4. Rebase #34 and #35 if needed. Neither touches `client.ts` or `intake.ts`'s CRM section, so no conflicts are expected.
5. Sandbox run (`scripts/ghl-sandbox-check.mts --live --cleanup`) with S2/S5 updated. Its output is the evidence for gate `leads-crm-delivery`. **Production CRM stays off until it passes.**

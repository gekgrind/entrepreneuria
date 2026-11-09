# GoHighLevel sandbox check (website leads)

Verifies the lead adapter (`lib/integrations/ghl/client.ts`) against a real **sandbox** sub-account before the inquiry form takes traffic. The scenarios live in `lib/integrations/ghl/sandbox-check.ts`; `npm test` runs them against the in-memory fake on every PR.

## Before a live run (owner)

1. Use a **separate sandbox sub-account** with no active workflows, no campaigns and no messaging numbers. Never the production sub-account.
2. Create a private integration token for that sub-account with: `contacts.write`, `contacts.readonly` (also used by the read-only duplicate search), `opportunities.readonly`, `opportunities.write`, and `workflows.readonly` (the preflight uses it).
3. Create a test pipeline and stage in the sandbox.
4. Optionally create the custom fields and map them in `GHL_SANDBOX_CUSTOM_FIELD_IDS` (same JSON shape as `GHL_CUSTOM_FIELD_IDS`).

## Settings (sandbox only; never committed)

| Name | Purpose |
|---|---|
| `GHL_SANDBOX_TOKEN` | Sandbox private integration token |
| `GHL_SANDBOX_LOCATION_ID` | Sandbox sub-account id |
| `GHL_SANDBOX_CONFIRM_LOCATION` | The same id again, typed by hand |
| `GHL_SANDBOX_PIPELINE_ID`, `GHL_SANDBOX_PIPELINE_STAGE_ID` | Test pipeline and stage |
| `GHL_SANDBOX_CUSTOM_FIELD_IDS` | Optional field-id map |
| `GHL_SANDBOX_ATTEST_NO_AUTOMATIONS=yes` | Only if the token can't list workflows and you have checked by hand |

The run refuses in CI, if the location isn't confirmed, if any value equals a production `GHL_*` value, or if the sub-account has any workflow that isn't a draft.

## Run

```
npx tsx scripts/ghl-sandbox-check.mts                    # dry run, no network
npx tsx scripts/ghl-sandbox-check.mts --live             # sandbox
npx tsx scripts/ghl-sandbox-check.mts --live --cleanup   # sandbox, then delete the contacts it created
```

Exit code 0 means every check passed. All data is synthetic (`ghl-sandbox+<run>-*@example.com`, 555-01xx numbers), every tag starts with `sandbox-<run>`, and the real `sms-consent` tag is never sent: consent protection uses a synthetic probe tag. Failures are injected on the client side, so nothing malformed is sent.

## Scenarios

| | Proves |
|---|---|
| S1 | A new email creates a contact; the upsert answers `new: true`; name, phone, company and mapped fields are applied; tags, one note and one opportunity land |
| S6 | Re-sending the same submission adds nothing |
| S2 | A second submission for an existing email writes **nothing** to that contact: no upsert, details, custom fields, tags (consent or otherwise), note or opportunity. The adapter stops with `GhlMatchedExistingError("existing")` (owner decision 2026-11-09) |
| S3 | The consent tag is applied to a contact the submission created |
| S4 | A failed details update still delivers tags, the note (with every detail) and the opportunity |
| S5 | A lost upsert response: the retry sees `new: false`, stops with `GhlMatchedExistingError("matched_on_upsert")`, and writes nothing beyond the email-only contact. In the app that inquiry goes to manual review; `--cleanup` removes the contact |
| S7 | A lost opportunity-create response is reconciled by search, never duplicated |

Record the output (pass counts and the `observed:` lines, which list the contact fields GHL returns) as evidence for the `features-verified` and `style-to-crm` release gates. Opportunities may need deleting by hand after `--cleanup`.

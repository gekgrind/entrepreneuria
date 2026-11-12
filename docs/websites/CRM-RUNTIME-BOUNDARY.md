# CRM runtime boundary: sandbox versus production GHL

Status, 2026-11-12: implemented, nothing deployed. Code: `lib/integrations/ghl/crm-boundary.ts`, wired through `lib/integrations/ghl/server.ts` and `lib/services/websites/inquiry-route.ts`. Tests: `lib/integrations/ghl/crm-boundary.test.ts` (in-process fake GHL, no network).

## The finding (Codex review of PR #43, F4)

Every services mode read the same `GHL_*` credentials. A `nonproduction` intake, or a `leads` rehearsal on a staging host, therefore wrote real leads to the production sub-account (five writes in the reproduction) and could fire its workflows and messages, while the production gates were closed.

## The rule

The CRM a request may use is decided from what the server resolved, not from a name or a flag.

| Request | CRM | Credentials |
|---|---|---|
| `leads` or `production` mode, served on the canonical production host (`entrepreneuria.io`) | production | `GHL_API_TOKEN`, `GHL_LOCATION_ID`, `GHL_PIPELINE_ID`, `GHL_PIPELINE_STAGE_ID`, `GHL_CUSTOM_FIELD_IDS` |
| anything else: `nonproduction` mode (any host, including the production host), or any mode on a staging or loopback host | sandbox | `GHL_SANDBOX_*` only |

Reaching production still needs each mode's existing authorization: `leads` needs `WEBSITES_LEADS_RELEASE_AUTHORIZED` and its gates; `production` needs every release gate plus `WEBSITES_OWNER_RELEASE_AUTHORIZED`. This change adds no new way in; it removes the way around.

A sandbox request is refused (no CRM call, nothing written, intake answers as if the CRM were unavailable) unless **all** of this holds:

1. Every `GHL_SANDBOX_*` setting is present: `GHL_SANDBOX_TOKEN`, `GHL_SANDBOX_LOCATION_ID`, `GHL_SANDBOX_EXPECT_LOCATION_NAME`, `GHL_SANDBOX_PIPELINE_ID`, `GHL_SANDBOX_PIPELINE_STAGE_ID`, and `GHL_SANDBOX_CUSTOM_FIELD_IDS` with `style_interest` and `package_interest`.
2. The sandbox token, location, pipeline and stage each differ from the ordinary `GHL_*` value. Ordinary `GHL_*` is read for sandbox requests only for this comparison. The same comparison refuses a production request whose values equal sandbox ones.
3. A live identity check passes (the read-only gate of `ghl-sandbox-check --live`, `sandbox-discover.ts`): the token reaches exactly `GHL_SANDBOX_LOCATION_ID`; its name is exactly `GHL_SANDBOX_EXPECT_LOCATION_NAME` and contains "sandbox"; the pipeline, stage and custom fields belong to it; **no workflow is active** (this is what keeps test traffic from triggering automations); every probe is readable.

Every CRM call (`syncLead`, the returning-contact lookup, the capacity count) waits for the check. A pass is reused for 10 minutes, a failure for 30 seconds (so a flood of requests does not hammer GHL), and concurrent requests share one check. If the sandbox is renamed or a workflow is switched on, writes stop within the window. Nothing is inferred from a flag or a variable name alone.

Returning-contact behavior (D-19) is unchanged and tested in the sandbox path: an existing contact is never written.

## Owner actions before a staging rehearsal

- The sandbox integration needs the scopes already listed in `GHL-SANDBOX-CHECK.md`, including the read-only `locations.readonly`, `locations/customFields.readonly` and `workflows.readonly`. Without them the check fails and intake stays unavailable on staging.
- Set the six `GHL_SANDBOX_*` settings on the staging host. Do not set production `GHL_*` there; if both are set they must differ.
- Existing staging that relied on ordinary `GHL_*` will now answer "unavailable" until the sandbox settings exist. That is the intended fail-closed behavior.

## Not covered, by design or by dependency

- **No identity check for the production CRM.** The production token's scopes are intake-only (no `locations.readonly`), so the location cannot be read back at runtime. Adding that scope and an expected-name setting is an owner decision; until then production routing relies on the mode, host and credential separation above.
- The check proves the sandbox *looks like* the owner's sandbox (id, exact name, "sandbox", drafts only). It cannot prove the owner never renamed a production location to match, or that GHL honors `status` on workflows it does not list.
- Rate limits and quotas of the sandbox sub-account are the owner's.

# GoHighLevel sandbox check (website leads)

Verifies the lead adapter (`lib/integrations/ghl/client.ts`) against a real **sandbox** sub-account before the inquiry form takes traffic. The scenarios live in `lib/integrations/ghl/sandbox-check.ts`; `npm test` runs them against the in-memory fake on every PR.

## Before a live run (owner)

1. Use a **separate sandbox sub-account** with no active workflows, no campaigns and no messaging numbers. Never the production sub-account. Its name must contain "Sandbox".
2. Create a private integration in **that sub-account** (Settings → Private Integrations) with these scopes:

| Scope | Used for | Read/write |
|---|---|---|
| `contacts.readonly` | duplicate lookup, read-back | read |
| `contacts.write` | upsert, details, tags, notes, `--cleanup` deletes | write |
| `opportunities.readonly` | pipeline discovery, opportunity search | read |
| `opportunities.write` | opportunity create | write |
| `locations.readonly` | **identity gate**: reads the sub-account name | read |
| `locations/customFields.readonly` | discovery and identity gate: field ids | read |
| `workflows.readonly` | workflow preflight | read |

   The last three are read-only. Without them the run stops before writing. Scopes can be added to an existing integration; third-party docs say this does not regenerate the token (not verified against GHL's own docs; if the token changes, store the new one the same way).
3. Create the test pipeline and stage, and the contact custom fields `style_interest` and `package_interest` (Single Line Text).

## Settings (sandbox only; never committed)

| Name | Purpose | Secret |
|---|---|---|
| `GHL_SANDBOX_TOKEN` | Sandbox private integration token | **yes** |
| `GHL_SANDBOX_LOCATION_ID` | Sandbox sub-account id (Settings → Business Profile, or the `/location/<id>/` part of the URL) | no |
| `GHL_SANDBOX_CONFIRM_LOCATION` | The same id again, typed by hand | no |
| `GHL_SANDBOX_EXPECT_LOCATION_NAME` | Exact sub-account name; must contain "sandbox" | no |
| `GHL_SANDBOX_PIPELINE_ID`, `GHL_SANDBOX_PIPELINE_STAGE_ID` | Test pipeline and stage | no |
| `GHL_SANDBOX_CUSTOM_FIELD_IDS` | `{"style_interest":"…","package_interest":"…"}` | no |
| `GHL_SANDBOX_ATTEST_NO_AUTOMATIONS=yes` | Only skips the old workflow preflight; the identity gate still requires a readable workflow list | no |

`scripts/ghl-sandbox-discover.mts` prints every non-secret line for you.

## Guards

`--live` refuses, before any write:
- in CI, with the location not typed twice, or with any value equal to a production `GHL_*` value present in the environment;
- if any workflow is not a draft;
- unless the **identity gate** passes (read-only, `lib/integrations/ghl/sandbox-discover.ts`): the token reads a location with exactly `GHL_SANDBOX_LOCATION_ID`, named exactly `GHL_SANDBOX_EXPECT_LOCATION_NAME`, containing "sandbox"; the pipeline and stage belong to it; both field ids are its `style_interest` / `package_interest` fields; contacts, pipelines, fields and workflows are all readable.

Write scopes can't be checked without writing. The first write is S1's email-only upsert; if `contacts.write` is missing it fails with nothing written. If `opportunities.write` is missing, S1 fails after creating a contact, and `--cleanup` removes it.

Discovery sends GET requests only. A wrapper rejects any other method before it reaches the network, and that is unit-tested. It prints names, ids and counts. It never prints the token, contact records or response bodies.

## Secure setup (VPS, as root)

The token never goes into chat, Git, shell history or a command line.

```
# 1. Stage the branch outside the web directories
git -C /var/www/entrepreneuria fetch origin feat/websites-returning-contacts
rm -rf /opt/ghl-sandbox-test && mkdir -p /opt/ghl-sandbox-test
git -C /var/www/entrepreneuria archive FETCH_HEAD | tar -x -C /opt/ghl-sandbox-test
cd /opt/ghl-sandbox-test && NODE_ENV=development npm ci      # needs devDependencies (tsx)

# 2. Env file: root-only, outside the repo
install -d -m 700 /etc/entrepreneuria
install -m 600 -o root -g root /dev/null /etc/entrepreneuria/ghl-sandbox.env

# 3. Token: typed (or pasted) at a hidden prompt; not echoed, not in history
bash -c 'read -rs -p "Sandbox token: " T; echo; printf "GHL_SANDBOX_TOKEN=%s\n" "$T" >> /etc/entrepreneuria/ghl-sandbox.env; unset T'

# 4. Location id (not secret)
bash -c 'read -r -p "Sandbox location id: " L; printf "GHL_SANDBOX_LOCATION_ID=%s\n" "$L" >> /etc/entrepreneuria/ghl-sandbox.env'

# 5. Check: names only, never values
cut -d= -f1 /etc/entrepreneuria/ghl-sandbox.env; stat -c '%a %U' /etc/entrepreneuria/ghl-sandbox.env   # expect 600 root
```

To run any step, source the file in a subshell so values stay out of the parent shell and off the command line:

```
cd /opt/ghl-sandbox-test
( set -a; . /etc/entrepreneuria/ghl-sandbox.env; set +a; npx tsx scripts/ghl-sandbox-discover.mts )
```

Do not source the production `.env.local` here.

## Run order

1. **Dry run** (no network, no env): `npx tsx scripts/ghl-sandbox-check.mts`. Expect `42/42 checks passed`.
2. **Discovery** (read-only), with the command above. Every read scope should be `OK`. The location name should be "Entrepreneuria Websites Sandbox", with 0 workflows not in draft, one pipeline match, one stage match, and one `TEXT` match per field. Append the printed id lines with `nano /etc/entrepreneuria/ghl-sandbox.env`, typing `GHL_SANDBOX_CONFIRM_LOCATION` by hand.
3. **Discovery again.** It ends with `identity gate (as --live will run it): PASS`. Stop on anything else.
4. **Live run, only with owner authorization:**
   `( set -a; . /etc/entrepreneuria/ghl-sandbox.env; set +a; npx tsx scripts/ghl-sandbox-check.mts --live --cleanup ) 2>&1 | tee /root/ghl-sandbox-run.txt`
   Output contains only synthetic data, ids and pass/fail lines.
5. Afterwards: delete leftover sandbox opportunities in the pipeline view (cleanup deletes contacts only). Then `rm -rf /opt/ghl-sandbox-test`. Keep or `shred -u` the env file. Rotate the sandbox token if it was exposed anywhere.

Exit code 0 means every check passed. All data is synthetic (`ghl-sandbox+<run>-*@example.com`, 555-01xx numbers), and every tag starts with `sandbox-<run>`. The real `sms-consent` tag is never sent; consent protection uses a synthetic probe tag. Failures are injected on the client side, so nothing malformed is sent.

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

Record the output (identity line, pass counts and the `observed:` lines, which list the contact fields GHL returns) as evidence for the `features-verified` and `style-to-crm` release gates.

/**
 * GHL custom-field configuration (audit finding F-2).
 *
 * Custom fields are addressed by their GHL field **id**, which is stable and
 * shown in the sub-account's Custom Fields settings. Field *keys*
 * (`contact.x` vs `x`) were never verified and are no longer accepted.
 *
 * Pure (no env, no `server-only`) so it is unit-tested; server.ts feeds it
 * `GHL_CUSTOM_FIELD_IDS`.
 */

/** Every logical field the intake can send. Order is the note/report order. */
export const LOGICAL_CUSTOM_FIELDS = [
  "business_type",
  "package_interest",
  "style_interest",
  "contact_method",
  "sms_consent",
  "sms_consent_at",
  "sms_consent_version",
  "consent_page_url",
  "pricing_version",
] as const;
export type LogicalCustomField = (typeof LOGICAL_CUSTOM_FIELDS)[number];

/**
 * Fields that must reach GHL as structured data. If one is unmapped,
 * rejected or not applied, every sync reports it as a warning. The value is
 * always also written to the contact note and the durable store, so nothing
 * is dropped.
 */
export const CRITICAL_CUSTOM_FIELDS: readonly LogicalCustomField[] = [
  "package_interest",
  "style_interest",
  "sms_consent",
  "sms_consent_at",
  "sms_consent_version",
  "consent_page_url",
];

/** GHL ids are opaque alphanumerics (20 chars in practice). Range kept loose but strict on charset. */
const FIELD_ID = /^[A-Za-z0-9]{12,40}$/;

export interface CustomFieldConfig {
  ids: Partial<Record<LogicalCustomField, string>>;
  /** Human-readable configuration problems, for startup logs and health checks. */
  problems: string[];
}

export function parseCustomFieldIds(raw: string | undefined, legacyKeysRaw?: string): CustomFieldConfig {
  const problems: string[] = [];
  const ids: CustomFieldConfig["ids"] = {};

  if (legacyKeysRaw) {
    problems.push("GHL_CUSTOM_FIELD_KEYS is no longer supported (keys are unverified); set GHL_CUSTOM_FIELD_IDS instead");
  }

  let parsed: unknown = {};
  if (raw && raw.trim()) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      problems.push("GHL_CUSTOM_FIELD_IDS is not valid JSON; no custom fields will be sent");
      parsed = {};
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    problems.push("GHL_CUSTOM_FIELD_IDS must be a JSON object of logical name → field id");
    parsed = {};
  }

  const entries = Object.entries(parsed as Record<string, unknown>);
  const byId = new Map<string, string[]>();
  for (const [name, value] of entries) {
    if (!(LOGICAL_CUSTOM_FIELDS as readonly string[]).includes(name)) {
      problems.push(`GHL_CUSTOM_FIELD_IDS: unknown field "${name}" ignored`);
      continue;
    }
    if (typeof value !== "string" || !FIELD_ID.test(value)) {
      problems.push(`GHL_CUSTOM_FIELD_IDS: "${name}" is not a valid GHL field id; field not sent`);
      continue;
    }
    byId.set(value, [...(byId.get(value) ?? []), name]);
  }
  for (const [id, names] of byId) {
    if (names.length > 1) {
      problems.push(`GHL_CUSTOM_FIELD_IDS: id ${id} is mapped to ${names.join(", ")}; those fields are not sent`);
      continue;
    }
    ids[names[0] as LogicalCustomField] = id;
  }

  for (const f of CRITICAL_CUSTOM_FIELDS) {
    if (!ids[f]) problems.push(`GHL_CUSTOM_FIELD_IDS: "${f}" is not mapped; it is kept only in the contact note`);
  }
  return { ids, problems };
}

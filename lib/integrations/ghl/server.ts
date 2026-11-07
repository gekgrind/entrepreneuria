import "server-only";

import { createGhlClient, type LeadCrm } from "./client";

const LOGICAL_FIELDS = [
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

/**
 * Builds the GHL client from server-side env, or returns null when not
 * configured (intake then relies on the durable store alone).
 *
 * Env: GHL_API_TOKEN, GHL_LOCATION_ID, GHL_PIPELINE_ID,
 * GHL_PIPELINE_STAGE_ID, GHL_API_VERSION (default 2021-07-28),
 * GHL_CUSTOM_FIELD_KEYS (JSON object, logical name → GHL field key).
 */
export function getGhlClient(): LeadCrm | null {
  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  const pipelineId = process.env.GHL_PIPELINE_ID;
  const pipelineStageId = process.env.GHL_PIPELINE_STAGE_ID;
  if (!token || !locationId || !pipelineId || !pipelineStageId) return null;

  let keys: Record<string, string> = {};
  try {
    const parsed = JSON.parse(process.env.GHL_CUSTOM_FIELD_KEYS ?? "{}");
    if (parsed && typeof parsed === "object") {
      keys = Object.fromEntries(
        LOGICAL_FIELDS.filter((f) => typeof parsed[f] === "string").map((f) => [f, parsed[f] as string])
      );
    }
  } catch {
    console.error("[websites] GHL_CUSTOM_FIELD_KEYS is not valid JSON; custom fields will be skipped");
  }

  return createGhlClient({
    token,
    locationId,
    pipelineId,
    pipelineStageId,
    apiVersion: process.env.GHL_API_VERSION ?? "2021-07-28",
    customFieldKeys: keys,
  });
}

import "server-only";

import { createGhlClient, type LeadCrm } from "./client";
import { parseCustomFieldIds } from "./config";

let reportedProblems = "";

/**
 * Builds the GHL client from server-side env, or returns null when not
 * configured (intake then relies on the durable store alone).
 *
 * Env: GHL_API_TOKEN, GHL_LOCATION_ID, GHL_PIPELINE_ID,
 * GHL_PIPELINE_STAGE_ID, GHL_API_VERSION (default 2021-07-28),
 * GHL_CUSTOM_FIELD_IDS (JSON object, logical name → GHL custom field id,
 * e.g. {"style_interest":"6dvNaf7VhkQ9snc5vnjJ"}).
 *
 * Configuration problems (unknown names, malformed or duplicate ids,
 * unmapped critical fields, legacy GHL_CUSTOM_FIELD_KEYS) are logged once
 * per process. The sync still runs, and unmapped values stay in the note.
 */
export function getGhlClient(): LeadCrm | null {
  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  const pipelineId = process.env.GHL_PIPELINE_ID;
  const pipelineStageId = process.env.GHL_PIPELINE_STAGE_ID;
  if (!token || !locationId || !pipelineId || !pipelineStageId) return null;

  const { ids, problems } = parseCustomFieldIds(process.env.GHL_CUSTOM_FIELD_IDS, process.env.GHL_CUSTOM_FIELD_KEYS);
  const signature = problems.join("|");
  if (signature && signature !== reportedProblems) {
    reportedProblems = signature;
    for (const p of problems) console.error(`[websites] GHL config: ${p}`);
  }

  return createGhlClient({
    token,
    locationId,
    pipelineId,
    pipelineStageId,
    apiVersion: process.env.GHL_API_VERSION ?? "2021-07-28",
    customFieldIds: ids,
  });
}

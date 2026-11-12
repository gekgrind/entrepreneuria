import "server-only";

import { createCrmProvider, type CrmContext } from "./crm-boundary";
import type { LeadCrm } from "./client";

const provider = createCrmProvider();

/**
 * The CRM this request may use, or null (intake then relies on the durable
 * store alone, or answers "unavailable"). `ctx` comes from the resolved release
 * gate, never from the request. See crm-boundary.ts:
 *
 *   production CRM   GHL_API_TOKEN, GHL_LOCATION_ID, GHL_PIPELINE_ID,
 *                    GHL_PIPELINE_STAGE_ID, GHL_API_VERSION (default
 *                    2021-07-28), GHL_CUSTOM_FIELD_IDS. Only in `leads` or
 *                    `production` mode on the canonical production host.
 *   sandbox CRM      GHL_SANDBOX_TOKEN, GHL_SANDBOX_LOCATION_ID,
 *                    GHL_SANDBOX_EXPECT_LOCATION_NAME, GHL_SANDBOX_PIPELINE_ID,
 *                    GHL_SANDBOX_PIPELINE_STAGE_ID, GHL_SANDBOX_CUSTOM_FIELD_IDS.
 *                    Every other request, after a live identity check.
 */
export function getCrmFor(ctx: CrmContext): LeadCrm | null {
  return provider.getCrm(ctx);
}

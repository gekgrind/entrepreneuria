/**
 * Shared page constants for /services/websites that both the server page
 * and the client form need. Customer-facing copy lives in the components
 * (verbatim from the approved Sprint 2 design); this file holds only the
 * values that drive behaviour.
 */

/** Approved Sprint 2 options, in order. Values are sent as-is to the CRM. */
export const BUSINESS_TYPES = [
  "Handyman or home repair",
  "Pressure washing or exterior cleaning",
  "Landscaping or lawn care",
  "Residential cleaning",
  "Remodeling or small contractor",
  "Other home service",
  "Other local business",
] as const;

/* The public services inbox is a server setting (WEBSITES_CONTACT_EMAIL, see
   parseContactEmail in leads-config.ts), never a constant in client code. */

export const INQUIRY_ENDPOINT = "/api/services/websites/inquiry";

/** Turnstile action the inquiry widget declares; the server requires it. */
export const WEBSITES_TURNSTILE_ACTION = "websites_inquiry";

/** Case-insensitive match of a `?type=` prefill against the approved options. */
export function matchBusinessType(raw: string | undefined): string {
  if (!raw) return "";
  const needle = raw.trim().toLowerCase();
  return BUSINESS_TYPES.find((t) => t.toLowerCase() === needle) ?? "";
}

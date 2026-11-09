/**
 * Website preview inquiry — the one schema shared by the client form and
 * the server route. Collects only what an inquiry needs (spec §8).
 *
 * SMS consent is a separate optional boolean, default false, never
 * required to submit (spec §9). Consent evidence (timestamp, disclosure
 * version, page URL) is stamped server-side, never trusted from the client.
 */
import { z } from "zod";

import { isLoopbackHost, normalizeHost, WEBSITES_PRODUCTION_HOSTS } from "./hosts";
import { PACKAGE_IDS } from "./packages";
import { normalizePhone, PHONE_ERROR_COPY } from "./phone";
import { styleInterestSchema } from "./styles";

export const CONTACT_METHODS = ["email", "phone", "text"] as const;

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

const utmSchema = z
  .object({
    source: optionalText(120),
    medium: optionalText(120),
    campaign: optionalText(120),
    term: optionalText(120),
    content: optionalText(120),
  })
  .strict();

export const inquiryFieldsSchema = z
  .object({
    name: z.string().trim().min(1, "Please enter your name.").max(120),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Please enter a valid email address.")
      .max(254),
    /** Normalized to E.164 (phone.ts); ambiguous or invalid numbers are rejected. */
    phone: z.string().trim().optional().transform((v, ctx) => {
      if (!v) return undefined;
      const r = normalizePhone(v);
      if (r.ok) return r.e164;
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: PHONE_ERROR_COPY[r.reason] });
      return z.NEVER;
    }),
    business: z.string().trim().min(1, "Please enter your business name.").max(160),
    business_type: z.string().trim().min(1, "Please tell us your type of business.").max(120),
    website: optionalText(300),
    /** A package id, "unsure" (the form's "Not sure yet"), or blank. */
    package_interest: z.enum(PACKAGE_IDS).or(z.enum(["unsure", ""])).default(""),
    style_interest: styleInterestSchema.default(""),
    contact_method: z.enum(CONTACT_METHODS).default("email"),
    message: optionalText(2000),
    sms_consent: z.boolean().default(false),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.contact_method !== "email" && !v.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Please add a phone number so we can reach you that way.",
      });
    }
    if (v.sms_consent && !v.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "A phone number is needed for text messages.",
      });
    }
  });

/** The only page the inquiry form is served from. */
export const INQUIRY_PAGE_PATH = "/services/websites";

/**
 * The page the inquiry was sent from, as consent evidence. Only our own
 * origin(s) are accepted: https on an allowed host (plain http only for a
 * loopback host that is itself allowed), no credentials, the inquiry page
 * path. Normalized to origin + path; query and fragment are dropped.
 */
export function pageUrlSchema(allowedHosts: readonly string[]) {
  const allowed = new Set(allowedHosts.map((h) => normalizeHost(h)).filter(Boolean));
  return z
    .string()
    .max(500)
    .transform((raw, ctx) => {
      let u: URL;
      try {
        u = new URL(raw);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid page URL." });
        return z.NEVER;
      }
      const host = normalizeHost(u.host);
      const schemeOk = u.protocol === "https:" || (u.protocol === "http:" && host !== null && isLoopbackHost(host));
      const path = u.pathname.replace(/\/$/, "");
      if (!schemeOk || !host || !allowed.has(host) || u.username || u.password || path !== INQUIRY_PAGE_PATH) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid page URL." });
        return z.NEVER;
      }
      return `${u.protocol}//${host}${path}`;
    });
}

/** Full request body: fields + anti-abuse + attribution envelope, for the given allowed page hosts. */
export function buildInquiryRequestSchema(allowedPageHosts: readonly string[]) {
  return z
    .object({
      fields: inquiryFieldsSchema,
      /** Honeypot. Real users never see or fill it. */
      hp: z.string().max(200).optional(),
      turnstile_token: z.string().max(4096).optional(),
      /** UUID per form instance; a resubmit returns the first outcome. */
      idempotency_key: z.string().uuid(),
      page_url: pageUrlSchema(allowedPageHosts),
      utm: utmSchema.optional(),
    })
    .strict();
}

/** The request schema for the production origin(s). */
export const inquiryRequestSchema = buildInquiryRequestSchema(WEBSITES_PRODUCTION_HOSTS);

export type InquiryFields = z.infer<typeof inquiryFieldsSchema>;
export type InquiryFieldsInput = z.input<typeof inquiryFieldsSchema>;
export type InquiryRequest = z.infer<typeof inquiryRequestSchema>;

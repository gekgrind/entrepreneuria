/**
 * Client-side rules for the preview request form, with the approved
 * Sprint 2 error copy. The server re-validates everything with
 * inquiry-schema.ts; these rules only give fast, friendly feedback.
 * Pure (no DOM) so they are unit-tested.
 */
import type { InquiryFieldsInput } from "./inquiry-schema";
import type { PackageId } from "./packages";
import { normalizePhone, PHONE_ERROR_COPY } from "./phone";
import { STYLE_INTEREST_VALUES } from "./styles";

export interface FormValues {
  name: string;
  business: string;
  email: string;
  phone: string;
  business_type: string;
  website: string;
  package_interest: "" | "unsure" | "starter" | "growth" | "business";
  style_interest: string;
  contact_method: "email" | "text" | "phone";
  sms_consent: boolean;
  message: string;
}

/** Field order = visual order; the error summary follows it. */
export const FIELD_ORDER = [
  "name",
  "business",
  "email",
  "phone",
  "business_type",
  "website",
  "package_interest",
  "sms_consent",
] as const;
export type ValidatedField = (typeof FIELD_ORDER)[number];

export const FIELD_LABELS: Record<ValidatedField | "style_interest" | "contact_method" | "message", string> = {
  name: "Your name",
  business: "Business name",
  email: "Email",
  phone: "Phone",
  business_type: "Type of business",
  website: "Existing website",
  package_interest: "Service or package",
  sms_consent: "Text message consent",
  style_interest: "Website style",
  contact_method: "Preferred contact method",
  message: "Message",
};

export const EMPTY_FORM: FormValues = {
  name: "",
  business: "",
  email: "",
  phone: "",
  business_type: "",
  website: "",
  package_interest: "",
  style_interest: "",
  contact_method: "email",
  sms_consent: false,
  message: "",
};

export function singlePackageId(packages: ReadonlyArray<{ id: PackageId }>): PackageId | undefined {
  return packages.length === 1 ? packages[0].id : undefined;
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
/* Same normalizer as the server schema (inquiry-schema.ts), so nothing the
   client accepts is rejected later and vice versa. */
const phoneError = (v: string) => {
  const r = normalizePhone(v);
  return r.ok ? "" : PHONE_ERROR_COPY[r.reason];
};
const isSite = (v: string) => /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(v);

export function ruleFor(field: ValidatedField, values: FormValues): string {
  const v = String(values[field] ?? "").trim();
  const c = values.contact_method;
  switch (field) {
    case "name":
      return v ? "" : "Enter your name.";
    case "business":
      return v ? "" : "Enter your business name.";
    case "email":
      return !v ? "Enter your email address." : isEmail(v) ? "" : "Enter a valid email address, like name@example.com.";
    case "phone":
      if (!v) {
        return c === "text" || c === "phone"
          ? `Enter a phone number so we can reach you by ${c === "text" ? "text" : "phone"}, or choose email.`
          : "";
      }
      return phoneError(v);
    case "business_type":
      return v ? "" : "Choose the type of business you run.";
    case "website":
      return !v || isSite(v) ? "" : "Enter a website address like yourbusiness.com, or leave this blank.";
    case "package_interest":
      return v ? "" : 'Choose a package, or "Not sure yet".';
    case "sms_consent":
      return c === "text" && !values.sms_consent ? "Check the box to receive texts, or choose email instead." : "";
  }
}

export function validateForm(values: FormValues): Array<[ValidatedField, string]> {
  return FIELD_ORDER.map((f) => [f, ruleFor(f, values)] as [ValidatedField, string]).filter(([, m]) => m);
}

/** Maps form values to the server's `fields` object (inquiry-schema.ts). */
export function toInquiryFields(values: FormValues, opts: { smsEnabled: boolean }): InquiryFieldsInput {
  const contact = !opts.smsEnabled && values.contact_method === "text" ? "email" : values.contact_method;
  const style = (STYLE_INTEREST_VALUES as readonly string[]).includes(values.style_interest) ? values.style_interest : "";
  const trim = (v: string) => v.trim() || undefined;
  return {
    name: values.name.trim(),
    email: values.email.trim(),
    phone: trim(values.phone),
    business: values.business.trim(),
    business_type: values.business_type,
    website: trim(values.website),
    package_interest: values.package_interest,
    style_interest: style as InquiryFieldsInput["style_interest"],
    contact_method: contact,
    message: trim(values.message),
    sms_consent: opts.smsEnabled && contact === "text" ? values.sms_consent : false,
  };
}

/** Server field keys → form field names (identical today; kept explicit). */
export function serverFieldToFormField(key: string): keyof FormValues | null {
  const known: Array<keyof FormValues> = [
    "name", "business", "email", "phone", "business_type", "website",
    "package_interest", "style_interest", "contact_method", "sms_consent", "message",
  ];
  return (known as string[]).includes(key) ? (key as keyof FormValues) : null;
}

export function utmFromSearch(search: string) {
  const p = new URLSearchParams(search);
  const pick = (k: string) => p.get(`utm_${k}`)?.slice(0, 120) || undefined;
  const utm = { source: pick("source"), medium: pick("medium"), campaign: pick("campaign"), term: pick("term"), content: pick("content") };
  return Object.values(utm).some(Boolean) ? utm : undefined;
}

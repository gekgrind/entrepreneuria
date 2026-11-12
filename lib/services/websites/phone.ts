/**
 * Phone normalization for the preview inquiry form.
 *
 * GoHighLevel stores phones in E.164 (`+<country><number>`, max 15 digits).
 * Shared by the client rules and the server schema so both accept exactly
 * the same inputs.
 *
 * Rules (no number is assumed to be American):
 *   - "+" or "00" prefix → international. The digits after the prefix must
 *     be 8–15 long with a non-zero country code. +1 numbers must also pass
 *     the North American Numbering Plan (NANP) checks below.
 *   - No prefix → accepted only when it is unambiguously NANP: 10 digits, or
 *     11 digits starting with 1, with a valid area code and exchange
 *     (first digit 2–9, neither in N11 form). Anything else without a country
 *     code is rejected as ambiguous, so a UK "020 …" or an Australian
 *     "04…" number is never silently turned into a US number.
 *   - Only digits, spaces, dots, hyphens, parentheses and one leading "+".
 *     Extensions, letters and other separators are rejected.
 *
 * Limitation: this checks structure, not carrier assignment, so a
 * national-format number from another country that happens to fit the NANP
 * pattern is read as North American. International visitors are asked to
 * include their country code.
 */

export type PhoneResult =
  | { ok: true; e164: string }
  | { ok: false; reason: "invalid" | "ambiguous" | "invalid_international" };

const ALLOWED = /^\+?[\d\s().-]+$/;
const NANP_LOCAL = /^[2-9]\d{2}[2-9]\d{6}$/;

function isNanp(tenDigits: string): boolean {
  if (!NANP_LOCAL.test(tenDigits)) return false;
  // N11 codes (211, 311 … 911) are service codes, never area codes or exchanges.
  const n11 = (i: number) => tenDigits[i + 1] === "1" && tenDigits[i + 2] === "1";
  return !n11(0) && !n11(3);
}

export function normalizePhone(input: string): PhoneResult {
  const raw = input.trim();
  if (!raw || raw.length > 32 || !ALLOWED.test(raw)) return { ok: false, reason: "invalid" };

  const digits = raw.replace(/\D/g, "");
  const international = raw.startsWith("+") || digits.startsWith("00");

  if (international) {
    const national = raw.startsWith("+") ? digits : digits.slice(2);
    if (national.length < 8 || national.length > 15 || national.startsWith("0")) {
      return { ok: false, reason: "invalid_international" };
    }
    if (national.startsWith("1")) {
      return national.length === 11 && isNanp(national.slice(1))
        ? { ok: true, e164: `+${national}` }
        : { ok: false, reason: "invalid_international" };
    }
    return { ok: true, e164: `+${national}` };
  }

  if (digits.length < 10) return { ok: false, reason: "invalid" };
  if (digits.length === 10 && isNanp(digits)) return { ok: true, e164: `+1${digits}` };
  if (digits.length === 11 && digits.startsWith("1") && isNanp(digits.slice(1))) return { ok: true, e164: `+${digits}` };
  return { ok: false, reason: "ambiguous" };
}

/** Form/server error copy. "invalid" keeps the approved Sprint 2 wording. */
export const PHONE_ERROR_COPY: Record<Exclude<PhoneResult, { ok: true }>["reason"], string> = {
  invalid: "Enter a phone number with area code, like 404-555-0123.",
  ambiguous: "For numbers outside the US and Canada, include the country code, like +44 20 7946 0958.",
  invalid_international: "Enter a valid international number with its country code, like +44 20 7946 0958.",
};

import "server-only";

import { isPublishable } from "./policies";

/**
 * Customer-facing legal wording from the Sprint 2 design that is still under
 * legal review (spec §9). It stays server-side and reaches the client only
 * once its policy is approved, so unapproved wording never ships in the JS
 * bundle. When counsel approves a revised wording, update it here together
 * with the policy version in policies.ts.
 */
const SMS_CONSENT_WORDING =
  "I agree that Entrepreneuria may text me about this request. Message and data rates may apply. Reply STOP to opt out.";

const PRIVACY_SENTENCE = "We will use your details to respond to this request.";

export function approvedSmsConsentWording(): string | undefined {
  return isPublishable("sms_consent") ? SMS_CONSENT_WORDING : undefined;
}

export function approvedPrivacySentence(): string | undefined {
  return isPublishable("privacy_notice") ? PRIVACY_SENTENCE : undefined;
}

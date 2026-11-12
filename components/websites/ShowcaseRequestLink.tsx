"use client";

import { FIELD_LABELS } from "@/lib/services/websites/form-rules";
import { STYLE_OPTIONS } from "@/lib/services/websites/styles";
import { requestEmailHref } from "@/lib/services/websites/submit-outcome";

import { useSelection } from "./SelectionContext";
import s from "./websites.module.css";

/**
 * Showcase mode's call to action: the prefilled email request, carrying the
 * style the visitor chose in the gallery. Nothing is submitted by the page.
 */
export function ShowcaseRequestLink({ contactEmail }: { contactEmail: string }) {
  const { style } = useSelection();
  const styleName = STYLE_OPTIONS.find((o) => o.value === style)?.label ?? "";
  return (
    <a
      className={`${s.btn} ${s.btnPrimary}`}
      href={requestEmailHref(contactEmail, [[FIELD_LABELS.style_interest, styleName]])}
    >
      Request My Free Website Preview
    </a>
  );
}

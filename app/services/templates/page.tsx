import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { TemplatesIndexPage } from "@/components/websites/templates/TemplatesIndexPage";
import { reportClosedGate, resolveWebsitesPageAccess } from "@/lib/services/websites/gate";
import { publishedIndustries } from "@/lib/services/websites/templates";

/* Same runtime release gate as /services/websites: evaluated per request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Website examples by industry | Entrepreneuria",
  description: "Sample website designs for local businesses, organised by industry. Every example is a fictional business.",
  alternates: { canonical: "/services/templates" },
  /* noindex while the Services page is (Sprint 2 handoff §6). */
  robots: { index: false, follow: false },
};

export default async function Page() {
  // Visible exactly where the Services page is (gate.ts). The gallery has no form,
  // so it never opens intake; showcase and intake modes render the same page.
  const access = resolveWebsitesPageAccess(await headers());
  if (!access.visible) {
    reportClosedGate(access.gate);
    notFound();
  }
  if (publishedIndustries().length === 0) notFound();
  return <TemplatesIndexPage contactEmail={access.contactEmail} />;
}

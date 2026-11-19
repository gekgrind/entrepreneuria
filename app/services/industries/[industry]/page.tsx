import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { IndustryPage } from "@/components/websites/templates/IndustryPage";
import { reportClosedGate, resolveWebsitesPageAccess } from "@/lib/services/websites/gate";
import { publishedIndustry } from "@/lib/services/websites/templates";

/* Same runtime release gate as /services/websites: evaluated per request. */
export const dynamic = "force-dynamic";

type Params = Promise<{ industry: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const industry = publishedIndustry((await params).industry);
  if (!industry) return { robots: { index: false, follow: false } };
  return {
    title: `${industry.name} website examples | Entrepreneuria`,
    description: `${industry.intro} Every example is a fictional business.`,
    alternates: { canonical: `/services/industries/${industry.slug}` },
    /* noindex while the Services page is (Sprint 2 handoff §6). */
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: { params: Params }) {
  const access = resolveWebsitesPageAccess(await headers());
  if (!access.visible) {
    reportClosedGate(access.gate);
    notFound();
  }
  // Unknown slugs and industries without a published template do not exist publicly.
  const industry = publishedIndustry((await params).industry);
  if (!industry) notFound();
  return <IndustryPage industry={industry} contactEmail={access.contactEmail} />;
}

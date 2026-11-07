import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WebsitesPage } from "@/components/websites/WebsitesPage";
import type { PackageChoice } from "@/components/websites/SelectionContext";
import { matchBusinessType } from "@/lib/services/websites/content";
import { resolveServicesMode } from "@/lib/services/websites/flags";
import { isPackageId } from "@/lib/services/websites/packages";
import { isStyleInterest } from "@/lib/services/websites/styles";

/* Evaluated per request so WEBSITES_SERVICES_MODE is a runtime switch, not a build-time one. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  /* Built only from approved Sprint 2 copy (H1 + preview strip), no new claims. */
  title: "Professional websites for local businesses | Entrepreneuria",
  description:
    "Request a free, personalized website preview inspired by your business, services and preferred style. No purchase or commitment required.",
  alternates: { canonical: "/services/websites" },
  /* noindex until pricing, terms and features clear owner/legal review (Sprint 2 handoff §6). */
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  // Release gate: the page exists only where the services mode is explicitly on (flags.ts).
  if (resolveServicesMode() === "off") notFound();

  const params = await searchParams;
  const pkgParam = first(params.package);
  const styleParam = first(params.style);

  const initialPackage: PackageChoice = isPackageId(pkgParam) ? pkgParam : pkgParam === "unsure" ? "unsure" : "";
  const initialStyle = isStyleInterest(styleParam) ? styleParam : "";

  return (
    <WebsitesPage
      initialPackage={initialPackage}
      initialStyle={initialStyle}
      initialType={matchBusinessType(first(params.type))}
    />
  );
}

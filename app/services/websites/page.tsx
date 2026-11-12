import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { WebsitesPage } from "@/components/websites/WebsitesPage";
import type { PackageChoice } from "@/components/websites/SelectionContext";
import { matchBusinessType } from "@/lib/services/websites/content";
import { reportClosedGate, resolveWebsitesPageAccess } from "@/lib/services/websites/gate";
import { isOfferedPackageId } from "@/lib/services/websites/packages";
import { isStyleInterest } from "@/lib/services/websites/styles";

/* Evaluated per request so WEBSITES_SERVICES_MODE is a runtime switch, not a build-time one. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  /* Built from approved copy plus the owner launch decisions of 2026-11-09 (homepage concept wording). */
  title: "Professional websites for local businesses | Entrepreneuria",
  description:
    "Request a free homepage concept designed around your business, services and preferred style. No purchase or commitment required.",
  alternates: { canonical: "/services/websites" },
  /* noindex until pricing, terms and features clear owner/legal review (Sprint 2 handoff §6). */
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  // Release gate: the page exists only where the services mode is explicitly on, on an
  // allowlisted host, with a confirmed public inbox. Intake modes also need the inquiry
  // route's secrets; showcase renders without the form (gate.ts).
  const access = resolveWebsitesPageAccess(await headers());
  if (!access.visible) {
    reportClosedGate(access.gate);
    notFound();
  }
  const { contactEmail, intake } = access;

  const params = await searchParams;
  const pkgParam = first(params.package);
  const styleParam = first(params.style);

  const initialPackage: PackageChoice = isOfferedPackageId(pkgParam) ? pkgParam : pkgParam === "unsure" ? "unsure" : "";
  const initialStyle = isStyleInterest(styleParam) ? styleParam : "";

  return (
    <WebsitesPage
      initialPackage={initialPackage}
      initialStyle={initialStyle}
      initialType={matchBusinessType(first(params.type))}
      contactEmail={contactEmail}
      intake={intake}
    />
  );
}

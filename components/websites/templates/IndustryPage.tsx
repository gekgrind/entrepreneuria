import { PageShell } from "@/components/marketing/PageShell";
import {
  publishedIndustries,
  publishedTemplates,
  servicesPageFits,
  type Industry,
} from "@/lib/services/websites/templates";

import w from "../websites.module.css";
import {
  Breadcrumbs,
  FictionalNote,
  IndustryNav,
  OtherIndustries,
  PreviewClosing,
} from "./GalleryParts";
import { TemplateDeck } from "./TemplateDeck";
import t from "./templates.module.css";

/** /services/industries/[industry]: every published design for one industry. */
export function IndustryPage({
  industry,
  contactEmail,
}: {
  industry: Industry;
  contactEmail: string;
}) {
  const templates = publishedTemplates(industry.slug);
  const industries = publishedIndustries();
  const counts = Object.fromEntries(industries.map((i) => [i.slug, publishedTemplates(i.slug).length]));

  return (
    <PageShell>
      <div className={w.page}>
        <section
          className={`${w.band} ${w.hero} ${t.heroCompact}`}
          aria-labelledby="h-industry"
        >
          <div className={w.wrap}>
            <div className={t.heroHead}>
              <Breadcrumbs
                items={[
                  /* The Services page is home-service copy: only link it where it fits (templates.ts). */
                  ...(servicesPageFits(industry) ? [{ label: "Services", href: "/services" }] : []),
                  { label: "Website examples", href: "/services/templates" },
                  { label: industry.name },
                ]}
              />
              <h1 id="h-industry">{industry.headline}</h1>
              <p className={w.lede}>{industry.intro}</p>
              <FictionalNote count={templates.length} />
            </div>
          </div>
        </section>

        <section className={`${w.band} ${t.deckBand}`} aria-label={`${industry.name} website designs`}>
          <div className={w.wrap}>
            <IndustryNav current={industry.slug} industries={industries} counts={counts} />
            {/* Keyed by industry so switching filters always mounts a fresh deck. */}
            <TemplateDeck key={industry.slug} templates={templates} industry={industry} contactEmail={contactEmail} />
          </div>
        </section>

        <section
          className={`${w.band} ${w.alt}`}
          aria-labelledby="h-industry-cta"
        >
          <div className={w.wrap}>
            <PreviewClosing
              industry={industry}
              contactEmail={contactEmail}
              headingId="h-industry-cta"
            />
            <OtherIndustries
              current={industry.slug}
              industries={industries}
            />
          </div>
        </section>
      </div>
    </PageShell>
  );
}

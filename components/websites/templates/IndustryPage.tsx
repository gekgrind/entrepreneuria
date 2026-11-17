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
  OtherIndustries,
  PreviewClosing,
  TemplateRow,
} from "./GalleryParts";
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

        <section
          className={w.band}
          aria-label={`${industry.name} website designs`}
        >
          <div className={w.wrap}>
            <ul className={t.rows}>
              {templates.map((tpl, i) => (
                <li key={tpl.id}>
                  <TemplateRow
                    template={tpl}
                    industry={industry}
                    index={i}
                    total={templates.length}
                    contactEmail={contactEmail}
                  />
                </li>
              ))}
            </ul>
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
              industries={publishedIndustries()}
            />
          </div>
        </section>
      </div>
    </PageShell>
  );
}

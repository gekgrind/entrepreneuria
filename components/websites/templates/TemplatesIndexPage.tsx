import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageShell } from "@/components/marketing/PageShell";
import {
  publishedIndustries,
  publishedTemplates,
} from "@/lib/services/websites/templates";

import w from "../websites.module.css";
import {
  Breadcrumbs,
  BrowserShot,
  FictionalNote,
  PreviewClosing,
} from "./GalleryParts";
import t from "./templates.module.css";

/** /services/templates: every industry that has a published design. */
export function TemplatesIndexPage({ contactEmail }: { contactEmail: string }) {
  const industries = publishedIndustries();
  const total = publishedTemplates().length;

  return (
    <PageShell>
      <div className={w.page}>
        <section
          className={`${w.band} ${w.hero} ${t.heroCompact}`}
          aria-labelledby="h-templates"
        >
          <div className={w.wrap}>
            <div className={t.heroHead}>
              <Breadcrumbs
                items={[
                  { label: "Services", href: "/services" },
                  { label: "Website examples" },
                ]}
              />
              <h1 id="h-templates">Website designs by industry.</h1>
              <p className={w.lede}>
                These samples show different creative directions. Your website
                is personalized around your business, your services, your brand
                and your customers, and you are not limited to any of these
                layouts.
              </p>
              <FictionalNote count={total} />
            </div>
          </div>
        </section>

        <section className={w.band} aria-label="Industries">
          <div className={w.wrap}>
            <ul className={t.dir}>
              {industries.map((industry) => {
                const templates = publishedTemplates(industry.slug);
                const href = `/services/industries/${industry.slug}`;
                const shown = templates.slice(0, 3);
                return (
                  <li key={industry.slug} className={t.dirRow}>
                    <div className={t.dirText}>
                      <p className={`${w.kicker} ${t.count}`}>
                        {templates.length}{" "}
                        {templates.length === 1 ? "design" : "designs"}
                      </p>
                      <h2 id={`ind-${industry.slug}`}>{industry.name}</h2>
                      <p>{industry.intro}</p>
                      <Link
                        className={w.arrowLink}
                        href={href}
                        aria-describedby={`ind-${industry.slug}`}
                      >
                        See{" "}
                        {templates.length === 1
                          ? "the design"
                          : `all ${templates.length} designs`}{" "}
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </div>
                    <Link
                      className={t.thumbs}
                      href={href}
                      tabIndex={-1}
                      aria-hidden="true"
                      data-n={shown.length}
                      style={{ ["--n" as string]: shown.length }}
                    >
                      {shown.map((tpl) => (
                        <BrowserShot
                          key={tpl.id}
                          template={tpl}
                          sizes={
                            shown.length === 1
                              ? "(min-width: 900px) 560px, 92vw"
                              : "(min-width: 900px) 220px, 30vw"
                          }
                        />
                      ))}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section
          className={`${w.band} ${w.alt}`}
          aria-labelledby="h-templates-cta"
        >
          <div className={w.wrap}>
            <PreviewClosing
              contactEmail={contactEmail}
              headingId="h-templates-cta"
            />
          </div>
        </section>
      </div>
    </PageShell>
  );
}

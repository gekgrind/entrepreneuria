import Image from "next/image";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { CSSProperties } from "react";

import { previewActionFor, type Industry, type PublishedTemplate } from "@/lib/services/websites/templates";

import w from "../websites.module.css";
import d from "./deck.module.css";
import { PreviewActionLink } from "./GalleryParts";

/**
 * The industry gallery as a scroll-stacked portfolio deck.
 *
 * Pure CSS, no client JS: every card is `position: sticky` (so the deck
 * stacks wherever sticky works), and where scroll-driven animations are
 * supported each card recedes (scale + shade) as the next one slides over
 * it, timed off one view timeline on the list. With nothing to subscribe
 * to, there is no listener to leak and no state to go stale when the
 * visitor switches industries, resizes or comes back.
 *
 * Stacking is enabled only with two or more cards, on viewports at least
 * 768px wide and 700px tall, and without a reduced-motion preference.
 * Everywhere else the same markup is a plain vertical list.
 */
export function TemplateDeck({
  templates,
  industry,
  contactEmail,
}: {
  templates: readonly PublishedTemplate[];
  industry: Industry;
  contactEmail: string;
}) {
  const n = templates.length;
  return (
    <ol className={d.deck} data-stack={n > 1 ? "on" : "off"} style={{ "--n": n } as CSSProperties}>
      {templates.map((tpl, i) => (
        <li key={tpl.id} className={d.item} style={{ "--i": i } as CSSProperties}>
          <DeckCard template={tpl} industry={industry} index={i} total={n} contactEmail={contactEmail} />
        </li>
      ))}
    </ol>
  );
}

function DeckCard({
  template,
  industry,
  index,
  total,
  contactEmail,
}: {
  template: PublishedTemplate;
  industry: Industry;
  index: number;
  total: number;
  contactEmail: string;
}) {
  const headingId = `tpl-${template.id}`;
  const pad = (v: number) => String(v).padStart(2, "0");
  return (
    <article className={d.card} aria-labelledby={headingId}>
      {/* The tab row is what stays visible of a card once the next one covers it. */}
      <header className={d.tab}>
        {total > 1 ? (
          <span className={d.index}>
            {pad(index + 1)} <span aria-hidden="true">/</span>
            <span className="sr-only"> of </span> {pad(total)}
          </span>
        ) : null}
        <h2 id={headingId} className={d.name}>
          {template.business}
        </h2>
        <span className={d.style}>{template.design}</span>
      </header>

      <div className={d.body}>
        <div className={d.preview}>
          <a
            className={d.frame}
            href={template.url}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={-1}
            aria-hidden="true"
          >
            <span className={d.bar}>
              <i />
              <i />
              <i />
            </span>
            <Image
              className={d.shot}
              src={template.desktop.src}
              alt={template.desktop.alt}
              width={template.desktop.width}
              height={template.desktop.height}
              sizes="(min-width: 1240px) 740px, (min-width: 1000px) 60vw, 92vw"
              loading={index === 0 ? "eager" : "lazy"}
            />
          </a>
          <div className={`${w.phone} ${d.phone}`}>
            <div className={w.phoneScreen}>
              <Image
                className={w.shot}
                src={template.mobile.src}
                alt={template.mobile.alt}
                width={template.mobile.width}
                height={template.mobile.height}
                sizes="(min-width: 1000px) 130px, 22vw"
                loading={index === 0 ? "eager" : "lazy"}
              />
            </div>
          </div>
        </div>

        <div className={d.info}>
          <p className={d.kicker}>{industry.name}</p>
          <p className={d.position}>{template.position}</p>
          <p className={d.fictional}>Fictional example</p>
          <div className={d.acts}>
            <a
              className={`${w.btn} ${w.btnPrimary} ${d.cta}`}
              href={template.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Explore the live demo of ${template.business}, a fictional example (opens in a new tab)`}
            >
              Explore Live Demo <ExternalLink aria-hidden="true" />
            </a>
            <PreviewActionLink
              action={previewActionFor(template, industry)}
              contactEmail={contactEmail}
              className={w.arrowLink}
              label={
                <>
                  Request a preview in this style <ArrowRight aria-hidden="true" />
                </>
              }
              ariaLabel={`Request a free preview in the ${template.design} style`}
            />
          </div>
        </div>
      </div>
      {/* Darkens the card as it recedes into the stack (scroll-driven; decorative). */}
      <span className={d.shade} aria-hidden="true" />
    </article>
  );
}

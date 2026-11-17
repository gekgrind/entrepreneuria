import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

import { entryPackage, formatUsd } from "@/lib/services/websites/packages";
import { requestEmailHref } from "@/lib/services/websites/submit-outcome";
import {
  closingActionsFor,
  previewActionFor,
  type Industry,
  type PreviewAction,
  type PublishedTemplate,
} from "@/lib/services/websites/templates";

import w from "../websites.module.css";
import t from "./templates.module.css";

/*
 * Server-rendered building blocks for the template gallery. No client JS:
 * every action is a plain link, so the pages work fully without scripts.
 */

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <nav className={t.crumbs} aria-label="Breadcrumb">
      <ol>
        {items.map((c) => (
          <li key={c.label}>
            {c.href ? (
              <Link href={c.href}>{c.label}</Link>
            ) : (
              <span aria-current="page">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Approved disclaimer wording from the Services page, sized to the count shown. */
export function FictionalNote({ count }: { count: number }) {
  return (
    <p className={t.fineNote}>
      <strong>
        {count === 1
          ? "This example is fictional."
          : `All ${count} are fictional.`}
      </strong>{" "}
      These businesses are made up by Entrepreneuria as design examples. They
      are not real clients or completed projects. Each demo opens in a new tab.
    </p>
  );
}

/** Desktop screenshot in the Services page's browser frame. */
export function BrowserShot({
  template,
  sizes,
}: {
  template: PublishedTemplate;
  sizes: string;
}) {
  return (
    <div className={w.laptop}>
      <div className={`${w.laptopBar} ${t.laptopBar}`} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <Image
        className={w.shot}
        src={template.desktop.src}
        alt={template.desktop.alt}
        width={template.desktop.width}
        height={template.desktop.height}
        sizes={sizes}
      />
    </div>
  );
}

function PreviewActionLink({
  action,
  contactEmail,
  className,
  label,
  ariaLabel,
}: {
  action: PreviewAction;
  contactEmail: string;
  className: string;
  label: string;
  ariaLabel?: string;
}) {
  if (action.kind === "form") {
    return (
      <Link className={className} href={action.href} aria-label={ariaLabel}>
        {label}
      </Link>
    );
  }
  return (
    <a
      className={className}
      href={requestEmailHref(contactEmail, action.lines)}
      aria-label={ariaLabel}
    >
      {label}
    </a>
  );
}

/** One template: large desktop + phone screenshots beside its description and actions. */
export function TemplateRow({
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
  return (
    <article className={t.row} aria-labelledby={headingId}>
      <div className={`${w.dstage} ${t.rowStage}`}>
        <a
          className={w.dframe}
          href={template.url}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={-1}
          aria-hidden="true"
        >
          <BrowserShot
            template={template}
            sizes="(min-width: 1240px) 700px, (min-width: 960px) 56vw, 92vw"
          />
        </a>
        <div className={`${w.phone} ${t.rowPhone}`}>
          <div className={w.phoneScreen}>
            <Image
              className={w.shot}
              src={template.mobile.src}
              alt={template.mobile.alt}
              width={template.mobile.width}
              height={template.mobile.height}
              sizes="(min-width: 960px) 150px, 22vw"
            />
          </div>
        </div>
      </div>

      <div className={t.rowBody}>
        <div className={t.metaRow}>
          {total > 1 ? (
            <span className={t.index}>
              Design {String(index + 1).padStart(2, "0")} of{" "}
              {String(total).padStart(2, "0")}
            </span>
          ) : null}
          <span className={w.badge}>Fictional example</span>
        </div>
        <h2 id={headingId}>{template.design}</h2>
        <p className={w.dbiz}>{template.business}</p>
        <p className={w.dpos}>{template.position}</p>
        <p className={w.dstyle}>{template.description}</p>
        <div className={w.swatches} aria-hidden="true">
          {template.palette.map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
        </div>
        <div className={t.rowActs}>
          <a
            className={`${w.btn} ${w.btnPrimary} ${t.act}`}
            href={template.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View live demo of ${template.business}, a fictional example (opens in a new tab)`}
          >
            View Live Demo <ExternalLink aria-hidden="true" />
          </a>
          <PreviewActionLink
            action={previewActionFor(template, industry)}
            contactEmail={contactEmail}
            className={`${w.btn} ${w.btnGhost} ${t.act}`}
            label="Request a preview in this style"
            ariaLabel={`Request a free preview in the ${template.design} style`}
          />
        </div>
      </div>
    </article>
  );
}

/**
 * Closing call to action: the free preview plus the offered price, so an
 * industry page stands on its own when shared directly with a prospect.
 */
export function PreviewClosing({
  industry,
  contactEmail,
  headingId,
}: {
  industry?: Industry;
  contactEmail: string;
  headingId: string;
}) {
  const starter = entryPackage();
  const { preview, secondary } = closingActionsFor(industry);

  return (
    <div className={t.closing}>
      <div className={t.closingText}>
        <p className={w.kicker}>Free personalized preview</p>
        <h2 id={headingId}>See what your business could look like online.</h2>
        <p>
          Request a free homepage concept designed around your business,
          services and preferred style. It is a first look, not a finished
          website. No purchase or commitment required.
        </p>
        <p className={t.price}>
          {starter.displayName}: {formatUsd(starter.monthlyPriceCents)}/month
          plus {formatUsd(starter.setupPriceCents)} one-time setup.
        </p>
      </div>
      <div className={t.closingActs}>
        <PreviewActionLink
          action={preview}
          contactEmail={contactEmail}
          className={`${w.btn} ${w.btnPrimary} ${t.act}`}
          label="Request My Free Website Preview"
        />
        {secondary.kind === "pricing" ? (
          <Link className={`${w.btn} ${w.btnGhost} ${t.act}`} href={secondary.href}>
            View Pricing
          </Link>
        ) : (
          <a className={`${w.btn} ${w.btnGhost} ${t.act}`} href={`mailto:${contactEmail}`}>
            Ask a Question by Email
          </a>
        )}
      </div>
    </div>
  );
}

/** Links to the other industries and back to the directory. */
export function OtherIndustries({
  current,
  industries,
}: {
  current?: string;
  industries: readonly Industry[];
}) {
  const others = industries.filter((i) => i.slug !== current);
  return (
    <nav className={t.others} aria-label="More website examples">
      <span className={t.index}>More examples</span>
      {others.map((i) => (
        <Link
          key={i.slug}
          className={w.arrowLink}
          href={`/services/industries/${i.slug}`}
        >
          {i.name} <ArrowRight aria-hidden="true" />
        </Link>
      ))}
      {current ? (
        <Link className={w.arrowLink} href="/services/templates">
          All industries <ArrowRight aria-hidden="true" />
        </Link>
      ) : null}
    </nav>
  );
}

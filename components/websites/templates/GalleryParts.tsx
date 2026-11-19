import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { entryPackage, formatUsd } from "@/lib/services/websites/packages";
import { requestEmailHref } from "@/lib/services/websites/submit-outcome";
import {
  closingActionsFor,
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

export function PreviewActionLink({
  action,
  contactEmail,
  className,
  label,
  ariaLabel,
}: {
  action: PreviewAction;
  contactEmail: string;
  className: string;
  label: ReactNode;
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

/**
 * Industry filter for the gallery: one link per industry with published
 * designs, plus the full directory. Each industry is its own route, so a
 * change of filter renders a fresh deck (no client state to reset).
 */
export function IndustryNav({ current, industries, counts }: { current: string; industries: readonly Industry[]; counts: Record<string, number> }) {
  return (
    <nav className={t.filter} aria-label="Website examples by industry">
      <ul>
        <li>
          <Link href="/services/templates">All industries</Link>
        </li>
        {industries.map((i) => (
          <li key={i.slug}>
            <Link href={`/services/industries/${i.slug}`} aria-current={i.slug === current ? "page" : undefined}>
              {i.name} <span className={t.filterCount}>{counts[i.slug] ?? 0}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
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

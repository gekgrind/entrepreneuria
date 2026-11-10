import { ArrowRight, Check, Plus } from "lucide-react";

import { PageShell } from "@/components/marketing/PageShell";
import { WEBSITE_DEMOS } from "@/lib/services/websites/demos";
import {
  entryPackage,
  formatUsd,
  getPublishableEntitlements,
  OFFERED_PACKAGES,
} from "@/lib/services/websites/packages";
import { approvedPrivacySentence, approvedSmsConsentWording } from "@/lib/services/websites/legal-copy";
import type { StyleInterest } from "@/lib/services/websites/styles";
import { requestEmailHref } from "@/lib/services/websites/submit-outcome";

import { DesignGallery, StyleSelectionNote } from "./DesignGallery";
import { InquiryForm } from "./InquiryForm";
import { CopyEmailButton, MobileDock, PackageRequestLink, PageSubnav } from "./PageChrome";
import { SelectionProvider, type PackageChoice } from "./SelectionContext";
import s from "./websites.module.css";

/*
 * /services/websites — Sprint 2 approved design, production build.
 * Copy is verbatim from docs/websites/design/websites-page.sprint2.html
 * except where the commercial spec (v1.0, 2026-11-06) requires removal of
 * unverified features, proposed policies or legally unapproved wording;
 * each removal is listed in docs/websites/PAGE-BUILD-NOTES.md.
 */

const WHY = [
  ["Handyman & home repair", "A professional first impression", "A neighbor gives someone your name. They search for it before they call. A tidy site that says what you do and where you work gives them a reason to reach out."],
  ["Residential cleaning", "Your business information in one place", "List your services, service area and how to book. Customers stop guessing what a standard visit covers and what costs extra."],
  ["Landscaping & lawn care", "Easier estimate requests", "A short request form asks for the basics: what they need, where, and how to reach them. You read it when you are off the mower, not while you are on it."],
  ["Small contractors & remodelers", "A convenient way to contact you", "Your phone number, email and a request form are easy to find. Customers choose how to reach you, including after hours."],
  ["Pressure washing", "Show your services and your own project photos", "Before-and-after shots of your jobs, laid out clearly. We use photos you provide. We never use someone else's work."],
  ["Every local service business", "A stronger foundation for local search", "Clear service pages, your service area and accurate contact details give search engines what they need to understand your business. Results are never guaranteed."],
] as const;

const STEPS = [
  ["Tell us about your business", "Fill out a short form with your business name, what you do, and how customers reach you."],
  ["Review your homepage concept", "We share a free homepage concept for you to look over, with next steps for building your full website."],
  ["Approve and launch", "When you are happy with it, you approve it and we publish your website."],
] as const;

function faqs(setupNote: string, replyWithin: string) {
  return [
    ["Is there a setup fee?", setupNote],
    ["Can I use my existing domain?", "In most cases you can keep your current domain and point it to your new website. We confirm the details with you before launch."],
    ["Can you help if I do not have a domain?", "Yes. We can help you choose a web address that fits your business. Any registration cost and who owns the domain are spelled out in your written proposal."],
    ["Can I request changes?", "Changes are covered in your written proposal: what is included before launch, and how changes after launch work. You see those terms before you pay anything."],
    ["What if I already have a website?", "Add its address to the request form. We will take a look and show you what a new design could look like. Your current site stays as it is until you decide to switch."],
    ["Do I need to understand technology?", "No. You tell us about your business and approve the result."],
    [
      "Is the website preview free?",
      `Yes. Your free preview is a homepage concept: one homepage designed around your business name, the services you offer and the style you chose, so you can see the direction your website could take. It is not a finished website, and it does not include other pages, revisions or publishing. There is no purchase or commitment required, and we reply ${replyWithin} with next steps.`,
    ],
    ["Can I get started without a phone call?", "Yes. Everything starts with the short form below, or an email. If you would like a call, we can schedule one. It is never required."],
  ] as const;
}

/** Owner-approved inquiry response commitment (2026-11-09). A reply, not delivery of the preview. */
const REPLY_WITHIN = "within 2 business days";

const Tick = () => <Check aria-hidden="true" />;

export function WebsitesPage({
  initialPackage,
  initialStyle,
  initialType,
  contactEmail,
  intake,
}: {
  initialPackage: PackageChoice;
  initialStyle: StyleInterest | "";
  initialType: string;
  /** Confirmed public inbox (WEBSITES_CONTACT_EMAIL); the page is not rendered without it. */
  contactEmail: string;
  /** False in showcase mode: no form is rendered, requests go to the inbox by email. */
  intake: boolean;
}) {
  /* Launch (owner, 2026-11-09): one offered package. Copy that compares or
     says "from"/"starting at" switches automatically when more are offered. */
  const single = OFFERED_PACKAGES.length === 1;
  const starter = entryPackage();
  const fromMonthly = formatUsd(starter.monthlyPriceCents);
  const starterSetup = formatUsd(starter.setupPriceCents);
  const starterEntitlements = getPublishableEntitlements(starter);
  /* "one-month" per the approved wording; any other term renders as digits. */
  const minTerm = starter.minimumTermMonths === 1 ? "one-month" : `${starter.minimumTermMonths}-month`;

  return (
    <PageShell>
      <SelectionProvider initialPackage={initialPackage} initialStyle={initialStyle}>
        <div className={s.page}>
          <PageSubnav />

          {/* 1. HERO */}
          <section className={`${s.band} ${s.hero}`} id="top" aria-labelledby="h-hero">
            <div className={`${s.wrap} ${s.heroGrid}`}>
              <div>
                <p className={s.kicker}>Georgia-based &middot; Built for local service businesses</p>
                <h1 id="h-hero">
                  Professional websites for local businesses.{" "}
                  <span className={s.price}>
                    {single ? null : "Starting at "}
                    <span className={s.nowrap}>{fromMonthly}/month.</span>
                  </span>
                </h1>
                <p className={s.lede}>
                  Get a modern, mobile-friendly website that helps customers find your business, request estimates, and get in
                  touch. Without the hassle of building it yourself.
                </p>
                <div className={s.ctaRow}>
                  <a className={`${s.btn} ${s.btnPrimary}`} href="#examples">
                    See Website Examples
                  </a>
                  <a className={`${s.btn} ${s.btnGhost}`} href="#packages">
                    View Packages
                  </a>
                </div>
                <p className={s.heroAlt}>
                  Want to see it for your business?{" "}
                  <a className={s.arrowLink} href="#preview">
                    Request a free personalized preview <ArrowRight aria-hidden="true" />
                  </a>
                </p>
              </div>
              <aside className={s.offer} aria-label={`${starter.displayName} at a glance`}>
                <p className={s.kicker}>{starter.displayName}</p>
                <p className={s.offerPrice}>
                  <span className={s.amt}>{fromMonthly}</span>
                  <span className={s.per}>/month</span>
                </p>
                <p className={s.offerSetup}>plus {starterSetup} one-time setup</p>
                {starterEntitlements.length ? (
                  <ul className={s.ticks}>
                    {starterEntitlements.map((e) => (
                      <li key={e.id}>
                        <Tick />
                        {e.label}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <a className={s.arrowLink} href="#packages">
                  {single ? "See pricing details" : `Compare all ${OFFERED_PACKAGES.length} packages`} <ArrowRight aria-hidden="true" />
                </a>
              </aside>
            </div>
          </section>

          <section className={s.trust} aria-label="At a glance">
            <div className={s.wrap}>
              <ul>
                {["Based in Georgia", "Made for home-service businesses", "Setup fee shown up front", "No phone call needed to start"].map((t) => (
                  <li key={t}>
                    <Tick />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* 2. DESIGN SHOWCASE */}
          <section className={`${s.band} ${s.alt}`} id="examples" aria-labelledby="h-demo">
            <div className={s.wrap}>
              <div className={s.secHead}>
                <p className={s.kicker}>Website examples</p>
                <h2 className={s.h2} id="h-demo">
                  Three directions, all built for local service businesses.
                </h2>
                <p className={s.lede}>
                  These samples show different creative directions. Your website is personalized around your business, your
                  services, your brand and your customers, and you are not limited to any of these layouts.
                </p>
                <p className={s.fine}>
                  <strong>All three are fictional.</strong> These businesses are made up by Entrepreneuria as design examples.
                  They are not real clients or completed projects. Each demo opens in a new tab.
                </p>
              </div>
              <DesignGallery demos={WEBSITE_DEMOS} />
              <div className={s.previewStrip}>
                <div>
                  <p className={s.kicker}>Free personalized preview</p>
                  <h3>See what your business could look like online.</h3>
                </div>
                <div>
                  <p>
                    Request a free homepage concept designed around your business, services and preferred style. It is a
                    first look, not a finished website. We&rsquo;ll reply {REPLY_WITHIN} with next steps. No purchase or
                    commitment required.
                  </p>
                  <StyleSelectionNote demos={WEBSITE_DEMOS} />
                </div>
                <a className={`${s.btn} ${s.btnPrimary}`} href="#preview">
                  Request My Free Website Preview
                </a>
              </div>
            </div>
          </section>

          {/* DIFFERENCE */}
          <section className={s.band} id="difference" aria-labelledby="h-diff">
            <div className={s.wrap}>
              <div className={s.secHead}>
                <p className={s.kicker}>Why Entrepreneuria</p>
                <h2 className={s.h2} id="h-diff">
                  A professional website without the technical headaches.
                </h2>
              </div>
              <div className={s.diff} style={{ ["--diff-cols" as string]: 2 }}>
                <div>
                  <h3>No website builder to learn</h3>
                  <p>We build your website for you. You tell us about your business and approve the result.</p>
                </div>
                <div>
                  <h3>Accessible pricing</h3>
                  <p>
                    {single
                      ? `${fromMonthly}/month plus a one-time ${starterSetup} setup fee, and the price is on this page before you ask for anything.`
                      : `Plans start at ${fromMonthly}/month plus a one-time setup fee, and the price is on this page before you ask for anything.`}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 3. WHY (paper) */}
          <section className={`${s.band} ${s.paper}`} id="why" aria-labelledby="h-why">
            <div className={`${s.wrap} ${s.whyGrid}`}>
              <div className={s.stickyHead}>
                <p className={s.kicker}>Why a better website</p>
                <h2 className={`${s.h2} ${s.mt16}`} id="h-why">
                  Customers look you up before they call.
                </h2>
                <p className={`${s.lede} ${s.mt20}`}>
                  A clear, current website does a lot of the explaining for you. Here is what it does for the kind of work you do.
                </p>
                <p className={s.noteLine}>
                  A good website helps you show up well and get found more easily. It cannot promise rankings, leads or sales, and
                  we will not tell you it can.
                </p>
              </div>
              <ul className={s.whyList}>
                {WHY.map(([trade, title, body]) => (
                  <li key={title}>
                    <span className={s.trade}>{trade}</span>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* 4. PACKAGES */}
          <section className={s.band} id="packages" aria-labelledby="h-pkg">
            <div className={s.wrap}>
              <div className={s.secHead}>
                <p className={s.kicker}>{single ? "Website package" : "Website packages"}</p>
                <h2 className={s.h2} id="h-pkg">
                  Simple monthly pricing.
                </h2>
                <p className={s.lede}>
                  {single ? "One plan: a one-time setup fee plus a monthly fee." : "Each package is a one-time setup fee plus a monthly fee."}
                </p>
              </div>
              <div className={`${s.pkgs} ${single ? s.pkgsSingle : ""}`}>
                {OFFERED_PACKAGES.map((p) => {
                  const included = getPublishableEntitlements(p);
                  /* "Recommended" only means something next to alternatives. */
                  const highlight = single || p.recommended;
                  return (
                    <article key={p.id} className={`${s.pkg} ${highlight ? s.rec : ""}`} aria-labelledby={`pk-${p.id}`}>
                      {!single && p.recommended ? <span className={s.tag}>Recommended</span> : null}
                      <h3 id={`pk-${p.id}`}>{p.displayName}</h3>
                      <p className={s.pr}>
                        <span className={s.amt}>{formatUsd(p.monthlyPriceCents)}</span>
                        <span className={s.per}>/month</span>
                      </p>
                      <p className={s.setup}>plus {formatUsd(p.setupPriceCents)} one-time setup</p>
                      {included.length ? (
                        <>
                          <p className={s.incl}>Includes</p>
                          <ul className={s.ticks}>
                            {included.map((e) => (
                              <li key={e.id}>
                                <Tick />
                                <span>{e.label}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <div className={s.pkgSpacer} />
                      )}
                      <PackageRequestLink
                        pkg={p.id}
                        className={`${s.btn} ${highlight ? s.btnPrimary : s.btnGhost}`}
                        ariaLabel={`Request a free preview, interested in ${p.displayName}`}
                      >
                        Request a free preview
                      </PackageRequestLink>
                    </article>
                  );
                })}
              </div>
              <div className={s.pkgFoot}>
                <p>
                  {single ? `The plan has a ${minTerm} minimum. ` : `Every plan has a ${minTerm} minimum. `}
                  Final package details, including support and change terms, are confirmed in your written proposal before you pay anything.
                </p>
              </div>
              {/* Sprint 2's side-by-side comparison table is withheld until a verified
                  feature matrix exists (spec §2); prices alone duplicate the cards. */}
            </div>
          </section>

          {/* 5. HOW IT WORKS */}
          <section className={`${s.band} ${s.alt}`} id="how" aria-labelledby="h-how">
            <div className={s.wrap}>
              <div className={s.secHead}>
                <p className={s.kicker}>How it works</p>
                <h2 className={s.h2} id="h-how">
                  Three steps, all online.
                </h2>
                <p className={s.lede}>You do not need to hop on a call, learn any software, or build anything yourself.</p>
              </div>
              <ol className={s.steps}>
                {STEPS.map(([title, body], i) => (
                  <li key={title} className={s.step}>
                    <span className={s.stepN} aria-hidden="true">
                      {i + 1}
                    </span>
                    <div>
                      <h3>{title}</h3>
                      <p>{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className={s.howCta}>
                <a className={`${s.btn} ${s.btnPrimary}`} href="#preview">
                  Start with step 1
                </a>
                <span className={s.fine}>You see your design before anything goes live.</span>
              </div>
            </div>
          </section>

          {/* 7. FAQ */}
          <section className={`${s.band} ${s.alt}`} id="faq" aria-labelledby="h-faq">
            <div className={`${s.wrap} ${s.faqGrid}`}>
              <div>
                <p className={s.kicker}>Questions</p>
                <h2 className={`${s.h2} ${s.mt16}`} id="h-faq">
                  Plain answers.
                </h2>
                <p className={`${s.lede} ${s.mt20}`}>Something missing? Send us a note by email and we will reply in writing.</p>
              </div>
              <div className={s.faq}>
                {faqs(
                  single
                    ? `Yes. There is a one-time ${starterSetup} setup fee, shown with the price above. The ${fromMonthly} monthly price is separate and has a ${minTerm} minimum.`
                    : "Yes. Each package has a one-time setup fee, shown on the package card above. The monthly price is separate.",
                  REPLY_WITHIN
                ).map(([q, a]) => (
                  <details key={q} name="faq">
                    <summary>
                      {q}
                      <span className={s.pm}>
                        <Plus aria-hidden="true" />
                      </span>
                    </summary>
                    <div className={s.ans}>
                      <p>{a}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* 8. FORM (paper) */}
          <section className={`${s.band} ${s.paper}`} id="preview" aria-labelledby="h-form">
            <div className={`${s.wrap} ${s.formGrid}`}>
              <div className={s.stickyHead}>
                <p className={s.kicker}>Free website preview</p>
                <h2 className={`${s.h2} ${s.mt16}`} id="h-form">
                  Request your free website preview.
                </h2>
                <p className={`${s.lede} ${s.mt20}`}>
                  Tell us about your business and we will reply in writing {REPLY_WITHIN}. No phone call needed.
                </p>
                <ul className={s.nextList}>
                  <li>
                    <Tick />
                    Your free preview is a homepage concept based on your business, services and preferred style.
                  </li>
                  <li>
                    <Tick />
                    We reply {REPLY_WITHIN}, using the contact method you choose.
                  </li>
                  <li>
                    <Tick />
                    No purchase or commitment required.
                  </li>
                </ul>
                <div className={s.emailBox}>
                  <p className={s.help} style={{ fontSize: ".875rem" }}>
                    Prefer email? Ask a question directly:
                  </p>
                  <div className={s.emailRow}>
                    <span className={s.addr} id="email-addr">
                      {contactEmail}
                    </span>
                    <CopyEmailButton address={contactEmail} />
                  </div>
                  <a className={s.arrowLink} href={`mailto:${contactEmail}`}>
                    Open in my email app <ArrowRight aria-hidden="true" />
                  </a>
                </div>
              </div>
              <div>
                {intake ? (
                  <InquiryForm
                    packages={OFFERED_PACKAGES.map((p) => ({ id: p.id, displayName: p.displayName }))}
                    initialType={initialType}
                    smsConsentLabel={approvedSmsConsentWording()}
                    privacySentence={approvedPrivacySentence()}
                    contactEmail={contactEmail}
                    replyWithin={REPLY_WITHIN}
                  />
                ) : (
                  /* Showcase: no form and no submission. The existing prefilled email request is the call to action. */
                  <a className={`${s.btn} ${s.btnPrimary}`} href={requestEmailHref(contactEmail, [])}>
                    Request My Free Website Preview
                  </a>
                )}
              </div>
            </div>
          </section>

          {/* 9. FINAL CTA */}
          <section className={`${s.band} ${s.final}`} aria-labelledby="h-final">
            <div className={s.wrap}>
              <div className={s.inner}>
                <p className={s.kicker}>Ready when you are</p>
                <h2 id="h-final">See what your website could look like.</h2>
                <p className={s.lede}>
                  {`Request a free homepage concept and we will reply in writing ${REPLY_WITHIN}. Websites ${single ? "are" : "start at"} ${fromMonthly}/month, from a Georgia-based team, and you can begin right from your phone.`}
                </p>
                <div className={s.ctaRow}>
                  <a className={`${s.btn} ${s.btnPrimary}`} href="#preview">
                    Request My Free Website Preview
                  </a>
                  <a className={`${s.btn} ${s.btnGhost}`} href={`mailto:${contactEmail}`}>
                    Ask a Question by Email
                  </a>
                </div>
                <ul className={s.finalFacts}>
                  {[single ? `${fromMonthly}/month + ${starterSetup} setup` : `Starting at ${fromMonthly}/month`, "Based in Georgia", "No phone call needed"].map((t) => (
                    <li key={t}>
                      <Tick />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <MobileDock priceLabel={fromMonthly} from={!single} />
        </div>
      </SelectionProvider>
    </PageShell>
  );
}

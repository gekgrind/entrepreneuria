import { ArrowRight, Check, Plus } from "lucide-react";

import { PageShell } from "@/components/marketing/PageShell";
import { WEBSITES_CONTACT_EMAIL } from "@/lib/services/websites/content";
import { WEBSITE_DEMOS } from "@/lib/services/websites/demos";
import {
  formatUsd,
  getPackage,
  getPublishableEntitlements,
  WEBSITE_PACKAGES,
} from "@/lib/services/websites/packages";
import { approvedPrivacySentence, approvedSmsConsentWording } from "@/lib/services/websites/legal-copy";
import type { StyleInterest } from "@/lib/services/websites/styles";

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
  ["Review your website design", "We share a design for you to look over. Tell us what you would like changed."],
  ["Approve and launch", "When you are happy with it, you approve it and we publish your website."],
] as const;

function faqs(setupNote: string) {
  return [
    ["Is there a setup fee?", setupNote],
    ["Can I use my existing domain?", "In most cases you can keep your current domain and point it to your new website. We confirm the details with you before launch."],
    ["Can you help if I do not have a domain?", "Yes. We can help you choose a web address that fits your business. Any registration cost and who owns the domain are spelled out in your written proposal."],
    ["Can I request changes?", "Yes. You review your design before launch and can tell us what you would like changed. How many rounds of changes are included, and how changes after launch work, are outlined in your written proposal."],
    ["What if I already have a website?", "Add its address to the request form. We will take a look and show you what a new design could look like. Your current site stays as it is until you decide to switch."],
    ["Do I need to understand technology?", "No. You tell us about your business and approve the result."],
    ["Is the website preview free?", "Yes. A personalized preview is free, and there is no purchase or commitment required. We review your details and follow up with your preview and next steps."],
    ["Can I get started without a phone call?", "Yes. Everything starts with the short form below, or an email. If you would like a call, we can schedule one. It is never required."],
  ] as const;
}

const Tick = () => <Check aria-hidden="true" />;

export function WebsitesPage({
  initialPackage,
  initialStyle,
  initialType,
}: {
  initialPackage: PackageChoice;
  initialStyle: StyleInterest | "";
  initialType: string;
}) {
  const starter = getPackage("starter");
  const fromMonthly = formatUsd(starter.monthlyPriceCents);
  const starterSetup = formatUsd(starter.setupPriceCents);
  const starterEntitlements = getPublishableEntitlements(starter);

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
                    Starting at <span className={s.nowrap}>{fromMonthly}/month.</span>
                  </span>
                </h1>
                <p className={s.lede}>
                  Get a modern, mobile-friendly website that helps customers find your business, request estimates, and get in
                  touch. Without the hassle of building or managing it yourself.
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
                  Compare all three packages <ArrowRight aria-hidden="true" />
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
                    Request a free, personalized website preview inspired by your business, services and preferred style.
                    We&rsquo;ll review your details and follow up with your preview and next steps. No purchase or commitment
                    required.
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
                  A website that is managed for you, at a price you can plan around.
                </h2>
              </div>
              <div className={s.diff} style={{ ["--diff-cols" as string]: 2 }}>
                <div>
                  <h3>Professionally managed</h3>
                  <p>You do not have to learn a website builder.</p>
                </div>
                <div>
                  <h3>Accessible pricing</h3>
                  <p>
                    Plans start at {fromMonthly}/month plus a one-time setup fee, and the price is on this page before you ask
                    for anything.
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
                <p className={s.kicker}>Website packages</p>
                <h2 className={s.h2} id="h-pkg">
                  Simple monthly pricing.
                </h2>
                <p className={s.lede}>Each package is a one-time setup fee plus a monthly fee.</p>
              </div>
              <div className={s.pkgs}>
                {WEBSITE_PACKAGES.map((p) => {
                  const included = getPublishableEntitlements(p);
                  return (
                    <article key={p.id} className={`${s.pkg} ${p.recommended ? s.rec : ""}`} aria-labelledby={`pk-${p.id}`}>
                      {p.recommended ? <span className={s.tag}>Recommended</span> : null}
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
                        className={`${s.btn} ${p.recommended ? s.btnPrimary : s.btnGhost}`}
                        ariaLabel={`Request a free preview, interested in ${p.displayName}`}
                      >
                        Request a free preview
                      </PackageRequestLink>
                    </article>
                  );
                })}
              </div>
              <div className={s.pkgFoot}>
                <p>Final package details, including support and change terms, are confirmed in your written proposal before you pay anything.</p>
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
                  "Yes. Each package has a one-time setup fee, shown on the package card above. The monthly price is separate."
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
                  Tell us about your business and we will follow up in writing with next steps. No phone call needed.
                </p>
                <ul className={s.nextList}>
                  <li>
                    <Tick />
                    The preview is inspired by your business, services and preferred style.
                  </li>
                  <li>
                    <Tick />
                    We follow up using the contact method you choose.
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
                      {WEBSITES_CONTACT_EMAIL}
                    </span>
                    <CopyEmailButton address={WEBSITES_CONTACT_EMAIL} />
                  </div>
                  <a className={s.arrowLink} href={`mailto:${WEBSITES_CONTACT_EMAIL}`}>
                    Open in my email app <ArrowRight aria-hidden="true" />
                  </a>
                </div>
              </div>
              <div>
                <InquiryForm
                  packages={WEBSITE_PACKAGES.map((p) => ({ id: p.id, displayName: p.displayName }))}
                  initialType={initialType}
                  smsConsentLabel={approvedSmsConsentWording()}
                  privacySentence={approvedPrivacySentence()}
                  contactEmail={WEBSITES_CONTACT_EMAIL}
                />
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
                  {`Request a free, personalized website preview and we will follow up in writing. Websites start at ${fromMonthly}/month, from a Georgia-based team, and you can begin right from your phone.`}
                </p>
                <div className={s.ctaRow}>
                  <a className={`${s.btn} ${s.btnPrimary}`} href="#preview">
                    Request My Free Website Preview
                  </a>
                  <a className={`${s.btn} ${s.btnGhost}`} href={`mailto:${WEBSITES_CONTACT_EMAIL}`}>
                    Ask a Question by Email
                  </a>
                </div>
                <ul className={s.finalFacts}>
                  {[`Starting at ${fromMonthly}/month`, "Based in Georgia", "No phone call needed"].map((t) => (
                    <li key={t}>
                      <Tick />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <MobileDock priceLabel={fromMonthly} />
        </div>
      </SelectionProvider>
    </PageShell>
  );
}

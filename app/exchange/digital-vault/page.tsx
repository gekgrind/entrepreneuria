import type { Metadata } from "next";
import {
  Database,
  FolderKanban,
  Lock,
  Sparkles,
  Layers3,
  Package,
  RefreshCcw,
  Search,
  ShieldCheck,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { PillButton, GhostButton } from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Digital Vault | Entrepreneuria",
  description:
    "The Digital Vault turns everything you create into structured, reusable business assets — the founder's memory system for the Entrepreneuria ecosystem.",
};

const featureCards = [
  {
    icon: FolderKanban,
    title: "Smart asset library",
    description:
      "Everything you create is automatically organized, searchable, and easy to reuse across your business.",
  },
  {
    icon: Sparkles,
    title: "AI memory layer",
    description:
      "Your offers, audience, voice, and strategy stay connected so every tool gets smarter over time.",
  },
  {
    icon: RefreshCcw,
    title: "Version control",
    description:
      "Track changes to offers, content systems, and strategy without losing the work that got you here.",
  },
  {
    icon: Package,
    title: "Product locker",
    description:
      "Turn templates, workbooks, guides, and frameworks into deliverable digital products from one place.",
  },
  {
    icon: ShieldCheck,
    title: "Access control",
    description:
      "Keep assets private, unlock them for customers, and prepare for team permissions as you scale.",
  },
  {
    icon: Database,
    title: "Cross-app sync",
    description:
      "Strategies, content, decisions, and workflows flow into one connected system instead of living in silos.",
  },
];

const whyItMatters = [
  "Search past strategies instantly",
  "Reuse content instead of recreating it",
  "Keep your offers, templates, and systems in one place",
  "Turn business outputs into monetizable assets",
];

const monetize = [
  {
    icon: Package,
    title: "Templates, guides, and workbooks",
    body: "Store your best assets where they are ready to package, bundle, and deliver.",
  },
  {
    icon: Lock,
    title: "Gated access",
    body: "Control what stays private, what becomes customer-facing, and what unlocks after purchase.",
  },
  {
    icon: Layers3,
    title: "Reusable IP",
    body: "Turn one-time work into repeatable systems that keep paying you back.",
  },
];

const connections = [
  {
    icon: Sparkles,
    title: "Prospra",
    body: "Strategies, plans, and founder guidance become saved business assets.",
  },
  {
    icon: Layers3,
    title: "Architecta",
    body: "Content systems, messaging, and campaigns stay organized and reusable.",
  },
  {
    icon: Search,
    title: "Directorium",
    body: "Key decisions, model debates, and strategic rationale stay documented.",
  },
  {
    icon: Database,
    title: "Synceri",
    body: "Execution layers, life-admin workflows, and future automations stay connected.",
  },
];

const faqs = [
  {
    question: "What exactly goes into the Vault?",
    answer:
      "Anything you create inside Entrepreneuria can flow into the Vault, including strategies, offers, content, decision logs, templates, frameworks, and future customer-facing products.",
  },
  {
    question: "Is the Vault just storage?",
    answer:
      "No. The Vault is structured storage with search, memory, access control, and product-readiness built in. It is designed to help your work compound, not just sit there.",
  },
  {
    question: "Will the Vault connect to the other apps?",
    answer:
      "Yes. The long-term value of the Vault is that it becomes the shared memory and asset layer for Prospra, Architecta, Directorium, and Synceri.",
  },
  {
    question: "Can I sell what's inside the Vault?",
    answer:
      "That is a core part of the vision. The Vault is built to support digital products, gated access, bundles, and founder-owned assets you can package and monetize.",
  },
];

export default function DigitalVaultPage() {
  return (
    <PageShell>
      <PageHero
        kicker="Digital Vault · The founder's memory system"
        title={
          <>
            Everything you build.{" "}
            <em className="italic">Organized. Owned. Monetized.</em>
          </>
        }
        lede="Stop losing your work across tabs, tools, and scattered docs. The Digital Vault turns everything you create into structured, reusable business assets."
      >
        <div className="flex flex-wrap gap-4">
          <PillButton href="#features">See what it does</PillButton>
          <GhostButton href="#monetize">Explore the product layer</GhostButton>
        </div>
      </PageHero>

      <Section
        kicker="01 — Why it matters"
        title={
          <>
            You&apos;re not disorganized. You&apos;re{" "}
            <em className="italic">overloaded</em>.
          </>
        }
      >
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="max-w-xl space-y-5 text-lg leading-8 text-white/60">
            <p>
              Ideas in one place. Content in another. Offers buried in docs
              you forgot existed. Every time you sit down to work, you waste
              momentum trying to find what you already made.
            </p>
            <p>
              The Digital Vault fixes that. It gives Entrepreneuria a memory
              layer, so your strategies, assets, decisions, and products stop
              drifting and start compounding.
            </p>
          </div>

          <ul className="grid gap-4">
            {whyItMatters.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 leading-7 text-white/70"
              >
                <span
                  aria-hidden="true"
                  className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00d4ff] shadow-[0_0_8px_rgba(0,212,255,0.6)]"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section
        id="features"
        kicker="02 — What the Vault does"
        title={
          <>
            The system that <em className="italic">remembers</em> everything
            you build.
          </>
        }
        lede="Not just files. Not just folders. The Vault captures your business as a living system, with structure, memory, and leverage built in from day one."
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-white/25 sm:p-8"
              >
                <Icon
                  className="mb-5 h-6 w-6 text-[#00d4ff]"
                  aria-hidden="true"
                />
                <h3 className="text-xl font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="mt-3 leading-7 text-white/60">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </Section>

      <Section
        id="monetize"
        kicker="03 — Built to monetize"
        title={
          <>
            Turn your work into products. Without{" "}
            <em className="italic">rebuilding</em> everything.
          </>
        }
      >
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="space-y-4">
            {monetize.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <div className="flex items-start gap-4">
                    <Icon
                      className="mt-1 h-5 w-5 shrink-0 text-[#00d4ff]"
                      aria-hidden="true"
                    />
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {item.title}
                      </h3>
                      <p className="mt-2 leading-7 text-white/60">
                        {item.body}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="max-w-xl">
            <div className="space-y-5 text-lg leading-8 text-white/60">
              <p>
                The Vault is not just where your business lives. It is where
                your best work becomes leverage.
              </p>
              <p>
                Store templates, frameworks, guides, and strategic assets in a
                structure designed for packaging, gating, and future delivery.
                That means less digital duct tape and way less{" "}
                <span className="text-white">
                  “where did I put that thing?”
                </span>{" "}
                chaos.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {["Product locker", "Controlled access", "Founder-owned IP"].map(
                (label) => (
                  <span
                    key={label}
                    className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/70"
                  >
                    {label}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section
        kicker="04 — How it connects"
        title={
          <>
            One shared brain for the <em className="italic">entire</em>{" "}
            ecosystem.
          </>
        }
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {connections.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-7"
              >
                <Icon
                  className="mb-5 h-6 w-6 text-[#00d4ff]"
                  aria-hidden="true"
                />
                <h3 className="text-xl font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  {item.body}
                </p>
              </article>
            );
          })}
        </div>
      </Section>

      <Section
        kicker="05 — The shift"
        title={
          <>
            Stop creating things once. Start building assets that{" "}
            <em className="italic">compound</em>.
          </>
        }
        lede="Most founders do the work, ship the work, and then lose the work. The Vault changes that. Every idea, asset, and system becomes part of something cumulative, connected, and easier to monetize over time."
      >
        <div className="max-w-3xl">
          <Accordion type="single" collapsible className="space-y-1">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={faq.question}
                value={`faq-${i}`}
                className="border-b border-white/10"
              >
                <AccordionTrigger className="py-5 text-left text-base font-semibold text-white hover:no-underline [&>svg]:text-white/50">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-6 leading-7 text-white/60">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Section>

      <Section kicker="06 — Final call">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-14 text-center sm:px-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,124,167,0.25),transparent_65%)]"
          />
          <h2 className="relative text-balance text-3xl font-medium leading-tight tracking-tight text-white sm:text-4xl">
            You&apos;ve already done the work. Now make it{" "}
            <em className="italic">work for you</em>.
          </h2>
          <p className="relative mx-auto mt-5 max-w-2xl leading-7 text-white/60">
            The Digital Vault gives your business a memory, a structure, and a
            path to ownership. Instead of losing momentum, you start
            compounding it.
          </p>
          <div className="relative mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <PillButton href="/waitlist">Join the waitlist</PillButton>
            <GhostButton href="/exchange">
              See how it fits together
            </GhostButton>
          </div>
        </div>
      </Section>
    </PageShell>
  );
}

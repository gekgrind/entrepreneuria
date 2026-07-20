import type { Metadata } from "next";
import { Vault, Bot, ArrowRight, Shield, Zap, Users } from "lucide-react";

import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import {
  PillButton,
  GhostButton,
  ArrowLink,
} from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Exchange | Entrepreneuria",
  description:
    "The Entrepreneuria Exchange: secure your digital assets with Digital Vault and put AI agents to work with Agentverse.",
};

const products = [
  {
    icon: Vault,
    name: "Digital Vault",
    tagline: "Secure storage for all your business assets",
    body: "Store, organize, and protect your business documents, contracts, intellectual property, and digital assets in one secure location.",
    href: "/exchange/digital-vault",
    cta: "Explore Digital Vault",
    points: [
      {
        icon: Shield,
        title: "Bank-level security",
        desc: "End-to-end encryption for all your files",
      },
      {
        icon: Zap,
        title: "Smart organization",
        desc: "AI-powered categorization and search",
      },
      {
        icon: Users,
        title: "Team collaboration",
        desc: "Secure sharing with granular permissions",
      },
    ],
  },
  {
    icon: Bot,
    name: "Agentverse",
    tagline: "AI agents working for your business",
    body: "Deploy specialized AI agents to automate tasks, analyze data, and accelerate your business operations 24/7.",
    href: "/exchange/agentverse",
    cta: "Explore Agentverse",
    points: [
      {
        icon: Bot,
        title: "Specialized agents",
        desc: "Marketing, sales, finance, and operations agents",
      },
      {
        icon: Zap,
        title: "24/7 automation",
        desc: "Agents work around the clock for you",
      },
      {
        icon: Shield,
        title: "Custom training",
        desc: "Train agents on your business data",
      },
    ],
  },
];

const integration = [
  {
    icon: Vault,
    title: "Store assets",
    desc: "Securely store all your business data",
  },
  {
    icon: ArrowRight,
    title: "Connect agents",
    desc: "Give agents access to your data",
  },
  {
    icon: Zap,
    title: "Automate & scale",
    desc: "Let AI handle the heavy lifting",
  },
];

export default function ExchangePage() {
  return (
    <PageShell>
      <PageHero
        kicker="The Exchange"
        title={
          <>
            Your digital business <em className="italic">hub</em>.
          </>
        }
        lede="Secure your digital assets and leverage AI agents to accelerate your journey — one integrated suite for how your business actually runs."
      />

      <Section kicker="01 — The products" title="Two tools. One system.">
        <div className="grid gap-5 md:grid-cols-2">
          {products.map((product) => {
            const Icon = product.icon;
            return (
              <article
                key={product.name}
                className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-white/25 sm:p-8"
              >
                <Icon
                  className="mb-5 h-7 w-7 text-[#00d4ff]"
                  aria-hidden="true"
                />
                <h3 className="text-3xl font-medium tracking-tight text-white">
                  {product.name}
                </h3>
                <p className="mt-2 text-sm font-medium text-white/80">
                  {product.tagline}
                </p>
                <p className="mt-4 leading-7 text-white/60">{product.body}</p>

                <ul className="mt-6 flex-1 space-y-4">
                  {product.points.map((point) => {
                    const PointIcon = point.icon;
                    return (
                      <li key={point.title} className="flex items-start gap-3">
                        <PointIcon
                          className="mt-1 h-4 w-4 shrink-0 text-[#00d4ff]"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="font-semibold text-white">
                            {point.title}
                          </p>
                          <p className="text-sm leading-6 text-white/50">
                            {point.desc}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-7">
                  <ArrowLink href={product.href}>{product.cta}</ArrowLink>
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      <Section
        kicker="02 — Better together"
        title={
          <>
            Seamless <em className="italic">integration</em>.
          </>
        }
        lede="Digital Vault and Agentverse work together to supercharge your business."
      >
        <div className="grid gap-5 md:grid-cols-3">
          {integration.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 text-center"
              >
                <Icon
                  className="mx-auto mb-4 h-6 w-6 text-[#00d4ff]"
                  aria-hidden="true"
                />
                <h4 className="font-semibold text-white">{item.title}</h4>
                <p className="mt-2 text-sm leading-6 text-white/50">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section kicker="03 — The close">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-14 text-center sm:px-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,124,167,0.25),transparent_65%)]"
          />
          <h2 className="relative text-balance text-3xl font-medium leading-tight tracking-tight text-white sm:text-4xl">
            Ready to transform your <em className="italic">business</em>?
          </h2>
          <p className="relative mx-auto mt-5 max-w-2xl leading-7 text-white/60">
            Secure your assets, put agents to work, and run your venture from
            one connected hub.
          </p>
          <div className="relative mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <PillButton href="/pricing">Get started today</PillButton>
            <GhostButton href="/contact">Contact us</GhostButton>
          </div>
        </div>
      </Section>
    </PageShell>
  );
}

import { Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  Lock,
  FileText,
  Cookie,
  Trash2,
  BrainCircuit,
  Globe,
  ArrowRight,
} from "lucide-react";

import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section, PaperSection } from "@/components/marketing/Section";

export const metadata: Metadata = {
  title: "Trust Center | Entrepreneuria",
  description:
    "Learn how Entrepreneuria protects your privacy, secures your data, and builds trustworthy AI-powered software.",
};

const resources = [
  {
    title: "Privacy Policy",
    description:
      "Learn what information we collect, how we use it, and how we protect your privacy.",
    href: "/privacy",
    icon: Shield,
  },
  {
    title: "Terms of Service",
    description:
      "Review the terms governing the use of Entrepreneuria and its AI-powered applications.",
    href: "/terms",
    icon: FileText,
  },
  {
    title: "Cookie Policy",
    description:
      "Understand how cookies and similar technologies improve your experience.",
    href: "/cookies",
    icon: Cookie,
  },
  {
    title: "Security",
    description:
      "Discover the security measures we use to protect your data and connected accounts.",
    href: "/security",
    icon: Lock,
  },
  {
    title: "Data Deletion",
    description:
      "Request deletion of your account and learn how we process deletion requests.",
    href: "/data-deletion",
    icon: Trash2,
  },
];

const commitments = [
  "We do not sell your personal information.",
  "We request only the permissions necessary to provide requested features.",
  "You remain in control of your connected accounts.",
  "You can request deletion of your account and personal data.",
  "We continuously improve our security practices and platform safeguards.",
];

const contacts = [
  { label: "General", email: "support@entrepreneuria.io" },
  { label: "Privacy", email: "privacy@entrepreneuria.io" },
  { label: "Security", email: "security@entrepreneuria.io" },
  { label: "Legal", email: "legal@entrepreneuria.io" },
];

export default function TrustCenterPage() {
  return (
    <PageShell>
      <PageHero
        kicker="Trust center"
        title={
          <>
            Trust is the <em className="italic">foundation</em> of everything
            we build.
          </>
        }
        lede="Entrepreneuria is committed to protecting your privacy, securing your information, and building AI-powered tools responsibly. This Trust Center provides access to our policies, security practices, and transparency resources."
      />

      <Section
        kicker="01 — Policies & resources"
        title="Everything, in plain sight."
      >
        <div className="grid gap-5 md:grid-cols-2">
          {resources.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-white/25 sm:p-8"
              >
                <Icon className="mb-5 h-6 w-6 text-[#00d4ff]" aria-hidden="true" />
                <h3 className="text-2xl font-medium tracking-tight text-white">
                  {item.title}
                </h3>
                <p className="mt-3 flex-1 leading-7 text-white/60">
                  {item.description}
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                  Read the policy
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </Section>

      <Section
        kicker="02 — How we operate"
        title={
          <>
            Responsible AI, <em className="italic">human</em> judgment.
          </>
        }
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 sm:p-8">
            <div className="flex items-center gap-3">
              <BrainCircuit className="h-6 w-6 text-[#00d4ff]" aria-hidden="true" />
              <h3 className="text-2xl font-medium tracking-tight text-white">
                Responsible AI
              </h3>
            </div>
            <p className="mt-4 leading-7 text-white/60">
              Entrepreneuria combines advanced AI models from providers such as
              OpenAI, Anthropic, and other trusted partners. AI-generated
              responses should always be reviewed before being relied upon or
              published. Our goal is to augment human decision-making, not
              replace it.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 sm:p-8">
            <div className="flex items-center gap-3">
              <Globe className="h-6 w-6 text-[#00d4ff]" aria-hidden="true" />
              <h3 className="text-2xl font-medium tracking-tight text-white">
                Our commitment
              </h3>
            </div>
            <ul className="mt-4 space-y-3">
              {commitments.map((item) => (
                <li key={item} className="flex gap-3 leading-7 text-white/60">
                  <span
                    aria-hidden="true"
                    className="mt-3 h-1 w-1 shrink-0 rounded-full bg-[#00d4ff]"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <PaperSection
        kicker="03 — Questions"
        title="We're here to help."
        lede="If you have questions about security, privacy, compliance, or your data, reach the right inbox directly."
      >
        <ul className="grid gap-4 sm:grid-cols-2">
          {contacts.map((contact) => (
            <li
              key={contact.email}
              className="rounded-2xl border border-[#1a2942]/10 bg-white p-6 shadow-[0_16px_50px_rgba(26,41,66,0.06)]"
            >
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#4f7ca7] [font-family:var(--font-label)]">
                {contact.label}
              </p>
              <a
                href={`mailto:${contact.email}`}
                className="no-accent-link mt-2 inline-block font-semibold text-[#1a2942] underline decoration-[#1a2942]/25 underline-offset-4 transition hover:decoration-[#1a2942]"
              >
                {contact.email}
              </a>
            </li>
          ))}
        </ul>
      </PaperSection>
    </PageShell>
  );
}

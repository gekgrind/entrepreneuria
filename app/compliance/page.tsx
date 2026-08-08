import { Metadata } from "next";
import Link from "@/components/transition/TransitionLink";
import {
  ShieldCheck,
  Lock,
  BrainCircuit,
  FileText,
  Cookie,
  Trash2,
  ArrowRight,
} from "lucide-react";

import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section, PaperSection } from "@/components/marketing/Section";

export const metadata: Metadata = {
  title: "Compliance | Entrepreneuria",
  description:
    "Learn about Entrepreneuria's privacy, security, AI governance, and compliance practices.",
};

const resources = [
  {
    title: "Privacy Policy",
    href: "/privacy",
    icon: Lock,
  },
  {
    title: "Terms of Service",
    href: "/terms",
    icon: FileText,
  },
  {
    title: "Cookie Policy",
    href: "/cookies",
    icon: Cookie,
  },
  {
    title: "Security",
    href: "/security",
    icon: ShieldCheck,
  },
  {
    title: "AI Transparency",
    href: "/ai-transparency",
    icon: BrainCircuit,
  },
  {
    title: "Data Deletion",
    href: "/data-deletion",
    icon: Trash2,
  },
];

const commitments = [
  {
    title: "Privacy first",
    body: "We collect only the information reasonably necessary to provide our Services and do not sell personal information.",
  },
  {
    title: "Responsible AI",
    body: "AI is designed to assist users, not replace human judgment. Users remain responsible for reviewing AI-generated content before relying on or publishing it.",
  },
  {
    title: "Secure by design",
    body: "We use modern authentication, encryption, infrastructure security, and access controls designed to protect customer data.",
  },
  {
    title: "Customer control",
    body: "Users control their connected accounts, AI preferences, and may request deletion of their account and personal information.",
  },
];

const standards = [
  {
    name: "GDPR",
    body: "We strive to support user privacy rights, including access, correction, and deletion requests where applicable.",
  },
  {
    name: "CCPA/CPRA",
    body: "We are committed to transparency regarding the collection and use of personal information.",
  },
  {
    name: "AI Governance",
    body: "We promote responsible, transparent, and human-supervised use of AI technologies.",
  },
  {
    name: "Security Best Practices",
    body: "We continually improve our security controls, monitoring, and infrastructure as our platform evolves.",
  },
];

const contacts = [
  { label: "General", email: "support@entrepreneuria.io" },
  { label: "Privacy", email: "privacy@entrepreneuria.io" },
  { label: "Security", email: "security@entrepreneuria.io" },
  { label: "Legal", email: "legal@entrepreneuria.io" },
];

export default function CompliancePage() {
  return (
    <PageShell>
      <PageHero
        kicker="Compliance"
        title={
          <>
            Compliance &amp; <em className="italic">governance</em>.
          </>
        }
        lede="Entrepreneuria Global, Inc. is committed to protecting customer data, building trustworthy AI-powered software, and operating our platform responsibly. This page summarizes our privacy, security, and compliance commitments."
      />

      <Section kicker="01 — Our commitments" title="How we hold ourselves.">
        <div className="grid gap-5 md:grid-cols-2">
          {commitments.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 sm:p-8"
            >
              <h3 className="text-2xl font-medium tracking-tight text-white">
                {item.title}
              </h3>
              <p className="mt-3 leading-7 text-white/60">{item.body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section
        kicker="02 — Regulations & standards"
        title={
          <>
            Standards we build <em className="italic">against</em>.
          </>
        }
      >
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 sm:p-9">
          <ul className="divide-y divide-white/[0.07]">
            {standards.map((item) => (
              <li key={item.name} className="flex gap-6 py-5 first:pt-0 last:pb-0">
                <span className="w-40 shrink-0 pt-0.5 text-[11px] uppercase tracking-[0.2em] text-[#00d4ff] [font-family:var(--font-label)]">
                  {item.name}
                </span>
                <p className="leading-7 text-white/60">{item.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 border-t border-white/[0.07] pt-5 text-sm leading-6 text-white/45">
            Compliance obligations may evolve as our products, customer base,
            and applicable laws change.
          </p>
        </div>
      </Section>

      <Section kicker="03 — Related resources" title="Read the source documents.">
        <div className="grid gap-4 md:grid-cols-2">
          {resources.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/25"
              >
                <span className="flex items-center gap-4">
                  <Icon className="h-5 w-5 text-[#00d4ff]" aria-hidden="true" />
                  <span className="font-medium text-white">{item.title}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-white/50 transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      </Section>

      <PaperSection
        kicker="04 — Questions"
        title="Questions about compliance?"
        lede="If your organization has questions about privacy, security, compliance, AI governance, or vendor reviews, we're happy to help."
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

import { Metadata } from "next";
import { Database, Globe, Server, Sparkles } from "lucide-react";

import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { StatusDot } from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "System Status | Entrepreneuria",
  description: "Current system status for Entrepreneuria products and services.",
};

const services = [
  {
    name: "Entrepreneuria Website",
    description: "Main website and public pages",
    icon: Globe,
    status: "Operational",
  },
  {
    name: "Architecta",
    description: "AI content planning and publishing tools",
    icon: Sparkles,
    status: "Operational",
  },
  {
    name: "Prospra",
    description: "AI business mentor and entrepreneurial guidance",
    icon: Sparkles,
    status: "Operational",
  },
  {
    name: "Synceri",
    description: "AI life admin and workflow automation",
    icon: Sparkles,
    status: "Planned",
  },
  {
    name: "Authentication",
    description: "Login, signup, and account access",
    icon: Server,
    status: "Operational",
  },
  {
    name: "Database",
    description: "Application data, storage, and user records",
    icon: Database,
    status: "Operational",
  },
];

export default function StatusPage() {
  return (
    <PageShell>
      <PageHero
        kicker="System status"
        title={
          <>
            All systems <em className="italic">operational</em>.
          </>
        }
        lede="This page provides a high-level overview of Entrepreneuria services, products, and infrastructure status."
      />

      <Section kicker="01 — Current status" title="Service by service.">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 sm:p-9">
          <div className="flex items-baseline justify-between border-b border-white/10 pb-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45 [font-family:var(--font-label)]">
              Updated manually
            </p>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/30 [font-family:var(--font-label)]">
              No spin
            </p>
          </div>

          <ul className="divide-y divide-white/[0.07]">
            {services.map((service) => {
              const Icon = service.icon;
              const isOperational = service.status === "Operational";

              return (
                <li
                  key={service.name}
                  className="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <Icon
                        className="h-5 w-5 text-white/70"
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {service.name}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-white/50">
                        {service.description}
                      </p>
                    </div>
                  </div>

                  <p
                    className={`inline-flex w-fit items-center gap-3 text-[11px] uppercase tracking-[0.18em] [font-family:var(--font-label)] ${
                      isOperational ? "text-[#00d4ff]" : "text-white/40"
                    }`}
                  >
                    <StatusDot live={isOperational} />
                    {service.status}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 p-7 sm:p-8">
            <h3 className="text-2xl font-medium tracking-tight text-white">
              Incident history
            </h3>
            <p className="mt-3 leading-7 text-white/60">
              No active incidents are currently reported. Historical incident
              tracking may be added as Entrepreneuria expands.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 p-7 sm:p-8">
            <h3 className="text-2xl font-medium tracking-tight text-white">
              Need help?
            </h3>
            <p className="mt-3 leading-7 text-white/60">
              If you are experiencing an issue with any Entrepreneuria service,
              please contact support.
            </p>
            <a
              href="mailto:support@entrepreneuria.io"
              className="no-accent-link mt-5 inline-block text-sm font-semibold text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white"
            >
              support@entrepreneuria.io
            </a>
          </div>
        </div>
      </Section>
    </PageShell>
  );
}

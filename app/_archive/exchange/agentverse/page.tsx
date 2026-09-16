import type { Metadata } from "next";
import {
  Bot,
  BrainCircuit,
  Database,
  LineChart,
  Megaphone,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";

import { PageShell } from "@/components/marketing/PageShell";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import {
  PillButton,
  GhostButton,
  StatusDot,
} from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Agentverse | Entrepreneuria",
  description:
    "Agentverse puts specialized AI agents to work for your business — marketing, sales, finance, and operations agents that run 24/7. In development; join the waitlist.",
};

const agents = [
  {
    icon: Megaphone,
    title: "Marketing agents",
    desc: "Draft campaigns, adapt content across channels, and keep your publishing rhythm alive while you build.",
  },
  {
    icon: LineChart,
    title: "Sales agents",
    desc: "Research prospects, prep outreach, and keep your pipeline warm without a sales team on payroll.",
  },
  {
    icon: Wallet,
    title: "Finance agents",
    desc: "Track spend, flag anomalies, and keep the numbers organized so decisions start from real data.",
  },
  {
    icon: Zap,
    title: "Operations agents",
    desc: "Handle the recurring workflows — follow-ups, routines, admin load — that quietly eat founder time.",
  },
];

const principles = [
  {
    icon: Bot,
    title: "Specialized, not generic",
    desc: "Each agent is scoped to a real business function instead of pretending one chatbot can do everything.",
  },
  {
    icon: BrainCircuit,
    title: "Trained on your business",
    desc: "Agents learn from your context — offers, audience, voice, and priorities — so output fits your company.",
  },
  {
    icon: Database,
    title: "Connected to your Vault",
    desc: "Agents draw on the assets you already store in the Digital Vault, so work compounds instead of restarting.",
  },
  {
    icon: ShieldCheck,
    title: "You stay in control",
    desc: "Agents propose and prepare; you approve what ships. Automation with judgment, not autopilot.",
  },
];

export default function AgentversePage() {
  return (
    <PageShell>
      <PageHero
        kicker={
          <span className="inline-flex items-center gap-3">
            <StatusDot live={false} />
            Agentverse · In development — waitlist open
          </span>
        }
        title={
          <>
            AI agents, working for <em className="italic">your</em> business.
          </>
        }
        lede="Deploy specialized AI agents to automate tasks, analyze data, and accelerate your business operations 24/7 — one connected roster instead of a dozen disconnected bots."
      >
        <div className="flex flex-wrap gap-4">
          <PillButton href="/waitlist">Join the waitlist</PillButton>
          <GhostButton href="/exchange">Back to the Exchange</GhostButton>
        </div>
      </PageHero>

      <Section
        kicker="01 — The roster"
        title={
          <>
            A team you <em className="italic">deploy</em>, not hire.
          </>
        }
        lede="Marketing, sales, finance, and operations — each agent covers a function most solo founders carry alone."
      >
        <div className="grid gap-5 md:grid-cols-2">
          {agents.map((agent) => {
            const Icon = agent.icon;
            return (
              <article
                key={agent.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-white/25 sm:p-8"
              >
                <Icon
                  className="mb-5 h-6 w-6 text-[#00d4ff]"
                  aria-hidden="true"
                />
                <h3 className="text-2xl font-medium tracking-tight text-white">
                  {agent.title}
                </h3>
                <p className="mt-3 leading-7 text-white/60">{agent.desc}</p>
              </article>
            );
          })}
        </div>
      </Section>

      <Section
        kicker="02 — How it's built"
        title={
          <>
            Automation with <em className="italic">judgment</em>.
          </>
        }
      >
        <div className="grid gap-5 md:grid-cols-2">
          {principles.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rounded-2xl border border-white/10 p-7 sm:p-8"
              >
                <Icon
                  className="mb-5 h-6 w-6 text-[#00d4ff]"
                  aria-hidden="true"
                />
                <h3 className="text-xl font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-3 leading-7 text-white/60">{item.desc}</p>
              </article>
            );
          })}
        </div>
      </Section>

      <Section kicker="03 — Early access">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-14 text-center sm:px-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,124,167,0.25),transparent_65%)]"
          />
          <h2 className="relative text-balance text-3xl font-medium leading-tight tracking-tight text-white sm:text-4xl">
            Be first in when the agents go to{" "}
            <em className="italic">work</em>.
          </h2>
          <p className="relative mx-auto mt-5 max-w-2xl leading-7 text-white/60">
            Agentverse is being built in the open alongside the rest of the
            Entrepreneuria ecosystem. The waitlist gets first access as it
            opens.
          </p>
          <div className="relative mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <PillButton href="/waitlist">Join the waitlist</PillButton>
            <GhostButton href="/exchange/digital-vault">
              Explore Digital Vault
            </GhostButton>
          </div>
        </div>
      </Section>
    </PageShell>
  );
}

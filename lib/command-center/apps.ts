import {
  Archive,
  Brain,
  Lightbulb,
  Network,
  Repeat2,
  ShieldCheck,
} from "lucide-react";

import type { CommandCenterApp } from "./types";

export const commandCenterApps: CommandCenterApp[] = [
  {
    id: "prospra",
    name: "Prospra",
    description:
      "Strategic coaching and founder intelligence for sharper decisions.",
    status: "available",
    tierLabel: "Partner Tier",
    includedInPlan: true,
    href: "https://prospra.entrepreneuria.io",
    icon: Lightbulb,
    accentClass: "from-[#00D4FF] to-[#087EFF]",
    features: ["AI mentor", "Founder strategy", "Growth planning"],
    useCases: [
      "Clarify the next strategic move",
      "Pressure-test growth priorities",
      "Turn founder questions into action plans",
    ],
    liveData: {
      message: "3 new founder insights ready",
      actionLabel: "Review insights",
      tone: "positive",
    },
  },
  {
    id: "architecta",
    name: "Architecta",
    description:
      "Growth and content execution studio for brand, SEO, and market positioning.",
    status: "available",
    tierLabel: "Partner Tier",
    includedInPlan: true,
    href: "https://architecta.entrepreneuria.io",
    icon: Brain,
    accentClass: "from-[#087EFF] to-[#00D4FF]",
    features: ["Content strategy", "Web intelligence", "SEO systems"],
    useCases: [
      "Analyze your website and positioning",
      "Generate founder-focused content",
      "Build repeatable campaign assets",
    ],
    liveData: {
      message: "Website intelligence snapshot available",
      actionLabel: "Open report",
      tone: "info",
    },
  },
  {
    id: "directorium",
    name: "Directorium",
    description:
      "An AI board of directors for structured debate, risk review, and executive decisions.",
    status: "available",
    tierLabel: "Partner Tier",
    includedInPlan: true,
    href: "https://directorium.entrepreneuria.io",
    icon: ShieldCheck,
    accentClass: "from-[#00D4FF] to-[#FFE521]",
    features: ["AI boardroom", "Decision support", "Risk review"],
    useCases: [
      "Pressure-test big decisions",
      "Review strategy from multiple expert angles",
      "Surface tensions before execution",
    ],
    liveData: {
      message: "Next board review ready to start",
      actionLabel: "Enter boardroom",
      tone: "positive",
    },
  },
  {
    id: "synceri",
    name: "Synceri",
    description:
      "Workflow automation and integrations across your founder operating system.",
    status: "coming-soon",
    tierLabel: "Partner Tier",
    includedInPlan: true,
    icon: Repeat2,
    accentClass: "from-[#087EFF] to-[#FFE521]",
    features: ["Workflow sync", "Tool connections", "Automation routing"],
    useCases: [
      "Sync CRM, email, and calendar",
      "Automate recurring admin work",
      "Route operational updates across tools",
    ],
    liveData: {
      message: "2 automations waiting to be connected",
      actionLabel: "Connect workflows",
      tone: "warning",
    },
  },
  {
    id: "digital-vault",
    name: "Digital Vault",
    description:
      "A secure home for founder assets, decisions, documents, and reusable business IP.",
    status: "coming-soon",
    tierLabel: "Partner Tier",
    includedInPlan: true,
    icon: Archive,
    accentClass: "from-[#00D4FF] to-[#087EFF]",
    features: ["Asset storage", "Business IP", "Decision archive"],
    useCases: [
      "Preserve strategy outputs and brand assets",
      "Organize important founder documents",
      "Reconnect past decisions to current work",
    ],
    liveData: {
      message: "Vault workspace reserved",
      actionLabel: "Preview access",
      tone: "muted",
    },
  },
  {
    id: "agentverse",
    name: "Agentverse",
    description:
      "A coordinated network of specialized AI agents for higher-leverage founder workflows.",
    status: "coming-soon",
    tierLabel: "Partner Tier",
    includedInPlan: true,
    icon: Network,
    accentClass: "from-[#087EFF] to-[#00D4FF]",
    features: ["Agent network", "Task delegation", "Workflow orchestration"],
    useCases: [
      "Assign research, content, and ops work",
      "Coordinate multi-step founder workflows",
      "Extend the ecosystem with specialized agents",
    ],
    liveData: {
      message: "Agent marketplace in planning",
      actionLabel: "Coming soon",
      tone: "info",
    },
  },
];

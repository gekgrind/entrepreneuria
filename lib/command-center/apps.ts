import { Brain, Lightbulb, Repeat2, ShieldCheck } from "lucide-react";

import type { CommandCenterApp } from "./types";

export const commandCenterApps: CommandCenterApp[] = [
  {
    id: "prospra",
    name: "Prospra",
    description:
      "AI-powered founder intelligence, growth strategy, and business coaching.",
    status: "available",
    tierLabel: "Partner Tier",
    includedInPlan: true,
    href: "https://prospra.entrepreneuria.io",
    icon: Lightbulb,
    accentClass: "from-cyan-400 to-blue-500",
    features: ["AI Mentor", "Founder strategy", "Growth planning"],
    useCases: ["Clarify your next move", "Build an actionable growth plan"],
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
      "AI strategy studio for content, SEO, brand systems, and market positioning.",
    status: "available",
    tierLabel: "Partner Tier",
    includedInPlan: true,
    href: "https://architecta.entrepreneuria.io",
    icon: Brain,
    accentClass: "from-blue-500 to-indigo-600",
    features: ["Content strategy", "Web intelligence", "SEO systems"],
    useCases: ["Analyze your website", "Generate founder-focused content"],
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
      "Your AI-powered board of directors for better decisions and sharper execution.",
    status: "available",
    tierLabel: "Partner Tier",
    includedInPlan: true,
    href: "https://directorium.entrepreneuria.io",
    icon: ShieldCheck,
    accentClass: "from-emerald-400 to-teal-600",
    features: ["AI boardroom", "Decision support", "Risk review"],
    useCases: [
      "Pressure-test big decisions",
      "Review strategy from multiple expert angles",
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
    status: "available",
    tierLabel: "Partner Tier",
    includedInPlan: true,
    href: "https://synceri.entrepreneuria.io",
    icon: Repeat2,
    accentClass: "from-violet-500 to-fuchsia-500",
    features: ["Workflow sync", "Tool connections", "Automation routing"],
    useCases: [
      "Sync CRM, email, and calendar",
      "Automate recurring admin work",
    ],
    liveData: {
      message: "2 automations waiting to be connected",
      actionLabel: "Connect workflows",
      tone: "warning",
    },
  },
];

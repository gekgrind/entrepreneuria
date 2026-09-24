import { PRODUCTS } from "@/lib/ecosystem/products";
import type { Product } from "@/lib/ecosystem/schema";

/**
 * THE PLAN REGISTRY — single source of truth for public pricing.
 *
 * Mirrors `lib/ecosystem/products.ts`: plan names, prices, positioning,
 * and the comparison matrix live here and ONLY here, so the ladder, the
 * comparison grid, and the FAQ can never drift apart.
 *
 * Two rules this file exists to enforce:
 *
 * 1. The ladder is data. Rendering is driven by `PUBLISHED_PLANS`, so a
 *    three-tier and a four-tier ladder are the same code path. Adding a
 *    tier is a data entry, never a layout edit.
 *
 * 2. Nothing here is a billing product. The repository has no payment
 *    processor, no checkout, and no entitlement store (see the audit in
 *    the pricing page header). These are marketing claims about what a
 *    plan WILL include, and the page is careful to say so.
 */

export const PLAN_IDS = ["free", "starter", "growth", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanFeature {
  text: string;
  /**
   * The capability depends on a product that has not shipped yet. The
   * card marks these rather than hiding them: a founder deciding today
   * is entitled to know which half of the sentence is a promise.
   */
  pending?: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** 1-based rung. Drives the capability motif and nothing else. */
  step: number;
  /** Whole USD per month. */
  price: number;
  /** One line: who this rung is for. */
  positioning: string;
  /** The differentiating promise, in the founder's second person. */
  bestFor: string;
  /** CTA label used once signups are open. */
  ctaLabel: string;
  recommended?: boolean;
  featuresLabel: string;
  features: PlanFeature[];
}

/* ------------------------------------------------------------------ */
/* The published ladder                                                */
/* ------------------------------------------------------------------ */

const FREE: Plan = {
  id: "free",
  name: "Free",
  step: 1,
  price: 0,
  positioning: "For the idea that is still an idea.",
  bestFor:
    "Walk the whole ecosystem before you spend anything. No card, no clock.",
  ctaLabel: "Start free",
  featuresLabel: "What you get",
  features: [
    { text: "An account that opens every app as it ships" },
    { text: "Prospra mentor sessions, capped monthly" },
    { text: "Architecta core planning tools", pending: true },
    { text: "Directorium with one advisor at the table", pending: true },
    { text: "Synceri manual workflows", pending: true },
    { text: "The full Library of templates and playbooks" },
  ],
};

const GROWTH: Plan = {
  id: "growth",
  name: "Growth",
  step: 2,
  price: 29,
  positioning: "For the business you are actively running.",
  bestFor:
    "The whole suite unlocked, with the AI credits and automations that make it an operating system instead of four apps.",
  ctaLabel: "Start with Growth",
  recommended: true,
  featuresLabel: "Everything in Free, plus",
  features: [
    { text: "Prospra in full — unlimited sessions, pipeline, and outreach" },
    {
      text: "Architecta in full — strategy, offers, and content planning",
      pending: true,
    },
    {
      text: "Directorium with three advisors and capped sessions",
      pending: true,
    },
    { text: "Synceri core automations and integrations", pending: true },
    { text: "A monthly AI agent credit allotment across every app" },
    { text: "Priority email support" },
  ],
};

const PRO: Plan = {
  id: "pro",
  name: "Pro",
  step: 3,
  price: 59,
  positioning: "For running like a funded startup without the headcount.",
  bestFor:
    "Every ceiling raised: the full boardroom, multi-step automation, and first access to whatever ships next.",
  ctaLabel: "Start with Pro",
  featuresLabel: "Everything in Growth, plus",
  features: [
    {
      text: "Directorium's full board — all six advisors, unlimited sessions",
      pending: true,
    },
    { text: "Synceri advanced multi-step automations", pending: true },
    { text: "Architecta premium templates and forecasting", pending: true },
    { text: "Higher AI agent credit limits across the ecosystem" },
    { text: "Priority performance on generation-heavy work" },
    { text: "Early access to new apps and betas" },
  ],
};

/* ------------------------------------------------------------------ */
/* Starter — a PROPOSAL, not a product                                 */
/* ------------------------------------------------------------------ */

/**
 * The $0 → $29 gap is real, and this is the tier that would close it.
 * It is NOT live, and shipping it is a founder decision, not a code
 * change: there is no billing system to sell it through yet.
 *
 * The boundary that keeps it from cannibalising Growth: Starter buys
 * DEPTH in one app (Prospra, the flagship that is actually launching).
 * Growth buys BREADTH across the suite plus the credits and automation
 * that make the ecosystem an operating system. A founder who wants a
 * second app has no route through Starter.
 *
 * Enable on a preview deploy with NEXT_PUBLIC_PRICING_STARTER=on to see
 * the four-rung ladder. Same idiom as NEXT_PUBLIC_PROSPRA_LAUNCH_STATE:
 * a pricing change should be an env change, not a commit.
 */
const STARTER_PROPOSAL: Plan = {
  id: "starter",
  name: "Starter",
  step: 2,
  price: 12,
  positioning: "For the founder going deep on one thing first.",
  bestFor:
    "Prospra without the ceiling, for people who want a mentor before they want a suite.",
  ctaLabel: "Start with Starter",
  featuresLabel: "Everything in Free, plus",
  features: [
    { text: "Prospra in full — unlimited sessions, pipeline, and outreach" },
    {
      text: "Directorium with two advisors and ten sessions a month",
      pending: true,
    },
    { text: "A starter allotment of AI agent credits" },
    { text: "Architecta core planning tools", pending: true },
    { text: "Email support" },
  ],
};

export const STARTER_ENABLED = process.env.NEXT_PUBLIC_PRICING_STARTER === "on";

/** The ladder, in reading order. Three rungs today, four when enabled. */
export const PUBLISHED_PLANS: readonly Plan[] = Object.freeze(
  STARTER_ENABLED
    ? [
        FREE,
        STARTER_PROPOSAL,
        { ...GROWTH, step: 3, featuresLabel: "Everything in Starter, plus" },
        { ...PRO, step: 4 },
      ]
    : [FREE, GROWTH, PRO],
);

/** Rungs on the ladder — the capability motif counts against this. */
export const LADDER_HEIGHT = PUBLISHED_PLANS.length;

/* ------------------------------------------------------------------ */
/* The comparison matrix                                               */
/* ------------------------------------------------------------------ */

export interface ComparisonRow {
  feature: string;
  /** Every plan id is required, so a fourth rung is never half-authored. */
  values: Record<PlanId, string>;
}

export interface ComparisonGroup {
  /** Registry slug when the group is a product, so status stays honest. */
  productSlug: string | null;
  title: string;
  rows: ComparisonRow[];
}

export const COMPARISON: readonly ComparisonGroup[] = Object.freeze([
  {
    productSlug: "prospra",
    title: "Prospra — mentorship & pipeline",
    rows: [
      {
        feature: "Mentor sessions",
        values: {
          free: "Capped monthly",
          starter: "Unlimited",
          growth: "Unlimited",
          pro: "Unlimited",
        },
      },
      {
        feature: "Pipeline & contact tracking",
        values: { free: "Basic", starter: "Full", growth: "Full", pro: "Full" },
      },
      {
        feature: "AI outreach & sequences",
        values: {
          free: "—",
          starter: "Included",
          growth: "Included",
          pro: "Included",
        },
      },
    ],
  },
  {
    productSlug: "architecta",
    title: "Architecta — content & strategy",
    rows: [
      {
        feature: "Core planning tools",
        values: {
          free: "Included",
          starter: "Included",
          growth: "Included",
          pro: "Included",
        },
      },
      {
        feature: "Full strategy & offer design",
        values: {
          free: "—",
          starter: "—",
          growth: "Included",
          pro: "Included",
        },
      },
      {
        feature: "Premium templates & forecasting",
        values: { free: "—", starter: "—", growth: "—", pro: "Included" },
      },
    ],
  },
  {
    productSlug: "directorium",
    title: "Directorium — the boardroom",
    rows: [
      {
        feature: "Advisors at the table",
        values: {
          free: "1 of 6",
          starter: "2 of 6",
          growth: "3 of 6",
          pro: "All 6",
        },
      },
      {
        feature: "Board sessions",
        values: {
          free: "5 a month",
          starter: "10 a month",
          growth: "Capped",
          pro: "Unlimited",
        },
      },
      {
        feature: "Full-board debate across all six models",
        values: { free: "—", starter: "—", growth: "—", pro: "Included" },
      },
    ],
  },
  {
    productSlug: "synceri",
    title: "Synceri — order & automation",
    rows: [
      {
        feature: "Manual workflows",
        values: {
          free: "Included",
          starter: "Included",
          growth: "Included",
          pro: "Included",
        },
      },
      {
        feature: "Core automations & integrations",
        values: {
          free: "—",
          starter: "—",
          growth: "Included",
          pro: "Included",
        },
      },
      {
        feature: "Advanced multi-step automations",
        values: { free: "—", starter: "—", growth: "—", pro: "Included" },
      },
    ],
  },
  {
    productSlug: null,
    title: "Across the platform",
    rows: [
      {
        feature: "AI agent credits",
        values: {
          free: "—",
          starter: "Starter allotment",
          growth: "Monthly allotment",
          pro: "Higher limits",
        },
      },
      {
        feature: "New apps as they ship",
        values: {
          free: "Free tier",
          starter: "Starter tier",
          growth: "Growth tier",
          pro: "Pro tier, first",
        },
      },
      {
        feature: "Priority performance",
        values: { free: "—", starter: "—", growth: "—", pro: "Included" },
      },
      {
        feature: "Support",
        values: {
          free: "Community",
          starter: "Email",
          growth: "Priority email",
          pro: "Priority queue",
        },
      },
    ],
  },
]);

/* ------------------------------------------------------------------ */
/* Shared value — what a plan is before it is a tier                   */
/* ------------------------------------------------------------------ */

export const SHARED_VALUE: readonly { title: string; body: string }[] =
  Object.freeze([
    {
      title: "One account, every app",
      body: "You are not buying a tool. One login opens Prospra today and every app in the ecosystem the day it ships — at the tier you are already on, at no extra cost.",
    },
    {
      title: "Your business, carried between apps",
      body: "What you tell one app, the rest already know. The model, the market, the offer, the numbers — entered once, used everywhere.",
    },
    {
      title: "The Library, open to everyone",
      body: "Templates, playbooks, and frameworks for funding, growth, and team building. Free tier included, no upgrade prompt attached.",
    },
    {
      title: "Free AI tools, no account",
      body: "Six tools for the decisions that come first — model, market, money, personas, pitch, and hiring. They stay free and they stay open.",
    },
  ]);

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

/** Core-tier products, in registry order. Channelwright is standalone
 *  and sold separately, so it must never appear inside a plan. */
export function getPlanProducts(): Product[] {
  return PRODUCTS.filter((p) => p.tier === "core");
}

export function getComparisonProduct(slug: string | null): Product | null {
  if (!slug) return null;
  return PRODUCTS.find((p) => p.slug === slug) ?? null;
}

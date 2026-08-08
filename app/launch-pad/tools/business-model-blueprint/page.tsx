"use client";

import { useMemo, useState } from "react";
import Link from "@/components/transition/TransitionLink";
import { ArrowLeft, Copy, Sparkles } from "lucide-react";

const customerTypes = ["B2C", "B2B", "B2B2C", "Marketplace", "Community"];
const revenueModels = [
  "One-time product sale",
  "Subscription/SaaS",
  "Service/consulting",
  "Licensing",
  "Affiliate/referral",
  "Marketplace fees",
  "Freemium upsell",
  "Sponsorship/ads",
];
const activityCategories = [
  "Content creation",
  "Product development",
  "Sales & marketing",
  "Customer support",
  "Operations & fulfillment",
  "Community building",
  "Partnerships",
];

type SectionKey =
  | "customers"
  | "value"
  | "revenue"
  | "activities"
  | "resources";

const sections: { key: SectionKey; title: string; description: string }[] = [
  {
    key: "customers",
    title: "Your Customers",
    description:
      "Get specific about who you're serving and what real pain they're paying to solve.",
  },
  {
    key: "value",
    title: "Your Value Proposition",
    description:
      "Define the transformation you deliver and why your offer wins in a noisy market.",
  },
  {
    key: "revenue",
    title: "Revenue Streams",
    description:
      "Pressure-test how money flows into the business now — and what grows later.",
  },
  {
    key: "activities",
    title: "Key Activities",
    description:
      "Find the few actions that actually create momentum, not just busywork.",
  },
  {
    key: "resources",
    title: "Key Resources & Partners",
    description:
      "Spot what you're leaning on, what's fragile, and where hidden leverage lives.",
  },
];

const MarkdownLike = ({ text }: { text: string }) => {
  const lines = text.split("\n");
  return (
    <div className="space-y-2 text-sm leading-7 text-slate-100">
      {lines.map((line, idx) => {
        if (!line.trim()) return <div key={idx} className="h-2" />;
        if (line.startsWith("### "))
          return (
            <h4 key={idx} className="text-lg font-semibold text-white">
              {line.replace("### ", "")}
            </h4>
          );
        if (line.startsWith("## "))
          return (
            <h3 key={idx} className="text-xl font-semibold text-white">
              {line.replace("## ", "")}
            </h3>
          );
        if (line.startsWith("# "))
          return (
            <h2 key={idx} className="text-2xl font-semibold text-white">
              {line.replace("# ", "")}
            </h2>
          );
        if (line.match(/^[-*] /))
          return (
            <li key={idx} className="ml-5 list-disc">
              {line.replace(/^[-*] /, "")}
            </li>
          );
        return <p key={idx}>{line}</p>;
      })}
    </div>
  );
};

export default function BusinessModelBlueprintPage() {
  const [active, setActive] = useState<SectionKey>("customers");

  const [customers, setCustomers] = useState({
    targetCustomer: "",
    problem: "",
    types: [] as string[],
  });
  const [value, setValue] = useState({
    product: "",
    outcome: "",
    differentiation: "",
  });
  const [revenue, setRevenue] = useState({
    models: [] as string[],
    primaryOffer: "",
    extraStreams: "",
    monthlyGoal: "",
  });
  const [activities, setActivities] = useState({
    tasks: "",
    topActivity: "",
    categories: [] as string[],
  });
  const [resources, setResources] = useState({
    reliedOn: "",
    partners: "",
    missing: "",
  });

  const [loadingMap, setLoadingMap] = useState<Record<SectionKey, boolean>>({
    customers: false,
    value: false,
    revenue: false,
    activities: false,
    resources: false,
  });
  const [errors, setErrors] = useState<Record<SectionKey | "full", string>>({
    customers: "",
    value: "",
    revenue: "",
    activities: "",
    resources: "",
    full: "",
  });
  const [insights, setInsights] = useState<Record<SectionKey, string>>({
    customers: "",
    value: "",
    revenue: "",
    activities: "",
    resources: "",
  });
  const [fullLoading, setFullLoading] = useState(false);
  const [fullBlueprint, setFullBlueprint] = useState("");

  const completion = useMemo(
    () => Object.values(insights).filter(Boolean).length,
    [insights],
  );
  const activeStep =
    sections.findIndex((section) => section.key === active) + 1;

  const toggleArrayValue = (current: string[], valueToToggle: string) =>
    current.includes(valueToToggle)
      ? current.filter((entry) => entry !== valueToToggle)
      : [...current, valueToToggle];

  const callAI = async (mode: "section" | "full", prompt: string) => {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, prompt }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Generation failed");
    }

    return data.result as string;
  };

  const sectionPrompt = (section: SectionKey) => {
    if (section === "customers") {
      return `You are a strategic business advisor. Based on this target customer description and problem, provide: 1) A refined customer persona summary, 2) Key customer jobs-to-be-done, 3) Possible customer segments to consider, 4) One risk or blind spot about this customer assumption. Keep insights sharp, practical, and founder-focused. Format with clear headers.\n\nTarget customer: ${customers.targetCustomer || "N/A"}\nProblem: ${customers.problem || "N/A"}\nCustomer types: ${customers.types.join(", ") || "N/A"}`;
    }

    if (section === "value") {
      return `You are a positioning strategist. Based on this value proposition, provide: 1) A sharpened one-sentence value proposition statement, 2) The core transformation this product delivers (from → to), 3) Three compelling differentiators to lean into, 4) A warning about a positioning trap to avoid. Format with headers. Keep it punchy.\n\nOffer description: ${value.product || "N/A"}\nCustomer outcome: ${value.outcome || "N/A"}\nDifferentiation: ${value.differentiation || "N/A"}`;
    }

    if (section === "revenue") {
      return `You are a revenue strategist. Based on these revenue streams and pricing, provide: 1) An assessment of the revenue model’s scalability, 2) Two revenue expansion opportunities to consider, 3) A pricing strategy insight or recommendation, 4) A risk to watch in this revenue structure. Be direct and strategic.\n\nRevenue model types: ${revenue.models.join(", ") || "N/A"}\nPrimary offer + price: ${revenue.primaryOffer || "N/A"}\nOther streams: ${revenue.extraStreams || "N/A"}\nMonthly revenue goal (USD): ${revenue.monthlyGoal || "N/A"}`;
    }

    if (section === "activities") {
      return `You are an operations and growth strategist. Based on these key activities, provide: 1) An assessment of whether these activities align with the revenue goals, 2) The highest-leverage activity this founder should double down on, 3) One activity that could likely be automated or eliminated, 4) A framework suggestion for prioritizing these activities. Keep it actionable.\n\nCurrent activities: ${activities.tasks || "N/A"}\nHighest growth/revenue activity: ${activities.topActivity || "N/A"}\nActivity categories: ${activities.categories.join(", ") || "N/A"}`;
    }

    return `You are a strategic advisor. Based on these resources and partners, provide: 1) An audit of resource strengths and vulnerabilities, 2) One platform or partnership risk to address, 3) A resource gap this founder should prioritize filling, 4) A leverage opportunity hiding in their current assets. Be specific and tactical.\n\nCore resources: ${resources.reliedOn || "N/A"}\nPartners/platforms/channels: ${resources.partners || "N/A"}\nMissing resources: ${resources.missing || "N/A"}`;
  };

  const generateSection = async (section: SectionKey) => {
    setLoadingMap((prev) => ({ ...prev, [section]: true }));
    setErrors((prev) => ({ ...prev, [section]: "" }));

    try {
      const result = await callAI("section", sectionPrompt(section));
      setInsights((prev) => ({ ...prev, [section]: result }));
    } catch (error) {
      setErrors((prev) => ({ ...prev, [section]: (error as Error).message }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [section]: false }));
    }
  };

  const generateFullBlueprint = async () => {
    setFullLoading(true);
    setErrors((prev) => ({ ...prev, full: "" }));

    const combinedPrompt = `Business model inputs:\n\n1) Customers\nTarget customer: ${customers.targetCustomer || "N/A"}\nProblem: ${customers.problem || "N/A"}\nCustomer types: ${customers.types.join(", ") || "N/A"}\n\n2) Value Proposition\nOffer: ${value.product || "N/A"}\nOutcome: ${value.outcome || "N/A"}\nDifferentiation: ${value.differentiation || "N/A"}\n\n3) Revenue Streams\nModels: ${revenue.models.join(", ") || "N/A"}\nPrimary offer + price: ${revenue.primaryOffer || "N/A"}\nOther streams: ${revenue.extraStreams || "N/A"}\nMonthly goal: ${revenue.monthlyGoal || "N/A"}\n\n4) Key Activities\nActivities: ${activities.tasks || "N/A"}\nHighest leverage activity: ${activities.topActivity || "N/A"}\nCategories: ${activities.categories.join(", ") || "N/A"}\n\n5) Resources & Partners\nResources: ${resources.reliedOn || "N/A"}\nPartners/channels: ${resources.partners || "N/A"}\nGaps: ${resources.missing || "N/A"}`;

    try {
      const result = await callAI("full", combinedPrompt);
      setFullBlueprint(result);
    } catch (error) {
      setErrors((prev) => ({ ...prev, full: (error as Error).message }));
    } finally {
      setFullLoading(false);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // no-op fallback
    }
  };

  const hasAnyInput = Boolean(
    customers.targetCustomer ||
    customers.problem ||
    customers.types.length ||
    value.product ||
    value.outcome ||
    value.differentiation ||
    revenue.models.length ||
    revenue.primaryOffer ||
    revenue.extraStreams ||
    revenue.monthlyGoal ||
    activities.tasks ||
    activities.topActivity ||
    activities.categories.length ||
    resources.reliedOn ||
    resources.partners ||
    resources.missing,
  );

  return (
    <main className="min-h-screen bg-[#081527] text-white pt-24 pb-16">
      <div className="mx-auto max-w-6xl px-4 md:px-8 print:max-w-full print:px-0">
        <Link
          href="/launch-pad/tools"
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white print:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to AI Tools
        </Link>

        <section className="rounded-3xl border border-white/10 bg-gradient-to-r from-[#0f2138] via-[#14283f] to-[#0a1a2f] p-6 md:p-10 shadow-[0_0_80px_var(--brand-accent-soft)]">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--brand-accent)]/40 bg-[var(--brand-accent)]/10 px-3 py-1 text-xs text-[var(--brand-accent)]">
            <span className="h-2 w-2 rounded-full bg-[var(--brand-accent)] shadow-[0_0_10px_var(--brand-accent)]" />
            AI-Powered
          </div>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">
            Business Model Blueprint
          </h1>
          <p className="mt-4 max-w-2xl text-slate-300 text-lg">
            Map your model. Build with clarity.
          </p>
          <div className="mt-6 h-1 w-full rounded-full bg-white/10">
            <div
              className="h-1 rounded-full bg-gradient-to-r from-[var(--brand-accent)] to-[var(--brand-accent-strong)]"
              style={{ width: `${(completion / 5) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Step {activeStep} of 5 • {completion}/5 insights generated
          </p>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-5 print:hidden">
          {sections.map((section, index) => (
            <button
              key={section.key}
              onClick={() => setActive(section.key)}
              className={`rounded-xl border p-3 text-left transition ${
                active === section.key
                  ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <p className="text-xs uppercase tracking-widest text-slate-400">
                Step {index + 1}
              </p>
              <p className="mt-1 text-sm font-medium">{section.title}</p>
            </button>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-[#111426] p-6 md:p-8">
          <h2 className="text-2xl font-semibold">
            {sections.find((s) => s.key === active)?.title}
          </h2>
          <p className="mt-2 text-slate-300">
            {sections.find((s) => s.key === active)?.description}
          </p>

          <div className="mt-6 space-y-4">
            {active === "customers" && (
              <>
                <input
                  value={customers.targetCustomer}
                  onChange={(e) =>
                    setCustomers((p) => ({
                      ...p,
                      targetCustomer: e.target.value,
                    }))
                  }
                  placeholder="Solo founders building their first digital product business"
                  className="w-full rounded-lg border border-white/10 bg-[#0d1120] px-4 py-3"
                />
                <input
                  value={customers.problem}
                  onChange={(e) =>
                    setCustomers((p) => ({ ...p, problem: e.target.value }))
                  }
                  placeholder="They struggle to validate their idea and know where to start"
                  className="w-full rounded-lg border border-white/10 bg-[#0d1120] px-4 py-3"
                />
                <div className="flex flex-wrap gap-2">
                  {customerTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() =>
                        setCustomers((p) => ({
                          ...p,
                          types: toggleArrayValue(p.types, type),
                        }))
                      }
                      className={`rounded-full border px-3 py-1 text-sm ${customers.types.includes(type) ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/20" : "border-white/15"}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </>
            )}

            {active === "value" && (
              <>
                <textarea
                  value={value.product}
                  onChange={(e) =>
                    setValue((p) => ({ ...p, product: e.target.value }))
                  }
                  placeholder="A suite of Notion templates that help solo founders launch their business in 30 days"
                  className="h-28 w-full rounded-lg border border-white/10 bg-[#0d1120] px-4 py-3"
                />
                <input
                  value={value.outcome}
                  onChange={(e) =>
                    setValue((p) => ({ ...p, outcome: e.target.value }))
                  }
                  placeholder="A fully structured business ready to scale"
                  className="w-full rounded-lg border border-white/10 bg-[#0d1120] px-4 py-3"
                />
                <input
                  value={value.differentiation}
                  onChange={(e) =>
                    setValue((p) => ({ ...p, differentiation: e.target.value }))
                  }
                  placeholder="Built specifically for non-technical founders, not corporate teams"
                  className="w-full rounded-lg border border-white/10 bg-[#0d1120] px-4 py-3"
                />
              </>
            )}

            {active === "revenue" && (
              <>
                <div className="flex flex-wrap gap-2">
                  {revenueModels.map((model) => (
                    <button
                      key={model}
                      onClick={() =>
                        setRevenue((p) => ({
                          ...p,
                          models: toggleArrayValue(p.models, model),
                        }))
                      }
                      className={`rounded-full border px-3 py-1 text-sm ${revenue.models.includes(model) ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/20" : "border-white/15"}`}
                    >
                      {model}
                    </button>
                  ))}
                </div>
                <input
                  value={revenue.primaryOffer}
                  onChange={(e) =>
                    setRevenue((p) => ({ ...p, primaryOffer: e.target.value }))
                  }
                  placeholder="$27 Notion template bundle"
                  className="w-full rounded-lg border border-white/10 bg-[#0d1120] px-4 py-3"
                />
                <textarea
                  value={revenue.extraStreams}
                  onChange={(e) =>
                    setRevenue((p) => ({ ...p, extraStreams: e.target.value }))
                  }
                  placeholder="Describe any other current or planned revenue streams"
                  className="h-24 w-full rounded-lg border border-white/10 bg-[#0d1120] px-4 py-3"
                />
                <input
                  type="number"
                  value={revenue.monthlyGoal}
                  onChange={(e) =>
                    setRevenue((p) => ({ ...p, monthlyGoal: e.target.value }))
                  }
                  placeholder="Approximate monthly revenue goal (USD)"
                  className="w-full rounded-lg border border-white/10 bg-[#0d1120] px-4 py-3"
                />
              </>
            )}

            {active === "activities" && (
              <>
                <textarea
                  value={activities.tasks}
                  onChange={(e) =>
                    setActivities((p) => ({ ...p, tasks: e.target.value }))
                  }
                  placeholder="Creating content, building templates, managing Etsy shop, growing email list"
                  className="h-28 w-full rounded-lg border border-white/10 bg-[#0d1120] px-4 py-3"
                />
                <input
                  value={activities.topActivity}
                  onChange={(e) =>
                    setActivities((p) => ({
                      ...p,
                      topActivity: e.target.value,
                    }))
                  }
                  placeholder="What activity drives the most growth?"
                  className="w-full rounded-lg border border-white/10 bg-[#0d1120] px-4 py-3"
                />
                <div className="flex flex-wrap gap-2">
                  {activityCategories.map((category) => (
                    <button
                      key={category}
                      onClick={() =>
                        setActivities((p) => ({
                          ...p,
                          categories: toggleArrayValue(p.categories, category),
                        }))
                      }
                      className={`rounded-full border px-3 py-1 text-sm ${activities.categories.includes(category) ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/20" : "border-white/15"}`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </>
            )}

            {active === "resources" && (
              <>
                <textarea
                  value={resources.reliedOn}
                  onChange={(e) =>
                    setResources((p) => ({ ...p, reliedOn: e.target.value }))
                  }
                  placeholder="Notion, Canva, email list, social media, AI tools"
                  className="h-28 w-full rounded-lg border border-white/10 bg-[#0d1120] px-4 py-3"
                />
                <input
                  value={resources.partners}
                  onChange={(e) =>
                    setResources((p) => ({ ...p, partners: e.target.value }))
                  }
                  placeholder="Etsy, Gumroad, Instagram"
                  className="w-full rounded-lg border border-white/10 bg-[#0d1120] px-4 py-3"
                />
                <textarea
                  value={resources.missing}
                  onChange={(e) =>
                    setResources((p) => ({ ...p, missing: e.target.value }))
                  }
                  placeholder="Consistent traffic, a larger audience"
                  className="h-24 w-full rounded-lg border border-white/10 bg-[#0d1120] px-4 py-3"
                />
              </>
            )}
          </div>

          <button
            onClick={() => generateSection(active)}
            disabled={loadingMap[active]}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--brand-accent)] px-5 py-3 font-medium text-white hover:bg-[var(--brand-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Sparkles className="h-4 w-4" />
            {loadingMap[active]
              ? "Thinking like your advisor…"
              : "Get AI Insights →"}
          </button>

          {errors[active] && (
            <p className="mt-4 text-sm text-red-300">{errors[active]}</p>
          )}

          {(loadingMap[active] || insights[active]) && (
            <div className="mt-6 rounded-xl border border-[var(--brand-accent)]/40 bg-[#0f1324] p-5 shadow-[0_0_30px_var(--brand-accent-soft)]">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--brand-accent)]">
                  AI Insight Panel
                </p>
                {insights[active] && (
                  <button
                    onClick={() => copyText(insights[active])}
                    className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                )}
              </div>
              {loadingMap[active] ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-3 w-3/4 rounded bg-white/10" />
                  <div className="h-3 w-full rounded bg-white/10" />
                  <div className="h-3 w-5/6 rounded bg-white/10" />
                </div>
              ) : (
                <MarkdownLike text={insights[active]} />
              )}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-[#111426] p-6 md:p-8">
          <h3 className="text-2xl font-semibold">
            Full Business Model Blueprint
          </h3>
          <p className="mt-2 text-slate-300">
            Generate a complete, strategic snapshot from every section
            you&apos;ve filled in.
          </p>

          {!hasAnyInput && !fullBlueprint && (
            <p className="mt-4 rounded-lg border border-dashed border-white/20 bg-white/5 p-4 text-sm text-slate-300">
              Fill in at least one section to generate your Blueprint.
            </p>
          )}

          {hasAnyInput && (
            <button
              onClick={generateFullBlueprint}
              disabled={fullLoading}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--brand-accent)] px-5 py-3 font-medium text-white hover:bg-[var(--brand-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70 print:hidden"
            >
              {fullLoading
                ? "Thinking like your advisor…"
                : "Generate Full Business Model Blueprint"}
            </button>
          )}

          {errors.full && (
            <p className="mt-4 text-sm text-red-300">{errors.full}</p>
          )}

          {(fullLoading || fullBlueprint) && (
            <div className="mt-6 rounded-xl border border-[var(--brand-accent)]/40 bg-[#0f1324] p-6 shadow-[0_0_30px_var(--brand-accent-soft)] print:bg-white print:text-black">
              {fullLoading ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-3 w-2/3 rounded bg-white/10" />
                  <div className="h-3 w-full rounded bg-white/10" />
                  <div className="h-3 w-5/6 rounded bg-white/10" />
                  <div className="h-3 w-4/6 rounded bg-white/10" />
                </div>
              ) : (
                <>
                  <div className="mb-5 flex flex-wrap items-center gap-3 print:hidden">
                    <button
                      onClick={() => copyText(fullBlueprint)}
                      className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy All
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="rounded-md border border-white/20 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                    >
                      Download as PDF
                    </button>
                  </div>
                  <MarkdownLike text={fullBlueprint} />
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Briefcase,
  ChevronDown,
  Copy,
  Download,
  MapPin,
  Sparkles,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Persona = {
  name: string;
  archetypeTitle: string;
  age: string;
  locationType: string;
  occupation: string;
  goals: string[];
  painPoints: string[];
  motivations: string[];
  purchaseBehavior: string[];
  objections: string[];
  channels: string[];
  voiceSamples: string[];
  conversionRecommendation: string;
  fitScore: number;
  fitScoreReason: string;
  rawText?: string;
};

type PersonaState = {
  loading: boolean;
  loadingMessage: string;
  error: string | null;
  persona: Persona | null;
  openSections: Record<string, boolean>;
};


const BUSINESS_TYPES = [
  "Digital Products",
  "SaaS / Software",
  "Coaching / Consulting",
  "E-commerce / Physical Products",
  "Content / Media",
  "Community / Membership",
  "Service Business",
  "Mixed",
];

const PRICE_OPTIONS = [
  "Under $25",
  "$25–$99",
  "$100–$299",
  "$300–$999",
  "$1,000+",
  "Subscription under $50/mo",
  "Subscription $50+/mo",
];

const PERSONA_OPTIONS = [1, 2, 3];

const DEFAULT_SECTIONS = {
  goals: true,
  painPoints: true,
  motivations: true,
  purchaseBehavior: true,
  objections: true,
  channels: true,
  voiceSamples: true,
  conversionRecommendation: true,
};

function parsePersonaText(text: string): Persona {
  try {
    const parsed = JSON.parse(text) as Persona;
    return {
      ...parsed,
      goals: parsed.goals ?? [],
      painPoints: parsed.painPoints ?? [],
      motivations: parsed.motivations ?? [],
      purchaseBehavior: parsed.purchaseBehavior ?? [],
      objections: parsed.objections ?? [],
      channels: parsed.channels ?? [],
      voiceSamples: parsed.voiceSamples ?? [],
      fitScore: Number(parsed.fitScore ?? 3),
    };
  } catch {
    return {
      name: "Persona Output",
      archetypeTitle: "Research Composite",
      age: "Unknown",
      locationType: "Unknown",
      occupation: "Unknown",
      goals: [],
      painPoints: [],
      motivations: [],
      purchaseBehavior: [],
      objections: [],
      channels: [],
      voiceSamples: [],
      conversionRecommendation: "",
      fitScore: 3,
      fitScoreReason: "Unable to parse structured fit score.",
      rawText: text,
    };
  }
}

function avatarForIndex(index: number) {
  if (index % 3 === 0) {
    return <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#E8674A] via-[#F09D88] to-[#F7C8B7] shadow-[0_0_30px_rgba(232,103,74,0.3)]" />;
  }
  if (index % 3 === 1) {
    return <div className="h-14 w-14 bg-gradient-to-br from-[#3DB6C6] via-[#77D8D6] to-[#0EA5A8] [clip-path:polygon(50%_0%,100%_35%,82%_100%,18%_100%,0%_35%)] shadow-[0_0_30px_rgba(61,182,198,0.3)]" />;
  }
  return <div className="h-14 w-14 rounded-[35%_65%_55%_45%/40%_45%_55%_60%] bg-gradient-to-br from-[#E0B15B] via-[#F4D089] to-[#FFF1B8] shadow-[0_0_30px_rgba(224,177,91,0.3)]" />;
}


function SimpleMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-3 text-white/85">
      {content.split("\n").map((line, index) => {
        if (line.startsWith("### ")) {
          return (
            <h3 key={index} className="text-xl font-semibold text-[#ffd4cb]">
              {line.replace("### ", "")}
            </h3>
          );
        }

        if (line.startsWith("## ")) {
          return (
            <h2 key={index} className="text-2xl font-semibold text-[#ffd4cb]">
              {line.replace("## ", "")}
            </h2>
          );
        }

        if (line.startsWith("- ")) {
          return (
            <li key={index} className="ml-5 list-disc">
              {line.replace("- ", "")}
            </li>
          );
        }

        if (!line.trim()) {
          return <div key={index} className="h-2" />;
        }

        return (
          <p key={index} className="leading-relaxed text-white/80">
            {line}
          </p>
        );
      })}
    </div>
  );
}

export default function CustomerPersonaBuilderPage() {
  const [form, setForm] = useState({
    productService: "",
    problemSolved: "",
    businessType: BUSINESS_TYPES[0],
    priceRange: PRICE_OPTIONS[0],
    customerDescription: "",
    customerGoal: "",
    onlineChannels: "",
    personaCount: 2,
    additionalResearch: "",
  });

  const [personaStates, setPersonaStates] = useState<PersonaState[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [crossInsights, setCrossInsights] = useState("");
  const [crossLoading, setCrossLoading] = useState(false);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [strategyReport, setStrategyReport] = useState("");

  const formIsValid =
    form.productService.trim() &&
    form.problemSolved.trim() &&
    form.customerDescription.trim() &&
    form.customerGoal.trim() &&
    form.onlineChannels.trim();

  const completedPersonas = useMemo(
    () => personaStates.map((item) => item.persona).filter(Boolean) as Persona[],
    [personaStates]
  );

  async function buildPersonas() {
    if (!formIsValid) return;

    setStrategyReport("");
    setCrossInsights("");
    setGeneratedAt(new Date().toLocaleString());
    setGlobalLoading(true);

    const initial = Array.from({ length: form.personaCount }, () => ({
      loading: true,
      loadingMessage: "Researching your customer...",
      error: null,
      persona: null,
      openSections: { ...DEFAULT_SECTIONS },
    }));
    setPersonaStates(initial);

    const founderInputs = {
      productService: form.productService,
      problemSolved: form.problemSolved,
      businessType: form.businessType,
      priceRange: form.priceRange,
      customerDescription: form.customerDescription,
      customerGoal: form.customerGoal,
      onlineChannels: form.onlineChannels,
      additionalResearch: form.additionalResearch,
    };

    const requests = Array.from({ length: form.personaCount }, (_, i) => i).map(async (index) => {
      setPersonaStates((prev) =>
        prev.map((card, idx) =>
          idx === index ? { ...card, loadingMessage: "Building your persona..." } : card
        )
      );

      try {
        const response = await fetch("/api/persona-builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "persona",
            founderInputs,
            personaNumber: index + 1,
            totalPersonas: form.personaCount,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Could not generate persona");
        }

        const persona = parsePersonaText(data.text);

        setPersonaStates((prev) =>
          prev.map((card, idx) =>
            idx === index
              ? {
                  ...card,
                  loading: false,
                  loadingMessage: `Bringing ${persona.name} to life...`,
                  persona,
                }
              : card
          )
        );

        return persona;
      } catch {
        setPersonaStates((prev) =>
          prev.map((card, idx) =>
            idx === index
              ? {
                  ...card,
                  loading: false,
                  error: "Couldn't build this persona. Your customers are worth a retry.",
                }
              : card
          )
        );

        return null;
      }
    });

    const results = await Promise.all(requests);
    const successful = results.filter(Boolean) as Persona[];

    if (successful.length > 1) {
      setCrossLoading(true);
      try {
        const response = await fetch("/api/persona-builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "cross",
            founderInputs,
            allPersonas: successful,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Could not generate cross persona insights");
        }

        setCrossInsights(data.text ?? "");
      } catch {
        setCrossInsights("### Cross-Persona Intelligence\nWe couldn't compare personas right now. Please try again.");
      } finally {
        setCrossLoading(false);
      }
    }

    setGlobalLoading(false);
  }

  async function generateStrategyReport() {
    if (!completedPersonas.length) return;

    setStrategyLoading(true);

    try {
      const response = await fetch("/api/persona-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "strategy",
          founderInputs: {
            productService: form.productService,
            problemSolved: form.problemSolved,
            businessType: form.businessType,
            priceRange: form.priceRange,
            customerDescription: form.customerDescription,
            customerGoal: form.customerGoal,
            onlineChannels: form.onlineChannels,
            additionalResearch: form.additionalResearch,
          },
          strategyPayload: {
            founderInputs: form,
            personas: completedPersonas,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not generate strategy report");
      }

      setStrategyReport(data.text ?? "");
    } catch {
      setStrategyReport("### Persona Strategy Report\nCouldn't generate your strategy report yet. Please retry.");
    } finally {
      setStrategyLoading(false);
    }
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
  }

  function downloadAsPdf(title: string, content: string) {
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return;

    popup.document.write(`
      <html>
      <head><title>${title}</title></head>
      <body style="font-family: Arial, sans-serif; padding: 32px; line-height: 1.6;">
        <h1>${title}</h1>
        <pre style="white-space: pre-wrap; font-family: inherit;">${content.replace(/[<>&]/g, "")}</pre>
      </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  const gridCols = form.personaCount === 1 ? "lg:grid-cols-1" : form.personaCount === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3";

  return (
    <main className={cn("min-h-screen bg-[#0B0D1A] text-white px-4 py-10 md:px-8 font-[DM_Sans,system-ui,sans-serif]")}>
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#11152b] to-[#0b0d1a] p-6 md:p-10 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <h1 className="text-4xl md:text-5xl tracking-tight font-serif">Customer Persona Builder</h1>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E8674A]/40 bg-[#E8674A]/10 px-3 py-1 text-xs font-medium text-[#ffd4cb]">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#E8674A]" />
              AI + Live Research
            </div>
          </div>
          <p className="text-lg text-white/80">Know your customer better than they know themselves.</p>

          <motion.div layout className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-7">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-[#ffd4cb]">Your Business & Offer</h2>
                <Input placeholder='e.g., "Notion template bundles that help solo founders organize and launch their business"' value={form.productService} onChange={(e) => setForm((prev) => ({ ...prev, productService: e.target.value }))} />
                <Input placeholder="e.g., &quot;Founders feel overwhelmed and don't know where to start — my templates give them a system&quot;" value={form.problemSolved} onChange={(e) => setForm((prev) => ({ ...prev, problemSolved: e.target.value }))} />
                <Select value={form.businessType} onValueChange={(value) => setForm((prev) => ({ ...prev, businessType: value }))}>
                  <SelectTrigger><SelectValue placeholder="Business type" /></SelectTrigger>
                  <SelectContent>{BUSINESS_TYPES.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={form.priceRange} onValueChange={(value) => setForm((prev) => ({ ...prev, priceRange: value }))}>
                  <SelectTrigger><SelectValue placeholder="Price range" /></SelectTrigger>
                  <SelectContent>{PRICE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-4 border-t border-white/10 pt-8 md:border-l md:border-t-0 md:pl-8 md:pt-0">
                <h2 className="text-lg font-semibold text-[#ffd4cb]">What You Know About Your Customer</h2>
                <Textarea placeholder='e.g., "Early-stage solopreneurs, mostly women 28–42..."' value={form.customerDescription} onChange={(e) => setForm((prev) => ({ ...prev, customerDescription: e.target.value }))} className="min-h-24" />
                <Input placeholder='e.g., "Launch a profitable business without quitting their job first"' value={form.customerGoal} onChange={(e) => setForm((prev) => ({ ...prev, customerGoal: e.target.value }))} />
                <Input placeholder='e.g., "Instagram, Pinterest, LinkedIn, Reddit r/Entrepreneur"' value={form.onlineChannels} onChange={(e) => setForm((prev) => ({ ...prev, onlineChannels: e.target.value }))} />
                <Select value={String(form.personaCount)} onValueChange={(value) => setForm((prev) => ({ ...prev, personaCount: Number(value) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERSONA_OPTIONS.map((count) => (
                      <SelectItem key={count} value={String(count)}>{count} Persona{count > 1 ? "s" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea placeholder='e.g., "Research communities like r/Entrepreneur..."' value={form.additionalResearch} onChange={(e) => setForm((prev) => ({ ...prev, additionalResearch: e.target.value }))} className="min-h-24" />
              </div>
            </div>
            <div className="mt-8 flex flex-col items-start gap-3">
              <Button disabled={!formIsValid || globalLoading} onClick={buildPersonas} className="rounded-xl bg-[#E8674A] px-8 py-6 text-base font-semibold text-white hover:bg-[#f07c62]">Build My Personas →</Button>
              <p className="text-sm text-white/60">Personas are AI-generated composites for strategic planning. Validate with real customer research whenever possible.</p>
            </div>
          </motion.div>
        </section>

        {!personaStates.length && (
          <section className="rounded-2xl border border-dashed border-white/20 p-10 text-center text-white/60">
            Tell us about your offer and customer above — we&apos;ll handle the research.
          </section>
        )}

        {!!personaStates.length && (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-3xl font-serif">Your Customer Personas</h2>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
                {form.personaCount} personas · AI + Live Research · Generated {generatedAt}
              </span>
            </div>

            <div className={cn("grid gap-5 md:grid-cols-2", gridCols)}>
              {personaStates.map((state, index) => (
                <motion.article
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.12 }}
                  className="group rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] via-white/[0.03] to-transparent p-5 shadow-[0_15px_40px_rgba(0,0,0,0.35)] transition hover:-translate-y-1 hover:border-[#E8674A]/40 hover:shadow-[0_0_35px_rgba(232,103,74,0.2)]"
                >
                  {state.loading ? (
                    <div className="space-y-4 animate-pulse">
                      <div className="h-14 w-14 rounded-full bg-gradient-to-r from-[#E8674A]/40 via-[#f4a267]/50 to-[#E8674A]/40" />
                      <div className="h-5 w-2/3 rounded bg-[#f4a267]/30" />
                      <div className="h-4 w-1/2 rounded bg-[#f4a267]/20" />
                      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-[#f4a267]/10" />)}
                      <p className="text-sm text-[#ffd4cb]">{state.loadingMessage}</p>
                    </div>
                  ) : state.error ? (
                    <p className="text-sm text-[#ffb19d]">{state.error}</p>
                  ) : state.persona ? (
                    <>
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {avatarForIndex(index)}
                          <div>
                            <h3 className="text-2xl font-serif">{state.persona.name}</h3>
                            <p className="text-sm text-white/70">{state.persona.archetypeTitle}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mb-4 flex flex-wrap gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1"><User className="h-3.5 w-3.5" />{state.persona.age}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1"><MapPin className="h-3.5 w-3.5" />{state.persona.locationType}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1"><Briefcase className="h-3.5 w-3.5" />{state.persona.occupation}</span>
                      </div>

                      {[
                        ["🎯 Core Goals", "goals", state.persona.goals],
                        ["😤 Pain Points & Frustrations", "painPoints", state.persona.painPoints],
                        ["💡 Motivations & Drivers", "motivations", state.persona.motivations],
                        ["🛒 Purchase Behavior", "purchaseBehavior", state.persona.purchaseBehavior],
                        ["🚧 Objections & Hesitations", "objections", state.persona.objections],
                        ["📱 Preferred Channels & Content", "channels", state.persona.channels],
                        ["💬 Voice & Language", "voiceSamples", state.persona.voiceSamples],
                      ].map(([label, key, items]) => (
                        <div key={String(key)} className="mb-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                          <button
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold"
                            onClick={() =>
                              setPersonaStates((prev) =>
                                prev.map((card, idx) =>
                                  idx === index
                                    ? {
                                        ...card,
                                        openSections: {
                                          ...card.openSections,
                                          [String(key)]: !card.openSections[String(key)],
                                        },
                                      }
                                    : card
                                )
                              )
                            }
                          >
                            {label}
                            <ChevronDown className={cn("h-4 w-4 transition", state.openSections[String(key)] ? "rotate-180" : "")} />
                          </button>
                          <AnimatePresence initial={false}>
                            {state.openSections[String(key)] && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="px-4 pb-3 text-sm text-white/80"
                              >
                                <ul className="list-disc space-y-1 pl-4">
                                  {(items as string[]).map((item, i) => (
                                    <li key={i} className={key === "voiceSamples" ? "italic text-white/70" : ""}>{key === "voiceSamples" ? `\"${item}\"` : item}</li>
                                  ))}
                                </ul>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}

                      <div className="mb-4 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                        <button
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold"
                          onClick={() =>
                            setPersonaStates((prev) =>
                              prev.map((card, idx) =>
                                idx === index
                                  ? {
                                      ...card,
                                      openSections: {
                                        ...card.openSections,
                                        conversionRecommendation:
                                          !card.openSections.conversionRecommendation,
                                      },
                                    }
                                  : card
                              )
                            )
                          }
                        >
                          📣 How to Reach & Convert Them
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition",
                              state.openSections.conversionRecommendation ? "rotate-180" : ""
                            )}
                          />
                        </button>
                        <AnimatePresence initial={false}>
                          {state.openSections.conversionRecommendation && (
                            <motion.p
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="px-4 pb-3 text-sm text-white/80"
                            >
                              {state.persona.conversionRecommendation || state.persona.rawText}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-[#0f142a] p-3">
                        <div className="mb-2 flex items-center justify-between text-sm font-medium">
                          <span className="inline-flex items-center gap-1"><BadgeCheck className="h-4 w-4 text-[#E8674A]" />Offer Fit</span>
                          <span>{state.persona.fitScore}/5</span>
                        </div>
                        <div className="mb-2 flex gap-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <motion.span
                              key={i}
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: 1 }}
                              transition={{ delay: 0.15 + i * 0.08 }}
                              className={cn(
                                "h-2 flex-1 origin-left rounded-full",
                                i < state.persona.fitScore ? "bg-[#E8674A]" : "bg-white/15"
                              )}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-white/70">{state.persona.fitScoreReason}</p>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Button variant="outline" className="border-white/20 bg-transparent" onClick={() => copyText(JSON.stringify(state.persona, null, 2))}><Copy className="mr-2 h-4 w-4" />Copy Persona</Button>
                        <Button variant="outline" className="border-white/20 bg-transparent" onClick={() => downloadAsPdf(`${state.persona.name} Persona`, JSON.stringify(state.persona, null, 2))}><Download className="mr-2 h-4 w-4" />Download as PDF</Button>
                      </div>
                    </>
                  ) : null}
                </motion.article>
              ))}
            </div>
          </section>
        )}

        {form.personaCount > 1 && (crossLoading || !!crossInsights) && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
          >
            <h3 className="mb-3 flex items-center gap-2 text-2xl font-serif"><Sparkles className="h-5 w-5 text-[#E8674A]" />Cross-Persona Intelligence</h3>
            {crossLoading ? (
              <p className="text-white/70">Connecting the dots across your audience...</p>
            ) : (
              <article className="prose prose-invert max-w-none prose-headings:text-[#ffd4cb] prose-strong:text-white">
                <SimpleMarkdown content={crossInsights} />
              </article>
            )}
          </motion.section>
        )}

        {completedPersonas.length > 0 && !globalLoading && (
          <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <Button onClick={generateStrategyReport} disabled={strategyLoading} className="rounded-xl bg-[#E8674A] px-8 py-6 text-base font-semibold text-white hover:bg-[#f07c62]">Generate Persona Strategy Report →</Button>
            {strategyLoading && <p className="text-white/70">Building your founder-ready strategy report...</p>}
            {!!strategyReport && (
              <>
                <article className="prose prose-invert max-w-none prose-headings:text-[#ffd4cb] prose-strong:text-white">
                  <SimpleMarkdown content={strategyReport} />
                </article>
                <div className="flex gap-2">
                  <Button variant="outline" className="border-white/20 bg-transparent" onClick={() => copyText(strategyReport)}><Copy className="mr-2 h-4 w-4" />Copy</Button>
                  <Button variant="outline" className="border-white/20 bg-transparent" onClick={() => downloadAsPdf("Persona Strategy Report", strategyReport)}><Download className="mr-2 h-4 w-4" />Download as PDF</Button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

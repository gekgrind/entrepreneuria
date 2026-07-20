"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Clipboard,
  Copy,
  Edit3,
  Grid3X3,
  LayoutPanelLeft,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

type LengthOption =
  | "Short (8–10 slides)"
  | "Standard (12–14 slides)"
  | "Comprehensive (16–18 slides)";

type PitchInputs = {
  companyName: string;
  businessDescription: string;
  problem: string;
  solution: string;
  customer: string;
  differentiator: string;
  revenueModel: string;
  traction: string;
  market: string;
  competitors: string;
  purpose: string;
  length: LengthOption;
  tone: string;
  specificRequests: string;
};

type SlidePlan = {
  slideNumber: number;
  slideType: string;
  slideTitle: string;
  narrativeRole: string;
};

type SlideContent = {
  headline: string;
  bodyContent: string[] | string;
  layoutRecommendation: string;
  slideDesignSuggestion: string;
  slidePurpose: string;
  storytellingPrompt: string;
  copyNotes: string;
};

type SlideState = SlidePlan & {
  status: "loading" | "ready" | "error";
  content?: SlideContent;
  error?: string;
};

const defaultInputs: PitchInputs = {
  companyName: "",
  businessDescription: "",
  problem: "",
  solution: "",
  customer: "",
  differentiator: "",
  revenueModel: "",
  traction: "",
  market: "",
  competitors: "",
  purpose: "Investor Pitch",
  length: "Standard (12–14 slides)",
  tone: "Bold & Visionary",
  specificRequests: "",
};

const lengthTemplates: Record<LengthOption, string[]> = {
  "Short (8–10 slides)": [
    "Cover / Title Slide",
    "The Problem",
    "The Solution",
    "How It Works",
    "Market Opportunity",
    "Business Model",
    "Traction & Proof",
    "The Ask / Call to Action",
  ],
  "Standard (12–14 slides)": [
    "Cover / Title Slide",
    "The Hook",
    "The Problem",
    "The Solution",
    "How It Works / Product Overview",
    "Market Opportunity",
    "Competitive Landscape",
    "Business Model & Revenue",
    "Traction & Social Proof",
    "Go-To-Market Strategy",
    "The Team / Founder Story",
    "Financial Snapshot",
    "The Vision",
    "The Ask / Call to Action",
  ],
  "Comprehensive (16–18 slides)": [
    "Cover / Title Slide",
    "The Hook",
    "The Problem",
    "The Solution",
    "How It Works / Product Overview",
    "Market Opportunity",
    "Competitive Landscape",
    "Business Model & Revenue",
    "Traction & Social Proof",
    "Go-To-Market Strategy",
    "The Team / Founder Story",
    "Financial Snapshot",
    "The Vision",
    "The Ask / Call to Action",
    "Customer Personas / Who We Serve",
    "Roadmap",
    "Risk & Mitigation",
    "Appendix / Supporting Data",
  ],
};

function fallbackPlan(length: LengthOption): SlidePlan[] {
  return lengthTemplates[length].map((title, idx) => ({
    slideNumber: idx + 1,
    slideType: title,
    slideTitle: title,
    narrativeRole:
      "Support the founder's story arc with clear narrative progression.",
  }));
}

function parsePossiblyBrokenJson<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    const cleaned = input
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/, "");
    const first = Math.min(
      ...[cleaned.indexOf("{"), cleaned.indexOf("[")].filter((x) => x >= 0),
    );
    const last = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(cleaned.slice(first, last + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function bodyAsLines(bodyContent?: string[] | string): string[] {
  if (!bodyContent) return [];
  if (Array.isArray(bodyContent)) return bodyContent;
  return bodyContent
    .split("\n")
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

export default function PitchDeckCreatorPage() {
  const [inputs, setInputs] = useState<PitchInputs>(defaultInputs);
  const [isBuilding, setIsBuilding] = useState(false);
  const [slides, setSlides] = useState<SlideState[]>([]);
  const [overviewMode, setOverviewMode] = useState(false);
  const [copied, setCopied] = useState<"script" | "canva" | number | null>(
    null,
  );
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [regeneratingSlide, setRegeneratingSlide] = useState<number | null>(
    null,
  );

  const slideRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const totalSlides = slides.length;
  const completedSlides = slides.filter(
    (slide) => slide.status !== "loading",
  ).length;
  const progress = totalSlides
    ? Math.round((completedSlides / totalSlides) * 100)
    : 0;
  const ready = totalSlides > 0 && completedSlides === totalSlides;

  const metaTag = useMemo(() => {
    if (!slides.length) return null;
    return `${slides.length} slides · ${inputs.tone} · ${inputs.purpose}`;
  }, [slides.length, inputs.tone, inputs.purpose]);

  async function runPlanningCall(form: PitchInputs): Promise<SlidePlan[]> {
    try {
      const res = await fetch("/api/pitch-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "plan", inputs: form }),
      });
      const data = await res.json();
      const plan = Array.isArray(data.plan)
        ? data.plan
        : parsePossiblyBrokenJson<SlidePlan[]>(
            typeof data.plan === "string" ? data.plan : "",
          );
      if (Array.isArray(plan) && plan.length) {
        return plan.map((slide, index) => ({
          slideNumber: slide.slideNumber ?? index + 1,
          slideType:
            slide.slideType ?? slide.slideTitle ?? `Slide ${index + 1}`,
          slideTitle:
            slide.slideTitle ?? slide.slideType ?? `Slide ${index + 1}`,
          narrativeRole:
            slide.narrativeRole ??
            "Advance the story with clear founder-focused logic.",
        }));
      }
    } catch (error) {
      console.error(error);
    }
    return fallbackPlan(form.length);
  }

  async function buildDeck() {
    setOverviewMode(false);
    setIsBuilding(true);
    const plan = await runPlanningCall(inputs);

    setSlides(
      plan.map((slide) => ({
        ...slide,
        status: "loading",
      })),
    );

    const batchSize = 3;
    for (let i = 0; i < plan.length; i += batchSize) {
      const batch = plan.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map((slide) => generateSingleSlide(slide, plan.length, inputs)),
      );
    }

    setIsBuilding(false);
  }

  async function generateSingleSlide(
    slide: SlidePlan,
    total: number,
    form: PitchInputs,
    isRetry = false,
  ) {
    if (isRetry) {
      setRegeneratingSlide(slide.slideNumber);
      setSlides((current) =>
        current.map((item) =>
          item.slideNumber === slide.slideNumber
            ? { ...item, status: "loading", error: undefined }
            : item,
        ),
      );
    }

    try {
      const res = await fetch("/api/pitch-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "slide",
          inputs: form,
          slide,
          totalSlides: total,
        }),
      });
      const data = await res.json();
      const parsed =
        typeof data.slideContent === "object"
          ? (data.slideContent as SlideContent)
          : parsePossiblyBrokenJson<SlideContent>(
              String(data.slideContent ?? ""),
            );

      if (!res.ok || !parsed) {
        throw new Error(
          data.error ?? "This slide hit a snag. Retry or edit manually.",
        );
      }

      const normalized: SlideContent = {
        headline: parsed.headline || `${slide.slideTitle} that lands quickly`,
        bodyContent:
          Array.isArray(parsed.bodyContent) ||
          typeof parsed.bodyContent === "string"
            ? parsed.bodyContent
            : ["Add your core point here."],
        layoutRecommendation: parsed.layoutRecommendation || "Two Column",
        slideDesignSuggestion:
          parsed.slideDesignSuggestion ||
          "Use bold typography and high contrast to land one key message.",
        slidePurpose:
          parsed.slidePurpose ||
          "Clarify this part of the story arc and move the audience forward.",
        storytellingPrompt:
          parsed.storytellingPrompt ||
          "Lead with conviction, pause after your key line, and invite the audience to picture the outcome.",
        copyNotes:
          parsed.copyNotes ||
          "Copy is kept concise to maximize retention during live delivery.",
      };

      setSlides((current) =>
        current.map((item) =>
          item.slideNumber === slide.slideNumber
            ? {
                ...item,
                content: normalized,
                status: "ready",
                error: undefined,
              }
            : item,
        ),
      );
    } catch (error) {
      setSlides((current) =>
        current.map((item) =>
          item.slideNumber === slide.slideNumber
            ? {
                ...item,
                status: "error",
                error:
                  error instanceof Error
                    ? error.message
                    : "This slide hit a snag. Retry or edit manually.",
              }
            : item,
        ),
      );
    } finally {
      if (isRetry) {
        setRegeneratingSlide(null);
      }
    }
  }

  function updateInput<K extends keyof PitchInputs>(
    key: K,
    value: PitchInputs[K],
  ) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  function saveSlideEdits(slideNumber: number, headline: string, body: string) {
    setSlides((current) =>
      current.map((slide) =>
        slide.slideNumber === slideNumber
          ? {
              ...slide,
              status: "ready",
              content: {
                ...(slide.content as SlideContent),
                headline,
                bodyContent: body
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean),
              },
            }
          : slide,
      ),
    );
    setEditingSlide(null);
  }

  async function copySlide(slide: SlideState) {
    const lines = bodyAsLines(slide.content?.bodyContent);
    const block = [
      `Slide ${slide.slideNumber}: ${slide.slideTitle}`,
      `Headline: ${slide.content?.headline ?? ""}`,
      "Body:",
      ...lines.map((line) => `- ${line}`),
      `Layout: ${slide.content?.layoutRecommendation ?? ""}`,
      `Slide Purpose: ${slide.content?.slidePurpose ?? ""}`,
      `Storytelling Prompt: ${slide.content?.storytellingPrompt ?? ""}`,
      `Copy Notes: ${slide.content?.copyNotes ?? ""}`,
      `Design Suggestion: ${slide.content?.slideDesignSuggestion ?? ""}`,
    ].join("\n");

    await navigator.clipboard.writeText(block);
    setCopied(slide.slideNumber);
    setTimeout(() => setCopied(null), 1200);
  }

  async function copyFullScript() {
    const script = slides
      .map((slide) => {
        const lines = bodyAsLines(slide.content?.bodyContent);
        return [
          `========== Slide ${slide.slideNumber}: ${slide.slideTitle} ==========`,
          `Headline: ${slide.content?.headline ?? ""}`,
          `Body:\n${lines.map((line) => `• ${line}`).join("\n")}`,
          `Layout Recommendation: ${slide.content?.layoutRecommendation ?? ""}`,
          `Slide Purpose: ${slide.content?.slidePurpose ?? ""}`,
          `Storytelling Prompt: ${slide.content?.storytellingPrompt ?? ""}`,
          `Copy Notes: ${slide.content?.copyNotes ?? ""}`,
          `Design Suggestion: ${slide.content?.slideDesignSuggestion ?? ""}`,
        ].join("\n");
      })
      .join("\n\n");

    await navigator.clipboard.writeText(script);
    setCopied("script");
    setTimeout(() => setCopied(null), 1200);
  }

  async function copyCanvaGuide() {
    const guide = slides
      .map((slide) =>
        [
          `Slide ${slide.slideNumber}: ${slide.slideTitle}`,
          `1) Layout: ${slide.content?.layoutRecommendation ?? ""}`,
          `2) Headline to place: ${slide.content?.headline ?? ""}`,
          `3) On-slide content:`,
          ...bodyAsLines(slide.content?.bodyContent).map(
            (line) => `   - ${line}`,
          ),
          `4) Visual direction: ${slide.content?.slideDesignSuggestion ?? ""}`,
        ].join("\n"),
      )
      .join("\n\n");

    await navigator.clipboard.writeText(guide);
    setCopied("canva");
    setTimeout(() => setCopied(null), 1200);
  }

  async function downloadPdf() {
    const printable = slides
      .map((slide) => {
        const lines = bodyAsLines(slide.content?.bodyContent);
        return `
          <section class="page">
            <h2>Slide ${slide.slideNumber}: ${slide.slideTitle}</h2>
            <p><strong>Headline:</strong> ${slide.content?.headline ?? ""}</p>
            <p><strong>Body:</strong></p>
            <ul>${lines.map((line) => `<li>${line}</li>`).join("")}</ul>
            <p><strong>Layout:</strong> ${slide.content?.layoutRecommendation ?? ""}</p>
            <p><strong>Design Suggestion:</strong> ${slide.content?.slideDesignSuggestion ?? ""}</p>
          </section>
        `;
      })
      .join("");

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>${inputs.companyName || "Pitch Deck"} - Export</title>
          <style>
            @page { size: A4; margin: 22mm; }
            body { font-family: Inter, Arial, sans-serif; color: #111; margin: 0; }
            h1 { margin: 0 0 16px; }
            .page { page-break-after: always; }
            .page:last-child { page-break-after: auto; }
            h2 { margin: 0 0 10px; }
            p, li { font-size: 12px; line-height: 1.45; }
          </style>
        </head>
        <body>
          <h1>Pitch Deck Creator — ${inputs.companyName || "Founder Deck"}</h1>
          ${printable}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <main className="min-h-screen bg-[#081527] text-white pt-24 pb-20 px-4 md:px-8 font-[DM_Sans,Inter,sans-serif]">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/launch-pad/tools"
          className="text-sm text-white/70 hover:text-white mb-5 inline-block"
        >
          ← Back to Tools
        </Link>

        <header className="mb-10 relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f2138] to-[#081527] p-8 md:p-12">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(210,122,44,0.25),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(101,84,255,0.2),transparent_35%)]" />
          <div className="relative z-10 flex flex-wrap items-center gap-4 mb-4">
            <span className="story-badge">AI Story Engine</span>
          </div>
          <h1 className="text-4xl md:text-6xl mb-3 font-[Playfair_Display,DM_Serif_Display,serif]">
            Pitch Deck Creator
          </h1>
          <p className="text-white/80 text-lg">
            Your story, structured to sell.
          </p>
        </header>

        {!slides.length && (
          <section className="rounded-3xl border border-white/15 bg-[#0f2138]/80 p-6 md:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <p className="text-white/70 mb-5">
              Tell us your story above — we&apos;ll build the deck that tells
              it.
            </p>
            <div className="grid gap-6">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <h2 className="text-2xl mb-4 font-[Playfair_Display,DM_Serif_Display,serif]">
                  Your Business Story
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="What is your company or product name?">
                    <input
                      className="input"
                      value={inputs.companyName}
                      onChange={(e) =>
                        updateInput("companyName", e.target.value)
                      }
                      placeholder='e.g., "Entrepreneuria"'
                    />
                  </Field>
                  <Field label="What is the core problem you solve?">
                    <input
                      className="input"
                      value={inputs.problem}
                      onChange={(e) => updateInput("problem", e.target.value)}
                      placeholder="Solo founders are overwhelmed..."
                    />
                  </Field>
                  <Field label="What is your solution?">
                    <input
                      className="input"
                      value={inputs.solution}
                      onChange={(e) => updateInput("solution", e.target.value)}
                      placeholder="An all-in-one founder OS..."
                    />
                  </Field>
                  <Field label="Who is your target customer?">
                    <input
                      className="input"
                      value={inputs.customer}
                      onChange={(e) => updateInput("customer", e.target.value)}
                      placeholder="Solopreneurs and early-stage founders..."
                    />
                  </Field>
                  <Field
                    label="What is your unique differentiator or unfair advantage?"
                    className="md:col-span-2"
                  >
                    <input
                      className="input"
                      value={inputs.differentiator}
                      onChange={(e) =>
                        updateInput("differentiator", e.target.value)
                      }
                      placeholder="Built by a founder for founders..."
                    />
                  </Field>
                  <Field
                    label="Describe your business in 2–3 sentences"
                    className="md:col-span-2"
                  >
                    <textarea
                      className="input min-h-[110px]"
                      value={inputs.businessDescription}
                      onChange={(e) =>
                        updateInput("businessDescription", e.target.value)
                      }
                      placeholder="Entrepreneuria is a platform..."
                    />
                  </Field>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <h2 className="text-2xl mb-4 font-[Playfair_Display,DM_Serif_Display,serif]">
                  Business & Pitch Context
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="What is your primary revenue model?">
                    <input
                      className="input"
                      value={inputs.revenueModel}
                      onChange={(e) =>
                        updateInput("revenueModel", e.target.value)
                      }
                      placeholder="Digital product sales..."
                    />
                  </Field>
                  <Field label="Current traction, if any">
                    <input
                      className="input"
                      value={inputs.traction}
                      onChange={(e) => updateInput("traction", e.target.value)}
                      placeholder="Pre-launch"
                    />
                  </Field>
                  <Field label="What is your market size or opportunity?">
                    <input
                      className="input"
                      value={inputs.market}
                      onChange={(e) => updateInput("market", e.target.value)}
                      placeholder="57 million solopreneurs..."
                    />
                  </Field>
                  <Field label="Who are your main competitors?">
                    <input
                      className="input"
                      value={inputs.competitors}
                      onChange={(e) =>
                        updateInput("competitors", e.target.value)
                      }
                      placeholder="Notion, Blaze.ai..."
                    />
                  </Field>
                  <Field label="What is the purpose of this pitch?">
                    <select
                      className="input"
                      value={inputs.purpose}
                      onChange={(e) => updateInput("purpose", e.target.value)}
                    >
                      {[
                        "Investor Pitch",
                        "Brand Partnership Pitch",
                        "Press / Media Pitch",
                        "Client / Customer Pitch",
                        "Accelerator Application",
                        "Internal Strategy Deck",
                        "Grant Application",
                      ].map((purpose) => (
                        <option key={purpose} value={purpose}>
                          {purpose}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Pitch deck length">
                    <select
                      className="input"
                      value={inputs.length}
                      onChange={(e) =>
                        updateInput("length", e.target.value as LengthOption)
                      }
                    >
                      {Object.keys(lengthTemplates).map((length) => (
                        <option key={length} value={length}>
                          {length}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Tone & style">
                    <select
                      className="input"
                      value={inputs.tone}
                      onChange={(e) => updateInput("tone", e.target.value)}
                    >
                      {[
                        "Bold & Visionary",
                        "Data-Driven & Analytical",
                        "Warm & Story-Led",
                        "Punchy & Minimalist",
                        "Professional & Polished",
                      ].map((tone) => (
                        <option key={tone} value={tone}>
                          {tone}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Any specific slides, talking points, or stories you want included?"
                    className="md:col-span-2"
                  >
                    <textarea
                      className="input min-h-[100px]"
                      value={inputs.specificRequests}
                      onChange={(e) =>
                        updateInput("specificRequests", e.target.value)
                      }
                      placeholder="Include a founder story slide..."
                    />
                  </Field>
                </div>
              </div>

              <div>
                <button
                  className="cta"
                  onClick={buildDeck}
                  disabled={
                    isBuilding ||
                    !inputs.businessDescription ||
                    !inputs.problem ||
                    !inputs.solution
                  }
                >
                  {isBuilding ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Building your
                      deck...
                    </>
                  ) : (
                    <>Build My Pitch Deck →</>
                  )}
                </button>
                <p className="text-sm text-white/60 mt-3">
                  Your deck will be generated slide by slide. Each slide
                  includes AI copy, a layout recommendation, and a storytelling
                  coaching note.
                </p>
              </div>
            </div>
          </section>
        )}

        {!!slides.length && (
          <section className="space-y-6">
            <div className="rounded-2xl border border-white/15 bg-black/30 p-4 md:p-6 sticky top-20 z-30 backdrop-blur-lg">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                <div>
                  <h2 className="text-2xl font-[Playfair_Display,DM_Serif_Display,serif]">
                    Your Pitch Deck
                  </h2>
                  {metaTag && (
                    <p className="text-white/70 text-sm">{metaTag}</p>
                  )}
                </div>
                <button
                  className="mini-btn"
                  onClick={() => setOverviewMode((current) => !current)}
                >
                  {overviewMode ? (
                    <LayoutPanelLeft className="h-4 w-4" />
                  ) : (
                    <Grid3X3 className="h-4 w-4" />
                  )}
                  {overviewMode ? "Full Feed" : "Deck Overview"}
                </button>
              </div>

              <div className="mb-2 text-white/80 text-sm">
                Building your deck... slide{" "}
                {Math.min(completedSlides + (isBuilding ? 1 : 0), totalSlides)}{" "}
                of {totalSlides}
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#d27a2c] via-[#ff9a62] to-[#ffa6b1] transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {!overviewMode && (
              <div className="space-y-7">
                {slides.map((slide) => (
                  <SlideCard
                    key={slide.slideNumber}
                    slide={slide}
                    playfair="font-[Playfair_Display,DM_Serif_Display,serif]"
                    editingSlide={editingSlide}
                    onEdit={setEditingSlide}
                    onSaveEdits={saveSlideEdits}
                    onRetry={() =>
                      generateSingleSlide(slide, totalSlides, inputs, true)
                    }
                    onCopySlide={() => copySlide(slide)}
                    copied={copied === slide.slideNumber}
                    isRegenerating={regeneratingSlide === slide.slideNumber}
                    setRef={(el) => {
                      slideRefs.current[slide.slideNumber] = el;
                    }}
                  />
                ))}
              </div>
            )}

            {overviewMode && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 transition-all duration-500">
                {slides.map((slide) => (
                  <button
                    key={slide.slideNumber}
                    onClick={() => {
                      setOverviewMode(false);
                      setTimeout(
                        () =>
                          slideRefs.current[slide.slideNumber]?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          }),
                        150,
                      );
                    }}
                    className="text-left rounded-xl border border-white/15 bg-[#0f2138] p-3 hover:border-[#d27a2c]/60"
                  >
                    <div className="text-xs text-white/60 mb-2">
                      Slide {slide.slideNumber}
                    </div>
                    <div className="font-semibold mb-2">{slide.slideTitle}</div>
                    <div className="aspect-video rounded-lg bg-black/30 border border-white/10 p-3 text-sm text-white/75">
                      {slide.content?.headline ||
                        `Crafting your ${slide.slideType} slide...`}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {ready && (
              <div className="ready-panel rounded-3xl border border-[#d27a2c]/40 bg-gradient-to-br from-[#12263f] to-[#091829] p-6 md:p-8">
                <h3 className="text-3xl mb-2 font-[Playfair_Display,DM_Serif_Display,serif]">
                  Your Deck Is Ready
                </h3>
                <p className="text-white/75 mb-6">
                  {slides.length} slides generated · {inputs.tone} style ·{" "}
                  {inputs.purpose} pitch
                </p>
                <p className="text-[#ffcfbf] mb-6">
                  Your pitch deck is ready. Go make them believe.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button className="mini-btn" onClick={copyFullScript}>
                    {copied === "script" ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}{" "}
                    Copy Full Deck Script →
                  </button>
                  <button className="mini-btn" onClick={downloadPdf}>
                    Download as PDF →
                  </button>
                  <button
                    className="mini-btn"
                    title="Step-by-step design instructions for building this deck in Canva"
                    onClick={copyCanvaGuide}
                  >
                    {copied === "canva" ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Clipboard className="w-4 h-4" />
                    )}{" "}
                    Copy Canva Build Guide →
                  </button>
                  <button className="mini-btn" onClick={buildDeck}>
                    <RefreshCw className="w-4 h-4" /> Rebuild Full Deck
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(5, 7, 16, 0.65);
          color: #fff;
          padding: 0.75rem 0.85rem;
          outline: none;
        }
        .input:focus {
          border-color: rgba(210,122,44, 0.9);
          box-shadow: 0 0 0 2px rgba(210,122,44, 0.25);
        }
        .cta {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          border-radius: 14px;
          background: linear-gradient(120deg, #d27a2c, #f58a67);
          color: white;
          font-weight: 700;
          padding: 0.95rem 1.3rem;
          border: none;
        }
        .cta:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .mini-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
          font-size: 0.9rem;
          padding: 0.58rem 0.78rem;
        }
        .story-badge {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(210,122,44, 0.45);
          border-radius: 999px;
          background: rgba(210,122,44, 0.1);
          color: #ffd8cb;
          font-size: 0.82rem;
          letter-spacing: 0.02em;
          padding: 0.4rem 0.8rem;
        }
        .story-badge::after {
          content: "";
          position: absolute;
          top: 0;
          left: -45%;
          width: 38%;
          height: 100%;
          transform: skewX(-20deg);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.75),
            transparent
          );
          animation: shimmer 2.8s infinite;
        }
        @keyframes shimmer {
          0% {
            left: -45%;
          }
          100% {
            left: 145%;
          }
        }
      `}</style>
    </main>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid gap-2 ${className}`}>
      <span className="text-sm text-white/80">{label}</span>
      {children}
    </label>
  );
}

function SlideCard({
  slide,
  playfair,
  editingSlide,
  onEdit,
  onSaveEdits,
  onRetry,
  onCopySlide,
  copied,
  isRegenerating,
  setRef,
}: {
  slide: SlideState;
  playfair: string;
  editingSlide: number | null;
  onEdit: (num: number | null) => void;
  onSaveEdits: (slideNumber: number, headline: string, body: string) => void;
  onRetry: () => void;
  onCopySlide: () => void;
  copied: boolean;
  isRegenerating: boolean;
  setRef: (el: HTMLDivElement | null) => void;
}) {
  const [headlineDraft, setHeadlineDraft] = useState(
    slide.content?.headline ?? "",
  );
  const [bodyDraft, setBodyDraft] = useState(
    bodyAsLines(slide.content?.bodyContent).join("\n"),
  );

  const inEdit = editingSlide === slide.slideNumber;
  const loadingText = `Crafting your ${slide.slideType} slide...`;
  const lines = bodyAsLines(slide.content?.bodyContent);

  return (
    <article
      ref={setRef}
      className="slide-card relative rounded-3xl border border-white/15 bg-[#101528] p-4 md:p-5"
    >
      {isRegenerating && (
        <div className="absolute inset-0 rounded-3xl bg-black/45 backdrop-blur-[1px] regen-overlay z-20" />
      )}

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <div
            className={`aspect-video rounded-2xl border border-white/15 p-4 md:p-6 relative overflow-hidden ${slide.status === "loading" ? "skeleton" : ""}`}
          >
            <div className="absolute inset-0 opacity-80 pointer-events-none bg-[radial-gradient(circle_at_25%_20%,rgba(210,122,44,0.22),transparent_45%),radial-gradient(circle_at_95%_95%,rgba(73,89,255,0.2),transparent_40%)]" />
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(160deg,rgba(0,0,0,0.05),rgba(0,0,0,0.45))]" />

            <div className="relative z-10 h-full flex flex-col">
              <div className="flex items-start justify-between">
                <span className="text-xs px-2 py-1 rounded-full border border-white/20 bg-black/30 text-white/70">
                  Slide {slide.slideNumber}
                </span>
                {slide.content?.layoutRecommendation && (
                  <span className="text-xs px-2 py-1 rounded-full border border-[#d27a2c]/50 bg-[#d27a2c]/15 text-[#ffd4c8] animate-in fade-in zoom-in-95 duration-300">
                    {slide.content.layoutRecommendation}
                  </span>
                )}
              </div>
              <h3 className={`${playfair} text-2xl md:text-3xl mt-4 mb-1`}>
                {slide.slideTitle}
              </h3>
              {inEdit ? (
                <div className="space-y-2">
                  <input
                    className="input"
                    value={headlineDraft}
                    onChange={(e) => setHeadlineDraft(e.target.value)}
                  />
                  <textarea
                    className="input min-h-[120px]"
                    value={bodyDraft}
                    onChange={(e) => setBodyDraft(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      className="mini-btn"
                      onClick={() =>
                        onSaveEdits(slide.slideNumber, headlineDraft, bodyDraft)
                      }
                    >
                      Save
                    </button>
                    <button className="mini-btn" onClick={() => onEdit(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xl md:text-2xl font-semibold mb-3 text-white">
                    {slide.content?.headline || loadingText}
                  </p>
                  <div className="text-white/85 text-sm md:text-base space-y-1">
                    {slide.status === "loading" && (
                      <p className="italic text-white/60">{loadingText}</p>
                    )}
                    {slide.status === "error" && (
                      <p className="text-red-300">
                        This slide hit a snag. Retry or edit manually.
                      </p>
                    )}
                    {slide.status === "ready" && (
                      <ul className="list-disc pl-5 space-y-1">
                        {lines.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <aside className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#0b0f1e] p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#d27a2c]" /> Coaching Panel
          </h4>
          <div className="space-y-3 text-sm">
            <CoachingItem
              emoji="🎯"
              title="Slide Purpose"
              text={slide.content?.slidePurpose}
            />
            <CoachingItem
              emoji="🗣️"
              title="Storytelling Prompt"
              text={slide.content?.storytellingPrompt}
            />
            <CoachingItem
              emoji="✍️"
              title="Copy Notes"
              text={slide.content?.copyNotes}
            />
            <CoachingItem
              emoji="🎨"
              title="Design Suggestion"
              text={slide.content?.slideDesignSuggestion}
            />
          </div>
          <div className="flex flex-wrap gap-2 mt-5">
            <button
              className="mini-btn"
              onClick={() => onEdit(inEdit ? null : slide.slideNumber)}
            >
              <Edit3 className="w-4 h-4" /> Edit
            </button>
            <button className="mini-btn" onClick={onRetry}>
              <RefreshCw className="w-4 h-4" /> Rewriting this slide...
            </button>
            <button className="mini-btn" onClick={onCopySlide}>
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}{" "}
              Copy Slide
            </button>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .slide-card {
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
          animation: riseIn 0.45s ease both;
        }
        @keyframes riseIn {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .skeleton::before,
        .regen-overlay::before {
          content: "";
          position: absolute;
          inset: -40% -20%;
          background: linear-gradient(
            110deg,
            transparent 15%,
            rgba(210,122,44, 0.35) 45%,
            rgba(247, 203, 114, 0.35) 50%,
            transparent 70%
          );
          animation: sweep 2.1s linear infinite;
        }
        @keyframes sweep {
          0% {
            transform: translateX(-45%);
          }
          100% {
            transform: translateX(45%);
          }
        }
      `}</style>
    </article>
  );
}

function CoachingItem({
  emoji,
  title,
  text,
}: {
  emoji: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="font-medium text-white/90 mb-1">
        {emoji} {title}
      </div>
      <p className="text-white/70">{text || "Loading coaching guidance..."}</p>
    </div>
  );
}

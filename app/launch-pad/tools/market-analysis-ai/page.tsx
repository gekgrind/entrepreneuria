"use client"

import { useMemo, useRef, useState } from "react"
import { Globe2, Crosshair, TrendingUp, Sparkles, RefreshCcw, Copy, FileText, Download } from "lucide-react"

type PillarId =
  | "market_landscape"
  | "competitor_intelligence"
  | "customer_demand_signals"
  | "hidden_opportunities"

type Pillar = {
  id: PillarId
  title: string
  subtitle: string
  loadingMessage: string
  icon: React.ComponentType<{ className?: string }>
}

type PillarState = {
  result: string
  loading: boolean
  error: string | null
}

const PILLARS: Pillar[] = [
  {
    id: "market_landscape",
    title: "Market Landscape",
    subtitle: "Market size, growth trends, and industry context",
    loadingMessage: "Researching the market...",
    icon: Globe2,
  },
  {
    id: "competitor_intelligence",
    title: "Competitor Intelligence",
    subtitle: "Who's winning, how they win, and where they're weak",
    loadingMessage: "Profiling your competitors...",
    icon: Crosshair,
  },
  {
    id: "customer_demand_signals",
    title: "Customer Demand Signals",
    subtitle: "What real customers are searching for, saying, and wanting",
    loadingMessage: "Reading demand signals...",
    icon: TrendingUp,
  },
  {
    id: "hidden_opportunities",
    title: "Hidden Opportunities",
    subtitle: "Gaps, niches, and strategic angles hiding in plain sight",
    loadingMessage: "Scanning for opportunities...",
    icon: Sparkles,
  },
]

const initialPillarState: Record<PillarId, PillarState> = {
  market_landscape: { result: "", loading: false, error: null },
  competitor_intelligence: { result: "", loading: false, error: null },
  customer_demand_signals: { result: "", loading: false, error: null },
  hidden_opportunities: { result: "", loading: false, error: null },
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split("\n")
  const blocks: Array<{ type: string; text: string }> = []

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed) {
      blocks.push({ type: "spacer", text: "" })
      return
    }

    if (trimmed.startsWith("### ")) {
      blocks.push({ type: "h3", text: trimmed.replace(/^###\s+/, "") })
      return
    }

    if (trimmed.startsWith("## ")) {
      blocks.push({ type: "h2", text: trimmed.replace(/^##\s+/, "") })
      return
    }

    if (trimmed.startsWith("# ")) {
      blocks.push({ type: "h1", text: trimmed.replace(/^#\s+/, "") })
      return
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      blocks.push({ type: "li", text: trimmed.replace(/^([-*]|\d+\.)\s+/, "") })
      return
    }

    blocks.push({ type: "p", text: trimmed })
  })

  return (
    <div className="space-y-2 text-sm leading-7 text-[#E7E9F4]">
      {blocks.map((block, index) => {
        if (block.type === "spacer") return <div key={index} className="h-2" />
        if (block.type === "h1") return <h2 key={index} className="text-lg font-semibold text-white">{block.text}</h2>
        if (block.type === "h2") return <h3 key={index} className="text-base font-semibold text-white">{block.text}</h3>
        if (block.type === "h3") return <h4 key={index} className="text-sm font-semibold text-white">{block.text}</h4>
        if (block.type === "li") return <p key={index} className="pl-4 before:mr-2 before:text-[#E8674A] before:content-['•']">{block.text}</p>
        return <p key={index}>{block.text}</p>
      })}
    </div>
  )
}

export default function MarketAnalysisAIPage() {
  const [businessDescription, setBusinessDescription] = useState("")
  const [targetCustomer, setTargetCustomer] = useState("")
  const [competitors, setCompetitors] = useState("")
  const [analysisStarted, setAnalysisStarted] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [pillarStates, setPillarStates] = useState(initialPillarState)
  const [fullReport, setFullReport] = useState("")
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [fullReportError, setFullReportError] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)

  const inputRef = useRef<HTMLDivElement | null>(null)
  const resultsRef = useRef<HTMLDivElement | null>(null)

  const allPillarsComplete = useMemo(
    () => PILLARS.every((pillar) => pillarStates[pillar.id].result),
    [pillarStates],
  )

  async function callPillar(pillarId: PillarId) {
    setPillarStates((prev) => ({
      ...prev,
      [pillarId]: { ...prev[pillarId], loading: true, error: null },
    }))

    try {
      const response = await fetch("/api/market-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "pillar",
          pillarId,
          businessDescription,
          targetCustomer,
          competitors,
        }),
      })

      const payload = (await response.json()) as { result?: string; error?: string }

      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "Unable to generate analysis.")
      }

      setPillarStates((prev) => ({
        ...prev,
        [pillarId]: { result: payload.result || "", loading: false, error: null },
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong."
      setPillarStates((prev) => ({
        ...prev,
        [pillarId]: {
          ...prev[pillarId],
          loading: false,
          error: "Something went wrong. The market's not going anywhere — try again.",
        },
      }))
      console.error(message)
    }
  }

  async function runFullAnalysis() {
    if (!businessDescription.trim()) return

    setAnalysisStarted(true)
    setGeneratedAt(new Date().toLocaleString())
    setFullReport("")
    setFullReportError(null)

    setPillarStates({
      market_landscape: { result: "", loading: true, error: null },
      competitor_intelligence: { result: "", loading: true, error: null },
      customer_demand_signals: { result: "", loading: true, error: null },
      hidden_opportunities: { result: "", loading: true, error: null },
    })

    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })

    await Promise.allSettled(PILLARS.map((pillar) => callPillar(pillar.id)))
  }

  async function generateFullReport() {
    setIsGeneratingReport(true)
    setFullReportError(null)

    try {
      const response = await fetch("/api/market-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "full_report",
          businessDescription,
          targetCustomer,
          competitors,
          pillars: {
            market_landscape: pillarStates.market_landscape.result,
            competitor_intelligence: pillarStates.competitor_intelligence.result,
            customer_demand_signals: pillarStates.customer_demand_signals.result,
            hidden_opportunities: pillarStates.hidden_opportunities.result,
          },
        }),
      })

      const payload = (await response.json()) as { result?: string; error?: string }

      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "Unable to generate full report.")
      }

      setFullReport(payload.result)
      requestAnimationFrame(() => {
        document.getElementById("full-market-report")?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    } catch (error) {
      setFullReportError("Something went wrong. The market's not going anywhere — try again.")
      console.error(error)
    } finally {
      setIsGeneratingReport(false)
    }
  }

  async function copyText(text: string, label: string) {
    await navigator.clipboard.writeText(text)
    setCopyStatus(`${label} copied`)
    window.setTimeout(() => setCopyStatus(null), 1600)
  }

  return (
    <main className="min-h-screen bg-[#0B0D1A] text-white px-4 pb-16 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl pt-12" ref={inputRef}>
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#12162B] to-[#0B0D1A] p-6 shadow-[0_0_80px_rgba(232,103,74,0.1)] sm:p-10">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl sm:text-5xl">Market Analysis AI</h1>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300"></span>
              </span>
              Live AI Research
            </span>
          </div>
          <p className="mb-8 text-lg text-[#D6DAF0]">Uncover your market. Outmaneuver your competition.</p>

          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#D6DAF0]">What is your business, product, or market?</span>
              <textarea
                value={businessDescription}
                onChange={(event) => setBusinessDescription(event.target.value)}
                placeholder="e.g., AI-powered Notion templates for solo founders"
                className="h-24 rounded-xl border border-white/10 bg-[#0F1328] px-4 py-3 text-sm text-white outline-none ring-[#E8674A] placeholder:text-[#8088AB] focus:ring-2"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#D6DAF0]">Who is your target customer? (optional)</span>
              <input
                value={targetCustomer}
                onChange={(event) => setTargetCustomer(event.target.value)}
                placeholder="e.g., Early-stage solopreneurs, age 25–40, bootstrapped"
                className="rounded-xl border border-white/10 bg-[#0F1328] px-4 py-3 text-sm text-white outline-none ring-[#E8674A] placeholder:text-[#8088AB] focus:ring-2"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#D6DAF0]">Who are your main competitors or comparable brands? (optional)</span>
              <input
                value={competitors}
                onChange={(event) => setCompetitors(event.target.value)}
                placeholder="e.g., Notion itself, Thomas Frank's templates, Easlo"
                className="rounded-xl border border-white/10 bg-[#0F1328] px-4 py-3 text-sm text-white outline-none ring-[#E8674A] placeholder:text-[#8088AB] focus:ring-2"
              />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={runFullAnalysis}
              disabled={!businessDescription.trim()}
              className="rounded-xl bg-[#E8674A] px-8 py-3 text-base font-semibold text-white transition hover:bg-[#f37658] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Run Market Analysis →
            </button>
            {copyStatus && <span className="text-xs text-emerald-300">{copyStatus}</span>}
          </div>
          <p className="mt-3 text-xs text-[#A0A8C7]">
            Powered by Claude AI + live web search. Results are AI-generated for strategic exploration, not financial advice.
          </p>
        </section>

        {analysisStarted && (
          <div className="sticky top-[calc(var(--header-height)+14px)] z-20 mt-5 rounded-xl border border-white/10 bg-[#0F1328]/95 px-4 py-3 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex flex-wrap gap-2 text-[#D6DAF0]">
                <span className="rounded-full border border-white/15 px-3 py-1">Market: {businessDescription || "Not set"}</span>
                {targetCustomer && <span className="rounded-full border border-white/15 px-3 py-1">Customer: {targetCustomer}</span>}
                {competitors && <span className="rounded-full border border-white/15 px-3 py-1">Competitors: {competitors}</span>}
              </div>
              <button onClick={() => inputRef.current?.scrollIntoView({ behavior: "smooth" })} className="text-[#E8674A] underline underline-offset-4">
                Edit
              </button>
            </div>
          </div>
        )}

        <section ref={resultsRef} className="mt-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-serif text-3xl">Your Market Intelligence</h2>
              {generatedAt && <p className="mt-1 text-xs text-[#9CA5C7]">Generated {generatedAt}</p>}
            </div>
          </div>

          {!analysisStarted && (
            <div className="rounded-2xl border border-dashed border-white/20 bg-[#101529]/50 px-6 py-12 text-center text-[#C5CBE2]">
              Enter your business above to unlock your market intelligence.
            </div>
          )}

          {analysisStarted && (
            <div className="grid gap-5 md:grid-cols-2">
              {PILLARS.map((pillar, index) => {
                const state = pillarStates[pillar.id]
                const Icon = pillar.icon

                return (
                  <article
                    key={pillar.id}
                    className={cx(
                      "rounded-2xl border border-white/10 bg-[#101529] p-5 shadow-[0_0_24px_rgba(76,89,136,0.25)]",
                      "animate-in fade-in slide-in-from-bottom-4 duration-500",
                    )}
                    style={{ animationDelay: `${index * 120}ms` }}
                  >
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5 text-[#E8674A]" />
                          <h3 className="text-lg font-semibold text-white">{pillar.title}</h3>
                        </div>
                        <p className="mt-1 text-xs text-[#AEB6D7]">{pillar.subtitle}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => callPillar(pillar.id)}
                          className="rounded-lg border border-white/15 p-2 text-[#D6DAF0] hover:text-white"
                          aria-label={`Regenerate ${pillar.title}`}
                        >
                          <RefreshCcw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => copyText(state.result, pillar.title)}
                          disabled={!state.result}
                          className="rounded-lg border border-white/15 p-2 text-[#D6DAF0] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Copy ${pillar.title}`}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {state.loading && (
                      <div>
                        <p className="mb-3 text-sm text-[#D6DAF0]">{pillar.loadingMessage}</p>
                        <div className="space-y-2">
                          <div className="h-3 w-3/4 animate-pulse rounded bg-white/10" />
                          <div className="h-3 w-full animate-pulse rounded bg-white/10" />
                          <div className="h-3 w-5/6 animate-pulse rounded bg-white/10" />
                          <div className="h-3 w-2/3 animate-pulse rounded bg-white/10" />
                        </div>
                      </div>
                    )}

                    {!state.loading && state.error && (
                      <div className="rounded-xl border border-[#E8674A]/40 bg-[#E8674A]/10 p-4 text-sm text-[#FFD5CC]">
                        <p>{state.error}</p>
                        <button
                          onClick={() => callPillar(pillar.id)}
                          className="mt-3 text-xs font-semibold text-[#FFD5CC] underline"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {!state.loading && !state.error && state.result && <SimpleMarkdown content={state.result} />}
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {allPillarsComplete && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={generateFullReport}
              disabled={isGeneratingReport}
              className="animate-in fade-in slide-in-from-bottom-4 rounded-xl border border-[#E8674A] bg-[#E8674A] px-7 py-3 font-semibold text-white transition hover:bg-[#f37658] disabled:opacity-50"
            >
              {isGeneratingReport ? "Generating full report..." : "Generate Full Market Report →"}
            </button>
          </div>
        )}

        {(fullReport || fullReportError) && (
          <section id="full-market-report" className="mt-8 rounded-2xl border border-white/20 bg-[#0E1224] p-6 shadow-[0_0_40px_rgba(232,103,74,0.25)] print:bg-white print:text-black">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#E8674A] print:text-black" />
                <h3 className="font-serif text-2xl">Full Market Report</h3>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button
                  onClick={() => copyText(fullReport, "Full report")}
                  disabled={!fullReport}
                  className="rounded-lg border border-white/20 px-3 py-2 text-sm text-[#D6DAF0] hover:text-white disabled:opacity-40"
                >
                  Copy Full Report
                </button>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm text-[#D6DAF0] hover:text-white"
                >
                  <Download className="h-4 w-4" />
                  Download as PDF
                </button>
              </div>
            </div>

            {fullReportError && (
              <div className="rounded-xl border border-[#E8674A]/40 bg-[#E8674A]/10 p-4 text-sm text-[#FFD5CC]">
                {fullReportError}
              </div>
            )}

            {fullReport && <SimpleMarkdown content={fullReport} />}
          </section>
        )}
      </div>
    </main>
  )
}

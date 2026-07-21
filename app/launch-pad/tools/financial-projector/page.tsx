"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  Copy,
  Info,
  Loader2,
  RefreshCw,
  Scale,
  TrendingUp,
} from "lucide-react"

type RevenueModel =
  | "One-Time Product Sale"
  | "Monthly Subscription"
  | "Annual Subscription"
  | "Service Retainer"
  | "Course/Cohort"
  | "Mixed Model"

type BusinessStage =
  | "Pre-Revenue"
  | "Just Launched (0–3 months)"
  | "Early Traction (3–12 months)"
  | "Growing (1–2 years)"

type Timeframe = "3 Months" | "6 Months" | "12 Months" | "24 Months"
type GrowthScenario =
  | "Conservative (slow, steady growth)"
  | "Moderate (realistic optimism)"
  | "Aggressive (fast growth assumptions)"

type Inputs = {
  product: string
  revenueModel: RevenueModel
  businessStage: BusinessStage
  primaryPrice: string
  subscriptionMonthlyPrice: string
  monthlySales: string
  monthlyCustomerAdds: string
  monthlyFixedCosts: string
  variableCostPerSale: string
  startupCosts: string
  monthlyMarketingSpend: string
  timeframe: Timeframe
  growthScenario: GrowthScenario
  additionalContext: string
}

type RevenueRow = {
  month: string
  newCustomers: number
  totalCustomers: number
  monthlyRevenue: number
  cumulativeRevenue: number
}

type CashflowRow = {
  month: string
  revenue: number
  fixedCosts: number
  variableCosts: number
  marketingSpend: number
  netCashFlow: number
  cumulativeCashPosition: number
}

const REQUIRED_FIELDS: (keyof Inputs)[] = [
  "product",
  "revenueModel",
  "businessStage",
  "primaryPrice",
  "monthlySales",
  "monthlyCustomerAdds",
  "monthlyFixedCosts",
  "variableCostPerSale",
  "startupCosts",
  "monthlyMarketingSpend",
  "timeframe",
  "growthScenario",
]

const DEFAULT_INPUTS: Inputs = {
  product: "",
  revenueModel: "One-Time Product Sale",
  businessStage: "Pre-Revenue",
  primaryPrice: "",
  subscriptionMonthlyPrice: "",
  monthlySales: "",
  monthlyCustomerAdds: "",
  monthlyFixedCosts: "",
  variableCostPerSale: "",
  startupCosts: "",
  monthlyMarketingSpend: "",
  timeframe: "12 Months",
  growthScenario: "Moderate (realistic optimism)",
  additionalContext: "",
}

const timeframeToMonths: Record<Timeframe, number> = {
  "3 Months": 3,
  "6 Months": 6,
  "12 Months": 12,
  "24 Months": 24,
}

const growthRange: Record<GrowthScenario, [number, number]> = {
  "Conservative (slow, steady growth)": [0.03, 0.05],
  "Moderate (realistic optimism)": [0.07, 0.1],
  "Aggressive (fast growth assumptions)": [0.12, 0.18],
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

const numberFmt = new Intl.NumberFormat("en-US")

function formatCurrency(value: number) {
  return currency.format(Number.isFinite(value) ? value : 0)
}

function asNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function PanelSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[#E8EAF6]">{label}</p>
      <div className="h-4 rounded bg-white/10 animate-pulse" />
      <div className="h-4 rounded bg-white/10 animate-pulse" />
      <div className="h-4 rounded bg-white/10 animate-pulse w-3/4" />
    </div>
  )
}


function MarkdownBlock({ content }: { content: string }) {
  return <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm leading-7">{content}</div>
}

function NumericKPI({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  const target = useMemo(() => Math.round(value), [value])
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const duration = 700
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      setShown(Math.round(target * progress))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target])

  return (
    <div
      className={`rounded-xl border p-4 ${accent ? "border-[#d27a2c]/60 bg-[#d27a2c]/10" : "border-white/15 bg-white/5"}`}
    >
      <div className="font-mono text-2xl text-white">{formatCurrency(shown)}</div>
      <div className="text-xs text-[#BBC3E1] mt-1">{label}</div>
    </div>
  )
}

export default function FinancialProjectorPage() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS)
  const [errors, setErrors] = useState<Partial<Record<keyof Inputs, string>>>({})
  const [generatedAt, setGeneratedAt] = useState<string>("")

  const [revenueRows, setRevenueRows] = useState<RevenueRow[]>([])
  const [cashflowRows, setCashflowRows] = useState<CashflowRow[]>([])
  const [breakEvenData, setBreakEvenData] = useState<Record<string, number>>({})

  const [assumptions, setAssumptions] = useState("")
  const [revenueInsight, setRevenueInsight] = useState("")
  const [breakEvenInsight, setBreakEvenInsight] = useState("")
  const [cashflowInsight, setCashflowInsight] = useState("")
  const [fullSummary, setFullSummary] = useState("")

  const [loadingAssumptions, setLoadingAssumptions] = useState(false)
  const [loadingRevenue, setLoadingRevenue] = useState(false)
  const [loadingBreakEven, setLoadingBreakEven] = useState(false)
  const [loadingCashflow, setLoadingCashflow] = useState(false)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const hasResults = revenueRows.length > 0
  const allInsightsReady = Boolean(revenueInsight && breakEvenInsight && cashflowInsight)

  const revenueThreshold = useMemo(() => {
    const max = revenueRows.reduce((m, row) => Math.max(m, row.monthlyRevenue), 0)
    if (max >= 10000) return 10000
    if (max >= 5000) return 5000
    return 1000
  }, [revenueRows])

  const firstThresholdMonth = useMemo(
    () => revenueRows.findIndex((row) => row.monthlyRevenue >= revenueThreshold),
    [revenueRows, revenueThreshold],
  )

  const firstNegativeCashMonth = useMemo(
    () => cashflowRows.findIndex((row) => row.cumulativeCashPosition < 0),
    [cashflowRows],
  )

  const validateInputs = () => {
    const nextErrors: Partial<Record<keyof Inputs, string>> = {}

    for (const field of REQUIRED_FIELDS) {
      if (!inputs[field]?.toString().trim()) {
        nextErrors[field] = "This field is needed to run your projections."
      }
    }

    const numericFields: (keyof Inputs)[] = [
      "primaryPrice",
      "subscriptionMonthlyPrice",
      "monthlySales",
      "monthlyCustomerAdds",
      "monthlyFixedCosts",
      "variableCostPerSale",
      "startupCosts",
      "monthlyMarketingSpend",
    ]

    for (const field of numericFields) {
      if (!inputs[field]) continue
      const value = Number(inputs[field])
      if (Number.isNaN(value)) {
        nextErrors[field] = "Please enter a valid number."
      }
      if (value < 0) {
        nextErrors[field] = "Negative values are not allowed."
      }
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const calculateRevenueRows = (values: Inputs) => {
    const months = timeframeToMonths[values.timeframe]
    const [minGrowth, maxGrowth] = growthRange[values.growthScenario]
    const growthRate = (minGrowth + maxGrowth) / 2

    const baseSales = asNumber(values.monthlySales)
    const addPerMonth = asNumber(values.monthlyCustomerAdds)
    const price = asNumber(values.subscriptionMonthlyPrice || values.primaryPrice)

    const rows: RevenueRow[] = []
    let cumulative = 0

    for (let i = 1; i <= months; i += 1) {
      const totalCustomers = baseSales + addPerMonth * i
      const baseRevenue = totalCustomers * price
      const grownRevenue = baseRevenue * Math.pow(1 + growthRate, i - 1)
      cumulative += grownRevenue

      rows.push({
        month: `Month ${i}`,
        newCustomers: addPerMonth,
        totalCustomers,
        monthlyRevenue: Math.round(grownRevenue),
        cumulativeRevenue: Math.round(cumulative),
      })
    }

    return rows
  }

  const calculateBreakEven = (values: Inputs, revRows: RevenueRow[]) => {
    const price = asNumber(values.subscriptionMonthlyPrice || values.primaryPrice)
    const variable = asNumber(values.variableCostPerSale)
    const fixedCosts = asNumber(values.monthlyFixedCosts) + asNumber(values.monthlyMarketingSpend)
    const startupCosts = asNumber(values.startupCosts)
    const margin = Math.max(price - variable, 0.01)
    const marginPct = (margin / Math.max(price, 1)) * 100
    const breakEvenUnits = Math.ceil(fixedCosts / margin)
    const breakEvenRevenue = breakEvenUnits * price

    const avgMonthlyNet =
      revRows.length > 0
        ? revRows.reduce((acc, row) => acc + (row.monthlyRevenue - fixedCosts - row.totalCustomers * variable), 0) /
          revRows.length
        : 0

    const monthsToRecoverStartup = startupCosts > 0 && avgMonthlyNet > 0 ? Math.ceil(startupCosts / avgMonthlyNet) : 0

    return {
      fixedCosts,
      variable,
      margin,
      marginPct,
      breakEvenUnits,
      breakEvenRevenue,
      monthsToRecoverStartup,
    }
  }

  const calculateCashflowRows = (values: Inputs, revRows: RevenueRow[]) => {
    const fixedCosts = asNumber(values.monthlyFixedCosts)
    const variablePerSale = asNumber(values.variableCostPerSale)
    const marketing = asNumber(values.monthlyMarketingSpend)
    const startupCosts = asNumber(values.startupCosts)

    const rows: CashflowRow[] = []
    let cumulative = -startupCosts

    for (let i = 0; i < revRows.length; i += 1) {
      const revenue = revRows[i].monthlyRevenue
      const variableCosts = revRows[i].totalCustomers * variablePerSale
      const net = revenue - fixedCosts - variableCosts - marketing
      cumulative += net

      rows.push({
        month: revRows[i].month,
        revenue,
        fixedCosts,
        variableCosts,
        marketingSpend: marketing,
        netCashFlow: Math.round(net),
        cumulativeCashPosition: Math.round(cumulative),
      })
    }

    return rows
  }

  const makeRequest = async (type: "assumptions" | "revenue" | "breakeven" | "cashflow" | "full-summary", prompt: string) => {
    const response = await fetch("/api/financial-projector", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, prompt }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "Request failed")
    return data.text as string
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitError("")
    setFullSummary("")

    if (!validateInputs()) return

    const revRows = calculateRevenueRows(inputs)
    setRevenueRows(revRows)
    const beData = calculateBreakEven(inputs, revRows)
    setBreakEvenData(beData)
    const cfRows = calculateCashflowRows(inputs, revRows)
    setCashflowRows(cfRows)
    setGeneratedAt(new Date().toLocaleString())

    const allInputBlock = JSON.stringify(inputs, null, 2)
    const revBlock = JSON.stringify(revRows, null, 2)
    const breakEvenBlock = JSON.stringify(beData, null, 2)
    const cashflowBlock = JSON.stringify(cfRows, null, 2)

    setLoadingAssumptions(true)
    try {
      const assumptionText = await makeRequest(
        "assumptions",
        `Review these business inputs and summarize AI assumptions in plain language. Keep it to short bullet points. Inputs:\n${allInputBlock}`,
      )
      setAssumptions(assumptionText)
    } catch {
      setAssumptions("The numbers hit a snag. Check your inputs and try again.")
    } finally {
      setLoadingAssumptions(false)
    }

    setLoadingRevenue(true)
    setLoadingBreakEven(true)
    setLoadingCashflow(true)

    try {
      const [revInsight, beInsight, cfInsight] = await Promise.all([
        makeRequest(
          "revenue",
          `You are a financial advisor for early-stage founders. Here are the business inputs: ${allInputBlock}. Here are the calculated revenue projections: ${revBlock}. Provide: 1) A plain-language interpretation of what these revenue projections mean for this founder, 2) The key growth lever that will most impact revenue in this model, 3) A realistic assessment of whether these projections are achievable given the inputs, 4) One specific action the founder should take in the first 30 days to hit these numbers, 5) A scenario analysis — what happens to revenue if sales are 50% lower than projected? What's the downside case? Format with clear headers. Be direct, specific, and founder-friendly — no jargon.`,
        ),
        makeRequest(
          "breakeven",
          `You are a financial strategist for solo founders. Based on these business inputs: ${allInputBlock} and this break-even analysis: ${breakEvenBlock}, provide: 1) A plain-language explanation of what this break-even point means for this specific business, 2) How long realistically it will take to reach break-even given the growth assumptions, 3) Two specific strategies to lower the break-even point (either reduce costs or increase price/volume), 4) Whether the current pricing and cost structure is healthy for a business at this stage, 5) A red flag or risk in this financial model that the founder should address immediately. Be honest — if the numbers look difficult, say so and explain what to change. Format with headers.`,
        ),
        makeRequest(
          "cashflow",
          `You are a cash flow strategist for early-stage founders. Based on these inputs: ${allInputBlock} and this cash flow projection: ${cashflowBlock}, provide: 1) A cash flow health assessment — is this business cash flow positive, when does it become so, and how stable is it?, 2) The biggest cash flow risk in this model and when the founder should watch for it, 3) Two tactics to improve cash flow in the short term (first 90 days), 4) A recommendation on whether the founder needs external funding, a revenue bridge, or can grow self-funded based on these projections, 5) A specific cash flow milestone the founder should aim to hit at the 6-month mark. Keep it grounded and practical.`,
        ),
      ])

      setRevenueInsight(revInsight)
      setBreakEvenInsight(beInsight)
      setCashflowInsight(cfInsight)
    } catch {
      setSubmitError("The numbers hit a snag. Check your inputs and try again.")
    } finally {
      setLoadingRevenue(false)
      setLoadingBreakEven(false)
      setLoadingCashflow(false)
    }
  }

  const regeneratePanel = async (panel: "revenue" | "breakeven" | "cashflow") => {
    const allInputBlock = JSON.stringify(inputs, null, 2)
    if (panel === "revenue") {
      setLoadingRevenue(true)
      try {
        setRevenueInsight(
          await makeRequest("revenue", `Re-run revenue interpretation with these inputs ${allInputBlock} and data ${JSON.stringify(revenueRows)}`),
        )
      } finally {
        setLoadingRevenue(false)
      }
    }
    if (panel === "breakeven") {
      setLoadingBreakEven(true)
      try {
        setBreakEvenInsight(
          await makeRequest("breakeven", `Re-run break-even interpretation with these inputs ${allInputBlock} and data ${JSON.stringify(breakEvenData)}`),
        )
      } finally {
        setLoadingBreakEven(false)
      }
    }
    if (panel === "cashflow") {
      setLoadingCashflow(true)
      try {
        setCashflowInsight(
          await makeRequest("cashflow", `Re-run cash-flow interpretation with these inputs ${allInputBlock} and data ${JSON.stringify(cashflowRows)}`),
        )
      } finally {
        setLoadingCashflow(false)
      }
    }
  }

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text)
  }

  const generateFullSummary = async () => {
    setLoadingSummary(true)
    try {
      const result = await makeRequest(
        "full-summary",
        `You are a CFO writing a financial summary memo for a solo founder. Using all of the following financial data and projections: inputs ${JSON.stringify(
          inputs,
        )}, revenue table ${JSON.stringify(revenueRows)}, break-even ${JSON.stringify(
          breakEvenData,
        )}, cash flow ${JSON.stringify(cashflowRows)}, revenue insight ${revenueInsight}, break-even insight ${breakEvenInsight}, cash flow insight ${cashflowInsight}; write a concise Financial Health Summary. Structure it as: Financial Snapshot (key metrics at a glance), Revenue Outlook, Break-Even Reality Check, Cash Flow Assessment, Top 3 Financial Priorities for the Next 90 Days, and One Financial Risk That Could Derail This Business. Write in clear, plain language — this founder doesn't have an accountant. Be honest, be specific, and prioritize what matters most. End with one sentence of encouragement that is grounded in something specific and real about their numbers.`,
      )
      setFullSummary(result)
    } catch {
      setSubmitError("The numbers hit a snag. Check your inputs and try again.")
    } finally {
      setLoadingSummary(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#081527] text-white pb-20 px-4 sm:px-8">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;700&display=swap');
        .fp-heading { font-family: 'DM Serif Display', serif; }
        .fp-ui { font-family: 'DM Sans', sans-serif; }
        .fp-mono { font-family: 'JetBrains Mono', monospace; }
        @media print {
          body * { visibility: hidden; }
          #full-summary-print, #full-summary-print * { visibility: visible; }
          #full-summary-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
      <div className="max-w-6xl mx-auto fp-ui">
        <div className="pt-10 pb-8">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="fp-heading text-4xl md:text-5xl">Financial Projector</h1>
            <span className="rounded-full border border-[#d27a2c]/60 px-3 py-1 text-xs bg-[#d27a2c]/10 animate-pulse">
              AI-Powered Projections
            </span>
          </div>
          <p className="text-[#BBC3E1] mt-2">Know your numbers before the market does.</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/15 bg-[#0f2138] p-5 md:p-8 space-y-6 transition-all duration-300">
          <div className="grid md:grid-cols-2 gap-6">
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Business Basics</h2>
              <div>
                <label className="text-sm">What is your product or service? *</label>
                <input className="w-full mt-1 rounded-lg px-3 py-2" value={inputs.product} placeholder='e.g., "Notion template bundles for solo founders"' onChange={(e) => setInputs((prev) => ({ ...prev, product: e.target.value }))} />
                <p className="text-xs text-[#BBC3E1] mt-1">Defines how the model should frame your economics.</p>
                {errors.product && <p className="text-xs text-[#d27a2c] mt-1">{errors.product}</p>}
              </div>
              <div>
                <label className="text-sm">Revenue Model *</label>
                <select className="w-full mt-1 rounded-lg px-3 py-2" value={inputs.revenueModel} onChange={(e) => setInputs((prev) => ({ ...prev, revenueModel: e.target.value as RevenueModel }))}>
                  {["One-Time Product Sale", "Monthly Subscription", "Annual Subscription", "Service Retainer", "Course/Cohort", "Mixed Model"].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm">Business Stage *</label>
                <select className="w-full mt-1 rounded-lg px-3 py-2" value={inputs.businessStage} onChange={(e) => setInputs((prev) => ({ ...prev, businessStage: e.target.value as BusinessStage }))}>
                  {["Pre-Revenue", "Just Launched (0–3 months)", "Early Traction (3–12 months)", "Growing (1–2 years)"].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Pricing & Sales</h2>
              {[
                ["primaryPrice", "Primary price point (USD)", "e.g., 27", "Core price that drives your topline."] as const,
                ["subscriptionMonthlyPrice", "If subscription — monthly price (USD)", "leave blank if not applicable", "Used for recurring models."] as const,
                ["monthlySales", "Average number of sales per month", "e.g., 10", "Baseline sales volume."] as const,
                ["monthlyCustomerAdds", "Average new customers/subscribers added per month", "e.g., 5", "Sets monthly growth in your model."] as const,
              ].map(([key, label, placeholder, helper]) => (
                <div key={key}>
                  <label className="text-sm">{label}{key !== "subscriptionMonthlyPrice" ? " *" : ""}</label>
                  <input type="number" min={0} className="w-full mt-1 rounded-lg px-3 py-2" value={inputs[key]} placeholder={placeholder} onChange={(e) => setInputs((prev) => ({ ...prev, [key]: e.target.value }))} />
                  <p className="text-xs text-[#BBC3E1] mt-1">{helper}</p>
                  {errors[key] && <p className="text-xs text-[#d27a2c] mt-1">{errors[key]}</p>}
                </div>
              ))}
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Costs & Expenses</h2>
              {[
                ["monthlyFixedCosts", "Monthly fixed costs (USD)", "e.g., 150", "Tools, subscriptions, and software."] as const,
                ["variableCostPerSale", "Monthly variable costs per sale (USD)", "e.g., 3", "Transaction and delivery costs."] as const,
                ["startupCosts", "One-time startup or setup costs (USD)", "e.g., 500", "Enter 0 if already launched."] as const,
                ["monthlyMarketingSpend", "Monthly marketing spend (USD)", "e.g., 50", "Impacts growth and cash burn."] as const,
              ].map(([key, label, placeholder, helper]) => (
                <div key={key}>
                  <label className="text-sm">{label} *</label>
                  <input type="number" min={0} className="w-full mt-1 rounded-lg px-3 py-2" value={inputs[key]} placeholder={placeholder} onChange={(e) => setInputs((prev) => ({ ...prev, [key]: e.target.value }))} />
                  <p className="text-xs text-[#BBC3E1] mt-1">{helper}</p>
                  {errors[key] && <p className="text-xs text-[#d27a2c] mt-1">{errors[key]}</p>}
                </div>
              ))}
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Projection Assumptions</h2>
              <div>
                <label className="text-sm">Projection timeframe *</label>
                <select className="w-full mt-1 rounded-lg px-3 py-2" value={inputs.timeframe} onChange={(e) => setInputs((prev) => ({ ...prev, timeframe: e.target.value as Timeframe }))}>
                  {["3 Months", "6 Months", "12 Months", "24 Months"].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm">Growth scenario *</label>
                <select className="w-full mt-1 rounded-lg px-3 py-2" value={inputs.growthScenario} onChange={(e) => setInputs((prev) => ({ ...prev, growthScenario: e.target.value as GrowthScenario }))}>
                  {["Conservative (slow, steady growth)", "Moderate (realistic optimism)", "Aggressive (fast growth assumptions)"].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm">Any additional context about your business model or assumptions</label>
                <textarea className="w-full mt-1 rounded-lg px-3 py-2 min-h-24" value={inputs.additionalContext} placeholder="I plan to launch a second product at month 4. I have an email list of 500 people already." onChange={(e) => setInputs((prev) => ({ ...prev, additionalContext: e.target.value }))} />
              </div>
            </section>
          </div>

          <button type="submit" className="w-full rounded-xl bg-[#d27a2c] hover:bg-[#f07055] py-3 font-semibold shadow-[0_0_20px_rgba(210,122,44,0.35)]">
            Generate Financial Projections →
          </button>
          <p className="text-xs text-[#9BA3C5]">Projections are AI-generated estimates for planning purposes only and do not constitute financial advice.</p>
          {submitError && <p className="text-sm text-[#d27a2c]">{submitError}</p>}
        </form>

        {!hasResults && <p className="text-[#BBC3E1] text-center mt-10">Enter your numbers above to see your financial future.</p>}

        {hasResults && (
          <section className="mt-10 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-semibold">Your Financial Projections</h2>
            <p className="text-sm text-[#BBC3E1]">Generated {generatedAt} · {inputs.growthScenario.split(" ")[0]} Scenario · {inputs.timeframe} Outlook</p>

            <div className="rounded-xl border border-white/15 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-sm mb-2"><Info className="h-4 w-4 text-[#d27a2c]" /> AI Assumptions Used</div>
              {loadingAssumptions ? <PanelSkeleton label="Reviewing your assumptions..." /> : <MarkdownBlock content={assumptions} />}
            </div>

            <article className="rounded-2xl border border-[#d27a2c]/30 bg-[#11152A] p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-[#d27a2c]" /> Revenue Forecast</h3>
                  <p className="text-sm text-[#BBC3E1]">Projected revenue over your selected timeframe</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="p-2 border border-white/20 rounded" onClick={() => regeneratePanel("revenue")}><RefreshCw className="h-4 w-4" /></button>
                  <button type="button" className="p-2 border border-white/20 rounded" onClick={() => copyText(revenueInsight)}><Copy className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm fp-mono min-w-[720px]">
                  <thead><tr className="text-left border-b border-white/10"><th>Month</th><th>New Customers</th><th>Total Customers</th><th>Monthly Revenue</th><th>Cumulative Revenue</th></tr></thead>
                  <tbody>
                    {revenueRows.map((row, idx) => (
                      <tr key={row.month} className={`border-b border-white/5 ${idx === firstThresholdMonth ? "bg-[#d27a2c]/10" : ""}`}>
                        <td className="py-2">{row.month}</td><td>{numberFmt.format(row.newCustomers)}</td><td>{numberFmt.format(row.totalCustomers)}</td><td>{formatCurrency(row.monthlyRevenue)}</td><td>{formatCurrency(row.cumulativeRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {loadingRevenue ? <PanelSkeleton label="Forecasting your revenue trajectory..." /> : <MarkdownBlock content={revenueInsight} />}
            </article>

            <article className="rounded-2xl border border-[#d27a2c]/30 bg-[#11152A] p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold flex items-center gap-2"><Scale className="h-5 w-5 text-[#d27a2c]" /> Break-Even Analysis</h3>
                  <p className="text-sm text-[#BBC3E1]">When does your business start making real money?</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="p-2 border border-white/20 rounded" onClick={() => regeneratePanel("breakeven")}><RefreshCw className="h-4 w-4" /></button>
                  <button type="button" className="p-2 border border-white/20 rounded" onClick={() => copyText(breakEvenInsight)}><Copy className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <NumericKPI label="Monthly Fixed Costs" value={breakEvenData.fixedCosts || 0} />
                <NumericKPI label="Variable Cost per Sale" value={breakEvenData.variable || 0} />
                <NumericKPI label="Contribution Margin per Sale" value={breakEvenData.margin || 0} accent />
                <NumericKPI label="Break-Even Revenue / Month" value={breakEvenData.breakEvenRevenue || 0} accent />
              </div>
              <div className="rounded-xl border border-[#d27a2c]/50 bg-[#d27a2c]/10 p-4">
                <p className="fp-mono text-lg">You need to sell {numberFmt.format(breakEvenData.breakEvenUnits || 0)} units per month to break even.</p>
                <p className="text-xs text-[#BBC3E1] mt-1">Contribution Margin %: {Math.round(breakEvenData.marginPct || 0)}% · Months to recover startup costs: {breakEvenData.monthsToRecoverStartup || 0}</p>
              </div>

              {loadingBreakEven ? <PanelSkeleton label="Calculating your break-even point..." /> : <MarkdownBlock content={breakEvenInsight} />}
            </article>

            <article className="rounded-2xl border border-[#d27a2c]/30 bg-[#11152A] p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold flex items-center gap-2"><Activity className="h-5 w-5 text-[#d27a2c]" /> Cash Flow Projection</h3>
                  <p className="text-sm text-[#BBC3E1]">Your money in, money out, and runway — month by month</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="p-2 border border-white/20 rounded" onClick={() => regeneratePanel("cashflow")}><RefreshCw className="h-4 w-4" /></button>
                  <button type="button" className="p-2 border border-white/20 rounded" onClick={() => copyText(cashflowInsight)}><Copy className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm fp-mono min-w-[920px]">
                  <thead><tr className="text-left border-b border-white/10"><th>Month</th><th>Revenue</th><th>Fixed Costs</th><th>Variable Costs</th><th>Marketing Spend</th><th>Net Cash Flow</th><th>Cumulative Cash Position</th></tr></thead>
                  <tbody>
                    {cashflowRows.map((row) => {
                      const neg = row.netCashFlow < 0
                      return (
                        <tr key={row.month} className={`border-b border-white/5 ${neg ? "bg-amber-500/10 border-l-2 border-l-amber-400 animate-pulse" : "bg-emerald-500/10"}`}>
                          <td className="py-2">{row.month}</td>
                          <td>{formatCurrency(row.revenue)}</td>
                          <td>{formatCurrency(row.fixedCosts)}</td>
                          <td>{formatCurrency(row.variableCosts)}</td>
                          <td>{formatCurrency(row.marketingSpend)}</td>
                          <td>{formatCurrency(row.netCashFlow)}</td>
                          <td>{formatCurrency(row.cumulativeCashPosition)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {firstNegativeCashMonth >= 0 && (
                <div className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-3 text-sm">⚠️ Cash goes negative at Month {firstNegativeCashMonth + 1}</div>
              )}

              {loadingCashflow ? <PanelSkeleton label="Mapping your cash flow..." /> : <MarkdownBlock content={cashflowInsight} />}
            </article>

            {allInsightsReady && (
              <div className="space-y-4">
                <button type="button" onClick={generateFullSummary} className="w-full rounded-xl bg-[#d27a2c] hover:bg-[#f07055] py-3 font-semibold shadow-[0_0_20px_rgba(210,122,44,0.35)] flex items-center justify-center gap-2">
                  {loadingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Generate Full Financial Summary →
                </button>

                {(loadingSummary || fullSummary) && (
                  <article id="full-summary-print" className="rounded-2xl border border-white/15 bg-[#11152A] p-6">
                    <div className="flex justify-end gap-2 mb-4">
                      <button type="button" className="p-2 border border-white/20 rounded" onClick={() => copyText(fullSummary)}><Copy className="h-4 w-4" /></button>
                      <button type="button" className="p-2 border border-white/20 rounded text-sm" onClick={() => window.print()}>Download as PDF</button>
                    </div>
                    {loadingSummary ? <PanelSkeleton label="Generating full financial memo..." /> : <MarkdownBlock content={fullSummary} />}
                  </article>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}

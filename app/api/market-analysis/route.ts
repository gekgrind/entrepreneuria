import { NextRequest, NextResponse } from "next/server"

type AnalysisType = "pillar" | "full_report"
type PillarId =
  | "market_landscape"
  | "competitor_intelligence"
  | "customer_demand_signals"
  | "hidden_opportunities"

const CLAUDE_MODEL = "claude-sonnet-4-20250514"

const PILLAR_PROMPTS: Record<PillarId, string> = {
  market_landscape:
    "You are a market research analyst. The user is building: [business description]. Their target customer is: [target customer]. Use web search to research the current market landscape for this business. Provide: 1) Estimated market size (TAM, SAM, SOM if possible — use real data or credible estimates found via search), 2) Current market growth rate and trajectory, 3) Key market trends shaping this space right now, 4) The maturity stage of this market (emerging, growing, saturated, declining) and what that means for a new entrant, 5) Any regulatory, economic, or cultural forces affecting this market. Cite any specific data points or sources you find. Format with clear headers. Be specific — avoid generic statements.",
  competitor_intelligence:
    "You are a competitive intelligence analyst. The user is building: [business description]. Their known competitors are: [competitors]. Use web search to research these competitors and the broader competitive landscape. Provide: 1) A brief profile of each named competitor (positioning, pricing if findable, strengths, weaknesses), 2) Any additional competitors or alternatives you find that the user may not have listed, 3) A competitive gap analysis — where are the whitespace opportunities in this competitive set?, 4) How these competitors acquire customers (channels, messaging), 5) One thing each major competitor does well that the user should study, and one thing they do poorly that the user could exploit. Format as structured competitor profiles followed by a gap summary. Be direct and tactical.",
  customer_demand_signals:
    "You are a customer research analyst specializing in demand analysis. The user is targeting: [target customer] with this offer: [business description]. Use web search to find real signals of customer demand in this space. Provide: 1) Top search queries and keywords customers are using to find solutions like this (use search to find real data), 2) Common pain points, complaints, and frustrations customers express in communities, reviews, or forums about current solutions, 3) What customers say they wish existed or want more of, 4) Buying behavior patterns — how do customers in this space typically discover and purchase solutions?, 5) Any underserved demand signals — questions being asked that don't have good answers yet. Ground your findings in specific examples where possible. Format with clear headers.",
  hidden_opportunities:
    "You are a strategic opportunity analyst. Based on the following: Business: [business description], Target customer: [target customer], Competitors: [competitors] — use web search to identify non-obvious strategic opportunities. Provide: 1) Two or three underserved niches within this market that are growing but not yet crowded, 2) A channel or platform where this audience is active but competitors haven't fully claimed, 3) A content or positioning angle that no current competitor is owning, 4) An adjacent market or customer segment that could be a logical expansion, 5) One contrarian insight about this market that most people get wrong. Be specific, be bold, and prioritize insights that a solo founder could actually act on. Format with headers.",
}

function fillPrompt(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`[${key}]`, value || "Not provided")
  }, template)
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return ""
  return content
    .map((item) => {
      if (
        typeof item === "object" &&
        item !== null &&
        "type" in item &&
        (item as { type?: string }).type === "text" &&
        "text" in item
      ) {
        return (item as { text?: string }).text ?? ""
      }
      return ""
    })
    .join("\n")
    .trim()
}

async function callClaude(prompt: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY environment variable")
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "web-search-2025-03-05",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2200,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`)
  }

  const payload = (await response.json()) as { content?: unknown }
  return extractText(payload.content)
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      type?: AnalysisType
      pillarId?: PillarId
      businessDescription?: string
      targetCustomer?: string
      competitors?: string
      pillars?: Partial<Record<PillarId, string>>
    }

    const type = body.type

    if (!type) {
      return NextResponse.json({ error: "Request type is required." }, { status: 400 })
    }

    if (!body.businessDescription?.trim()) {
      return NextResponse.json(
        { error: "Business description is required." },
        { status: 400 },
      )
    }

    if (type === "pillar") {
      if (!body.pillarId || !PILLAR_PROMPTS[body.pillarId]) {
        return NextResponse.json({ error: "Invalid pillar id." }, { status: 400 })
      }

      const prompt = fillPrompt(PILLAR_PROMPTS[body.pillarId], {
        "business description": body.businessDescription.trim(),
        "target customer": body.targetCustomer?.trim() ?? "Not provided",
        competitors: body.competitors?.trim() ?? "Not provided",
      })

      const result = await callClaude(prompt)

      return NextResponse.json({ result })
    }

    if (type === "full_report") {
      const pillars = body.pillars

      if (!pillars) {
        return NextResponse.json({ error: "Pillar results are required." }, { status: 400 })
      }

      const fullPrompt = `You are a senior market research strategist writing for a solo founder. Using the market research findings below, write a comprehensive Market Analysis Report. Structure it as: Executive Summary (3–4 sentences capturing the most critical findings), Market Opportunity Assessment (size, timing, and fit), Competitive Landscape Summary, Customer Demand Analysis, Strategic Opportunities & Recommendations, Go-to-Market Angle (one specific recommended entry strategy based on all findings), Risk Factors to Monitor. Write in a direct, founder-friendly tone — sharp, specific, and actionable. No fluff. This founder is building lean and needs to know exactly where to place their bets.\n\nOriginal Inputs:\nBusiness: ${body.businessDescription.trim()}\nTarget Customer: ${body.targetCustomer?.trim() || "Not provided"}\nCompetitors: ${body.competitors?.trim() || "Not provided"}\n\nPillar Findings:\n\nMarket Landscape:\n${pillars.market_landscape || "No data"}\n\nCompetitor Intelligence:\n${pillars.competitor_intelligence || "No data"}\n\nCustomer Demand Signals:\n${pillars.customer_demand_signals || "No data"}\n\nHidden Opportunities:\n${pillars.hidden_opportunities || "No data"}`

      const result = await callClaude(fullPrompt)

      return NextResponse.json({ result })
    }

    return NextResponse.json({ error: "Unsupported request type." }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

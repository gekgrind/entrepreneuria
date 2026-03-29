import { NextResponse } from "next/server"

type PitchDeckMode = "plan" | "slide"

function extractTextContent(payload: any): string {
  if (!payload?.content || !Array.isArray(payload.content)) return ""
  return payload.content
    .filter((item: any) => item?.type === "text")
    .map((item: any) => item.text)
    .join("\n")
}

function parseJsonResponse(raw: string) {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/, "")
  try {
    return JSON.parse(cleaned)
  } catch {
    const bracketIndexes = [cleaned.indexOf("["), cleaned.indexOf("{")].filter((v) => v >= 0)
    const firstBracket = bracketIndexes.length ? Math.min(...bracketIndexes) : -1
    const lastBracket = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"))
    if (firstBracket >= 0 && lastBracket > firstBracket) {
      return JSON.parse(cleaned.slice(firstBracket, lastBracket + 1))
    }
    throw new Error("Unable to parse JSON response")
  }
}

async function callClaude(prompt: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY")
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1400,
      temperature: 0.6,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Anthropic API error (${response.status}): ${text}`)
  }

  const payload = await response.json()
  return extractTextContent(payload)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const mode = body?.mode as PitchDeckMode

    if (mode === "plan") {
      const inputs = body.inputs
      const prompt = `You are a pitch deck strategist. Based on these inputs: Business: ${inputs.businessDescription}, Problem: ${inputs.problem}, Solution: ${inputs.solution}, Customer: ${inputs.customer}, Differentiator: ${inputs.differentiator}, Revenue Model: ${inputs.revenueModel}, Traction: ${inputs.traction}, Market: ${inputs.market}, Competitors: ${inputs.competitors}, Pitch Purpose: ${inputs.purpose}, Tone: ${inputs.tone}, Length: ${inputs.length} — return a JSON array of slide objects in this exact format: [{ slideNumber, slideType, slideTitle, narrativeRole }]. The narrativeRole should be one sentence explaining what story job this slide does in the overall pitch arc. Return ONLY the JSON array, no preamble.`
      const raw = await callClaude(prompt)
      const plan = parseJsonResponse(raw)
      return NextResponse.json({ plan })
    }

    if (mode === "slide") {
      const { inputs, slide, totalSlides } = body
      const prompt = `You are a world-class pitch deck copywriter and presentation coach. You are writing slide ${slide.slideNumber} of ${totalSlides} for a ${inputs.tone} pitch deck targeting ${inputs.purpose}. The business is: ${inputs.businessDescription}. The problem: ${inputs.problem}. The solution: ${inputs.solution}. Target customer: ${inputs.customer}. Differentiator: ${inputs.differentiator}. Traction: ${inputs.traction}. Market: ${inputs.market}. Competitors: ${inputs.competitors}.
This slide is: ${slide.slideType} — ${slide.slideTitle}. Its narrative role: ${slide.narrativeRole}.
Generate the following for this slide: headline (max 10 words — punchy, memorable, no jargon), bodyContent (the slide's main content — 2–4 concise bullet points OR a single powerful statement, depending on slide type), layoutRecommendation (one of: Full Bleed Hero, Two Column, Stats Grid, Quote Callout, Timeline, Team Grid, Chart + Copy, Minimal Text, Image + Data), slideDesignSuggestion (one specific actionable design direction for Canva or PowerPoint — 2–3 sentences), slidePurpose (one sentence — what must this slide accomplish?), storytellingPrompt (specific verbal coaching note for presenting this slide — 2–3 sentences), copyNotes (brief explanation of the strategic copy choices made — 1–2 sentences).
Return ONLY a JSON object in this exact format: { headline, bodyContent, layoutRecommendation, slideDesignSuggestion, slidePurpose, storytellingPrompt, copyNotes }. No preamble, no markdown fences.`
      const raw = await callClaude(prompt)
      const slideContent = parseJsonResponse(raw)
      return NextResponse.json({ slideContent })
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
  } catch (error) {
    console.error("Pitch deck API error", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

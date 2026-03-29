import { NextResponse } from "next/server"

const API_URL = "https://api.anthropic.com/v1/messages"
const MODEL = "claude-sonnet-4-20250514"

type PromptType = "assumptions" | "revenue" | "breakeven" | "cashflow" | "full-summary"

const SYSTEM_PROMPTS: Record<PromptType, string> = {
  assumptions:
    "You are a startup finance analyst. Keep responses concise, clear, and in plain language.",
  revenue:
    "You are a financial advisor for early-stage founders. Be direct and founder-friendly.",
  breakeven:
    "You are a financial strategist for solo founders. Be honest and practical.",
  cashflow:
    "You are a cash flow strategist for early-stage founders. Keep recommendations concrete.",
  "full-summary":
    "You are a CFO writing a summary memo for a solo founder. Keep it concise, specific, and actionable.",
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 500 })
  }

  try {
    const body = (await req.json()) as { type?: PromptType; prompt?: string }

    if (!body?.type || !body?.prompt) {
      return NextResponse.json({ error: "Missing required fields: type and prompt." }, { status: 400 })
    }

    const anthropicResponse = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        system: SYSTEM_PROMPTS[body.type],
        max_tokens: body.type === "full-summary" ? 1400 : 1000,
        messages: [
          {
            role: "user",
            content: body.prompt,
          },
        ],
      }),
    })

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text()
      return NextResponse.json(
        { error: `Anthropic API error (${anthropicResponse.status}): ${errorText}` },
        { status: anthropicResponse.status },
      )
    }

    const data = await anthropicResponse.json()
    const text = (data?.content ?? [])
      .filter((item: { type?: string }) => item.type === "text")
      .map((item: { text?: string }) => item.text ?? "")
      .join("\n")
      .trim()

    return NextResponse.json({ text })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown server error" },
      { status: 500 },
    )
  }
}

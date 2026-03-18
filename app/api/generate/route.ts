import { NextResponse } from "next/server"

type GenerateRequest = {
  mode: "section" | "full"
  prompt: string
}

const SYSTEM_PROMPTS = {
  section:
    "You are a strategic advisor for solo founders and early-stage entrepreneurs. Give practical, no-fluff insights with clear markdown headers and concise bullets.",
  full:
    "You are a world-class business strategist writing for a solo founder. Using the business model inputs provided, write a comprehensive Business Model Blueprint. Structure it with the following sections: Executive Summary, Customer & Problem, Value Proposition, Revenue Strategy, Key Operations, Resources & Leverage Points, Strategic Recommendations (3 specific, prioritized next steps). Use clear headers, keep the tone sharp and founder-friendly — not corporate. Write as if you're a trusted advisor who wants this founder to win.",
} as const

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequest

    if (!body?.prompt || !body?.mode) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured yet. Add ANTHROPIC_API_KEY to enable generation." },
        { status: 500 }
      )
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
        temperature: 0.4,
        system: SYSTEM_PROMPTS[body.mode],
        messages: [
          {
            role: "user",
            content: body.prompt,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      return NextResponse.json(
        { error: "We hit a snag generating insights. Please try again.", details: errorBody },
        { status: response.status }
      )
    }

    const data = await response.json()
    const text = data?.content?.find((item: { type: string }) => item.type === "text")?.text

    if (!text) {
      return NextResponse.json({ error: "No response content returned." }, { status: 502 })
    }

    return NextResponse.json({ result: text })
  } catch (error) {
    console.error("/api/generate error", error)
    return NextResponse.json(
      { error: "Something went wrong while generating. Please retry in a moment." },
      { status: 500 }
    )
  }
}

import { NextResponse } from "next/server"

type RequestBody = {
  businessIdea?: string
  targetCustomer?: string
  problem?: string
  differentiator?: string
  monetization?: string
}

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: "Server configuration error: OPENAI_API_KEY is not set." },
      { status: 500 },
    )
  }

  const body = (await request.json()) as RequestBody

  if (!body.businessIdea || !body.targetCustomer || !body.problem) {
    return NextResponse.json(
      { error: "Please provide your business idea, target customer, and problem statement." },
      { status: 400 },
    )
  }

  const systemPrompt =
    "You are a startup strategy assistant for Entrepreneuria. Return concise, practical guidance. Respond only as strict JSON with this shape: { valueProposition: string, revenueStreams: string[], keyActivities: string[], opportunities: string[], risks: string[], nextActions: string[] }. Each list should include 3-5 specific bullets."

  const userPrompt = `Business idea: ${body.businessIdea}\nTarget customer: ${body.targetCustomer}\nProblem: ${body.problem}\nDifferentiator: ${body.differentiator || "Not provided"}\nMonetization idea: ${body.monetization || "Not provided"}`

  try {
    const openAIResponse = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    })

    if (!openAIResponse.ok) {
      const errorPayload = await openAIResponse.text()
      return NextResponse.json(
        { error: `OpenAI request failed: ${errorPayload}` },
        { status: openAIResponse.status },
      )
    }

    const data = await openAIResponse.json()
    const rawContent = data?.choices?.[0]?.message?.content

    if (!rawContent) {
      return NextResponse.json(
        { error: "No response content returned from OpenAI." },
        { status: 502 },
      )
    }

    const parsed = JSON.parse(rawContent)

    return NextResponse.json({ insight: parsed })
  } catch {
    return NextResponse.json(
      { error: "Unexpected error while generating business model insights." },
      { status: 500 },
    )
  }
}

import { NextResponse } from "next/server";
const MODEL = "claude-sonnet-4-20250514";

const getApiKey = () => process.env.ANTHROPIC_API_KEY ?? null;

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
};

type RequestBody = {
  type: "job-description" | "screening" | "interview-questions";
  payload: Record<string, unknown>;
};

const safeJsonParse = (text: string) => {
  try {
    return { ok: true as const, value: JSON.parse(text) };
  } catch {
    return { ok: false as const };
  }
};

const buildPrompt = (type: RequestBody["type"], payload: Record<string, unknown>) => {
  if (type === "job-description") {
    return `You are a talent acquisition specialist and copywriter for early-stage startups. Write a compelling job description for a solo founder's business.
Role details: Title: ${payload.title}, Type: ${payload.employmentType}, Arrangement: ${payload.workArrangement}, Compensation: ${payload.compensation}, Experience: ${payload.experienceLevel}, Responsibilities: ${payload.responsibilities}, Required skills: ${payload.requiredSkills}, Bonus skills: ${payload.bonusSkills}.
Company details: Name: ${payload.companyName}, Description: ${payload.companyDescription}, Tone: ${payload.tone}.
Generate a complete job description with these sections: About Us, The Role, What You'll Do, What We're Looking For, Nice to Have, What We Offer, How to Apply ${payload.includeApplicationInstructions ? `(include application instructions: ${payload.applicationInstructions})` : "(omit this section)"}.
${payload.includeEeo ? "Include a concise equal opportunity employer statement." : "Do not include an equal opportunity employer statement."}
Make it feel genuinely human, specific to this role, and attractive to high-quality candidates. Avoid corporate jargon. Write for a founder-led business, not a Fortune 500.
After the job description, create an AI Coaching Note with 2–3 sentences explaining strategic choices and one personalization tip.
Return ONLY valid JSON in this shape:
{
  "jobDescriptionMarkdown": "...",
  "aiCoachingNote": "..."
}`;
  }

  if (type === "screening") {
    return `You are a talent screening specialist for early-stage startups. Screen the following candidate against this role.
Role: ${payload.title}.
Requirements: ${payload.requirements}.
Must-haves: ${payload.mustHaves}.
Culture fit weighting: ${payload.cultureWeighting}.
Candidate name: ${payload.candidateName}.
Candidate information type: ${payload.informationType}.
Candidate information: ${payload.candidateText}.
Specific concerns: ${payload.concerns}.
Provide: 1) An overall match score as a percentage (0–100) and one bold summary sentence, 2) A skills match analysis — for each requirement listed, indicate if it is Confirmed, Partial, or Not Evidenced with a one-line note, 3) Top 3–4 strengths of this candidate for this role, 4) Top 2–3 honest concerns or gaps, 5) A culture fit assessment paragraph based on the weighting specified, 6) A clear recommendation: Advance to Interview, Advance with Reservations, Request More Information, or Do Not Advance — with a 2–3 sentence rationale, 7) 2–3 specific follow-up questions tailored to this candidate's gaps.
Return as structured JSON: { "matchScore": number, "summary": string, "skillsMatch": [{ "skill": string, "status": "Confirmed" | "Partial" | "Not Evidenced", "note": string }], "strengths": string[], "concerns": string[], "cultureFitAssessment": string, "recommendation": "Advance to Interview" | "Advance with Reservations" | "Request More Information" | "Do Not Advance", "recommendationRationale": string, "followUpQuestions": string[] }.
Return ONLY JSON, no preamble.`;
  }

  return `You are a hiring coach and interview strategist for early-stage startups and solo founders. Generate a complete interview question set for this role.
Role: ${payload.title}.
Key responsibilities and requirements: ${payload.requirements}.
Interview format: ${payload.format}.
Interview focus: ${payload.focus}.
Specific topics or concerns to address: ${payload.concerns}.
Candidate context (if applicable): ${payload.candidateContext}.
Include illegal questions to avoid: ${payload.includeIllegalQuestions}.
Generate questions organized into these categories based on the focus selected: Opening & Rapport, Experience & Background, Skills & Technical, Problem-Solving & Thinking, Culture & Values, Future & Motivation, and a Candidate Questions coaching note.
For each question provide: the question text, why to ask it (one sentence), what a strong answer looks like (2–3 sentences describing signals to listen for — not a script), and what a red flag answer looks like (one sentence).
Also generate: a Before the Interview checklist (5–6 items), a Scoring Rubric with five criteria and 1–5 scale descriptions, and if requested, an Illegal Questions to Avoid reference section.
Make every question specific to this role — no generic filler questions.
Return ONLY JSON:
{
  "categories": [{ "categoryName": string, "categoryIcon": string, "questions": [{ "question": string, "whyAsk": string, "strongAnswer": string, "redFlag": string }] }],
  "beforeInterview": string[],
  "scoringRubric": [{ "criterion": string, "description": string }],
  "illegalQuestionsToAvoid": [{ "category": string, "examples": string, "note": string }]
}`;
};

export async function POST(request: Request) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
  }

  try {
    const body = (await request.json()) as RequestBody;
    if (!body?.type || !body?.payload) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const prompt = buildPrompt(body.type, body.payload);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        temperature: 0.4,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText || "Anthropic request failed" }, { status: 500 });
    }

    const responseJson = (await response.json()) as AnthropicResponse;
    const text = (responseJson.content ?? [])
      .filter((item) => item.type === "text")
      .map((item) => item.text ?? "")
      .join("\n")
      .trim();

    const parsed = safeJsonParse(text);

    if (!parsed.ok) {
      return NextResponse.json({
        raw: text,
        parseError: true,
      });
    }

    return NextResponse.json({ data: parsed.value, parseError: false });
  } catch (error) {
    console.error("Hiring assistant API error", error);
    return NextResponse.json(
      { error: "Failed to generate hiring assistant response" },
      { status: 500 },
    );
  }
}

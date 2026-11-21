/**
 * Prompt text for the persona builder, moved unchanged from
 * app/api/persona-builder/route.ts.
 */
import type { FounderInputs } from "./schema";

export function buildPersonaPrompt(
  founderInputs: FounderInputs,
  personaNumber: number,
  totalPersonas: number
) {
  return `You are a customer research specialist and behavioral psychologist. The founder is building: ${founderInputs.productService} that solves: ${founderInputs.problemSolved}. Their offer is priced at ${founderInputs.priceRange} and targets: ${founderInputs.customerDescription}. The customer is trying to achieve: ${founderInputs.customerGoal}. They hang out at: ${founderInputs.onlineChannels}. Additional research context: ${founderInputs.additionalResearch || "None provided."}
Use web search to research real communities, forums, reviews, and discussions where this type of customer is active. Find real language, real complaints, and real aspirations from actual people in this audience.
Generate a fully realized customer persona. This is persona ${personaNumber} of ${totalPersonas} — make this persona meaningfully distinct from the others if generating multiple. Give this persona: a realistic name, an archetype title, demographic details (age range, location type, occupation), core goals (3–4), pain points and frustrations (3–4 — use real language found via research), motivations and drivers (3–4), purchase behavior patterns (3–4), objections and hesitations (2–3 — these should be the specific doubts someone has before buying an offer like this), preferred channels and content types (2–3), voice and language samples (2–3 direct quotes in first person that this persona would actually say about their problem or goal), a tactical recommendation for how to reach and convert this specific persona, and a fit score (1–5) with one sentence explaining the rating.
Ground every insight in real human behavior. Avoid generic marketing personas. Make this feel like a real person.
Return your response as structured JSON in this exact format: { name, archetypeTitle, age, locationType, occupation, goals, painPoints, motivations, purchaseBehavior, objections, channels, voiceSamples, conversionRecommendation, fitScore, fitScoreReason }
Return ONLY the JSON object. No preamble, no markdown fences.`;
}

export function buildCrossPrompt(
  founderInputs: FounderInputs,
  allPersonas: unknown[]
) {
  return `You are an audience strategist for a solo founder. The founder is building: ${founderInputs.productService}. Here are their ${allPersonas.length} generated customer personas: ${JSON.stringify(allPersonas)}. Analyze these personas together and provide: 1) Shared pain points that appear across all personas — the universal problems this offer must address, 2) Key differentiators between the personas — what makes each one distinct in how they buy and what they need, 3) The highest-value persona for revenue potential and why, 4) A unified positioning statement and hook that speaks to all personas simultaneously. Format with the four headers. Be specific and use the persona names throughout.`;
}

export function buildStrategyPrompt(
  founderInputs: FounderInputs,
  personas: unknown[]
) {
  return `You are a customer strategy advisor for a solo founder. Using the following customer personas and business inputs: ${JSON.stringify({
    founderInputs,
    personas,
  })}, write a Persona Strategy Report. Structure it as: Audience Overview (who this founder is truly building for, in one paragraph), Persona Breakdown Summary (one paragraph per persona capturing the essential truth about each), Messaging Strategy (how to speak to each persona and where), Product-Market Fit Assessment (how well the current offer matches what these personas actually need), Content & Channel Recommendations (specific content types and platforms for this audience), Top 3 Customer Acquisition Insights (the highest-leverage ways to reach and convert these personas), and One Blind Spot (something about this audience the founder may be overlooking). Write in direct, founder-friendly language. Be specific. Use the persona names throughout to make it feel personal and actionable.`;
}

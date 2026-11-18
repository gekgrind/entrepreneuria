/**
 * Request validation for POST /api/persona-builder.
 *
 * Every field, array and number is bounded. Requests are first checked
 * structurally (cheap counts, before Zod runs), then parsed against a
 * per-mode schema. Zod 3 still visits every array element even when a
 * `.max()` fails, so the structural check is what keeps a large array from
 * doing work; the body cap bounds the rest.
 */
import { z } from "zod";

/** The tool offers 1, 2 or 3 personas (PERSONA_OPTIONS on the page). */
export const MAX_PERSONAS = 3;

/** Founder inputs, as the tool's form sends them. */
export const FOUNDER_TEXT_MAX = 2_000;
export const FOUNDER_CHOICE_MAX = 120;
export const ADDITIONAL_RESEARCH_MAX = 6_000;

/** Persona objects echo the model's own output back for the cross and strategy steps. */
export const PERSONA_TEXT_MAX = 1_000;
export const PERSONA_LONG_TEXT_MAX = 3_000;
export const PERSONA_RAW_TEXT_MAX = 12_000;
export const PERSONA_LIST_MAX = 12;
const PERSONA_RECORD_KEYS_MAX = 8;

const required = (max: number) => z.string().min(1).max(max);

const founderShape = {
  productService: required(FOUNDER_TEXT_MAX),
  problemSolved: required(FOUNDER_TEXT_MAX),
  businessType: required(FOUNDER_CHOICE_MAX),
  priceRange: required(FOUNDER_CHOICE_MAX),
  customerDescription: required(FOUNDER_TEXT_MAX),
  customerGoal: required(FOUNDER_TEXT_MAX),
  onlineChannels: required(FOUNDER_TEXT_MAX),
  additionalResearch: z.string().max(ADDITIONAL_RESEARCH_MAX).optional().default(""),
};

export const founderInputsSchema = z.object(founderShape).strict();
export type FounderInputs = z.infer<typeof founderInputsSchema>;

/** The strategy step also sends the whole form, which adds the persona count. */
const strategyFormSchema = z
  .object({ ...founderShape, personaCount: z.number().int().min(1).max(MAX_PERSONAS) })
  .strict();

/*
 * A persona is model output that the page parsed and sends back, so its
 * scalars may be strings or numbers and its lists may hold small objects.
 * Unknown keys are dropped (not rejected): the page spreads whatever the
 * model returned, and only the known fields reach the next prompt.
 */
const scalar = (max: number) => z.union([z.string().max(max), z.number().finite(), z.null()]).optional();

const listItem = z.union([
  z.string().max(PERSONA_TEXT_MAX),
  z.number().finite(),
  z
    .record(z.union([z.string().max(PERSONA_TEXT_MAX), z.number().finite(), z.boolean(), z.null()]))
    .refine((o) => Object.keys(o).length <= PERSONA_RECORD_KEYS_MAX && Object.keys(o).every((k) => k.length <= 64)),
]);
const list = z.array(listItem).max(PERSONA_LIST_MAX).optional();

export const personaSchema = z.object({
  name: scalar(PERSONA_TEXT_MAX),
  archetypeTitle: scalar(PERSONA_TEXT_MAX),
  age: scalar(PERSONA_TEXT_MAX),
  locationType: scalar(PERSONA_TEXT_MAX),
  occupation: scalar(PERSONA_TEXT_MAX),
  goals: list,
  painPoints: list,
  motivations: list,
  purchaseBehavior: list,
  objections: list,
  channels: list,
  voiceSamples: list,
  conversionRecommendation: scalar(PERSONA_LONG_TEXT_MAX),
  fitScore: scalar(PERSONA_TEXT_MAX),
  fitScoreReason: scalar(PERSONA_LONG_TEXT_MAX),
  rawText: scalar(PERSONA_RAW_TEXT_MAX),
});
export type PersonaInput = z.infer<typeof personaSchema>;

const personaRequest = z
  .object({
    mode: z.literal("persona"),
    founderInputs: founderInputsSchema,
    personaNumber: z.number().int().min(1).max(MAX_PERSONAS),
    totalPersonas: z.number().int().min(1).max(MAX_PERSONAS),
  })
  .strict();

const crossRequest = z
  .object({
    mode: z.literal("cross"),
    founderInputs: founderInputsSchema,
    allPersonas: z.array(personaSchema).min(2).max(MAX_PERSONAS),
  })
  .strict();

const strategyRequest = z
  .object({
    mode: z.literal("strategy"),
    founderInputs: founderInputsSchema,
    strategyPayload: z
      .object({
        founderInputs: strategyFormSchema.optional(),
        personas: z.array(personaSchema).min(1).max(MAX_PERSONAS),
      })
      .strict(),
  })
  .strict();

export const personaRequestSchema = z
  .discriminatedUnion("mode", [personaRequest, crossRequest, strategyRequest])
  .superRefine((req, ctx) => {
    if (req.mode === "persona" && req.personaNumber > req.totalPersonas) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["personaNumber"], message: "out of range" });
    }
  });
export type PersonaRequest = z.infer<typeof personaRequestSchema>;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Cheap structural limits checked before Zod: the request is an object and
 * every array a persona request can carry is within its count. Anything this
 * passes is still fully validated by `personaRequestSchema`.
 */
export function withinStructuralLimits(body: unknown): boolean {
  if (!isRecord(body)) return false;
  const personas: unknown[] = [];
  if ("allPersonas" in body) {
    if (!Array.isArray(body.allPersonas) || body.allPersonas.length > MAX_PERSONAS) return false;
    personas.push(...body.allPersonas);
  }
  if ("strategyPayload" in body) {
    const sp = body.strategyPayload;
    if (!isRecord(sp) || !Array.isArray(sp.personas) || sp.personas.length > MAX_PERSONAS) return false;
    personas.push(...sp.personas);
  }
  for (const p of personas) {
    if (!isRecord(p)) return false;
    for (const value of Object.values(p)) {
      if (Array.isArray(value) && value.length > PERSONA_LIST_MAX) return false;
    }
  }
  return true;
}

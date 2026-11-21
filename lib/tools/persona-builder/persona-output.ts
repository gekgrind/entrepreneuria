/**
 * Bounds the persona text the server returns in persona mode, so the persona
 * the page builds from it (parsePersonaText in
 * app/tools/customer-persona-builder/page.tsx) is always accepted by the
 * cross and strategy steps, within PERSONA_MAX_BYTES.
 *
 * - Text that parses as a JSON object is reduced to the fields the schema
 *   consumes, each cut to its limit, then trimmed to the byte budget.
 * - Anything else becomes the page's parse fallback: raw text, cut to its
 *   limits.
 *
 * Model output within the limits is returned unchanged in content: only
 * unknown keys and formatting whitespace are dropped.
 */
import {
  PERSONA_LIST_FIELDS,
  PERSONA_LIST_MAX,
  PERSONA_MAX_BYTES,
  PERSONA_RAW_TEXT_MAX,
  PERSONA_RECORD_KEYS_MAX,
  PERSONA_RECORD_KEY_LENGTH_MAX,
  PERSONA_SCALAR_FIELDS,
  PERSONA_TEXT_MAX,
} from "./schema";

/** Room left for what the page adds to a parsed persona (default lists, fitScore). */
const PAGE_ADDITIONS_RESERVE_BYTES = 1024;
/** Room left for the page's fixed fallback fields around rawText. */
const PAGE_FALLBACK_RESERVE_BYTES = 2048;

export const PERSONA_OUTPUT_MAX_BYTES = PERSONA_MAX_BYTES - PAGE_ADDITIONS_RESERVE_BYTES;
export const PERSONA_RAW_OUTPUT_MAX_BYTES = PERSONA_MAX_BYTES - PAGE_FALLBACK_RESERVE_BYTES;

type Scalar = string | number | null;
type ListItem = string | number | Record<string, string | number | boolean | null>;
type BoundedPersona = Record<string, Scalar | ListItem[]>;

const encoder = new TextEncoder();
const jsonBytes = (value: unknown) => encoder.encode(JSON.stringify(value)).length;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Cut to `max` UTF-16 units without leaving half a surrogate pair. */
function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  let end = max;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return text.slice(0, end);
}

function boundScalar(value: unknown, max: number): Scalar | undefined {
  if (typeof value === "string") return cut(value, max);
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (value === null) return null;
  return undefined;
}

function boundListItem(item: unknown): ListItem | undefined {
  if (typeof item === "string") return cut(item, PERSONA_TEXT_MAX);
  if (typeof item === "number") return Number.isFinite(item) ? item : undefined;
  if (!isPlainObject(item)) return undefined;
  const record: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(item)) {
    if (Object.keys(record).length >= PERSONA_RECORD_KEYS_MAX) break;
    if (key.length > PERSONA_RECORD_KEY_LENGTH_MAX) continue;
    if (typeof value === "boolean") record[key] = value;
    else {
      const scalar = boundScalar(value, PERSONA_TEXT_MAX);
      if (scalar !== undefined) record[key] = scalar;
    }
  }
  return record;
}

function boundObject(source: Record<string, unknown>): BoundedPersona {
  const persona: BoundedPersona = {};
  for (const [field, max] of Object.entries(PERSONA_SCALAR_FIELDS)) {
    const value = boundScalar(source[field], max);
    if (value !== undefined) persona[field] = value;
  }
  const candidates: Record<string, ListItem[]> = {};
  for (const field of PERSONA_LIST_FIELDS) {
    const value = source[field];
    candidates[field] = Array.isArray(value)
      ? value
          .slice(0, PERSONA_LIST_MAX)
          .map(boundListItem)
          .filter((item): item is ListItem => item !== undefined)
      : [];
    persona[field] = [];
  }

  // Scalars first: if they alone overflow the budget, halve the longest text until they fit.
  while (jsonBytes(persona) > PERSONA_OUTPUT_MAX_BYTES) {
    const longest = Object.keys(PERSONA_SCALAR_FIELDS)
      .filter((f) => typeof persona[f] === "string" && (persona[f] as string).length > 0)
      .sort((a, b) => (persona[b] as string).length - (persona[a] as string).length)[0];
    if (longest === undefined) break;
    const text = persona[longest] as string;
    persona[longest] = cut(text, Math.floor(text.length / 2));
  }

  // Then list items, one per list in turn, while they fit. Adding an item
  // costs its own bytes plus a comma after the first.
  let used = jsonBytes(persona);
  for (let i = 0; i < PERSONA_LIST_MAX; i++) {
    for (const field of PERSONA_LIST_FIELDS) {
      const item = candidates[field][i];
      if (item === undefined) continue;
      const list = persona[field] as ListItem[];
      const cost = jsonBytes(item) + (list.length > 0 ? 1 : 0);
      if (used + cost > PERSONA_OUTPUT_MAX_BYTES) continue;
      list.push(item);
      used += cost;
    }
  }
  return persona;
}

function boundRawText(text: string): string {
  let t = cut(text, PERSONA_RAW_TEXT_MAX);
  if (jsonBytes(t) <= PERSONA_RAW_OUTPUT_MAX_BYTES) return t;
  let lo = 0;
  let hi = t.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (jsonBytes(cut(t, mid)) <= PERSONA_RAW_OUTPUT_MAX_BYTES) lo = mid;
    else hi = mid - 1;
  }
  t = cut(t, lo);
  return t;
}

function tryParse(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

export function boundPersonaOutput(text: string): string {
  const parsed = tryParse(text);
  if (parsed.ok) {
    // The page spreads a parsed value: a non-object would spread into
    // index keys, so it is carried as raw text instead.
    return JSON.stringify(boundObject(isPlainObject(parsed.value) ? parsed.value : { rawText: text }));
  }
  const raw = boundRawText(text);
  // Cutting could leave text that now parses; bound it as the page would read it.
  const reparsed = raw === text ? { ok: false as const } : tryParse(raw);
  if (reparsed.ok) {
    return JSON.stringify(boundObject(isPlainObject(reparsed.value) ? reparsed.value : { rawText: raw }));
  }
  return raw;
}

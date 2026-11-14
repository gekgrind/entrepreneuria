/*
 * CSP violation intake: parse what browsers send, keep only what helps
 * diagnose a violation, and log it as one structured line.
 *
 * Two wire formats arrive:
 *   - `report-uri`:  Content-Type application/csp-report,
 *                    body {"csp-report": {"document-uri": …, …}}
 *   - `report-to`:   Content-Type application/reports+json,
 *                    body [{"type": "csp-violation", "body": {"documentURL": …}}]
 *
 * Nothing from a report is trusted or echoed back. URLs are reduced to
 * origin + path before logging: auth pages carry `code`, `token_hash` and
 * `next` in their query strings, and those must never reach a log.
 */

export const CSP_REPORT_MAX_BYTES = 16 * 1024;
const MAX_REPORTS_PER_REQUEST = 20;
const SAMPLE_MAX_CHARS = 80;
const FIELD_MAX_CHARS = 200;

export const CSP_REPORT_CONTENT_TYPES = [
  "application/csp-report",
  "application/reports+json",
  "application/json",
];

export type CspViolation = {
  disposition: string | null;
  directive: string | null;
  blocked: string | null;
  document: string | null;
  source: string | null;
  line: number | null;
  sample: string | null;
};

function clip(value: string, max: number) {
  /* Control characters would let a report forge extra log lines. */
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ");
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function str(value: unknown, max = FIELD_MAX_CHARS) {
  return typeof value === "string" && value.length > 0 ? clip(value, max) : null;
}

/**
 * A reported location reduced to scheme://host/path. CSP keywords
 * (`inline`, `eval`, `data`, `blob`, …) are not URLs and pass through.
 */
export function redactReportedUrl(value: unknown) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "wss:" || url.protocol === "ws:") {
      return clip(`${url.origin}${url.pathname}`, FIELD_MAX_CHARS);
    }

    /* data:, blob:, chrome-extension:, … : the scheme alone identifies it. */
    return clip(url.protocol, FIELD_MAX_CHARS);
  } catch {
    return clip(value, 40);
  }
}

function lineNumber(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function fromLegacy(report: Record<string, unknown>): CspViolation {
  return {
    disposition: str(report.disposition, 20),
    directive: str(report["effective-directive"]) ?? str(report["violated-directive"]),
    blocked: redactReportedUrl(report["blocked-uri"]),
    document: redactReportedUrl(report["document-uri"]),
    source: redactReportedUrl(report["source-file"]),
    line: lineNumber(report["line-number"]),
    sample: str(report["script-sample"], SAMPLE_MAX_CHARS),
  };
}

function fromReportingApi(body: Record<string, unknown>): CspViolation {
  return {
    disposition: str(body.disposition, 20),
    directive: str(body.effectiveDirective),
    blocked: redactReportedUrl(body.blockedURL),
    document: redactReportedUrl(body.documentURL),
    source: redactReportedUrl(body.sourceFile),
    line: lineNumber(body.lineNumber),
    sample: str(body.sample, SAMPLE_MAX_CHARS),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The violations in a parsed report body, or null if it is not one. */
export function parseCspReport(payload: unknown): CspViolation[] | null {
  if (isRecord(payload) && isRecord(payload["csp-report"])) {
    return [fromLegacy(payload["csp-report"])];
  }

  if (Array.isArray(payload)) {
    const violations = payload
      .slice(0, MAX_REPORTS_PER_REQUEST)
      .filter(
        (entry): entry is { type: string; body: Record<string, unknown> } =>
          isRecord(entry) && entry.type === "csp-violation" && isRecord(entry.body),
      )
      .map((entry) => fromReportingApi(entry.body));

    return violations.length > 0 ? violations : null;
  }

  return null;
}

/**
 * Reads at most `maxBytes` of a body; null when it is larger. A missing
 * or lying Content-Length cannot make this buffer more than the cap.
 */
export async function readCappedBody(
  body: ReadableStream<Uint8Array> | null,
  maxBytes = CSP_REPORT_MAX_BYTES,
) {
  if (!body) {
    return "";
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) break;

    total += value.byteLength;

    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }

    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(merged);
}

/*
 * A per-process cap on logged violations, so a page that violates in a
 * loop, or someone posting reports, cannot flood the server log. What is
 * dropped is counted and reported once the window rolls over.
 */
export function createViolationLogLimiter({
  limit = 120,
  windowMs = 60_000,
  now = () => Date.now(),
}: { limit?: number; windowMs?: number; now?: () => number } = {}) {
  let windowStart = now();
  let logged = 0;
  let dropped = 0;

  return {
    /** Whether to log one more violation, plus how many the last window dropped. */
    take(): { allowed: boolean; droppedInPreviousWindow: number } {
      const current = now();
      let droppedInPreviousWindow = 0;

      if (current - windowStart >= windowMs) {
        droppedInPreviousWindow = dropped;
        windowStart = current;
        logged = 0;
        dropped = 0;
      }

      if (logged >= limit) {
        dropped += 1;
        return { allowed: false, droppedInPreviousWindow };
      }

      logged += 1;
      return { allowed: true, droppedInPreviousWindow };
    },
  };
}

export const CSP_VIOLATION_LOG_PREFIX = "[csp-violation]";

export function formatViolationLogLine(violation: CspViolation) {
  return `${CSP_VIOLATION_LOG_PREFIX} ${JSON.stringify(violation)}`;
}

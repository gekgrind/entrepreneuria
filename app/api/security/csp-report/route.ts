import { NextResponse } from "next/server";

import {
  CSP_REPORT_CONTENT_TYPES,
  CSP_VIOLATION_LOG_PREFIX,
  createViolationLogLimiter,
  formatViolationLogLine,
  parseCspReport,
  readCappedBody,
} from "@/lib/security/csp-report";

/*
 * Where browsers send Content-Security-Policy violation reports
 * (lib/security/csp.ts). Each violation is written to the server log as
 * one `[csp-violation] {json}` line; docs/security/csp-rollout.md says how
 * to read them and when the policy can be enforced.
 *
 * Unauthenticated by design (browsers send reports without credentials),
 * size-capped, and rate-capped per process. It never echoes input.
 */

export const dynamic = "force-dynamic";

const limiter = createViolationLogLimiter();

function empty(status: number) {
  return new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";

  if (!CSP_REPORT_CONTENT_TYPES.includes(contentType)) {
    return empty(415);
  }

  const text = await readCappedBody(request.body);

  if (text === null) {
    return empty(413);
  }

  let payload: unknown;

  try {
    payload = JSON.parse(text);
  } catch {
    return empty(400);
  }

  const violations = parseCspReport(payload);

  if (!violations) {
    return empty(400);
  }

  for (const violation of violations) {
    const { allowed, droppedInPreviousWindow } = limiter.take();

    if (droppedInPreviousWindow > 0) {
      console.warn(
        `${CSP_VIOLATION_LOG_PREFIX} ${JSON.stringify({ dropped: droppedInPreviousWindow })}`,
      );
    }

    if (allowed) {
      console.warn(formatViolationLogLine(violation));
    }
  }

  return empty(204);
}

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { POST } from "../../app/api/security/csp-report/route";
import {
  CSP_REPORT_MAX_BYTES,
  createViolationLogLimiter,
  formatViolationLogLine,
  parseCspReport,
  readCappedBody,
  redactReportedUrl,
} from "./csp-report";

describe("redactReportedUrl", () => {
  it("drops query strings and fragments, where auth codes and tokens travel", () => {
    assert.equal(
      redactReportedUrl("https://entrepreneuria.io/auth/callback?code=SECRET&next=%2Fdashboard#access_token=SECRET"),
      "https://entrepreneuria.io/auth/callback",
    );
  });

  it("keeps CSP keywords and reduces opaque schemes to the scheme", () => {
    assert.equal(redactReportedUrl("inline"), "inline");
    assert.equal(redactReportedUrl("eval"), "eval");
    assert.equal(redactReportedUrl("data:text/javascript,alert(1)"), "data:");
    assert.equal(redactReportedUrl("chrome-extension://abcdef/inject.js"), "chrome-extension:");
  });

  it("ignores non-strings", () => {
    assert.equal(redactReportedUrl(42), null);
    assert.equal(redactReportedUrl(undefined), null);
  });
});

describe("parseCspReport", () => {
  it("reads the report-uri format", () => {
    const [violation] = parseCspReport({
      "csp-report": {
        "document-uri": "https://entrepreneuria.io/login?next=%2Fdashboard",
        "effective-directive": "script-src-elem",
        "blocked-uri": "https://evil.example/clickfix.js?id=1",
        disposition: "report",
        "source-file": "https://entrepreneuria.io/_next/static/chunks/a.js",
        "line-number": 12,
        "script-sample": "",
      },
    }) ?? [];

    assert.deepEqual(violation, {
      disposition: "report",
      directive: "script-src-elem",
      blocked: "https://evil.example/clickfix.js",
      document: "https://entrepreneuria.io/login",
      source: "https://entrepreneuria.io/_next/static/chunks/a.js",
      line: 12,
      sample: null,
    });
  });

  it("reads the Reporting API format and skips other report types", () => {
    const violations = parseCspReport([
      { type: "deprecation", body: { id: "x" } },
      {
        type: "csp-violation",
        body: {
          documentURL: "https://entrepreneuria.io/login",
          effectiveDirective: "script-src-elem",
          blockedURL: "inline",
          disposition: "report",
          sample: "navigator.clipboard.writeText('powershell -w h …')",
        },
      },
    ]);

    assert.equal(violations?.length, 1);
    assert.equal(violations?.[0]?.blocked, "inline");
    assert.match(violations?.[0]?.sample ?? "", /^navigator\.clipboard/);
  });

  it("rejects anything that is not a report", () => {
    for (const payload of [null, 1, "x", {}, [], [{ type: "csp-violation" }], { "csp-report": "x" }]) {
      assert.equal(parseCspReport(payload), null, JSON.stringify(payload));
    }
  });

  it("strips control characters so a report cannot forge log lines", () => {
    const [violation] = parseCspReport({
      "csp-report": { "effective-directive": "script-src\n[csp-violation] forged", "script-sample": "a\r\nb" },
    }) ?? [];

    assert.doesNotMatch(formatViolationLogLine(violation!), /\n|\r/);
  });
});

describe("readCappedBody", () => {
  function stream(bytes: number) {
    return new Response("x".repeat(bytes)).body;
  }

  it("returns the body under the cap and null over it", async () => {
    assert.equal(await readCappedBody(stream(10)), "x".repeat(10));
    assert.equal(await readCappedBody(stream(CSP_REPORT_MAX_BYTES + 1)), null);
  });
});

describe("violation log limiter", () => {
  it("caps logs per window and reports what it dropped", () => {
    let time = 0;
    const limiter = createViolationLogLimiter({ limit: 2, windowMs: 1000, now: () => time });

    assert.equal(limiter.take().allowed, true);
    assert.equal(limiter.take().allowed, true);
    assert.equal(limiter.take().allowed, false);
    assert.equal(limiter.take().allowed, false);

    time = 1000;
    assert.deepEqual(limiter.take(), { allowed: true, droppedInPreviousWindow: 2 });
  });
});

describe("POST /api/security/csp-report", () => {
  const originalWarn = console.warn;
  let lines: string[] = [];

  beforeEach(() => {
    lines = [];
    console.warn = (...args: unknown[]) => {
      lines.push(args.join(" "));
    };
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  function post(body: string, contentType = "application/csp-report") {
    return POST(
      new Request("http://localhost:3000/api/security/csp-report", {
        method: "POST",
        headers: { "content-type": contentType },
        body,
      }),
    );
  }

  it("logs a redacted violation and answers 204", async () => {
    const response = await post(
      JSON.stringify({
        "csp-report": {
          "document-uri": "https://entrepreneuria.io/auth/confirm?token_hash=SECRET",
          "effective-directive": "script-src-elem",
          "blocked-uri": "https://evil.example/x.js",
        },
      }),
    );

    assert.equal(response.status, 204);
    assert.equal(lines.length, 1);
    assert.match(lines[0]!, /^\[csp-violation\] /);
    assert.doesNotMatch(lines[0]!, /SECRET/);
  });

  it("accepts the Reporting API content type", async () => {
    const response = await post(
      JSON.stringify([{ type: "csp-violation", body: { effectiveDirective: "img-src", blockedURL: "https://x.test/a.png" } }]),
      "application/reports+json",
    );

    assert.equal(response.status, 204);
  });

  it("refuses other content types, oversize and malformed bodies without logging", async () => {
    assert.equal((await post("{}", "text/plain")).status, 415);
    assert.equal((await post("x".repeat(CSP_REPORT_MAX_BYTES + 1))).status, 413);
    assert.equal((await post("{not json")).status, 400);
    assert.equal((await post(JSON.stringify({ hello: "world" }))).status, 400);
    assert.equal(lines.length, 0);
  });
});

/**
 * Shared fixtures for the leads-only mode tests. Not matched by the
 * `*.test.ts` glob, so it is imported, never run on its own.
 */
import { randomUUID } from "node:crypto";

import { GhlError, type CrmLead, type LeadCrm } from "../../integrations/ghl/client";
import { createRateLimiter } from "../../rate-limit";

import type { HandlerDeps } from "./inquiry-handler";
import { createLeadsRuntime, type LeadsRuntime } from "./leads-runtime";
import { LEADS_RELEASE_GATES } from "./release-gates";

export const ORIGIN = "https://entrepreneuria.io";
export const ENDPOINT = `${ORIGIN}/api/services/websites/inquiry`;
export const SECRET = "s".repeat(40);

export function validLeadsEnv(over: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    WEBSITES_SERVICES_MODE: "leads",
    WEBSITES_LEADS_RELEASE_AUTHORIZED: "true",
    WEBSITES_ALERT_WEBHOOK_URL: "https://alerts.example.test/hook",
    WEBSITES_ALERT_WEBHOOK_SECRET: SECRET,
    TURNSTILE_SECRET_KEY: "turnstile-secret",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site",
    WEBSITES_IP_HASH_SALT: "x".repeat(24),
    WEBSITES_CLIENT_IP_SOURCE: "xff-last",
    WEBSITES_PUBLIC_ORIGIN: ORIGIN,
    GHL_API_TOKEN: "test-token",
    GHL_LOCATION_ID: "loc_test",
    GHL_PIPELINE_ID: "pipe_test",
    GHL_PIPELINE_STAGE_ID: "stage_test",
    WEBSITES_PREVIEW_INTAKE: "open",
    WEBSITES_PREVIEW_MAX_OPEN_REQUESTS: "5",
    ...over,
  };
}

/** Test-only: every leads gate passed with evidence. The real list is never mutated. */
export const PASSED_LEADS_GATES = LEADS_RELEASE_GATES.map((g) => ({ ...g, passed: true, evidence: "test fixture" }));

export interface FakeCrm extends LeadCrm {
  leads: CrmLead[];
  open: number;
  countCalls: number;
  failWith: GhlError | null;
  countFails: boolean;
}

export function fakeCrm(): FakeCrm {
  const crm: FakeCrm = {
    leads: [],
    open: 0,
    countCalls: 0,
    failWith: null,
    countFails: false,
    async syncLead(lead) {
      crm.leads.push(lead);
      if (crm.failWith) throw crm.failWith;
      return { contactId: "ct_1", opportunityId: "op_1", opportunityCreated: true, noteCreated: true, warnings: [] };
    },
    async countOpenOpportunities() {
      crm.countCalls += 1;
      if (crm.countFails) throw new GhlError("count failed", "opportunity", 503, true, undefined, { outcome: "unknown" });
      return crm.open;
    },
  };
  return crm;
}

export interface Harness {
  deps: HandlerDeps;
  crm: FakeCrm;
  alerts: Array<{ url: string; headers: Record<string, string>; body: string }>;
  storeCalls: { count: number };
  pending: Array<Promise<unknown>>;
  runtime: () => LeadsRuntime;
  /** Waits for scheduled alert deliveries, as Next's after() would. */
  flush(): Promise<void>;
}

export function harness(opts: {
  env?: Record<string, string | undefined>;
  gates?: HandlerDeps["leadsGates"];
  crm?: FakeCrm | null;
  turnstile?: (token: string) => Promise<boolean>;
  alertStatus?: number;
} = {}): Harness {
  const env = opts.env ?? validLeadsEnv();
  const crm = opts.crm === null ? null : (opts.crm ?? fakeCrm());
  const alerts: Harness["alerts"] = [];
  const storeCalls = { count: 0 };
  const pending: Array<Promise<unknown>> = [];
  const NOW = new Date("2026-11-09T12:00:00.000Z");

  let rt: LeadsRuntime | null = null;
  const deps: HandlerDeps = {
    env,
    now: () => NOW,
    log: () => {},
    getStore: () => {
      storeCalls.count += 1;
      throw new Error("the inquiry store must not be used in leads mode");
    },
    getCrm: () => crm,
    legacy: {
      rateLimiters: {
        ip: createRateLimiter({ limit: 5, windowMs: 60_000 }),
        email: createRateLimiter({ limit: 3, windowMs: 60_000 }),
      },
      verifyTurnstile: null,
    },
    leadsGates: opts.gates ?? PASSED_LEADS_GATES,
    leadsRuntime: (config) => {
      rt ??= createLeadsRuntime(config, {
        getCrm: () => crm,
        verifyTurnstileToken: opts.turnstile ?? (async (t) => t === "good"),
        environment: "test",
        now: () => NOW,
        sleep: async () => {},
        fetch: async (url, init) => {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries((init?.headers ?? {}) as Record<string, string>)) headers[k.toLowerCase()] = v;
          alerts.push({ url, headers, body: String(init?.body) });
          return new Response("", { status: opts.alertStatus ?? 200 });
        },
      });
      return rt;
    },
    schedule: (work) => {
      pending.push(work);
    },
  };

  return {
    deps,
    crm: crm as FakeCrm,
    alerts,
    storeCalls,
    pending,
    runtime: () => rt!,
    async flush() {
      await Promise.allSettled(pending);
    },
  };
}

export function payload(over: Record<string, unknown> = {}, fields: Record<string, unknown> = {}) {
  return {
    fields: {
      name: "Dana Reyes",
      email: `dana+${randomUUID().slice(0, 8)}@example.com`,
      business: "Reyes Plumbing",
      business_type: "Handyman or home repair",
      package_interest: "growth",
      style_interest: "modern-craftsman",
      ...fields,
    },
    idempotency_key: randomUUID(),
    page_url: "https://evil.example/not-our-page",
    turnstile_token: "good",
    ...over,
  };
}

export function req(
  body: unknown,
  headers: Record<string, string> = {},
  init: { raw?: string; method?: string } = {}
): Request {
  return new Request(ENDPOINT, {
    method: init.method ?? "POST",
    headers: {
      origin: ORIGIN,
      "content-type": "application/json",
      "x-forwarded-for": "198.51.100.7",
      ...headers,
    },
    body: init.raw ?? JSON.stringify(body),
  });
}

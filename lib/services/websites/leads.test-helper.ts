/**
 * Shared fixtures for the leads-only mode tests. Not matched by the
 * `*.test.ts` glob, so it is imported, never run on its own.
 * Synthetic hosts, placeholder secrets and documentation-range addresses only. No network.
 */
import { randomUUID } from "node:crypto";

import { GhlError, type CrmLead, type LeadCrm } from "../../integrations/ghl/client";
import { createRateLimiter } from "../../rate-limit";

import { WEBSITES_TURNSTILE_ACTION } from "./content";
import { handleInquiryPost, type InquiryRouteDeps } from "./inquiry-route";
import { createLeadsRuntime, type LeadsRuntime } from "./leads-runtime";
import { createMemoryReviewStore } from "./review-store";
import { LEADS_RELEASE_GATES } from "./release-gates";

export const HOST = "entrepreneuria.io";
export const ORIGIN = `https://${HOST}`;
export const ENDPOINT = `${ORIGIN}/api/services/websites/inquiry`;
export const STAGING = "staging.example.com";
export const SECRET = "s".repeat(40);
export const NOW = new Date("2026-11-09T12:00:00.000Z");

export function validLeadsEnv(over: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    WEBSITES_SERVICES_MODE: "leads",
    WEBSITES_LEADS_RELEASE_AUTHORIZED: "true",
    WEBSITES_IP_HASH_SALT: "x".repeat(24),
    WEBSITES_REVIEW_DIR: "/var/lib/entrepreneuria/websites-review",
    TURNSTILE_SECRET_KEY: "turnstile-secret",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site",
    WEBSITES_ALERT_WEBHOOK_URL: "https://alerts.example.test/hook",
    WEBSITES_ALERT_WEBHOOK_SECRET: SECRET,
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
  /** Emails (lowercase) that already exist in the CRM → contact id. */
  existing: Map<string, string>;
  lookups: string[];
  lookupFailWith: Error | null;
  leads: CrmLead[];
  open: number;
  countCalls: number;
  failWith: GhlError | null;
  countFails: boolean;
}

export function fakeCrm(): FakeCrm {
  const crm: FakeCrm = {
    existing: new Map(),
    lookups: [],
    lookupFailWith: null,
    leads: [],
    open: 0,
    countCalls: 0,
    failWith: null,
    countFails: false,
    async findContactByEmail(email) {
      crm.lookups.push(email);
      if (crm.lookupFailWith) throw crm.lookupFailWith;
      const id = crm.existing.get(email.trim().toLowerCase());
      return id ? { contactId: id } : null;
    },
    async syncLead(lead) {
      crm.leads.push(lead);
      if (crm.failWith) throw crm.failWith;
      // Like GHL: once synced, the email is an existing contact.
      crm.existing.set(lead.email.trim().toLowerCase(), "ct_1");
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
  deps: InquiryRouteDeps;
  reviews: ReturnType<typeof createMemoryReviewStore>;
  crm: FakeCrm;
  alerts: Array<{ url: string; headers: Record<string, string>; body: string }>;
  siteverify: { calls: number; failing: boolean; hostname: string };
  storeCalls: { count: number };
  pending: Array<Promise<unknown>>;
  /** Waits for scheduled alert deliveries, as Next's after() would. */
  flush(): Promise<void>;
  /** Sends a request through the real route handler. */
  send(request: Request): Promise<{ status: number; body: Record<string, unknown>; headers: Headers }>;
}

export function harness(opts: {
  env?: Record<string, string | undefined>;
  gates?: InquiryRouteDeps["leadsGates"];
  crm?: FakeCrm | null;
  alertStatus?: number;
  reviews?: ReturnType<typeof createMemoryReviewStore>;
} = {}): Harness {
  const reviews = opts.reviews ?? createMemoryReviewStore();
  const env = opts.env ?? validLeadsEnv();
  const crm = opts.crm === null ? null : (opts.crm ?? fakeCrm());
  const alerts: Harness["alerts"] = [];
  const storeCalls = { count: 0 };
  const pending: Array<Promise<unknown>> = [];
  const siteverify = { calls: 0, failing: false, hostname: env.WEBSITES_SERVICES_MODE === "nonproduction" ? STAGING : HOST };

  let rt: LeadsRuntime | null = null;
  const deps: InquiryRouteDeps = {
    env,
    getStore: () => {
      storeCalls.count += 1;
      throw new Error("the inquiry store must not be used in leads mode");
    },
    getCrm: () => crm,
    rateLimiters: {
      ip: createRateLimiter({ limit: 5, windowMs: 60_000 }),
      email: createRateLimiter({ limit: 3, windowMs: 60_000 }),
    },
    // Turnstile siteverify stand-in: token "good" passes, anything else fails the challenge.
    fetch: async (_url, init) => {
      siteverify.calls += 1;
      if (siteverify.failing) throw new Error("siteverify unreachable");
      const form = init!.body as FormData;
      const good = form.get("response") === "good";
      return Response.json({ success: good, action: WEBSITES_TURNSTILE_ACTION, hostname: siteverify.hostname });
    },
    now: () => NOW,
    log: () => {},
    leadsGates: opts.gates ?? PASSED_LEADS_GATES,
    leadsRuntime: (config) => {
      rt ??= createLeadsRuntime(config, {
        getCrm: () => crm,
        environment: "test",
        reviewStore: reviews,
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
    reviews,
    crm: crm as FakeCrm,
    alerts,
    siteverify,
    storeCalls,
    pending,
    async flush() {
      await Promise.allSettled(pending);
    },
    async send(request) {
      const res = await handleInquiryPost(request, deps);
      return { status: res.status, body: (await res.json()) as Record<string, unknown>, headers: res.headers };
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
    page_url: `${ORIGIN}/services/websites`,
    turnstile_token: "good",
    ...over,
  };
}

export function req(
  body: unknown,
  headers: Record<string, string> = {},
  init: { raw?: string } = {}
): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: {
      host: HOST,
      origin: ORIGIN,
      "content-type": "application/json",
      "x-real-ip": "198.51.100.7",
      ...headers,
    },
    body: init.raw ?? JSON.stringify(body),
  });
}

/** A request addressed to the synthetic staging host, for the non-leads modes. */
export function stagingReq(
  body: unknown,
  headers: Record<string, string> = {},
  init: { raw?: string; noOrigin?: boolean } = {}
): Request {
  const h: Record<string, string> = {
    host: STAGING,
    origin: `https://${STAGING}`,
    "content-type": "application/json",
    "x-real-ip": "198.51.100.7",
    ...headers,
  };
  if (init.noOrigin) delete h.origin;
  return new Request(`https://${STAGING}/api/services/websites/inquiry`, {
    method: "POST",
    headers: h,
    body: init.raw ?? JSON.stringify(body),
  });
}

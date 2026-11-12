/**
 * F4: a sandbox or nonproduction request must never reach the production GHL
 * sub-account. Everything here uses an in-process fake GHL, placeholder ids and
 * example.com addresses; nothing touches the network.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRateLimiter } from "../../rate-limit";
import { WEBSITES_TURNSTILE_ACTION } from "../../services/websites/content";
import { handleInquiryPost, type InquiryRouteDeps } from "../../services/websites/inquiry-route";
import type { CrmLead } from "./client";
import { createCrmProvider, crmTargetFor, decideCrm, SANDBOX_IDENTITY_FAIL_TTL_MS, SANDBOX_IDENTITY_OK_TTL_MS, type CrmContext } from "./crm-boundary";
import { createFakeGhl, type FakeLocation } from "./fake-ghl.test-helper";

const PROD_LOC = "loc_PRODUCTION_000001";
const SBX_LOC = "loc_sandbox";
const SBX_NAME = "Entrepreneuria Websites Sandbox";

const sandboxLocation = (over: Partial<FakeLocation> = {}): FakeLocation => ({
  id: SBX_LOC,
  name: SBX_NAME,
  pipelines: [{ id: "pipe_sbx", name: "Sandbox pipeline", stages: [{ id: "stage_sbx", name: "New" }, { id: "stage_sbx_2", name: "Other" }] }],
  customFields: [
    { id: "SbxStyleField0000001", name: "style_interest", fieldKey: "contact.style_interest", dataType: "TEXT" },
    { id: "SbxPackageField00002", name: "package_interest", fieldKey: "contact.package_interest", dataType: "TEXT" },
  ],
  ...over,
});

const PRODUCTION_ONLY = {
  GHL_API_TOKEN: "prod-token-0001",
  GHL_LOCATION_ID: PROD_LOC,
  GHL_PIPELINE_ID: "pipe_prod",
  GHL_PIPELINE_STAGE_ID: "stage_prod",
};
const SANDBOX = {
  GHL_SANDBOX_TOKEN: "sandbox-token-0001",
  GHL_SANDBOX_LOCATION_ID: SBX_LOC,
  GHL_SANDBOX_EXPECT_LOCATION_NAME: SBX_NAME,
  GHL_SANDBOX_PIPELINE_ID: "pipe_sbx",
  GHL_SANDBOX_PIPELINE_STAGE_ID: "stage_sbx",
  GHL_SANDBOX_CUSTOM_FIELD_IDS: JSON.stringify({ style_interest: "SbxStyleField0000001", package_interest: "SbxPackageField00002" }),
};

const NONPROD: CrmContext = { mode: "nonproduction", host: "staging.example.com" };
const LEADS_PROD: CrmContext = { mode: "leads", host: "entrepreneuria.io" };
const LEADS_STAGING: CrmContext = { mode: "leads", host: "staging.example.com" };

const lead = (over: Partial<CrmLead> = {}): CrmLead => ({
  name: "Dana Reyes",
  email: "dana@example.com",
  companyName: "Reyes Plumbing",
  source: "websites",
  tags: ["web-preview-request"],
  customFields: {},
  opportunityName: "Reyes Plumbing preview",
  note: "synthetic",
  reference: "ref-1",
  ...over,
});

const mutating = (calls: Array<{ method: string }>) => calls.filter((c) => c.method !== "GET");

function provider(env: Record<string, string>, ghl = createFakeGhl({ location: sandboxLocation() }), now = { t: 1_000_000 }) {
  const logs: string[] = [];
  return { ghl, logs, now, p: createCrmProvider({ env, fetch: ghl.fetch, now: () => now.t, log: (m) => logs.push(m) }) };
}

describe("F4: which CRM a request may use", () => {
  it("production credentials only for leads/production mode on the canonical host", () => {
    assert.equal(crmTargetFor(LEADS_PROD), "production");
    assert.equal(crmTargetFor({ mode: "production", host: "entrepreneuria.io" }), "production");
    assert.equal(crmTargetFor(NONPROD), "sandbox");
    assert.equal(crmTargetFor({ mode: "nonproduction", host: "entrepreneuria.io" }), "sandbox", "nonproduction mode never gets production CRM, even on the production host");
    assert.equal(crmTargetFor(LEADS_STAGING), "sandbox", "leads rehearsal on a staging host stays in the sandbox");
    assert.equal(crmTargetFor({ mode: "leads", host: "localhost:3000" }), "sandbox");
    assert.equal(crmTargetFor({ mode: "leads", host: "www.entrepreneuria.io" }), "sandbox", "only the canonical host");
  });

  it("the Codex repro: nonproduction with only ordinary credentials gets no CRM and sends nothing", async () => {
    const { p, ghl, logs } = provider(PRODUCTION_ONLY);
    assert.equal(p.getCrm(NONPROD), null);
    assert.equal(ghl.calls.length, 0);
    assert.match(logs.join("\n"), /sandbox_not_configured/);
    assert.doesNotMatch(logs.join("\n"), /prod-token-0001|loc_PRODUCTION/);
  });

  it("a leads rehearsal on a staging host with only production credentials gets no CRM", () => {
    const { p, ghl } = provider(PRODUCTION_ONLY);
    assert.equal(p.getCrm(LEADS_STAGING), null);
    assert.equal(ghl.calls.length, 0);
  });

  it("production target is unchanged: ordinary credentials on the canonical host in leads mode", () => {
    const { p } = provider(PRODUCTION_ONLY);
    assert.ok(p.getCrm(LEADS_PROD));
    const d = decideCrm(LEADS_PROD, PRODUCTION_ONLY);
    assert.ok(d.ok && d.target === "production" && d.config.locationId === PROD_LOC);
  });

  it("production CRM is refused when not fully configured", () => {
    for (const missing of Object.keys(PRODUCTION_ONLY)) {
      const env = { ...PRODUCTION_ONLY, [missing]: "" };
      const d = decideCrm(LEADS_PROD, env);
      assert.ok(!d.ok && d.reason === "production_not_configured" && d.detail.includes(missing), missing);
    }
  });
});

describe("F4: sandbox configuration is mandatory and separate", () => {
  it("each missing sandbox setting refuses the CRM", () => {
    for (const missing of Object.keys(SANDBOX)) {
      const env = { ...PRODUCTION_ONLY, ...SANDBOX, [missing]: "" };
      const d = decideCrm(NONPROD, env);
      assert.ok(!d.ok && d.reason === "sandbox_not_configured" && d.detail.includes(missing), missing);
    }
  });

  it("malformed sandbox custom field ids refuse the CRM", () => {
    for (const bad of ["not json", "[]", JSON.stringify({ style_interest: "x" }), JSON.stringify({ unknown_field: "ABCDEFGHIJ123456" })]) {
      const d = decideCrm(NONPROD, { ...SANDBOX, GHL_SANDBOX_CUSTOM_FIELD_IDS: bad });
      assert.equal(d.ok, false, bad);
    }
  });

  it("a sandbox value equal to its production counterpart refuses the CRM (mismatched credentials)", () => {
    const swaps: Array<[string, string]> = [
      ["GHL_SANDBOX_TOKEN", PRODUCTION_ONLY.GHL_API_TOKEN],
      ["GHL_SANDBOX_LOCATION_ID", PROD_LOC],
      ["GHL_SANDBOX_PIPELINE_ID", PRODUCTION_ONLY.GHL_PIPELINE_ID],
      ["GHL_SANDBOX_PIPELINE_STAGE_ID", PRODUCTION_ONLY.GHL_PIPELINE_STAGE_ID],
    ];
    for (const [key, value] of swaps) {
      const d = decideCrm(NONPROD, { ...PRODUCTION_ONLY, ...SANDBOX, [key]: value });
      assert.ok(!d.ok && d.reason === "sandbox_shares_production_value", key);
      const prod = decideCrm(LEADS_PROD, { ...PRODUCTION_ONLY, ...SANDBOX, [key]: value });
      assert.ok(!prod.ok && prod.reason === "production_shares_sandbox_value", `production side: ${key}`);
    }
  });

  it("the sandbox target reads only GHL_SANDBOX_* for its credentials", () => {
    const d = decideCrm(NONPROD, { ...PRODUCTION_ONLY, ...SANDBOX });
    assert.ok(d.ok && d.target === "sandbox");
    assert.equal(d.config.token, SANDBOX.GHL_SANDBOX_TOKEN);
    assert.equal(d.config.locationId, SBX_LOC);
    assert.equal(d.config.pipelineId, "pipe_sbx");
  });
});

describe("F4: the sandbox identity is verified live, before any call", () => {
  const env = { ...PRODUCTION_ONLY, ...SANDBOX };

  it("valid sandbox: verified with GETs only, then the sync is allowed and stays in the sandbox location", async () => {
    const { p, ghl } = provider(env);
    const crm = p.getCrm(NONPROD)!;
    assert.ok(crm);
    const result = await crm.syncLead(lead());
    assert.ok(result.contactId);
    assert.ok(ghl.calls.length > 0 && mutating(ghl.calls).length > 0);
    assert.ok(ghl.calls.every((c) => !JSON.stringify(c.body ?? {}).includes(PROD_LOC)));
    assert.ok(ghl.calls.every((c) => c.headers.Authorization === `Bearer ${SANDBOX.GHL_SANDBOX_TOKEN}`));
    assert.equal(ghl.calls.some((c) => c.headers.Authorization?.includes("prod-token")), false);
    // The identity check ran first, read-only.
    assert.equal(ghl.calls[0].method, "GET");
    assert.match(ghl.calls[0].path, /^\/locations\/loc_sandbox$/);
  });

  const refused: Array<[string, Parameters<typeof createFakeGhl>[0], (g: ReturnType<typeof createFakeGhl>) => void]> = [
    ["location name without 'sandbox'", { location: sandboxLocation({ name: "Entrepreneuria Websites" }) }, () => {}],
    ["location name different from the expected name", { location: sandboxLocation({ name: "Other Sandbox" }) }, () => {}],
    ["token reaches a different location id", { location: sandboxLocation({ id: "loc_other" }) }, () => {}],
    ["pipeline not in the location", { location: sandboxLocation({ pipelines: [{ id: "pipe_x", name: "x", stages: [{ id: "s", name: "s" }] }] }) }, () => {}],
    ["custom field ids not the location's", { location: sandboxLocation({ customFields: [] }) }, () => {}],
  ];
  for (const [label, opts] of refused) {
    it(`refuses when ${label}: nothing is written`, async () => {
      const ghl = createFakeGhl(opts);
      const { p, logs } = provider(env, ghl);
      await assert.rejects(p.getCrm(NONPROD)!.syncLead(lead()), /identity is not verified/);
      assert.equal(mutating(ghl.calls).length, 0);
      assert.equal(ghl.contacts.size, 0);
      assert.ok(logs.length > 0);
      assert.ok(logs.every((l) => !l.includes(SANDBOX.GHL_SANDBOX_TOKEN)));
    });
  }

  it("refuses when any workflow is active, so test traffic cannot trigger automations", async () => {
    const ghl = createFakeGhl({ location: sandboxLocation() });
    ghl.workflows.push({ id: "wf1", name: "Welcome text", status: "published" });
    const { p } = provider(env, ghl);
    await assert.rejects(p.getCrm(NONPROD)!.syncLead(lead()), /identity is not verified/);
    assert.equal(mutating(ghl.calls).length, 0);
  });

  it("refuses when the identity check cannot be completed (network failure, unreadable body)", async () => {
    const down = createCrmProvider({
      env,
      fetch: async () => {
        throw new Error("network down");
      },
      log: () => {},
    });
    await assert.rejects(down.getCrm(NONPROD)!.syncLead(lead()), /identity is not verified/);
    const garbled = createCrmProvider({ env, fetch: async () => new Response("<html>", { status: 200 }), log: () => {} });
    await assert.rejects(garbled.getCrm(NONPROD)!.syncLead(lead()), /identity is not verified/);
  });

  it("every CRM method waits for the check, including the read-only lookups", async () => {
    const ghl = createFakeGhl({ location: sandboxLocation({ name: "Production" }) });
    const crm = provider(env, ghl).p.getCrm(NONPROD)!;
    await assert.rejects(crm.findContactByEmail!("dana@example.com"), /identity is not verified/);
    await assert.rejects(crm.countOpenOpportunities!(), /identity is not verified/);
    assert.ok(ghl.calls.every((c) => c.path.startsWith("/locations") || c.path.startsWith("/opportunities/pipelines") || c.path.startsWith("/workflows") || c.method === "GET"));
    assert.equal(mutating(ghl.calls).length, 0);
  });

  it("the result is cached while healthy and re-checked afterwards; a later rename stops writes", async () => {
    const loc = sandboxLocation();
    const ghl = createFakeGhl({ location: loc });
    const clock = { t: 1_000_000 };
    const { p } = provider(env, ghl, clock);
    const crm = p.getCrm(NONPROD)!;
    await crm.syncLead(lead({ email: "a@example.com", reference: "r-a" }));
    const checksAfterFirst = ghl.count("GET", `/locations/${SBX_LOC}`);
    clock.t += SANDBOX_IDENTITY_OK_TTL_MS - 1000;
    await crm.syncLead(lead({ email: "b@example.com", reference: "r-b" }));
    assert.equal(ghl.count("GET", `/locations/${SBX_LOC}`), checksAfterFirst, "cached");
    loc.name = "Entrepreneuria Websites (live)";
    clock.t += 2000;
    await assert.rejects(crm.syncLead(lead({ email: "c@example.com", reference: "r-c" })), /identity is not verified/);
    assert.equal(ghl.contacts.size, 2, "no write after the sandbox stopped looking like one");
  });

  it("a failed check is remembered briefly so a flood of requests does not hammer GHL, then retried", async () => {
    const ghl = createFakeGhl({ location: sandboxLocation({ name: "Production" }) });
    const clock = { t: 1_000_000 };
    const { p } = provider(env, ghl, clock);
    const crm = p.getCrm(NONPROD)!;
    await assert.rejects(crm.syncLead(lead()), /not verified/);
    const first = ghl.calls.length;
    await assert.rejects(crm.syncLead(lead()), /not verified/);
    assert.equal(ghl.calls.length, first, "no second identity check within the failure window");
    clock.t += SANDBOX_IDENTITY_FAIL_TTL_MS + 1;
    await assert.rejects(crm.syncLead(lead()), /not verified/);
    assert.ok(ghl.calls.length > first, "re-checked after the window");
  });

  it("concurrent requests share one identity check", async () => {
    const ghl = createFakeGhl({ location: sandboxLocation() });
    const crm = provider(env, ghl).p.getCrm(NONPROD)!;
    await Promise.all([1, 2, 3, 4].map((i) => crm.syncLead(lead({ email: `p${i}@example.com`, reference: `r-p${i}` }))));
    assert.equal(ghl.count("GET", `/locations/${SBX_LOC}`), 1);
  });
});

/* ---------------------------------------------------------------------------
 * Through the real route: gate -> boundary -> client. Gate D (production) stays
 * closed throughout; only nonproduction mode is on.
 * ------------------------------------------------------------------------- */
const ROUTE_ENV = {
  WEBSITES_SERVICES_MODE: "nonproduction",
  WEBSITES_NONPRODUCTION_HOSTS: "staging.example.com",
  WEBSITES_IP_HASH_SALT: "test-salt-0123456789abcdef",
  TURNSTILE_SECRET_KEY: "test-turnstile-secret",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test-turnstile-site-key",
};

function route(credentials: Record<string, string>, ghl = createFakeGhl({ location: sandboxLocation() })) {
  const crmProvider = createCrmProvider({ env: credentials, fetch: ghl.fetch, log: () => {} });
  const deps: InquiryRouteDeps = {
    env: ROUTE_ENV,
    getStore: () => null,
    getCrm: (ctx) => crmProvider.getCrm(ctx),
    rateLimiters: { ip: createRateLimiter({ limit: 50, windowMs: 60_000 }), email: createRateLimiter({ limit: 50, windowMs: 60_000 }) },
    fetch: async () => Response.json({ success: true, action: WEBSITES_TURNSTILE_ACTION, hostname: "staging.example.com" }),
    log: () => {},
  };
  const send = (email = "dana@example.com") =>
    handleInquiryPost(
      new Request("http://localhost:3000/api/services/websites/inquiry", {
        method: "POST",
        headers: { host: "staging.example.com", "content-type": "application/json", "x-real-ip": "203.0.113.7" },
        body: JSON.stringify({
          fields: { name: "Dana Reyes", email, business: "Reyes Plumbing", business_type: "Plumbing", package_interest: "starter" },
          idempotency_key: crypto.randomUUID(),
          page_url: "https://staging.example.com/services/websites",
          turnstile_token: "tok",
        }),
      }),
      deps
    );
  return { ghl, send };
}

describe("F4: through the inquiry route (nonproduction, production gate closed)", () => {
  it("the reproduced request: ordinary credentials only => unavailable, zero GHL traffic", async () => {
    const { ghl, send } = route(PRODUCTION_ONLY);
    const res = await send();
    assert.notEqual(res.status, 200);
    assert.equal(ghl.calls.length, 0);
  });

  it("valid sandbox-only intake succeeds and writes only to the sandbox", async () => {
    const { ghl, send } = route({ ...PRODUCTION_ONLY, ...SANDBOX });
    const res = await send();
    assert.equal(res.status, 200);
    assert.equal(ghl.contacts.size, 1);
    assert.ok(ghl.calls.every((c) => c.headers.Authorization === `Bearer ${SANDBOX.GHL_SANDBOX_TOKEN}`));
  });

  it("sandbox settings equal to production values => nothing is sent", async () => {
    const { ghl, send } = route({ ...PRODUCTION_ONLY, ...SANDBOX, GHL_SANDBOX_LOCATION_ID: PROD_LOC });
    assert.notEqual((await send()).status, 200);
    assert.equal(ghl.calls.length, 0);
  });

  it("a sandbox location that does not look like one => no write", async () => {
    const ghl = createFakeGhl({ location: sandboxLocation({ name: "Entrepreneuria Websites" }) });
    const { send } = route({ ...PRODUCTION_ONLY, ...SANDBOX }, ghl);
    assert.notEqual((await send()).status, 200);
    assert.equal(mutating(ghl.calls).length, 0);
    assert.equal(ghl.contacts.size, 0);
  });

  it("D-19 is preserved in the sandbox: an existing contact is never written", async () => {
    const ghl = createFakeGhl({ location: sandboxLocation() });
    const seeded = ghl.seedContact("dana@example.com", ["existing-tag"]);
    const { send } = route({ ...PRODUCTION_ONLY, ...SANDBOX }, ghl);
    await send("dana@example.com");
    assert.equal(mutating(ghl.calls).length, 0, "no upsert, tags, note or opportunity for an existing contact");
    assert.deepEqual([...ghl.contacts.get(seeded.id)!.tags], ["existing-tag"]);
  });
});

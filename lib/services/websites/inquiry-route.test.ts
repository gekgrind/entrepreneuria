import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CrmLead, LeadCrm } from "../../integrations/ghl/client";
import { createRateLimiter } from "../../rate-limit";

import { WEBSITES_TURNSTILE_ACTION } from "./content";
import { handleInquiryPost, MAX_INQUIRY_BODY_BYTES, type InquiryRouteDeps } from "./inquiry-route";
import { PASSED_LEADS_GATES, validLeadsEnv } from "./leads.test-helper";

/* Synthetic hosts, placeholder secrets and documentation-range addresses only. No network. */
const ENV = {
  WEBSITES_SERVICES_MODE: "nonproduction",
  WEBSITES_NONPRODUCTION_HOSTS: "staging.example.com",
  WEBSITES_IP_HASH_SALT: "test-salt-0123456789abcdef",
  TURNSTILE_SECRET_KEY: "test-turnstile-secret",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test-turnstile-site-key",
};
const URL_ = "http://localhost:3000/api/services/websites/inquiry";

function payload(over: Record<string, unknown> = {}) {
  return {
    fields: { name: "Dana Reyes", email: "dana@example.com", business: "Reyes Plumbing", business_type: "Plumbing", package_interest: "starter" },
    idempotency_key: "3f1c6f1e-6a43-4c55-9a39-3c7b6d1f0a11",
    page_url: "https://staging.example.com/services/websites",
    turnstile_token: "tok",
    ...over,
  };
}

function setup(over: Partial<InquiryRouteDeps> = {}, siteverify: Record<string, unknown> = { hostname: "staging.example.com" }) {
  const leads: CrmLead[] = [];
  const crm: LeadCrm = {
    async syncLead(lead) {
      leads.push(lead);
      return { contactId: "ct_1", opportunityId: "op_1", opportunityCreated: true, noteCreated: true, warnings: [] };
    },
  };
  const verifyCalls: FormData[] = [];
  const deps: InquiryRouteDeps = {
    env: ENV,
    getStore: () => null,
    getCrm: () => crm,
    rateLimiters: {
      ip: createRateLimiter({ limit: 5, windowMs: 60_000 }),
      email: createRateLimiter({ limit: 3, windowMs: 60_000 }),
    },
    fetch: async (_url, init) => {
      verifyCalls.push(init!.body as FormData);
      return Response.json({ success: true, action: WEBSITES_TURNSTILE_ACTION, ...siteverify });
    },
    log: () => {},
    ...over,
  };
  return { deps, leads, verifyCalls };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(URL_, {
    method: "POST",
    headers: { host: "staging.example.com", "content-type": "application/json", "x-real-ip": "203.0.113.7", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("inquiry route: gate wiring", () => {
  it("returns 404 with WEBSITES_SERVICES_MODE unset, without reading the body or calling anything", async () => {
    const { deps, leads, verifyCalls } = setup({ env: { ...ENV, WEBSITES_SERVICES_MODE: undefined } });
    const req = post(payload());
    const res = await handleInquiryPost(req, deps);
    assert.equal(res.status, 404);
    assert.equal(req.bodyUsed, false);
    assert.equal(leads.length + verifyCalls.length, 0);
  });

  it("returns 404 in production mode while release gates are open", async () => {
    const { deps } = setup({ env: { ...ENV, WEBSITES_SERVICES_MODE: "production", WEBSITES_OWNER_RELEASE_AUTHORIZED: "true" } });
    assert.equal((await handleInquiryPost(post(payload(), { host: "entrepreneuria.io" }), deps)).status, 404);
  });

  it("returns 404 on a host that is not allowlisted", async () => {
    const { deps } = setup();
    assert.equal((await handleInquiryPost(post(payload(), { host: "other.example.com" }), deps)).status, 404);
  });

  it("accepts a submission on the allowlisted host, verifying Turnstile with the configured secret", async () => {
    const { deps, leads, verifyCalls } = setup();
    const res = await handleInquiryPost(post(payload()), deps);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(verifyCalls[0].get("secret"), ENV.TURNSTILE_SECRET_KEY);
    assert.equal(leads[0].customFields.consent_page_url, "https://staging.example.com/services/websites");
  });

  it("checks the Turnstile hostname and action against this form", async () => {
    for (const reply of [{ hostname: "other.example.com" }, { hostname: "staging.example.com", action: "login" }]) {
      const { deps, leads } = setup({}, reply);
      const res = await handleInquiryPost(post(payload()), deps);
      assert.equal(res.status, 400);
      assert.equal((await res.json()).error, "verification_failed");
      assert.equal(leads.length, 0);
    }
  });

  it("checks page_url against the request origin, and never 500s on a malformed one", async () => {
    for (const page_url of ["https://other.example.com/services/websites", "not a url", ""]) {
      const { deps, leads, verifyCalls } = setup();
      const res = await handleInquiryPost(post(payload({ page_url })), deps);
      assert.equal(res.status, 400, page_url);
      const body = await res.json();
      assert.equal(body.error, "invalid");
      assert.ok(body.fieldErrors.page_url, page_url);
      assert.equal(leads.length + verifyCalls.length, 0, "rejected before Turnstile or CRM");
    }
  });
});

describe("inquiry route: request handling", () => {
  it("refuses an oversized body with 413", async () => {
    const { deps } = setup();
    const big = JSON.stringify(payload({ hp: "x".repeat(MAX_INQUIRY_BODY_BYTES) }));
    assert.equal((await handleInquiryPost(post(big), deps)).status, 413);
  });

  it("refuses malformed JSON with 400", async () => {
    const { deps } = setup();
    assert.equal((await handleInquiryPost(post("{not json"), deps)).status, 400);
  });

  it("rate-limits per client address and sends Retry-After", async () => {
    const { deps } = setup({
      rateLimiters: { ip: createRateLimiter({ limit: 1, windowMs: 60_000 }), email: createRateLimiter({ limit: 100, windowMs: 60_000 }) },
    });
    assert.equal((await handleInquiryPost(post(payload()), deps)).status, 200);
    const second = await handleInquiryPost(post(payload({ idempotency_key: "3f1c6f1e-6a43-4c55-9a39-3c7b6d1f0a12" })), deps);
    assert.equal(second.status, 429);
    assert.ok(Number(second.headers.get("retry-after")) > 0);
    // A different address has its own allowance; a spoofed X-Forwarded-For changes nothing.
    const other = await handleInquiryPost(
      post(payload({ idempotency_key: "3f1c6f1e-6a43-4c55-9a39-3c7b6d1f0a13" }), { "x-real-ip": "203.0.113.8" }),
      deps
    );
    assert.equal(other.status, 200);
    const spoofed = await handleInquiryPost(
      post(payload({ idempotency_key: "3f1c6f1e-6a43-4c55-9a39-3c7b6d1f0a14" }), { "x-forwarded-for": "198.51.100.9" }),
      deps
    );
    assert.equal(spoofed.status, 429);
  });

  it("requests without a client address share one bucket", async () => {
    const { deps } = setup({
      rateLimiters: { ip: createRateLimiter({ limit: 1, windowMs: 60_000 }), email: createRateLimiter({ limit: 100, windowMs: 60_000 }) },
    });
    const noIp = { "x-real-ip": "" };
    assert.equal((await handleInquiryPost(post(payload(), noIp), deps)).status, 200);
    const second = await handleInquiryPost(post(payload({ idempotency_key: "3f1c6f1e-6a43-4c55-9a39-3c7b6d1f0a15" }), noIp), deps);
    assert.equal(second.status, 429);
  });
});

describe("inquiry route: showcase mode stays closed", () => {
  for (const [label, env, leadsGates] of [
    ["showcase on the canonical host", { WEBSITES_SERVICES_MODE: "showcase", WEBSITES_CONTACT_EMAIL: "services@example.test" }, undefined],
    ["showcase with every intake secret, CRM setting and leads gate present", { ...validLeadsEnv(), WEBSITES_SERVICES_MODE: "showcase" }, PASSED_LEADS_GATES],
    ["an unrecognised mode", { ...validLeadsEnv(), WEBSITES_SERVICES_MODE: "Showcase" }, PASSED_LEADS_GATES],
  ] as const) {
    it(`returns 404 for ${label}, before reading the body or touching the store, CRM, Turnstile or leads runtime`, async () => {
      let touched = 0;
      const { deps, verifyCalls } = setup({
        env,
        leadsGates,
        getStore: () => (touched++, null),
        getCrm: () => (touched++, null),
        leadsRuntime: () => {
          touched++;
          throw new Error("leads runtime must not be built");
        },
        schedule: () => void touched++,
      });
      const req = post(payload({ page_url: "https://entrepreneuria.io/services/websites" }), {
        host: "entrepreneuria.io",
        origin: "https://entrepreneuria.io",
      });
      const res = await handleInquiryPost(req, deps);
      assert.equal(res.status, 404);
      assert.deepEqual(await res.json(), { ok: false, error: "not_found" });
      assert.equal(res.headers.get("cache-control"), "no-store");
      assert.equal(req.bodyUsed, false);
      assert.equal(touched + verifyCalls.length, 0);
    });
  }
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inquiryStoreAllowed, isProposedFlowEnabled, resolvePaymentsMode, resolveServicesMode } from "./flags";
import { handleInquiry } from "./inquiry-handler";
import { leadsConfigProblems, parseClientIpSource, PROPOSED_MAX_OPEN_REQUESTS, readLeadsConfig } from "./leads-config";
import { harness, payload, PASSED_LEADS_GATES, req, validLeadsEnv } from "./leads.test-helper";
import { allLeadsGatesPassed, allReleaseGatesPassed, LEADS_RELEASE_GATES, openLeadsGates, RELEASE_GATES } from "./release-gates";

describe("leads release gates", () => {
  it("start fully closed, with no evidence", () => {
    assert.equal(LEADS_RELEASE_GATES.length, 13);
    assert.ok(LEADS_RELEASE_GATES.every((g) => g.passed === false && !g.evidence));
    assert.equal(allLeadsGatesPassed(), false);
    assert.equal(openLeadsGates().length, 13);
  });

  it("need evidence as well as a passed flag; an empty list never passes", () => {
    assert.equal(allLeadsGatesPassed(LEADS_RELEASE_GATES.map((g) => ({ ...g, passed: true }))), false);
    assert.equal(allLeadsGatesPassed(LEADS_RELEASE_GATES.map((g) => ({ ...g, passed: true, evidence: "  " }))), false);
    assert.equal(allLeadsGatesPassed([]), false);
    assert.equal(allLeadsGatesPassed(PASSED_LEADS_GATES), true);
    const oneOpen = PASSED_LEADS_GATES.map((g, i) => (i === 0 ? { ...g, passed: false } : g));
    assert.equal(allLeadsGatesPassed(oneOpen), false);
  });

  it("leave the full-production gates untouched: still 15, all closed", () => {
    assert.equal(RELEASE_GATES.length, 15);
    assert.ok(RELEASE_GATES.every((g) => !g.passed));
    assert.equal(allReleaseGatesPassed(), false);
  });
});

describe("mode resolution and isolation", () => {
  it("defaults to off and ignores unknown values", () => {
    assert.equal(resolveServicesMode({}), "off");
    assert.equal(resolveServicesMode({ WEBSITES_SERVICES_MODE: "public" }), "off");
  });

  it("leads resolves to off with the real (closed) gates, even fully configured and authorized", () => {
    assert.equal(resolveServicesMode(validLeadsEnv()), "off");
  });

  it("leads resolves to leads only with authorization, every gate evidenced and complete config", () => {
    assert.equal(resolveServicesMode(validLeadsEnv(), PASSED_LEADS_GATES), "leads");
  });

  it("each missing prerequisite keeps leads off", () => {
    assert.equal(resolveServicesMode(validLeadsEnv({ WEBSITES_LEADS_RELEASE_AUTHORIZED: undefined }), PASSED_LEADS_GATES), "off");
    assert.equal(resolveServicesMode(validLeadsEnv({ WEBSITES_LEADS_RELEASE_AUTHORIZED: "yes" }), PASSED_LEADS_GATES), "off");
    const oneOpen = PASSED_LEADS_GATES.map((g, i) => (i === 3 ? { ...g, passed: false } : g));
    assert.equal(resolveServicesMode(validLeadsEnv(), oneOpen), "off");
  });

  it("production authorization never enables leads, and leads authorization never enables production", () => {
    assert.equal(
      resolveServicesMode(validLeadsEnv({ WEBSITES_LEADS_RELEASE_AUTHORIZED: undefined, WEBSITES_OWNER_RELEASE_AUTHORIZED: "true" }), PASSED_LEADS_GATES),
      "off"
    );
    assert.equal(
      resolveServicesMode({ WEBSITES_SERVICES_MODE: "production", WEBSITES_LEADS_RELEASE_AUTHORIZED: "true" }, PASSED_LEADS_GATES),
      "off"
    );
    assert.equal(
      resolveServicesMode({ WEBSITES_SERVICES_MODE: "production", WEBSITES_OWNER_RELEASE_AUTHORIZED: "true", WEBSITES_LEADS_RELEASE_AUTHORIZED: "true" }, PASSED_LEADS_GATES),
      "off"
    );
  });

  it("nonproduction keeps its pre-existing behaviour", () => {
    assert.equal(resolveServicesMode({ WEBSITES_SERVICES_MODE: "nonproduction" }), "nonproduction");
    assert.equal(resolvePaymentsMode({ WEBSITES_SERVICES_MODE: "nonproduction", WEBSITES_PAYMENTS_MODE: "sandbox" }), "sandbox");
  });
});

describe("payment and proposed-flow restrictions in leads mode", () => {
  const env = validLeadsEnv({ WEBSITES_PAYMENTS_MODE: "sandbox", WEBSITES_PROPOSED_POLICY_FLOWS: "cancellation,setup_fee_refund,payment_recovery" });

  it("payments stay disabled, including when sandbox is requested", () => {
    assert.equal(resolvePaymentsMode(env), "disabled");
    assert.equal(resolvePaymentsMode({ ...env, WEBSITES_PAYMENTS_MODE: "live" }), "disabled");
  });

  it("proposed policy flows stay off", () => {
    for (const id of ["cancellation", "setup_fee_refund", "payment_recovery"] as const) assert.equal(isProposedFlowEnabled(id, env), false);
  });
});

describe("required configuration fails closed", () => {
  const REQUIRED = [
    "WEBSITES_ALERT_WEBHOOK_URL",
    "WEBSITES_ALERT_WEBHOOK_SECRET",
    "TURNSTILE_SECRET_KEY",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "WEBSITES_IP_HASH_SALT",
    "WEBSITES_CLIENT_IP_SOURCE",
    "WEBSITES_PUBLIC_ORIGIN",
    "GHL_API_TOKEN",
    "GHL_LOCATION_ID",
    "GHL_PIPELINE_ID",
    "GHL_PIPELINE_STAGE_ID",
    "WEBSITES_PREVIEW_INTAKE",
    "WEBSITES_PREVIEW_MAX_OPEN_REQUESTS",
  ];

  it("a complete configuration has no problems", () => {
    assert.deepEqual(leadsConfigProblems(validLeadsEnv()), []);
  });

  for (const name of REQUIRED) {
    it(`missing ${name} names the setting and keeps the mode off`, () => {
      const env = validLeadsEnv({ [name]: undefined });
      assert.deepEqual(leadsConfigProblems(env), [name]);
      assert.equal(resolveServicesMode(env, PASSED_LEADS_GATES), "off");
    });
  }

  it("rejects weak or malformed values without echoing them", () => {
    const bad = validLeadsEnv({
      WEBSITES_ALERT_WEBHOOK_URL: "http://insecure.example.test/hook",
      WEBSITES_ALERT_WEBHOOK_SECRET: "short",
      WEBSITES_IP_HASH_SALT: "short",
      WEBSITES_CLIENT_IP_SOURCE: "first-xff",
      WEBSITES_PUBLIC_ORIGIN: "https://entrepreneuria.io/services",
      WEBSITES_PREVIEW_INTAKE: "maybe",
      WEBSITES_PREVIEW_MAX_OPEN_REQUESTS: "0",
    });
    const problems = leadsConfigProblems(bad);
    assert.deepEqual(problems.sort(), [
      "WEBSITES_ALERT_WEBHOOK_SECRET",
      "WEBSITES_ALERT_WEBHOOK_URL",
      "WEBSITES_CLIENT_IP_SOURCE",
      "WEBSITES_IP_HASH_SALT",
      "WEBSITES_PREVIEW_INTAKE",
      "WEBSITES_PREVIEW_MAX_OPEN_REQUESTS",
      "WEBSITES_PUBLIC_ORIGIN",
    ]);
    for (const p of problems) assert.ok(!p.includes("short") && !p.includes("insecure"));
  });

  it("bounds the open-request limit to what the GHL count can enforce", () => {
    assert.equal(leadsConfigProblems(validLeadsEnv({ WEBSITES_PREVIEW_MAX_OPEN_REQUESTS: "100" })).length, 0);
    assert.deepEqual(leadsConfigProblems(validLeadsEnv({ WEBSITES_PREVIEW_MAX_OPEN_REQUESTS: "101" })), ["WEBSITES_PREVIEW_MAX_OPEN_REQUESTS"]);
    assert.deepEqual(leadsConfigProblems(validLeadsEnv({ WEBSITES_PREVIEW_MAX_OPEN_REQUESTS: "-1" })), ["WEBSITES_PREVIEW_MAX_OPEN_REQUESTS"]);
  });

  it("the owner's proposed limit is five, but it is never applied unless set", () => {
    assert.equal(PROPOSED_MAX_OPEN_REQUESTS, 5);
    assert.equal(readLeadsConfig(validLeadsEnv()).config?.maxOpenRequests, 5);
    assert.ok(leadsConfigProblems(validLeadsEnv({ WEBSITES_PREVIEW_MAX_OPEN_REQUESTS: undefined })).includes("WEBSITES_PREVIEW_MAX_OPEN_REQUESTS"));
  });

  it("parses the trusted client-IP source strictly", () => {
    assert.deepEqual(parseClientIpSource("x-real-ip"), { kind: "x-real-ip" });
    assert.deepEqual(parseClientIpSource("xff-last"), { kind: "xff-from-right", hops: 1 });
    assert.deepEqual(parseClientIpSource("xff-hops:2"), { kind: "xff-from-right", hops: 2 });
    for (const bad of [undefined, "", "xff", "xff-hops:0", "xff-hops:6", "xff-hops:x", "leftmost"]) assert.equal(parseClientIpSource(bad), null);
  });
});

describe("inquiry store isolation", () => {
  it("the Supabase store is disallowed whenever the raw mode is leads", () => {
    assert.equal(inquiryStoreAllowed({ WEBSITES_SERVICES_MODE: "leads", WEBSITES_INQUIRY_STORE: "supabase" }), false);
    assert.equal(inquiryStoreAllowed({ WEBSITES_SERVICES_MODE: "nonproduction", WEBSITES_INQUIRY_STORE: "supabase" }), true);
  });

  it("the leads handler never asks for the store, even when the store env is set", async () => {
    const h = harness({ env: validLeadsEnv({ WEBSITES_INQUIRY_STORE: "supabase" }) });
    const res = await handleInquiry(req(payload()), h.deps);
    await h.flush();
    assert.equal(res.status, 200);
    assert.equal(h.storeCalls.count, 0);
    assert.equal(h.crm.leads.length, 1);
  });
});

describe("rollback", () => {
  it("unsetting the mode returns 404 and runs nothing", async () => {
    const h = harness({ env: validLeadsEnv({ WEBSITES_SERVICES_MODE: undefined }) });
    const res = await handleInquiry(req(payload()), h.deps);
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { ok: false, error: "not_found" });
    assert.equal(h.crm.leads.length, 0);
    assert.equal(h.crm.countCalls, 0);
  });

  it("closed gates, missing authorization or missing config each give 404", async () => {
    for (const h of [
      harness({ gates: LEADS_RELEASE_GATES }),
      harness({ env: validLeadsEnv({ WEBSITES_LEADS_RELEASE_AUTHORIZED: undefined }) }),
      harness({ env: validLeadsEnv({ WEBSITES_ALERT_WEBHOOK_URL: undefined }) }),
      harness({ env: validLeadsEnv({ TURNSTILE_SECRET_KEY: undefined }) }),
    ]) {
      const res = await handleInquiry(req(payload()), h.deps);
      assert.equal(res.status, 404);
      assert.equal(h.crm.leads.length, 0);
    }
  });
});

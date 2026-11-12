import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { explainLeadsOff, inquiryStoreAllowed, isProposedFlowEnabled, resolvePaymentsMode, resolveServicesMode } from "./flags";
import { reportClosedGate, resolveWebsitesGate } from "./gate";
import { leadsConfigProblems, parseContactEmail, PROPOSED_MAX_OPEN_REQUESTS, readLeadsConfig } from "./leads-config";
import { fakeCrm, harness, HOST, ORIGIN, payload, PASSED_LEADS_GATES, req, STAGING, stagingReq, validLeadsEnv } from "./leads.test-helper";
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
    assert.equal(allLeadsGatesPassed(PASSED_LEADS_GATES.map((g, i) => (i === 0 ? { ...g, passed: false } : g))), false);
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

  it("each missing prerequisite keeps leads off, and the reason says which", () => {
    const noAuth = validLeadsEnv({ WEBSITES_LEADS_RELEASE_AUTHORIZED: undefined });
    assert.equal(resolveServicesMode(noAuth, PASSED_LEADS_GATES), "off");
    assert.equal(explainLeadsOff(noAuth, PASSED_LEADS_GATES)?.reason, "leads_not_authorized");
    assert.equal(resolveServicesMode(validLeadsEnv({ WEBSITES_LEADS_RELEASE_AUTHORIZED: "yes" }), PASSED_LEADS_GATES), "off");

    const oneOpen = PASSED_LEADS_GATES.map((g, i) => (i === 3 ? { ...g, passed: false } : g));
    assert.equal(resolveServicesMode(validLeadsEnv(), oneOpen), "off");
    assert.equal(explainLeadsOff(validLeadsEnv(), oneOpen)?.reason, "leads_gates_open");

    const noHook = validLeadsEnv({ WEBSITES_ALERT_WEBHOOK_URL: undefined });
    assert.equal(resolveServicesMode(noHook, PASSED_LEADS_GATES), "off");
    assert.deepEqual(explainLeadsOff(noHook, PASSED_LEADS_GATES), { reason: "leads_config_incomplete", missing: ["WEBSITES_ALERT_WEBHOOK_URL"] });
  });

  it("production authorization never enables leads, and leads authorization never enables production", () => {
    assert.equal(
      resolveServicesMode(validLeadsEnv({ WEBSITES_LEADS_RELEASE_AUTHORIZED: undefined, WEBSITES_OWNER_RELEASE_AUTHORIZED: "true" }), PASSED_LEADS_GATES),
      "off"
    );
    assert.equal(resolveServicesMode({ WEBSITES_SERVICES_MODE: "production", WEBSITES_LEADS_RELEASE_AUTHORIZED: "true" }, PASSED_LEADS_GATES), "off");
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

describe("leads-specific configuration fails closed", () => {
  const REQUIRED = [
    "WEBSITES_REVIEW_DIR",
    "WEBSITES_ALERT_WEBHOOK_URL",
    "WEBSITES_ALERT_WEBHOOK_SECRET",
    "GHL_API_TOKEN",
    "GHL_LOCATION_ID",
    "GHL_PIPELINE_ID",
    "GHL_PIPELINE_STAGE_ID",
    "WEBSITES_PREVIEW_INTAKE",
    "WEBSITES_PREVIEW_MAX_OPEN_REQUESTS",
    "WEBSITES_CONTACT_EMAIL",
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
      WEBSITES_PREVIEW_INTAKE: "maybe",
      WEBSITES_PREVIEW_MAX_OPEN_REQUESTS: "0",
    });
    const problems = leadsConfigProblems(bad);
    assert.deepEqual([...problems].sort(), [
      "WEBSITES_ALERT_WEBHOOK_SECRET",
      "WEBSITES_ALERT_WEBHOOK_URL",
      "WEBSITES_PREVIEW_INTAKE",
      "WEBSITES_PREVIEW_MAX_OPEN_REQUESTS",
    ]);
    for (const p of problems) assert.ok(!p.includes("short") && !p.includes("insecure"));
  });

  it("the public inbox must be a well-formed address (no default)", () => {
    for (const bad of ["", "misti", "a@b", "a b@example.com", "<a@example.com>"]) {
      assert.deepEqual(leadsConfigProblems(validLeadsEnv({ WEBSITES_CONTACT_EMAIL: bad })), ["WEBSITES_CONTACT_EMAIL"]);
    }
    assert.equal(parseContactEmail({ WEBSITES_CONTACT_EMAIL: " services@example.test " }), "services@example.test");
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
});

describe("per-request gate in leads mode", () => {
  const headers = (host: string) => new Headers({ host });

  it("serves the canonical production host and nothing else by default", () => {
    const g = resolveWebsitesGate(headers(HOST), validLeadsEnv(), PASSED_LEADS_GATES);
    assert.equal(g.enabled, true);
    if (g.enabled) {
      assert.equal(g.mode, "leads");
      assert.equal(g.origin, ORIGIN);
    }
    const other = resolveWebsitesGate(headers("evil.example"), validLeadsEnv(), PASSED_LEADS_GATES);
    assert.deepEqual([other.enabled, !other.enabled && other.reason], [false, "host_not_allowed"]);
    const www = resolveWebsitesGate(headers(`www.${HOST}`), validLeadsEnv(), PASSED_LEADS_GATES);
    assert.equal(www.enabled, false);
  });

  it("can be rehearsed on an explicitly allowlisted staging host", () => {
    const env = validLeadsEnv({ WEBSITES_NONPRODUCTION_HOSTS: "staging.example.com" });
    assert.equal(resolveWebsitesGate(headers("staging.example.com"), env, PASSED_LEADS_GATES).enabled, true);
    assert.equal(resolveWebsitesGate(headers("staging.example.com"), validLeadsEnv(), PASSED_LEADS_GATES).enabled, false);
  });

  it("still requires the shared secrets: salt and Turnstile", () => {
    const noSalt = resolveWebsitesGate(headers(HOST), validLeadsEnv({ WEBSITES_IP_HASH_SALT: "short" }), PASSED_LEADS_GATES);
    assert.deepEqual([noSalt.enabled, !noSalt.enabled && noSalt.reason], [false, "ip_hash_salt_missing"]);
    const noTs = resolveWebsitesGate(headers(HOST), validLeadsEnv({ TURNSTILE_SECRET_KEY: undefined }), PASSED_LEADS_GATES);
    assert.deepEqual([noTs.enabled, !noTs.enabled && noTs.reason], [false, "turnstile_not_configured"]);
  });

  it("explains why a requested leads mode is closed, logging setting names only", () => {
    const logs: string[] = [];
    const missing = resolveWebsitesGate(headers(HOST), validLeadsEnv({ GHL_API_TOKEN: undefined }), PASSED_LEADS_GATES);
    assert.equal(missing.enabled, false);
    reportClosedGate(missing, (m) => logs.push(m));
    assert.equal(logs.length, 1);
    assert.match(logs[0], /leads_config_incomplete/);
    assert.match(logs[0], /GHL_API_TOKEN/);
    assert.ok(!logs[0].includes("turnstile-secret") && !logs[0].includes("loc_test"));
    reportClosedGate(missing, (m) => logs.push(m));
    assert.equal(logs.length, 1, "reported once");

    const gatesOpen = resolveWebsitesGate(headers(HOST), validLeadsEnv());
    assert.deepEqual([gatesOpen.enabled, !gatesOpen.enabled && gatesOpen.reason], [false, "leads_gates_open"]);
  });

  it("a mode that was never requested stays silent", () => {
    const logs: string[] = [];
    reportClosedGate(resolveWebsitesGate(headers(HOST), {}), (m) => logs.push(m));
    assert.equal(logs.length, 0);
  });
});

describe("inquiry store isolation", () => {
  it("the Supabase store is disallowed whenever the raw mode is leads", () => {
    assert.equal(inquiryStoreAllowed({ WEBSITES_SERVICES_MODE: "leads", WEBSITES_INQUIRY_STORE: "supabase" }), false);
    assert.equal(inquiryStoreAllowed({ WEBSITES_SERVICES_MODE: "nonproduction", WEBSITES_INQUIRY_STORE: "supabase" }), true);
  });

  it("the leads route never asks for the store, even when the store env is set", async () => {
    const h = harness({ env: validLeadsEnv({ WEBSITES_INQUIRY_STORE: "supabase" }) });
    const res = await h.send(req(payload()));
    await h.flush();
    assert.equal(res.status, 200);
    assert.equal(h.storeCalls.count, 0);
    assert.equal(h.crm.leads.length, 1);
  });

  it("outside leads mode the store is still consulted exactly as before", async () => {
    const h = harness({ env: { ...validLeadsEnv(), WEBSITES_SERVICES_MODE: "nonproduction", WEBSITES_NONPRODUCTION_HOSTS: STAGING } });
    // The harness store throws if asked, which proves it was asked.
    await assert.rejects(h.send(stagingReq(payload({ page_url: `https://${STAGING}/services/websites` }))), /must not be used/);
    assert.equal(h.storeCalls.count, 1);
  });
});

describe("rollback", () => {
  it("unsetting the mode returns 404 and runs nothing", async () => {
    const crm = fakeCrm();
    const h = harness({ env: validLeadsEnv({ WEBSITES_SERVICES_MODE: undefined }), crm });
    const res = await h.send(req(payload()));
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { ok: false, error: "not_found" });
    assert.equal(crm.leads.length, 0);
    assert.equal(crm.countCalls, 0);
    assert.equal(h.siteverify.calls, 0);
  });

  it("closed gates, missing authorization or missing config each give 404 and run nothing", async () => {
    for (const h of [
      harness({ gates: LEADS_RELEASE_GATES }),
      harness({ env: validLeadsEnv({ WEBSITES_LEADS_RELEASE_AUTHORIZED: undefined }) }),
      harness({ env: validLeadsEnv({ WEBSITES_ALERT_WEBHOOK_URL: undefined }) }),
      harness({ env: validLeadsEnv({ TURNSTILE_SECRET_KEY: undefined }) }),
      harness({ env: validLeadsEnv({ WEBSITES_IP_HASH_SALT: undefined }) }),
    ]) {
      const res = await h.send(req(payload()));
      assert.equal(res.status, 404);
      assert.equal(h.crm.leads.length, 0);
      assert.equal(h.siteverify.calls, 0);
    }
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACTIVATION_PREREQUISITES,
  clearGate,
  evaluateGate,
  evaluateProductionGate,
  GATE_AUTHORIZATION_ENV,
  GateClosedError,
  ghlConfigProblems,
  openPrerequisites,
} from "./activation-gates";
import { activateSubscriptionAtLaunch, BillingGuardError, requestSetupPayment } from "./billing";
import { COMMUNICATION_TEMPLATES, isTemplateSendable, templateSendBlockers } from "./communications";
import type { Env } from "./flags";
import { newProject, type WebsiteProject } from "./lifecycle";
import { buildAcceptance } from "./acceptance";
import { EVIDENCE, proposalEvent, SANDBOX_ENV, step, T0, toApproved, toPreviewApproved, toProposal, toVerifiedLive } from "./lifecycle.test-helper";
import { createSandboxProvider } from "./payments/sandbox";

/** Every owner switch a careless deploy could set. None of them may open a gate on its own. */
const EVERY_FLAG_ON: Env = {
  WEBSITES_SERVICES_MODE: "production",
  WEBSITES_OWNER_RELEASE_AUTHORIZED: "true",
  WEBSITES_PAYMENTS_MODE: "live",
  WEBSITES_AGREEMENT_ACCEPTANCE_AUTHORIZED: "true",
  WEBSITES_SETUP_PAYMENT_AUTHORIZED: "true",
  WEBSITES_SUBSCRIPTION_AUTHORIZED: "true",
  WEBSITES_CUSTOMER_MESSAGES_AUTHORIZED: "true",
  GHL_API_TOKEN: "synthetic-not-a-token",
  GHL_LOCATION_ID: "synthetic-location",
};

/** Builds a production-mode project through the pre-sale steps (none of which are gated). */
function productionAt(stage: "proposal" | "approved_like" | "live_like"): WebsiteProject {
  const base = toPreviewApproved("prod-1", "production");
  if (stage === "proposal") return step(base, proposalEvent());
  // Gated states cannot be reached in production; fabricate the record to prove the gate, not the path, refuses.
  const sandboxTwin = stage === "approved_like" ? toApproved("prod-1") : toVerifiedLive("prod-1");
  return { ...sandboxTwin, mode: "production" };
}

describe("activation gates: everything commercial is closed today", () => {
  it("every external prerequisite starts closed with no evidence", () => {
    assert.ok(ACTIVATION_PREREQUISITES.length >= 10);
    for (const p of ACTIVATION_PREREQUISITES) {
      assert.equal(p.passed, false, p.id);
      assert.equal(p.evidence, undefined, p.id);
    }
    for (const id of ["entity-reinstatement-verified", "final-agreement-approved", "legal-entity-name-confirmed", "ghl-payment-processor-verified"]) {
      assert.ok(ACTIVATION_PREREQUISITES.some((p) => p.id === id), id);
    }
    assert.equal(openPrerequisites().length, ACTIVATION_PREREQUISITES.length);
  });

  it("Gate A (agreement acceptance) stays closed in production even with every flag on", () => {
    const e = evaluateGate("agreement_acceptance", { project: productionAt("proposal"), env: EVERY_FLAG_ON, now: T0 });
    assert.equal(e.open, false);
    for (const code of [
      "services_mode_not_production",
      "prerequisite:final-agreement-approved",
      "prerequisite:legal-entity-name-confirmed",
      "prerequisite:customer-disclosures-present",
      "prerequisite:acceptance-evidence-defined",
      "prerequisite:entity-reinstatement-verified",
      "policy_not_approved:service_agreement",
      "policy_not_approved:cancellation",
    ]) assert.ok(e.unmet.includes(code), code);
  });

  it("Gate B (setup payment) stays closed in production: no processor, no adapter, no live provider", () => {
    const e = evaluateGate("setup_payment", { project: productionAt("approved_like"), env: EVERY_FLAG_ON, now: T0 });
    assert.equal(e.open, false);
    for (const code of ["no_live_payment_provider", "prerequisite:ghl-payment-processor-verified", "prerequisite:owner-authorized-setup-payment"]) {
      assert.ok(e.unmet.includes(code), code);
    }
  });

  it("Gate B reports missing GHL configuration by setting name only", () => {
    assert.deepEqual(ghlConfigProblems({}), ["ghl_config_missing:GHL_API_TOKEN", "ghl_config_missing:GHL_LOCATION_ID"]);
    assert.deepEqual(ghlConfigProblems({ GHL_API_TOKEN: "x", GHL_LOCATION_ID: " " }), ["ghl_config_missing:GHL_LOCATION_ID"]);
    const e = evaluateGate("setup_payment", { project: productionAt("approved_like"), env: { ...EVERY_FLAG_ON, GHL_API_TOKEN: "" }, now: T0 });
    assert.ok(e.unmet.includes("ghl_config_missing:GHL_API_TOKEN"));
    assert.ok(!e.unmet.join(" ").includes("synthetic-location"), "values never appear in the report");
  });

  it("Gate C (subscription) stays closed in production", () => {
    const e = evaluateGate("subscription", { project: productionAt("live_like"), env: EVERY_FLAG_ON, now: T0 });
    assert.equal(e.open, false);
    assert.ok(e.unmet.includes("no_live_payment_provider"));
    assert.ok(e.unmet.includes("prerequisite:ghl-subscription-at-launch-verified"));
  });

  it("Gate D (production) stays closed with every flag on", () => {
    const e = evaluateProductionGate(EVERY_FLAG_ON);
    assert.equal(e.open, false);
    assert.ok(e.unmet.includes("services_mode_not_production"));
    assert.ok(e.unmet.includes("prerequisite:entity-reinstatement-verified"));
    assert.ok(e.unmet.includes("prerequisite:owner-authorized-production"));
  });

  it("the owner authorization flag for each gate is required and named", () => {
    const e = evaluateGate("agreement_acceptance", { project: productionAt("proposal"), env: {}, now: T0 });
    assert.ok(e.unmet.includes(`owner_authorization:${GATE_AUTHORIZATION_ENV.agreement_acceptance}`));
    assert.ok(evaluateProductionGate({}).unmet.includes(`owner_authorization:${GATE_AUTHORIZATION_ENV.production}`));
  });

  it("clearGate throws GateClosedError listing every unmet condition", () => {
    try {
      clearGate("agreement_acceptance", { project: productionAt("proposal"), env: EVERY_FLAG_ON, now: T0 });
      assert.fail("expected GateClosedError");
    } catch (err) {
      assert.ok(err instanceof GateClosedError);
      assert.equal(err.evaluation.mode, "production");
      assert.ok(err.message.includes("Gate A"));
    }
  });
});

describe("activation gates: sandbox / production isolation", () => {
  it("sandbox gates open only in nonproduction, and payment gates only with sandbox payments", () => {
    const proposal = toProposal("s1");
    assert.equal(evaluateGate("agreement_acceptance", { project: proposal, env: SANDBOX_ENV, now: T0 }).open, true);
    for (const env of [{}, { WEBSITES_SERVICES_MODE: "leads" }, EVERY_FLAG_ON] as Env[]) {
      assert.ok(evaluateGate("agreement_acceptance", { project: proposal, env, now: T0 }).unmet.includes("services_mode_not_nonproduction"));
    }
    const approved = toApproved("s2");
    const noPayments = evaluateGate("setup_payment", { project: approved, env: { WEBSITES_SERVICES_MODE: "nonproduction" }, now: T0 });
    assert.deepEqual(noPayments.unmet, ["payments_mode_not_sandbox"]);
  });

  it("a sandbox clearance cannot be used on a production project", () => {
    const sandbox = toProposal("iso-1");
    const clearance = clearGate("agreement_acceptance", { project: sandbox, env: SANDBOX_ENV, now: T0 });
    const production = { ...sandbox, mode: "production" as const };
    const acceptance = buildAcceptance({ packageId: "starter", acceptedAt: T0, ipHash: null, userAgent: null });
    assert.throws(() => step(production, { type: "approve", acceptance, clearance }), /mode sandbox does not match project mode production/);
  });

  it("a production project cannot use sandbox gates or the sandbox provider", async () => {
    const production = productionAt("approved_like");
    assert.ok(evaluateGate("setup_payment", { project: production, env: SANDBOX_ENV, now: T0 }).unmet.includes("services_mode_not_production"));
    // Even holding a valid sandbox clearance for its sandbox twin, billing refuses the production project.
    const twin = toApproved("prod-1");
    const clearance = clearGate("setup_payment", { project: twin, env: SANDBOX_ENV, now: T0 });
    const provider = createSandboxProvider({ webhookSecret: "s" });
    await assert.rejects(requestSetupPayment(production, provider, "c", clearance), BillingGuardError);
    const live = productionAt("live_like");
    const subClearance = clearGate("subscription", { project: toVerifiedLive("prod-1"), env: SANDBOX_ENV, now: T0 });
    await assert.rejects(activateSubscriptionAtLaunch(live, provider, "c", subClearance), BillingGuardError);
    assert.equal(provider.requests.size, 0);
    assert.equal(provider.subscriptions.size, 0);
  });

  it("new projects default to sandbox", () => {
    assert.equal(newProject("d").mode, "sandbox");
  });
});

describe("customer communications", () => {
  it("covers every required message and none is sendable in any mode", () => {
    const ids = COMMUNICATION_TEMPLATES.map((t) => t.id);
    for (const id of [
      "request_acknowledgment",
      "preview_delivery",
      "preview_feedback",
      "preview_approval_confirmation",
      "proposal_introduction",
      "agreement_acceptance_instructions",
      "setup_payment_instructions",
      "build_kickoff",
      "launch_approval_request",
      "launch_confirmation",
      "subscription_start_notification",
    ]) assert.ok(ids.includes(id as (typeof ids)[number]), id);
    const sandbox = toVerifiedLive("m1");
    const production = { ...sandbox, mode: "production" as const };
    for (const t of COMMUNICATION_TEMPLATES) {
      assert.equal(t.status, "draft");
      assert.equal(isTemplateSendable(t.id, sandbox, SANDBOX_ENV), false);
      assert.equal(isTemplateSendable(t.id, production, EVERY_FLAG_ON), false);
    }
    assert.ok(templateSendBlockers("request_acknowledgment", sandbox, SANDBOX_ENV).includes("sandbox_never_sends"));
    assert.ok(templateSendBlockers("setup_payment_instructions", production, EVERY_FLAG_ON).includes("requires_gate:setup_payment"));
  });

  it("legal and payment templates are tied to their gates", () => {
    for (const t of COMMUNICATION_TEMPLATES) {
      if (t.kind === "legal") assert.equal(t.requiresGate, "agreement_acceptance", t.id);
      if (t.id === "setup_payment_instructions") assert.equal(t.requiresGate, "setup_payment");
      if (t.id === "subscription_start_notification") assert.equal(t.requiresGate, "subscription");
    }
    assert.ok(EVIDENCE.ref.startsWith("synthetic"));
  });
});

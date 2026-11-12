/**
 * F1: acceptance pricing is untrusted. Amounts come from the proposal's terms
 * snapshot (terms.ts), which must equal the registry. Synthetic data only.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAcceptance, type AcceptanceRecord } from "./acceptance";
import { clearGate } from "./activation-gates";
import { activateSubscriptionAtLaunch, BillingGuardError, requestSetupPayment } from "./billing";
import type { ProjectEvent, WebsiteProject } from "./lifecycle";
import { SANDBOX_ENV, STARTER, step, T0, toApproved, toProposal, toVerifiedLive } from "./lifecycle.test-helper";
import { getPackage, PRICING_VERSION } from "./packages";
import { createSandboxProvider } from "./payments/sandbox";
import { authoritativeTerms, registryTerms, snapshotProblem, snapshotTerms, termsDigest, type ProposalTerms } from "./terms";

const rejects = (fn: () => unknown, re: RegExp) => assert.throws(fn, re);
const accept = (p: WebsiteProject, over: Partial<AcceptanceRecord> = {}): ProjectEvent => ({
  type: "approve",
  acceptance: { ...buildAcceptance({ packageId: "starter", acceptedAt: T0, ipHash: null, userAgent: null, termsDigest: p.proposal?.terms.digest }), ...over },
  clearance: clearGate("agreement_acceptance", { project: p, env: SANDBOX_ENV, now: T0 }),
});
/** A terms snapshot with a valid digest for arbitrary values (what a forger who can compute the digest would write). */
const forge = (over: Partial<Omit<ProposalTerms, "digest">>): ProposalTerms => {
  const f = { ...snapshotTerms("starter"), ...over };
  return { ...f, digest: termsDigest(f) };
};
const withTerms = (p: WebsiteProject, terms: ProposalTerms): WebsiteProject => ({ ...p, proposal: { ...p.proposal!, terms } });

describe("F1: the proposal carries the registry's terms", () => {
  it("snapshots Starter at $199 setup / $75 per month, USD, one-month minimum", () => {
    const p = toProposal("t1");
    const { digest, ...fields } = p.proposal!.terms;
    assert.match(digest, /^[0-9a-f]{64}$/);
    assert.deepEqual(fields, { packageId: "starter", pricingVersion: PRICING_VERSION, currency: "USD", setupPriceCents: 19_900, monthlyPriceCents: 7_500, minimumTermMonths: 1 });
    assert.equal(snapshotProblem(p.proposal!.terms), null);
  });

  it("is taken from the registry, not from the event", () => {
    const p = toProposal("t2");
    assert.equal(p.proposal!.terms.setupPriceCents, STARTER.setupPriceCents);
    assert.equal(p.proposal!.terms.monthlyPriceCents, STARTER.monthlyPriceCents);
  });

  it("leaves other packages available to the registry without weakening the check", () => {
    assert.equal(registryTerms("growth").monthlyPriceCents, getPackage("growth").monthlyPriceCents);
    assert.throws(() => snapshotTerms("growth"), /not offered/);
    assert.match(snapshotProblem(forge({ packageId: "growth", setupPriceCents: 1, monthlyPriceCents: 1 })) ?? "", /not offered/);
  });
});

describe("F1: agreement acceptance validates every commercial field", () => {
  it("accepts the exact terms and stores the proposal's amounts", () => {
    const p = toProposal("t3");
    const approved = step(p, accept(p));
    assert.equal(approved.state, "approved");
    assert.equal(approved.acceptance?.setupPriceCents, 19_900);
    assert.equal(approved.acceptance?.monthlyPriceCents, 7_500);
    assert.equal(approved.acceptance?.currency, "USD");
  });

  it("rejects a one-cent monthly price even though package and version strings match", () => {
    const p = toProposal("t4");
    rejects(() => step(p, accept(p, { monthlyPriceCents: 1 })), /monthly price differs/);
    assert.equal(p.state, "proposal_sent");
  });

  it("rejects a changed setup price, a higher price, and non-integer prices", () => {
    const p = toProposal("t5");
    rejects(() => step(p, accept(p, { setupPriceCents: 100 })), /setup price differs/);
    rejects(() => step(p, accept(p, { setupPriceCents: 29_900 })), /setup price differs/);
    rejects(() => step(p, accept(p, { monthlyPriceCents: 7_500.5 })), /monthly price differs/);
    rejects(() => step(p, accept(p, { monthlyPriceCents: "7500" as unknown as number })), /monthly price differs/);
  });

  it("rejects a mismatched or missing currency", () => {
    const p = toProposal("t6");
    rejects(() => step(p, accept(p, { currency: "EUR" as "USD" })), /currency differs/);
    rejects(() => step(p, accept(p, { currency: undefined as unknown as "USD" })), /currency differs/);
  });

  it("rejects a different package, pricing version, or terms digest", () => {
    const p = toProposal("t7");
    rejects(() => step(p, accept(p, { packageId: "growth" })), /different package/);
    rejects(() => step(p, accept(p, { pricingVersion: "2026-01-01.v0" })), /pricing/);
    rejects(() => step(p, accept(p, { termsDigest: "0".repeat(64) })), /not bound to this proposal/);
    rejects(() => step(p, accept(p, { termsDigest: undefined as unknown as string })), /not bound to this proposal/);
  });

  it("rejects an acceptance whose digest belongs to older terms", () => {
    const p = toProposal("t8");
    const olderDigest = forge({ pricingVersion: "2026-01-01.v0" }).digest;
    rejects(() => step(p, accept(p, { termsDigest: olderDigest })), /not bound to this proposal/);
  });
});

describe("F1: stale or altered proposal terms fail closed", () => {
  it("a proposal issued under an older pricing version cannot be accepted", () => {
    const p = withTerms(toProposal("t9"), forge({ pricingVersion: "2026-01-01.v0" }));
    rejects(() => step(p, accept(p, { pricingVersion: "2026-01-01.v0" })), /stale|pricing/);
  });

  it("a proposal whose registry prices have since changed cannot be accepted", () => {
    const p = withTerms(toProposal("t10"), forge({ setupPriceCents: 17_900 }));
    rejects(() => step(p, accept(p)), /stale/);
  });

  it("terms edited after issue (digest no longer matches) cannot be accepted", () => {
    const base = toProposal("t11");
    const p = withTerms(base, { ...base.proposal!.terms, monthlyPriceCents: 1 });
    rejects(() => step(p, accept(base)), /altered/);
  });

  it("a proposal without terms cannot be accepted", () => {
    const base = toProposal("t12");
    const p = { ...base, proposal: { ...base.proposal!, terms: undefined as unknown as ProposalTerms } };
    rejects(() => step(p, accept(base)), /missing/);
  });
});

describe("F1: billing and confirmations use the terms, never the acceptance record", () => {
  const provider = () => createSandboxProvider({ webhookSecret: "s", now: () => new Date("2027-01-01T00:00:00Z") });

  it("valid Starter terms: $199 setup request and $75 subscription", async () => {
    const approved = toApproved("b1");
    const sbx = provider();
    const req = await requestSetupPayment(approved, sbx, "cust", clearGate("setup_payment", { project: approved, env: SANDBOX_ENV, now: T0 }));
    assert.equal(req.amountCents, 19_900);
    const live = toVerifiedLive("b1");
    const sub = await activateSubscriptionAtLaunch(live, sbx, "cust", clearGate("subscription", { project: live, env: SANDBOX_ENV, now: T0 }));
    assert.equal(sub.amountCents, 7_500);
  });

  it("an acceptance rewritten after approval is refused by every billing path", async () => {
    const approved = toApproved("b2");
    const tamperedApproved = { ...approved, acceptance: { ...approved.acceptance!, setupPriceCents: 1 } };
    const sbx = provider();
    const clearance = clearGate("setup_payment", { project: approved, env: SANDBOX_ENV, now: T0 });
    await assert.rejects(requestSetupPayment(tamperedApproved, sbx, "cust", clearance), (e) => e instanceof BillingGuardError && e.code === "terms_invalid");
    assert.equal(sbx.requests.size, 0);

    const live = toVerifiedLive("b3");
    const tamperedLive = { ...live, acceptance: { ...live.acceptance!, monthlyPriceCents: 1 } };
    await assert.rejects(
      activateSubscriptionAtLaunch(tamperedLive, sbx, "cust", clearGate("subscription", { project: live, env: SANDBOX_ENV, now: T0 })),
      (e) => e instanceof BillingGuardError && e.code === "terms_invalid"
    );
    assert.equal(sbx.subscriptions.size, 0);
  });

  it("a stored project rewritten consistently to one cent (terms, digest and acceptance) still fails against the registry", async () => {
    const cheap = forge({ setupPriceCents: 1, monthlyPriceCents: 1 });
    const sbx = provider();
    const live = toVerifiedLive("b4");
    const forgedLive = { ...withTerms(live, cheap), acceptance: { ...live.acceptance!, setupPriceCents: 1, monthlyPriceCents: 1, termsDigest: cheap.digest } };
    await assert.rejects(
      activateSubscriptionAtLaunch(forgedLive, sbx, "cust", clearGate("subscription", { project: live, env: SANDBOX_ENV, now: T0 })),
      (e) => e instanceof BillingGuardError && e.code === "price_changed"
    );
    const approved = toApproved("b4");
    const forgedApproved = { ...withTerms(approved, cheap), acceptance: { ...approved.acceptance!, setupPriceCents: 1, monthlyPriceCents: 1, termsDigest: cheap.digest } };
    await assert.rejects(
      requestSetupPayment(forgedApproved, sbx, "cust", clearGate("setup_payment", { project: approved, env: SANDBOX_ENV, now: T0 })),
      (e) => e instanceof BillingGuardError && e.code === "price_changed"
    );
    assert.equal(sbx.requests.size + sbx.subscriptions.size, 0);
  });

  it("lifecycle events use the terms: a one-cent request is refused, also on a tampered project", () => {
    const approved = toApproved("b5");
    const tampered = { ...approved, acceptance: { ...approved.acceptance!, setupPriceCents: 1 } };
    const clearance = clearGate("setup_payment", { project: approved, env: SANDBOX_ENV, now: T0 });
    rejects(() => step(tampered, { type: "request_setup_payment", requestId: "r", amountCents: 1, clearance }), /setup price differs/);
    rejects(() => step(approved, { type: "request_setup_payment", requestId: "r", amountCents: 1, clearance }), /accepted setup fee/);
  });

  it("the provider refuses a non-USD currency", async () => {
    const sbx = provider();
    await assert.rejects(
      sbx.createSetupPaymentRequest({ projectId: "x", customerRef: "c", amountCents: 19_900, currency: "EUR" as "USD", description: "d", idempotencyKey: "k" }),
      /currency/
    );
    await assert.rejects(
      sbx.createSubscription({ projectId: "x", customerRef: "c", amountCents: 7_500, currency: "EUR" as "USD", interval: "month", anchorAt: new Date("2026-12-01T00:00:00Z"), idempotencyKey: "k2" }),
      /currency/
    );
  });

  it("authoritativeTerms accepts only intact terms that match the acceptance", () => {
    const p = toApproved("b6");
    assert.equal(authoritativeTerms(p.proposal, p.acceptance).ok, true);
    assert.equal(authoritativeTerms(p.proposal, { ...p.acceptance!, monthlyPriceCents: 1 }).ok, false);
    assert.equal(authoritativeTerms(null, p.acceptance).ok, false);
  });
});

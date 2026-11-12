import assert from "node:assert/strict";
import { test } from "node:test";

import { BUSINESS_TYPES, matchBusinessType } from "./content";
import { EMPTY_FORM, singlePackageId, toInquiryFields, validateForm } from "./form-rules";

test("the only offered package can be submitted without a package choice", () => {
  const packageId = singlePackageId([{ id: "starter" }]);
  assert.equal(packageId, "starter");
  assert.equal(singlePackageId([{ id: "starter" }, { id: "growth" }]), undefined);
  const values = {
    ...EMPTY_FORM,
    name: "Dana",
    email: "dana@example.test",
    business: "Local Studio",
    business_type: "Other local business",
    package_interest: packageId ?? "",
  };
  assert.deepEqual(validateForm(values), []);
  assert.equal(toInquiryFields(values, { smsEnabled: false }).package_interest, "starter");
});

test("Other local business follows Other home service and can be preselected", () => {
  assert.deepEqual(BUSINESS_TYPES.slice(-2), ["Other home service", "Other local business"]);
  assert.equal(matchBusinessType(" other LOCAL business "), "Other local business");
});

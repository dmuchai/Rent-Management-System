import assert from "node:assert/strict";
import test from "node:test";
import { resolvePaymentLandlordId } from "../../client/src/lib/tenantPayments.js";

test("uses the tenant profile landlord when available", () => {
  assert.equal(
    resolvePaymentLandlordId(
      { landlordId: "landlord-from-profile" },
      { ownerId: "landlord-from-lease" }
    ),
    "landlord-from-profile"
  );
});

test("falls back to the active lease owner when the tenant profile is unavailable", () => {
  assert.equal(
    resolvePaymentLandlordId(undefined, { ownerId: "dennis-landlord-id" }),
    "dennis-landlord-id"
  );
});

test("returns undefined only when neither source identifies a landlord", () => {
  assert.equal(resolvePaymentLandlordId(undefined, undefined), undefined);
});

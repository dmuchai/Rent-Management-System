import assert from "node:assert/strict";
import test from "node:test";
import {
  formatMpesaPhoneNumber,
  normalizeMpesaPhoneNumber,
} from "../../shared/mpesa.js";

test("normalizes supported Kenyan M-PESA phone formats", () => {
  assert.equal(normalizeMpesaPhoneNumber("0712 345 678"), "254712345678");
  assert.equal(normalizeMpesaPhoneNumber("+254 712 345 678"), "254712345678");
  assert.equal(normalizeMpesaPhoneNumber("112345678"), "254112345678");
});

test("rejects invalid or non-Kenyan Send Money recipients", () => {
  assert.equal(normalizeMpesaPhoneNumber("071234567"), null);
  assert.equal(normalizeMpesaPhoneNumber("255712345678"), null);
  assert.equal(normalizeMpesaPhoneNumber("not-a-phone"), null);
});

test("formats canonical recipients for tenant instructions", () => {
  assert.equal(formatMpesaPhoneNumber("254712345678"), "0712345678");
});

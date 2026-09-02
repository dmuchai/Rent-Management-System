import assert from "node:assert/strict";
import test from "node:test";
import { validateBankAccount } from "../../shared/bankPaybills.js";

test("accepts production-length KCB Account IPN identifiers", () => {
  assert.deepEqual(validateBankAccount("522533", "123456789012"), { valid: true });
});

test("accepts real 10-digit KCB account numbers for the 522522 account paybill", () => {
  assert.deepEqual(validateBankAccount("522522", "1235672349"), { valid: true });
});

test("accepts alphanumeric KCB Vooma references", () => {
  assert.deepEqual(validateBankAccount("522533", "ABC123456"), { valid: true });
});

test("rejects malformed KCB account identifiers", () => {
  assert.equal(validateBankAccount("522533", "12345").valid, false);
  assert.equal(validateBankAccount("522533", "12345-678").valid, false);
  assert.equal(validateBankAccount("522533", "12345678901234").valid, false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalRentInvoiceReference,
  paymentCompletionDelta,
} from '../../api/_lib/invoicePayments.js';

test('generates deterministic KCB-compatible 13-character invoice references', () => {
  const period = new Date('2026-09-01T00:00:00.000Z');
  const reference = canonicalRentInvoiceReference('lease-123', period);

  assert.equal(reference, canonicalRentInvoiceReference('lease-123', period));
  assert.match(reference, /^I[A-F0-9]{12}$/);
  assert.equal(reference.length, 13);
  assert.notEqual(reference, canonicalRentInvoiceReference('lease-456', period));
  assert.notEqual(reference, canonicalRentInvoiceReference('lease-123', new Date('2026-10-01T00:00:00.000Z')));
});

test('credits an invoice only when an attempt first becomes completed', () => {
  assert.equal(paymentCompletionDelta('pending', 'completed', 1_000), 1_000);
  assert.equal(paymentCompletionDelta('completed', 'completed', 1_000), 0);
  assert.equal(paymentCompletionDelta('failed', 'failed', 1_000), 0);
});

test('supports an explicit reversal without treating ordinary failures as money', () => {
  assert.equal(paymentCompletionDelta('completed', 'cancelled', 1_000), -1_000);
  assert.equal(paymentCompletionDelta('pending', 'failed', 1_000), 0);
});

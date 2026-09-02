import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLedger } from '../../client/src/lib/ledger.js';

const lease = {
  id: 'lease-1',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-12-31T23:59:59.999Z',
  monthlyRent: '1000.00',
};

test('uses canonical invoices, not lease dates or pending payment attempts, as charges', () => {
  const ledger = calculateLedger(lease, [{
    id: 'invoice-1',
    referenceCode: 'I123456789ABC',
    amount: 1_000,
    amountPaid: 0,
    billingPeriodStart: '2026-09-01T00:00:00.000Z',
    dueDate: '2026-09-01T00:00:00.000Z',
    status: 'pending',
  }], [{
    id: 'attempt-1',
    invoiceId: 'invoice-1',
    amount: '1000.00',
    status: 'pending',
    createdAt: '2026-09-02T00:00:00.000Z',
  }]);

  assert.equal(ledger.totalCharged, 1_000);
  assert.equal(ledger.totalPaid, 0);
  assert.equal(ledger.currentBalance, 1_000);
  assert.equal(ledger.entries.filter((entry) => entry.type === 'charge').length, 1);
});

test('reflects reconciled bank receipts from the invoice balance without a duplicate charge', () => {
  const ledger = calculateLedger(lease, [{
    id: 'invoice-1',
    referenceCode: 'I123456789ABC',
    amount: 1_000,
    amountPaid: 1_000,
    billingPeriodStart: '2026-09-01T00:00:00.000Z',
    dueDate: '2026-09-01T00:00:00.000Z',
    paidAt: '2026-09-03T00:00:00.000Z',
    status: 'paid',
  }], []);

  assert.equal(ledger.totalCharged, 1_000);
  assert.equal(ledger.totalPaid, 1_000);
  assert.equal(ledger.currentBalance, 0);
  assert.equal(ledger.entries.filter((entry) => entry.type === 'payment').length, 1);
});

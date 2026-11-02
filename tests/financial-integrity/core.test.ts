import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStkCallback, receiptConflicts, verifyStkResult } from '../../api/_lib/mpesaVerification.js';
import { selectTrustedAuthority } from '../../api/_lib/authority.js';
import { canEditLeaseStatus, hasScopedUnitAccess } from '../../api/_lib/leasePolicy.js';
import { cronAuthorizationStatus } from '../../api/_lib/cronAuth.js';

const callbackBody = (overrides: Record<string, unknown> = {}) => ({
  Body: { stkCallback: {
    MerchantRequestID: 'merchant-1', CheckoutRequestID: 'checkout-1',
    ResultCode: 0, ResultDesc: 'Processed',
    CallbackMetadata: { Item: [
      { Name: 'Amount', Value: 1000 },
      { Name: 'MpesaReceiptNumber', Value: 'TST1234567' },
    ] },
    ...overrides,
  } },
});

const expected = { amount: 1000, checkoutRequestId: 'checkout-1',
  merchantRequestId: 'merchant-1', merchantId: '174379' };
const query = { MerchantRequestID: 'merchant-1', CheckoutRequestID: 'checkout-1',
  ResultCode: '0', ResultDesc: 'Processed' };

test('authenticated status plus matching receipt evidence verifies an STK success', () => {
  assert.deepEqual(verifyStkResult(parseStkCallback(callbackBody()), query, expected),
    { verified: true, successful: true });
});

test('a callback declaration alone cannot verify mismatched provider status', () => {
  const result = verifyStkResult(parseStkCallback(callbackBody()), { ...query, ResultCode: 1032 }, expected);
  assert.equal(result.verified, false);
});

test('wrong amount or missing receipt never verifies as paid', () => {
  assert.equal(verifyStkResult(parseStkCallback(callbackBody({ CallbackMetadata: {
    Item: [{ Name: 'Amount', Value: 999 }, { Name: 'MpesaReceiptNumber', Value: 'TST1234567' }],
  } })), query, expected).verified, false);
  assert.equal(verifyStkResult(parseStkCallback(callbackBody({ CallbackMetadata: {
    Item: [{ Name: 'Amount', Value: 1000 }],
  } })), query, expected).verified, false);
});

test('delayed failures are verified but never described as successful', () => {
  const callback = parseStkCallback(callbackBody({ ResultCode: 1032, ResultDesc: 'Cancelled', CallbackMetadata: undefined }));
  assert.deepEqual(verifyStkResult(callback, { ...query, ResultCode: 1032 }, expected),
    { verified: true, successful: false });
});

test('a conflicting receipt cannot replace an already posted STK receipt', () => {
  assert.equal(receiptConflicts('TST1234567', 'TST7654321'), true);
  assert.equal(receiptConflicts('TST1234567', 'TST1234567'), false);
});

test('trusted scoped memberships support landlord and tenant contexts without metadata', () => {
  const memberships = [
    { role: 'landlord', context_owner_id: 'self' },
    { role: 'tenant', context_owner_id: 'other-owner' },
  ];
  assert.equal(selectTrustedAuthority(memberships, 'tenant', 'other-owner')?.role, 'tenant');
  assert.equal(selectTrustedAuthority(memberships, 'landlord', 'other-owner'), null);
  assert.equal(selectTrustedAuthority([], 'landlord', 'self'), null);
});

test('ordinary edits cannot activate or rewrite signed leases', () => {
  assert.equal(canEditLeaseStatus('draft'), true);
  assert.equal(canEditLeaseStatus('pending_tenant_signature'), true);
  assert.equal(canEditLeaseStatus('active'), false);
  assert.equal(canEditLeaseStatus('expired'), false);
});

test('landlords and managers are portfolio scoped and caretakers are assignment scoped', () => {
  const manager = { userId: 'manager', role: 'property_manager', contextOwnerId: 'owner-a' };
  assert.equal(hasScopedUnitAccess(manager, 'owner-a', 'unit-a', 'property-a', []), true);
  assert.equal(hasScopedUnitAccess(manager, 'owner-b', 'unit-b', 'property-b', []), false);
  const caretaker = { userId: 'caretaker', role: 'caretaker', contextOwnerId: 'owner-a' };
  assert.equal(hasScopedUnitAccess(caretaker, 'owner-a', 'unit-a', 'property-a', [{ property_id: 'property-a' }]), true);
  assert.equal(hasScopedUnitAccess(caretaker, 'owner-a', 'unit-b', 'property-b', [{ property_id: 'property-a' }]), false);
});

test('scheduled job authentication fails closed and rejects mutation methods', () => {
  assert.equal(cronAuthorizationStatus('GET', undefined, undefined), 500);
  assert.equal(cronAuthorizationStatus('GET', 'Bearer wrong', 'secret'), 401);
  assert.equal(cronAuthorizationStatus('POST', 'Bearer secret', 'secret'), 405);
  assert.equal(cronAuthorizationStatus('GET', 'Bearer secret', 'secret'), 200);
});

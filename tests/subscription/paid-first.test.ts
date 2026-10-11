import assert from 'node:assert/strict';
import test from 'node:test';
import { canAddUnit, getEffectivePlanCode, mapProductIdToPlan, mapRevenueCatEventToSubscriptionStatus, requiresManagementSubscription } from '../../shared/subscription/index.js';

const now = new Date('2026-10-11T12:00:00Z');
test('existing accounts retain Free; new accounts do not gain a free allowance', () => {
  for (const status of ['free', 'expired', 'billing_retry', 'paused', 'cancelled'] as const) {
    assert.equal(getEffectivePlanCode('starter', status, null, now, true), 'free');
    assert.equal(getEffectivePlanCode('starter', status, null, now, false), 'inactive');
  }
});
test('period expiry suspends access even when the final webhook is delayed', () => {
  assert.equal(getEffectivePlanCode('starter', 'trialing', null, now, false, '2026-10-11T11:59:59Z'), 'inactive');
  assert.equal(getEffectivePlanCode('starter', 'active', null, now, false, '2026-10-12T00:00:00Z'), 'starter');
  assert.equal(getEffectivePlanCode('bronze', 'grace_period', null, now, false, '2026-10-10T00:00:00Z', '2026-10-12T00:00:00Z'), 'bronze');
});
test('Starter has ten units while legacy product identifiers keep their meaning', () => {
  assert.equal(mapProductIdToPlan('landee_starter_v2:monthly'), 'starter');
  assert.equal(mapProductIdToPlan('landee_starter'), 'bronze');
  assert.equal(canAddUnit('starter', 9), true);
  assert.equal(canAddUnit('starter', 10), false);
  assert.equal(canAddUnit('inactive', 0), false);
});
test('read-only policy blocks portfolio writes and preserves recovery and tenant payments', () => {
  assert.equal(requiresManagementSubscription('POST', '/api/properties', 'landlord'), true);
  assert.equal(requiresManagementSubscription('PATCH', '/api/units/u1', 'caretaker'), true);
  assert.equal(requiresManagementSubscription('DELETE', '/api/units/u1', 'landlord'), false);
  assert.equal(requiresManagementSubscription('GET', '/api/invoices', 'landlord'), false);
  assert.equal(requiresManagementSubscription('GET', '/api/export', 'landlord'), false);
  assert.equal(requiresManagementSubscription('POST', '/api/payments/mpesa/push', 'tenant'), false);
  assert.equal(requiresManagementSubscription('POST', '/api/account-deletion', 'landlord'), false);
});
test('expiration with a trial period type cannot resurrect a trial', () => {
  assert.equal(mapRevenueCatEventToSubscriptionStatus({ event: { id: 'expired-trial', type: 'EXPIRATION', app_user_id: 'owner', product_id: 'landee_starter_v2', period_type: 'TRIAL', expiration_at_ms: Date.now() - 1000 }}), 'expired');
});

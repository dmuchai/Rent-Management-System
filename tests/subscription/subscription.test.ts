import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPlanLimitError,
  canAddManagementUser,
  canAddProperty,
  canAddUnit,
  getMinimumPlanForLimit,
  getEffectivePlanCode,
  hasFeature,
} from '../../shared/subscription/index.js';
import {
  mapProductIdToPlan,
  mapRevenueCatEventToSubscriptionStatus,
  shouldGrantPremiumAccess,
} from '../../shared/subscription/index.js';

test('maps Google Play product IDs to Landee plans', () => {
  assert.equal(mapProductIdToPlan('landee_starter'), 'bronze');
  assert.equal(mapProductIdToPlan('landee_growth'), 'silver');
  assert.equal(mapProductIdToPlan('landee_professional'), 'gold');
  assert.equal(mapProductIdToPlan('landee_silver:monthly'), 'silver');
  assert.equal(mapProductIdToPlan('unknown_product'), 'free');
});

test('respects plan limits for properties, units, and management users', () => {
  assert.equal(canAddProperty('free', 0), true);
  assert.equal(canAddProperty('free', 1), false);
  assert.equal(canAddUnit('free', 2), true);
  assert.equal(canAddUnit('free', 3), true);
  assert.equal(canAddUnit('free', 4), false);
  assert.equal(canAddManagementUser('bronze', 1), true);
  assert.equal(canAddManagementUser('bronze', 2), false);
});

test('resolves the minimum plan needed for a resource', () => {
  assert.equal(getMinimumPlanForLimit('active_units', 3), 'free');
  assert.equal(getMinimumPlanForLimit('active_units', 4), 'free');
  assert.equal(getMinimumPlanForLimit('active_units', 5), 'bronze');
  assert.equal(getMinimumPlanForLimit('active_units', 51), 'gold');
});

test('builds a structured plan limit error', () => {
  assert.deepEqual(buildPlanLimitError('free', 'active_units', 4), {
    code: 'PLAN_LIMIT_REACHED',
    resource: 'active_units',
    current: 4,
    limit: 4,
    requiredPlan: 'bronze',
  });
});

test('exposes feature access by plan', () => {
  assert.equal(hasFeature('bronze', 'pdf_statements'), true);
  assert.equal(hasFeature('free', 'data_export'), true);
  assert.equal(hasFeature('free', 'pdf_statements'), false);
  assert.equal(hasFeature('gold', 'priority_support'), true);
});

test('grants premium access only for paid states', () => {
  assert.equal(shouldGrantPremiumAccess('trialing'), true);
  assert.equal(shouldGrantPremiumAccess('active'), true);
  assert.equal(shouldGrantPremiumAccess('grace_period'), true);
  assert.equal(shouldGrantPremiumAccess('billing_retry'), false);
  assert.equal(shouldGrantPremiumAccess('expired'), false);
  assert.equal(shouldGrantPremiumAccess('cancelled'), false);
  assert.equal(shouldGrantPremiumAccess('paused'), false);
});

test('falls back to Free after paid access ends and grants temporary transition access', () => {
  assert.equal(getEffectivePlanCode('silver', 'expired'), 'free');
  assert.equal(getEffectivePlanCode('gold', 'cancelled'), 'free');
  assert.equal(getEffectivePlanCode('silver', 'active'), 'silver');
  assert.equal(getEffectivePlanCode('free', 'free', new Date(Date.now() + 86_400_000)), 'enterprise');
});

test('maps RevenueCat webhook events to subscription status', () => {
  const trialEvent = mapRevenueCatEventToSubscriptionStatus({
    event_id: 'evt_trial',
    event_type: 'initial_purchase',
    app_user_id: 'user-1',
    product_id: 'landee_growth',
    trial_ends_at_ms: Date.now() + 86400000,
  });

  const expiredEvent = mapRevenueCatEventToSubscriptionStatus({
    event_id: 'evt_expired',
    event_type: 'expiration',
    app_user_id: 'user-1',
    product_id: 'landee_growth',
    expiration_at_ms: Date.now() - 86400000,
  });

  const graceEvent = mapRevenueCatEventToSubscriptionStatus({
    event_id: 'evt_grace',
    event_type: 'billing_issue',
    app_user_id: 'user-1',
    product_id: 'landee_growth',
    expiration_at_ms: Date.now() - 1000,
    grace_period_expires_at_ms: Date.now() + 86400000,
  });

  assert.equal(trialEvent, 'trialing');
  assert.equal(expiredEvent, 'expired');
  assert.equal(graceEvent, 'grace_period');
});

test('maps the official nested RevenueCat trial and account-hold fields', () => {
  const trialEvent = mapRevenueCatEventToSubscriptionStatus({
    api_version: '1.0',
    event: {
      id: 'evt_nested_trial',
      type: 'INITIAL_PURCHASE',
      app_user_id: 'user-1',
      product_id: 'landee_silver:monthly',
      period_type: 'TRIAL',
      event_timestamp_ms: Date.now(),
      expiration_at_ms: Date.now() + 30 * 86_400_000,
    },
  });
  const graceEvent = mapRevenueCatEventToSubscriptionStatus({
    api_version: '1.0',
    event: {
      id: 'evt_nested_grace',
      type: 'BILLING_ISSUE',
      app_user_id: 'user-1',
      product_id: 'landee_silver:monthly',
      period_type: 'NORMAL',
      event_timestamp_ms: Date.now(),
      expiration_at_ms: Date.now() - 1,
      grace_period_expiration_at_ms: Date.now() + 86_400_000,
    },
  });
  const holdEvent = mapRevenueCatEventToSubscriptionStatus({
    api_version: '1.0',
    event: {
      id: 'evt_nested_hold',
      type: 'BILLING_ISSUE',
      app_user_id: 'user-1',
      product_id: 'landee_silver:monthly',
      period_type: 'NORMAL',
      event_timestamp_ms: Date.now(),
      expiration_at_ms: Date.now() - 1,
      grace_period_expiration_at_ms: null,
    },
  });

  assert.equal(trialEvent, 'trialing');
  assert.equal(graceEvent, 'grace_period');
  assert.equal(holdEvent, 'billing_retry');
});

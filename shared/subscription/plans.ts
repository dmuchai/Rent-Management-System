import {
  type PlanCode,
  type PlanConfig,
  type SubscriptionFeatureKey,
  type SubscriptionStatus,
} from './subscription-types.js';

export type { PlanCode, PlanConfig, SubscriptionFeatureKey, SubscriptionStatus } from './subscription-types.js';

export const PLAN_CODES: readonly PlanCode[] = ['free', 'bronze', 'silver', 'gold', 'enterprise'] as const;

const LEGACY_PLAN_ALIASES: Record<string, PlanCode> = {
  starter: 'bronze',
  growth: 'silver',
  professional: 'gold',
  landee_starter: 'bronze',
  landee_growth: 'silver',
  landee_professional: 'gold',
  landee_bronze: 'bronze',
  landee_silver: 'silver',
  landee_gold: 'gold',
};

export const FEATURE_KEYS: readonly SubscriptionFeatureKey[] = [
  'scheduled_reminders',
  'pdf_statements',
  'data_export',
  'recurring_charges',
  'advanced_reports',
  'bulk_actions',
  'audit_history',
  'payment_reconciliation',
  'sms_messaging',
  'staff_permissions',
  'owner_statements',
  'priority_support',
] as const;

export const PLAN_CONFIGS = {
  free: {
    code: 'free',
    displayName: 'Free',
    maxActiveProperties: 1,
    maxActiveUnits: 4,
    maxManagementUsers: 1,
    // Customers must always be able to take their data with them. This is a
    // basic export entitlement, not access to the advanced reporting suite.
    enabledFeatures: ['data_export'],
    googlePlayProductId: null,
    upgradeOrder: 0,
  },
  bronze: {
    code: 'bronze',
    displayName: 'Bronze',
    maxActiveProperties: null,
    maxActiveUnits: 20,
    maxManagementUsers: 2,
    enabledFeatures: ['scheduled_reminders', 'pdf_statements', 'data_export', 'recurring_charges'],
    googlePlayProductId: 'landee_bronze',
    upgradeOrder: 1,
  },
  silver: {
    code: 'silver',
    displayName: 'Silver',
    maxActiveProperties: null,
    maxActiveUnits: 50,
    maxManagementUsers: 5,
    enabledFeatures: [
      'scheduled_reminders',
      'pdf_statements',
      'data_export',
      'recurring_charges',
      'advanced_reports',
      'bulk_actions',
      'audit_history',
      'payment_reconciliation',
      'sms_messaging',
    ],
    googlePlayProductId: 'landee_silver',
    upgradeOrder: 2,
  },
  gold: {
    code: 'gold',
    displayName: 'Gold',
    maxActiveProperties: null,
    maxActiveUnits: 100,
    maxManagementUsers: 15,
    enabledFeatures: [
      'scheduled_reminders',
      'pdf_statements',
      'data_export',
      'recurring_charges',
      'advanced_reports',
      'bulk_actions',
      'audit_history',
      'payment_reconciliation',
      'sms_messaging',
      'staff_permissions',
      'owner_statements',
      'priority_support',
    ],
    googlePlayProductId: 'landee_gold',
    upgradeOrder: 3,
  },
  enterprise: {
    code: 'enterprise',
    displayName: 'Enterprise',
    maxActiveProperties: null,
    maxActiveUnits: null,
    maxManagementUsers: null,
    enabledFeatures: [...FEATURE_KEYS],
    googlePlayProductId: null,
    upgradeOrder: 4,
  },
} as const satisfies Record<PlanCode, PlanConfig>;

export function getPlanConfig(plan: PlanCode): PlanConfig {
  return PLAN_CONFIGS[plan];
}

export function hasFeature(plan: PlanCode, feature: SubscriptionFeatureKey): boolean {
  return getPlanConfig(plan).enabledFeatures.includes(feature);
}

function isUnderLimit(currentCount: number, limit: number | null): boolean {
  return limit === null ? true : currentCount < limit;
}

export function canAddProperty(plan: PlanCode, currentCount: number): boolean {
  return isUnderLimit(currentCount, getPlanConfig(plan).maxActiveProperties);
}

export function canAddUnit(plan: PlanCode, currentCount: number): boolean {
  return isUnderLimit(currentCount, getPlanConfig(plan).maxActiveUnits);
}

export function canAddManagementUser(plan: PlanCode, currentCount: number): boolean {
  return isUnderLimit(currentCount, getPlanConfig(plan).maxManagementUsers);
}

export function mapProductIdToPlan(productId: string | null | undefined): PlanCode {
  if (!productId) return 'free';

  const normalizedProductId = productId.trim().toLowerCase();
  // RevenueCat represents newer Google Play products as
  // `<subscription_id>:<base_plan_id>`. Plan selection is based on the
  // subscription id; the base plan controls billing cadence/offer details.
  const subscriptionProductId = normalizedProductId.split(':', 1)[0];
  const entry = PLAN_CODES.find((plan) => getPlanConfig(plan).googlePlayProductId === subscriptionProductId);

  return entry ?? LEGACY_PLAN_ALIASES[subscriptionProductId] ?? 'free';
}

export function normalizePlanCode(planCode: string | null | undefined): PlanCode {
  if (!planCode) return 'free';

  const normalized = planCode.trim().toLowerCase();
  if ((PLAN_CODES as readonly string[]).includes(normalized)) {
    return normalized as PlanCode;
  }

  return LEGACY_PLAN_ALIASES[normalized] ?? 'free';
}

export function isPaidStatus(status: SubscriptionStatus): boolean {
  return status === 'trialing' || status === 'active' || status === 'grace_period';
}

export function shouldGrantPremiumAccess(status: SubscriptionStatus): boolean {
  return isPaidStatus(status);
}

export function getEffectivePlanCode(
  storedPlan: PlanCode,
  status: SubscriptionStatus,
  transitionEndsAt?: string | Date | null,
  now = new Date(),
): PlanCode {
  if (transitionEndsAt) {
    const transitionEnd = transitionEndsAt instanceof Date ? transitionEndsAt : new Date(transitionEndsAt);
    if (!Number.isNaN(transitionEnd.getTime()) && transitionEnd.getTime() > now.getTime()) {
      return 'enterprise';
    }
  }

  return shouldGrantPremiumAccess(status) ? storedPlan : 'free';
}

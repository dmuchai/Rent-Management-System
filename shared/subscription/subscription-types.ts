export type PlanCode =
  | 'free'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'enterprise';

export type SubscriptionStatus =
  | 'free'
  | 'trialing'
  | 'active'
  | 'grace_period'
  | 'billing_retry'
  | 'paused'
  | 'expired'
  | 'cancelled'
  | 'unknown';

export type SubscriptionFeatureKey =
  | 'scheduled_reminders'
  | 'pdf_statements'
  | 'data_export'
  | 'recurring_charges'
  | 'advanced_reports'
  | 'bulk_actions'
  | 'audit_history'
  | 'payment_reconciliation'
  | 'sms_messaging'
  | 'staff_permissions'
  | 'owner_statements'
  | 'priority_support';

export type SubscriptionResourceKey = 'active_properties' | 'active_units' | 'management_users';

export interface PlanConfig {
  readonly code: PlanCode;
  readonly displayName: string;
  readonly maxActiveProperties: number | null;
  readonly maxActiveUnits: number | null;
  readonly maxManagementUsers: number | null;
  readonly enabledFeatures: readonly SubscriptionFeatureKey[];
  readonly googlePlayProductId: string | null;
  readonly upgradeOrder: number;
}

export interface SubscriptionLimitError {
  code: 'PLAN_LIMIT_REACHED';
  resource: SubscriptionResourceKey;
  current: number;
  limit: number;
  requiredPlan: PlanCode;
}

import {
  getPlanConfig,
  type PlanCode,
} from './plans.js';
import type { SubscriptionLimitError, SubscriptionResourceKey } from './subscription-types.js';

const PLAN_ORDER: readonly PlanCode[] = ['free', 'bronze', 'silver', 'gold', 'enterprise'] as const;

function getPlanLimit(plan: PlanCode, resource: SubscriptionResourceKey): number | null {
  const config = getPlanConfig(plan);

  if (resource === 'active_properties') return config.maxActiveProperties;
  if (resource === 'active_units') return config.maxActiveUnits;
  return config.maxManagementUsers;
}

export function getMinimumPlanForLimit(resource: SubscriptionResourceKey, current: number): PlanCode {
  for (const plan of PLAN_ORDER) {
    const limit = getPlanLimit(plan, resource);
    if (limit === null || current <= limit) {
      return plan;
    }
  }

  return 'enterprise';
}

export function buildPlanLimitError(plan: PlanCode, resource: SubscriptionResourceKey, current: number): SubscriptionLimitError {
  const limit = getPlanLimit(plan, resource);

  if (limit === null) {
    throw new Error(`Plan ${plan} does not limit ${resource}`);
  }

  return {
    code: 'PLAN_LIMIT_REACHED',
    resource,
    current,
    limit,
    requiredPlan: getMinimumPlanForLimit(resource, current + 1),
  };
}

export function hasRoomForResource(plan: PlanCode, resource: SubscriptionResourceKey, current: number): boolean {
  const limit = getPlanLimit(plan, resource);
  return limit === null ? true : current < limit;
}

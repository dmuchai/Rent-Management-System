import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from './_lib/auth.js';
import { createDbConnection } from './_lib/db.js';
import { getEffectiveSubscriptionAccess, getOwnerUsageSnapshot, isSubscriptionsEnabled } from './_lib/subscription.js';
import { getPlanConfig } from '../shared/subscription/index.js';

export default requireAuth(async (_req: VercelRequest, res: VercelResponse, auth) => {
  if (!['landlord', 'property_manager'].includes(auth.role)) {
    return res.status(403).json({ error: 'Subscriptions belong to the landlord or property-management billing account' });
  }
  const subscriptionEnabled = isSubscriptionsEnabled();
  const sql = createDbConnection();

  try {
    const access = await getEffectiveSubscriptionAccess(auth.userId);
    const billingAccount = access.billingAccount;
    const usage = await getOwnerUsageSnapshot(sql, auth.userId);
    const planConfig = getPlanConfig(access.planCode);

    return res.status(200).json({
      enabled: subscriptionEnabled,
      billingAccount: billingAccount ? {
        id: billingAccount.id,
        ownerUserId: billingAccount.owner_user_id,
        revenuecatAppUserId: billingAccount.revenuecat_app_user_id,
        planCode: billingAccount.plan_code,
        subscriptionStatus: billingAccount.subscription_status,
        productId: billingAccount.product_id,
        basePlanId: billingAccount.base_plan_id,
        store: billingAccount.store,
        trialEndsAt: billingAccount.trial_ends_at,
        currentPeriodEndsAt: billingAccount.current_period_ends_at,
        gracePeriodEndsAt: billingAccount.grace_period_ends_at,
        transitionEndsAt: billingAccount.transition_ends_at,
        willRenew: billingAccount.will_renew,
        lastEventAt: billingAccount.last_event_at,
        createdAt: billingAccount.created_at,
        updatedAt: billingAccount.updated_at,
      } : null,
      plan: planConfig,
      access: {
        premium: access.premium,
        subscriptionStatus: access.subscriptionStatus,
        planCode: access.planCode,
        storedPlanCode: access.storedPlanCode,
        transitionActive: access.transitionActive,
        transitionEndsAt: access.transitionEndsAt,
      },
      usage,
    });
  } finally {
    await sql.end();
  }
});

import { supabase } from "../supabaseAuth";
import {
  getEffectivePlanCode,
  getPlanConfig,
  hasFeature,
  normalizePlanCode,
  type PlanCode,
  type SubscriptionFeatureKey,
  type SubscriptionStatus,
} from "../../shared/subscription/index.js";

export const subscriptionsEnabled = () => process.env.ENABLE_SUBSCRIPTIONS === "true";

function transitionEndFor(createdAt?: string | null): string | null {
  const cutoff = process.env.SUBSCRIPTION_EXISTING_USER_CUTOFF;
  const transitionEnd = process.env.SUBSCRIPTION_TRANSITION_END_AT;
  if (!cutoff || !transitionEnd || !createdAt) return null;
  if (Date.parse(createdAt) > Date.parse(cutoff) || Date.parse(transitionEnd) <= Date.now()) return null;
  return transitionEnd;
}

export async function getOwnerSubscriptionAccess(ownerUserId: string): Promise<{
  billingAccount: any | null;
  planCode: PlanCode;
  storedPlanCode: PlanCode;
  status: SubscriptionStatus;
  transitionEndsAt: string | null;
  legacyFreeEligible: boolean;
  readOnly: boolean;
}> {
  if (!subscriptionsEnabled()) {
    return { billingAccount: null, planCode: "enterprise", storedPlanCode: "free", status: "free", transitionEndsAt: null, legacyFreeEligible: false, readOnly: false };
  }

  const { data: ownerFlags, error: flagsError } = await supabase.from('users')
    .select('legacy_free_eligible').eq('id', ownerUserId).maybeSingle();
  if (flagsError) throw flagsError;
  const legacyFreeEligible = ownerFlags?.legacy_free_eligible === true;

  let { data: account, error: accountError } = await supabase
    .from("billing_accounts")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (accountError) throw accountError;

  if (!account) {
    const { data: owner } = await supabase
      .from("users")
      .select("id, role, created_at")
      .eq("id", ownerUserId)
      .maybeSingle();

    if (owner && ["landlord", "property_manager"].includes(owner.role)) {
      const result = await supabase
        .from("billing_accounts")
        .upsert({
          owner_user_id: ownerUserId,
          revenuecat_app_user_id: ownerUserId,
          plan_code: "free",
          subscription_status: "free",
          transition_ends_at: transitionEndFor(owner.created_at),
        }, { onConflict: "owner_user_id", ignoreDuplicates: true })
        .select("*")
        .maybeSingle();
      if (result.error) throw result.error;
      account = result.data;
      if (!account) {
        const existing = await supabase.from('billing_accounts').select('*').eq('owner_user_id', ownerUserId).single();
        if (existing.error) throw existing.error;
        account = existing.data;
      }
    }
  }

  const storedPlanCode = normalizePlanCode(account?.plan_code);
  const status = (account?.subscription_status || "free") as SubscriptionStatus;
  const transitionEndsAt = account?.transition_ends_at || null;
  const planCode = getEffectivePlanCode(storedPlanCode, status, transitionEndsAt, new Date(),
    legacyFreeEligible, account?.current_period_ends_at || account?.trial_ends_at, account?.grace_period_ends_at);
  const unitLimit = getPlanConfig(planCode).maxActiveUnits;
  const usage = unitLimit === null ? null : await supabase.from('units')
    .select('id, properties!inner(owner_id, archived_at)', { count: 'exact', head: true })
    .eq('properties.owner_id', ownerUserId).is('properties.archived_at', null).is('archived_at', null);
  if (usage?.error) throw usage.error;
  const overUnitLimit = unitLimit !== null && Number(usage?.count || 0) > unitLimit;
  return {
    billingAccount: account,
    planCode,
    storedPlanCode,
    status,
    transitionEndsAt,
    legacyFreeEligible,
    readOnly: planCode === 'inactive' || overUnitLimit,
  };
}

export async function ownerHasFeature(ownerUserId: string, feature: SubscriptionFeatureKey): Promise<boolean> {
  const access = await getOwnerSubscriptionAccess(ownerUserId);
  return hasFeature(access.planCode, feature) && (!access.readOnly || !['recurring_charges', 'scheduled_reminders', 'sms_messaging', 'bulk_actions'].includes(feature));
}

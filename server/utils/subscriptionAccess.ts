import { supabase } from "../supabaseAuth";
import {
  getEffectivePlanCode,
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
}> {
  if (!subscriptionsEnabled()) {
    return { billingAccount: null, planCode: "enterprise", storedPlanCode: "free", status: "free", transitionEndsAt: null };
  }

  let { data: account } = await supabase
    .from("billing_accounts")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

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
        }, { onConflict: "owner_user_id" })
        .select("*")
        .single();
      account = result.data;
    }
  }

  const storedPlanCode = normalizePlanCode(account?.plan_code);
  const status = (account?.subscription_status || "free") as SubscriptionStatus;
  const transitionEndsAt = account?.transition_ends_at || null;
  return {
    billingAccount: account,
    planCode: getEffectivePlanCode(storedPlanCode, status, transitionEndsAt),
    storedPlanCode,
    status,
    transitionEndsAt,
  };
}

export async function ownerHasFeature(ownerUserId: string, feature: SubscriptionFeatureKey): Promise<boolean> {
  return hasFeature((await getOwnerSubscriptionAccess(ownerUserId)).planCode, feature);
}

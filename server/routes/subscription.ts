import { Router } from "express";
import { isAuthenticated, supabase } from "../supabaseAuth";
import { getPlanConfig } from "../../shared/subscription/index.js";
import { getOwnerSubscriptionAccess, subscriptionsEnabled } from "../utils/subscriptionAccess";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const role = req.user.appRole || req.user.role;
    if (role && !["landlord", "property_manager"].includes(role)) {
      return res.status(403).json({ error: "Subscriptions belong to the landlord or property-management billing account" });
    }
    const ownerId = req.user.sub;
    const access = await getOwnerSubscriptionAccess(ownerId);
    const account = access.billingAccount;
    const { data: activeProperties, count: activePropertyCount } = await supabase
      .from("properties").select("id", { count: "exact" }).eq("owner_id", ownerId).is("archived_at", null);
    const propertyIds = (activeProperties || []).map((row: any) => row.id);
    const { count: activeUnitCount } = propertyIds.length
      ? await supabase.from("units").select("id", { count: "exact", head: true }).in("property_id", propertyIds).is("archived_at", null)
      : { count: 0 };
    const [{ count: staffCount }, { count: inviteCount }] = await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }).eq("created_by", ownerId).in("role", ["caretaker", "property_manager"]).eq("status", "active"),
      supabase.from("caretaker_invitations").select("id", { count: "exact", head: true }).eq("landlord_id", ownerId).in("status", ["pending", "invited"]),
    ]);

    res.json({
      enabled: subscriptionsEnabled(),
      billingAccount: account ? {
        id: account.id,
        ownerUserId: account.owner_user_id,
        revenuecatAppUserId: account.revenuecat_app_user_id,
        planCode: account.plan_code,
        subscriptionStatus: account.subscription_status,
        productId: account.product_id,
        basePlanId: account.base_plan_id,
        store: account.store,
        trialEndsAt: account.trial_ends_at,
        currentPeriodEndsAt: account.current_period_ends_at,
        gracePeriodEndsAt: account.grace_period_ends_at,
        transitionEndsAt: account.transition_ends_at,
        willRenew: account.will_renew,
        lastEventAt: account.last_event_at,
        createdAt: account.created_at,
        updatedAt: account.updated_at,
      } : null,
      plan: getPlanConfig(access.planCode),
      access: {
        premium: access.planCode !== "free",
        subscriptionStatus: access.status,
        planCode: access.planCode,
        storedPlanCode: access.storedPlanCode,
        transitionActive: Boolean(access.transitionEndsAt && Date.parse(access.transitionEndsAt) > Date.now()),
        transitionEndsAt: access.transitionEndsAt,
      },
      usage: {
        activeProperties: Number(activePropertyCount || 0),
        activeUnits: Number(activeUnitCount || 0),
        managementUsers: 1 + Number(staffCount || 0) + Number(inviteCount || 0),
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load subscription state" });
  }
});

export default router;

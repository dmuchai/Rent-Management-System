import { createClient } from '@supabase/supabase-js';
import type { Sql } from 'postgres';
import {
  buildPlanLimitError,
  getEffectivePlanCode,
  hasFeature,
  hasRoomForResource,
  normalizePlanCode,
  type SubscriptionLimitError,
} from '../../shared/subscription/index.js';
import type { PlanCode, SubscriptionFeatureKey, SubscriptionResourceKey, SubscriptionStatus } from '../../shared/subscription/index.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables for subscription helpers');
}

export const subscriptionAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export function isSubscriptionsEnabled(): boolean {
  return process.env.ENABLE_SUBSCRIPTIONS === 'true';
}

export function isPlanResourceWithinLimit(plan: PlanCode, resource: SubscriptionResourceKey, current: number): boolean {
  return hasRoomForResource(plan, resource, current);
}

export function createPlanLimitError(plan: PlanCode, resource: SubscriptionResourceKey, current: number): SubscriptionLimitError {
  return buildPlanLimitError(plan, resource, current);
}

export async function getBillingAccountForOwner(ownerUserId: string) {
  const { data, error } = await subscriptionAdmin
    .from('billing_accounts')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function configuredTransitionEnd(createdAt: string | null | undefined): string | null {
  const cutoff = process.env.SUBSCRIPTION_EXISTING_USER_CUTOFF;
  const transitionEnd = process.env.SUBSCRIPTION_TRANSITION_END_AT;
  if (!cutoff || !transitionEnd || !createdAt) return null;

  const created = Date.parse(createdAt);
  const cutoffAt = Date.parse(cutoff);
  const endsAt = Date.parse(transitionEnd);
  if (![created, cutoffAt, endsAt].every(Number.isFinite) || created > cutoffAt || endsAt <= Date.now()) return null;
  return new Date(endsAt).toISOString();
}

export async function ensureBillingAccountForOwner(ownerUserId: string) {
  const existing = await getBillingAccountForOwner(ownerUserId);
  if (existing) return existing;

  const { data: owner, error: ownerError } = await subscriptionAdmin
    .from('users')
    .select('id, role, created_at')
    .eq('id', ownerUserId)
    .maybeSingle();

  if (ownerError) throw ownerError;
  if (!owner || !['landlord', 'property_manager'].includes(owner.role)) return null;

  const { data, error } = await subscriptionAdmin
    .from('billing_accounts')
    .upsert({
      owner_user_id: ownerUserId,
      revenuecat_app_user_id: ownerUserId,
      plan_code: 'free',
      subscription_status: 'free',
      transition_ends_at: configuredTransitionEnd(owner.created_at),
    }, { onConflict: 'owner_user_id', ignoreDuplicates: false })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export interface EffectiveSubscriptionAccess {
  billingAccount: any | null;
  storedPlanCode: PlanCode;
  planCode: PlanCode;
  subscriptionStatus: SubscriptionStatus;
  premium: boolean;
  transitionActive: boolean;
  transitionEndsAt: string | null;
}

export async function getEffectiveSubscriptionAccess(ownerUserId: string): Promise<EffectiveSubscriptionAccess> {
  if (!isSubscriptionsEnabled()) {
    return {
      billingAccount: null,
      storedPlanCode: 'free',
      planCode: 'enterprise',
      subscriptionStatus: 'free',
      premium: true,
      transitionActive: false,
      transitionEndsAt: null,
    };
  }

  const billingAccount = await ensureBillingAccountForOwner(ownerUserId);
  const storedPlanCode = normalizePlanCode(billingAccount?.plan_code);
  const subscriptionStatus = (billingAccount?.subscription_status || 'free') as SubscriptionStatus;
  const transitionEndsAt = billingAccount?.transition_ends_at || null;
  const transitionActive = Boolean(transitionEndsAt && Date.parse(transitionEndsAt) > Date.now());
  const planCode = getEffectivePlanCode(storedPlanCode, subscriptionStatus, transitionEndsAt);

  return {
    billingAccount,
    storedPlanCode,
    planCode,
    subscriptionStatus,
    premium: planCode !== 'free',
    transitionActive,
    transitionEndsAt,
  };
}

export async function ownerHasSubscriptionFeature(ownerUserId: string, feature: SubscriptionFeatureKey): Promise<boolean> {
  const access = await getEffectiveSubscriptionAccess(ownerUserId);
  return hasFeature(access.planCode, feature);
}

export async function getOwnerUsageSnapshot(sql: Sql, ownerUserId: string) {
  const [propertyRow] = await sql`
    SELECT COUNT(*)::int AS count
    FROM public.properties
    WHERE owner_id = ${ownerUserId}
      AND archived_at IS NULL
  `;

  const [unitRow] = await sql`
    SELECT COUNT(*)::int AS count
    FROM public.units u
    INNER JOIN public.properties p ON p.id = u.property_id
    WHERE p.owner_id = ${ownerUserId}
      AND u.archived_at IS NULL
  `;

  const [caretakerRow] = await sql`
    SELECT COUNT(*)::int AS count
    FROM public.users
    WHERE created_by = ${ownerUserId}
      AND role IN ('caretaker', 'property_manager')
      AND status = 'active'
  `;

  const [invitationRow] = await sql`
    SELECT COUNT(*)::int AS count
    FROM public.caretaker_invitations
    WHERE landlord_id = ${ownerUserId}
      AND status IN ('pending', 'invited')
  `;

  return {
    activeProperties: Number(propertyRow?.count || 0),
    activeUnits: Number(unitRow?.count || 0),
    managementUsers: 1 + Number(caretakerRow?.count || 0) + Number(invitationRow?.count || 0),
  };
}

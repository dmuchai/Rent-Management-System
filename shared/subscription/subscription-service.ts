import { z } from 'zod';
import { mapProductIdToPlan, shouldGrantPremiumAccess } from './plans.js';
import type { PlanCode, SubscriptionStatus } from './subscription-types.js';

const nullableString = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
});

const timestampValue = z.union([z.number(), z.string(), z.null(), z.undefined()]).transform((value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value.trim())) {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
  }
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) return null;
  const normalized = numericValue > 1_000_000_000_000 ? numericValue : numericValue * 1000;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
});

const rawRevenueCatWebhookSchema = z.object({
  event: z.record(z.string(), z.unknown()).optional(),
  event_id: nullableString.optional(),
  id: nullableString.optional(),
  event_type: nullableString.optional(),
  type: nullableString.optional(),
  app_user_id: nullableString.optional(),
  appUserId: nullableString.optional(),
  original_app_user_id: nullableString.optional(),
  originalAppUserId: nullableString.optional(),
  product_id: nullableString.optional(),
  productId: nullableString.optional(),
  base_plan_id: nullableString.optional(),
  basePlanId: nullableString.optional(),
  period_type: nullableString.optional(),
  periodType: nullableString.optional(),
  environment: nullableString.optional(),
  entitlement_ids: z.array(z.string()).optional(),
  entitlementIds: z.array(z.string()).optional(),
  event_timestamp_ms: timestampValue.optional(),
  eventTimestampMs: timestampValue.optional(),
  expiration_at_ms: timestampValue.optional(),
  expirationAtMs: timestampValue.optional(),
  trial_ends_at_ms: timestampValue.optional(),
  trialEndsAtMs: timestampValue.optional(),
  grace_period_expires_at_ms: timestampValue.optional(),
  gracePeriodExpiresAtMs: timestampValue.optional(),
  grace_period_expiration_at_ms: timestampValue.optional(),
  gracePeriodExpirationAtMs: timestampValue.optional(),
  will_renew: z.boolean().optional(),
  willRenew: z.boolean().optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export interface NormalizedRevenueCatWebhookEvent {
  eventId: string;
  eventType: string;
  appUserId: string;
  originalAppUserId: string | null;
  productId: string | null;
  basePlanId: string | null;
  entitlementIds: string[];
  environment: string | null;
  periodType: string | null;
  eventTimestamp: string | null;
  expirationAt: string | null;
  trialEndsAt: string | null;
  gracePeriodEndsAt: string | null;
  willRenew: boolean;
  planCode: PlanCode;
  subscriptionStatus: SubscriptionStatus;
  rawPayload: Record<string, unknown>;
}

function getString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getEventField(event: Record<string, unknown>, key: string): unknown {
  return event[key] ?? event[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)];
}

function toTimestamp(value: unknown): string | null {
  const parsed = timestampValue.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function inferSubscriptionStatus(eventType: string, details: Pick<NormalizedRevenueCatWebhookEvent, 'periodType' | 'trialEndsAt' | 'gracePeriodEndsAt' | 'expirationAt' | 'willRenew'>): SubscriptionStatus {
  const normalizedEventType = eventType.toLowerCase();
  const now = Date.now();
  const trialEndsAt = details.trialEndsAt ? Date.parse(details.trialEndsAt) : Number.NaN;
  const gracePeriodEndsAt = details.gracePeriodEndsAt ? Date.parse(details.gracePeriodEndsAt) : Number.NaN;
  const expirationAt = details.expirationAt ? Date.parse(details.expirationAt) : Number.NaN;

  if (details.periodType?.toLowerCase() === 'trial' || (Number.isFinite(trialEndsAt) && trialEndsAt > now)) {
    return 'trialing';
  }

  if (Number.isFinite(gracePeriodEndsAt) && gracePeriodEndsAt > now) {
    return 'grace_period';
  }

  if (normalizedEventType.includes('billing_issue') || normalizedEventType.includes('billing_retry')) {
    // A billing issue without a current grace period is account hold/billing
    // retry. Premium access is suspended until RevenueCat reports recovery.
    return 'billing_retry';
  }

  if (normalizedEventType.includes('subscription_paused')) {
    // RevenueCat's pause event schedules a future pause. Access remains active
    // until the corresponding EXPIRATION event.
    return Number.isFinite(expirationAt) && expirationAt <= now ? 'paused' : 'active';
  }

  if (normalizedEventType.includes('expiration')) {
    return 'expired';
  }

  if (normalizedEventType.includes('cancel') && (!Number.isFinite(expirationAt) || expirationAt <= now)) {
    return 'cancelled';
  }

  if (Number.isFinite(expirationAt) && expirationAt <= now) {
    return details.willRenew ? 'expired' : 'cancelled';
  }

  return 'active';
}

export function normalizeRevenueCatWebhookPayload(rawPayload: unknown): NormalizedRevenueCatWebhookEvent {
  const parsed = rawRevenueCatWebhookSchema.parse(rawPayload);
  const event = (parsed.event && typeof parsed.event === 'object' ? parsed.event : parsed) as Record<string, unknown>;

  const eventId =
    getString(getEventField(event, 'event_id')) ??
    getString(getEventField(event, 'id')) ??
    getString(getEventField(parsed, 'event_id')) ??
    getString(getEventField(parsed, 'id')) ??
    '';

  const eventType =
    getString(getEventField(event, 'event_type')) ??
    getString(getEventField(event, 'type')) ??
    getString(getEventField(parsed, 'event_type')) ??
    getString(getEventField(parsed, 'type')) ??
    'unknown';

  const appUserId =
    getString(getEventField(event, 'app_user_id')) ??
    getString(getEventField(event, 'appUserId')) ??
    getString(getEventField(parsed, 'app_user_id')) ??
    getString(getEventField(parsed, 'appUserId')) ??
    '';

  const originalAppUserId =
    getString(getEventField(event, 'original_app_user_id')) ??
    getString(getEventField(event, 'originalAppUserId')) ??
    getString(getEventField(parsed, 'original_app_user_id')) ??
    getString(getEventField(parsed, 'originalAppUserId'));

  const productId =
    getString(getEventField(event, 'product_id')) ??
    getString(getEventField(event, 'productId')) ??
    getString(getEventField(parsed, 'product_id')) ??
    getString(getEventField(parsed, 'productId'));

  const explicitBasePlanId =
    getString(getEventField(event, 'base_plan_id')) ??
    getString(getEventField(event, 'basePlanId')) ??
    getString(getEventField(parsed, 'base_plan_id')) ??
    getString(getEventField(parsed, 'basePlanId'));
  const basePlanId = explicitBasePlanId ?? (productId?.includes(':') ? productId.split(':').slice(1).join(':') : null);

  const periodType =
    getString(getEventField(event, 'period_type')) ??
    getString(getEventField(event, 'periodType')) ??
    getString(getEventField(parsed, 'period_type')) ??
    getString(getEventField(parsed, 'periodType'));

  const environment =
    getString(getEventField(event, 'environment')) ??
    getString(getEventField(parsed, 'environment'));

  const entitlementIds =
    (Array.isArray(getEventField(event, 'entitlement_ids')) ? (getEventField(event, 'entitlement_ids') as string[]) : null) ??
    (Array.isArray(getEventField(event, 'entitlementIds')) ? (getEventField(event, 'entitlementIds') as string[]) : null) ??
    (Array.isArray(getEventField(parsed, 'entitlement_ids')) ? (getEventField(parsed, 'entitlement_ids') as string[]) : null) ??
    (Array.isArray(getEventField(parsed, 'entitlementIds')) ? (getEventField(parsed, 'entitlementIds') as string[]) : null) ??
    [];

  const eventTimestamp =
    toTimestamp(getEventField(event, 'event_timestamp_ms')) ??
    toTimestamp(getEventField(event, 'eventTimestampMs')) ??
    toTimestamp(getEventField(parsed, 'event_timestamp_ms')) ??
    toTimestamp(getEventField(parsed, 'eventTimestampMs'));

  const expirationAt =
    toTimestamp(getEventField(event, 'expiration_at_ms')) ??
    toTimestamp(getEventField(event, 'expirationAtMs')) ??
    toTimestamp(getEventField(parsed, 'expiration_at_ms')) ??
    toTimestamp(getEventField(parsed, 'expirationAtMs'));

  const trialEndsAt =
    toTimestamp(getEventField(event, 'trial_ends_at_ms')) ??
    toTimestamp(getEventField(event, 'trialEndsAtMs')) ??
    toTimestamp(getEventField(parsed, 'trial_ends_at_ms')) ??
    toTimestamp(getEventField(parsed, 'trialEndsAtMs'));

  const gracePeriodEndsAt =
    toTimestamp(getEventField(event, 'grace_period_expiration_at_ms')) ??
    toTimestamp(getEventField(event, 'gracePeriodExpirationAtMs')) ??
    toTimestamp(getEventField(event, 'grace_period_expires_at_ms')) ??
    toTimestamp(getEventField(event, 'gracePeriodExpiresAtMs')) ??
    toTimestamp(getEventField(parsed, 'grace_period_expires_at_ms')) ??
    toTimestamp(getEventField(parsed, 'gracePeriodExpiresAtMs')) ??
    toTimestamp(getEventField(parsed, 'grace_period_expiration_at_ms')) ??
    toTimestamp(getEventField(parsed, 'gracePeriodExpirationAtMs'));

  const willRenew =
    Boolean(getEventField(event, 'will_renew') ?? getEventField(event, 'willRenew') ?? getEventField(parsed, 'will_renew') ?? getEventField(parsed, 'willRenew') ?? true);

  const planCode = mapProductIdToPlan(productId);
  const effectiveTrialEndsAt = periodType?.toLowerCase() === 'trial' ? (trialEndsAt ?? expirationAt) : trialEndsAt;
  const subscriptionStatus = inferSubscriptionStatus(eventType, {
    periodType,
    trialEndsAt: effectiveTrialEndsAt,
    gracePeriodEndsAt,
    expirationAt,
    willRenew,
  });

  return {
    eventId,
    eventType,
    appUserId,
    originalAppUserId,
    productId,
    basePlanId,
    entitlementIds,
    environment,
    periodType,
    eventTimestamp,
    expirationAt,
    trialEndsAt: effectiveTrialEndsAt,
    gracePeriodEndsAt,
    willRenew,
    planCode,
    subscriptionStatus,
    rawPayload: parsed as Record<string, unknown>,
  };
}

export function mapRevenueCatEventToPlanCode(rawPayload: unknown): PlanCode {
  return normalizeRevenueCatWebhookPayload(rawPayload).planCode;
}

export function mapRevenueCatEventToSubscriptionStatus(rawPayload: unknown): SubscriptionStatus {
  return normalizeRevenueCatWebhookPayload(rawPayload).subscriptionStatus;
}

export function shouldGrantAccessFromRevenueCatStatus(status: SubscriptionStatus): boolean {
  return shouldGrantPremiumAccess(status);
}

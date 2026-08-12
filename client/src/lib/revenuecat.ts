import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { mapProductIdToPlan, shouldGrantPremiumAccess, type PlanCode, type SubscriptionStatus } from '../../../shared/subscription/index.js';

const ANDROID_PACKAGE_NAME = 'com.rentmanagement.app';
const SUBSCRIPTION_FEATURE_FLAG = import.meta.env.VITE_ENABLE_SUBSCRIPTIONS === 'true';

type NativePurchasesModule = typeof import('@revenuecat/purchases-capacitor');

interface NativePackageHandle {
  identifier: string;
  nativePackage: unknown;
}

export interface SubscriptionPackageSummary extends NativePackageHandle {
  planCode: PlanCode;
  title: string;
  description: string;
  priceString: string;
  priceAmount: number | null;
  billingPeriod: 'monthly' | 'annual' | 'unknown';
  productId: string;
  basePlanId: string | null;
}

export interface SubscriptionOfferingSummary {
  identifier: string;
  packages: SubscriptionPackageSummary[];
}

export interface SubscriptionCustomerSnapshot {
  appUserId: string | null;
  planCode: PlanCode;
  subscriptionStatus: SubscriptionStatus;
  entitlementActive: boolean;
  activeProductId: string | null;
  currentPeriodEndsAt: string | null;
  trialEndsAt: string | null;
  gracePeriodEndsAt: string | null;
  willRenew: boolean;
}

export interface RevenueCatService {
  isAvailable(): boolean;
  configure(appUserId: string): Promise<void>;
  logOut(): Promise<void>;
  getOfferings(): Promise<SubscriptionOfferingSummary | null>;
  getCustomerInfo(): Promise<SubscriptionCustomerSnapshot | null>;
  purchasePackage(subscriptionPackage: SubscriptionPackageSummary): Promise<SubscriptionCustomerSnapshot>;
  restorePurchases(): Promise<SubscriptionCustomerSnapshot>;
  openManageSubscriptions(productId?: string | null): Promise<void>;
  isPurchaseCancelled(error: unknown): boolean;
}

function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toNumberValue(value: unknown): number | null {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeBillingPeriod(packageType: string, subscriptionPeriod: string): 'monthly' | 'annual' | 'unknown' {
  const normalizedType = packageType.toUpperCase();
  const normalizedPeriod = subscriptionPeriod.toUpperCase();

  if (normalizedType.includes('ANNUAL') || normalizedPeriod.includes('P1Y')) {
    return 'annual';
  }

  if (normalizedType.includes('MONTHLY') || normalizedPeriod.includes('P1M')) {
    return 'monthly';
  }

  return 'unknown';
}

function normalizeCustomerInfo(customerInfo: Record<string, any> | null | undefined): SubscriptionCustomerSnapshot {
  const activeEntitlements = customerInfo?.entitlements?.active ? Object.values(customerInfo.entitlements.active) : [];
  const activeEntitlement = activeEntitlements[0] as Record<string, any> | undefined;
  const activeProductId = toStringValue(activeEntitlement?.productIdentifier || activeEntitlement?.product_id || customerInfo?.activeSubscriptions?.[0] || null) || null;
  const planCode = mapProductIdToPlan(activeProductId);
  const periodType = toStringValue(activeEntitlement?.periodType || activeEntitlement?.period_type || '');
  const isTrial = periodType.toLowerCase() === 'trial';
  const subscriptionStatus: SubscriptionStatus = isTrial
    ? 'trialing'
    : shouldGrantPremiumAccess(activeEntitlement?.subscriptionStatus as SubscriptionStatus)
      ? (activeEntitlement?.willRenew === false ? 'active' : 'active')
      : (activeProductId ? 'active' : 'free');

  return {
    appUserId: toStringValue(customerInfo?.originalAppUserId || customerInfo?.appUserId || null) || null,
    planCode,
    subscriptionStatus,
    entitlementActive: activeEntitlements.length > 0,
    activeProductId,
    currentPeriodEndsAt: toStringValue(activeEntitlement?.expirationDate || activeEntitlement?.expiresDate || null) || null,
    trialEndsAt: isTrial
      ? (toStringValue(activeEntitlement?.trialEndsAt || activeEntitlement?.expirationDate || activeEntitlement?.expiresDate || null) || null)
      : null,
    gracePeriodEndsAt: toStringValue(activeEntitlement?.gracePeriodExpiresDate || null) || null,
    willRenew: Boolean(activeEntitlement?.willRenew ?? false),
  };
}

function normalizePackage(nativePackage: Record<string, any>): SubscriptionPackageSummary {
  const storeProduct = nativePackage.storeProduct ?? nativePackage.product ?? {};
  const productId = toStringValue(storeProduct.productIdentifier || storeProduct.identifier || nativePackage.productIdentifier || nativePackage.productId || null);
  const packageType = toStringValue(nativePackage.packageType || nativePackage.package_type || '');
  const subscriptionPeriod = toStringValue(storeProduct.subscriptionPeriod || storeProduct.subscription_period || '');
  const priceString = toStringValue(storeProduct.priceString || storeProduct.localizedPrice || nativePackage.priceString || '');
  const description = toStringValue(storeProduct.description || nativePackage.description || '');
  const title = toStringValue(storeProduct.title || storeProduct.name || nativePackage.identifier || productId || 'Plan');
  const priceAmount = toNumberValue(storeProduct.price ?? nativePackage.price ?? null);
  const billingPeriod = normalizeBillingPeriod(packageType, subscriptionPeriod);

  return {
    identifier: toStringValue(nativePackage.identifier || productId || title),
    nativePackage,
    planCode: mapProductIdToPlan(productId),
    title,
    description,
    priceString,
    priceAmount,
    billingPeriod,
    productId,
    basePlanId: toStringValue(storeProduct.basePlanId || storeProduct.base_plan_id || nativePackage.basePlanId || null) || null,
  };
}

function mapOfferings(offerings: Record<string, any>): SubscriptionOfferingSummary | null {
  const current = offerings.current ?? offerings.currentOffering ?? offerings.current_offering ?? null;
  const availablePackages = current?.availablePackages ?? current?.available_packages ?? [];

  if (!current || !Array.isArray(availablePackages)) {
    return null;
  }

  return {
    identifier: toStringValue(current.identifier || 'default'),
    packages: availablePackages.map((subscriptionPackage: Record<string, any>) => normalizePackage(subscriptionPackage)),
  };
}

async function loadPurchasesSdk(): Promise<NativePurchasesModule | null> {
  if (!isNativeAndroid() || !SUBSCRIPTION_FEATURE_FLAG) {
    return null;
  }

  try {
    return await import('@revenuecat/purchases-capacitor');
  } catch (error) {
    console.warn('[RevenueCat] Native SDK unavailable:', error);
    return null;
  }
}

export function createRevenueCatService(): RevenueCatService {
  let configuredAppUserId: string | null = null;
  let sdkPromise: Promise<NativePurchasesModule | null> | null = null;
  const packageRegistry = new Map<string, SubscriptionPackageSummary>();

  async function getSdk() {
    if (!sdkPromise) {
      sdkPromise = loadPurchasesSdk();
    }

    return sdkPromise;
  }

  async function configure(appUserId: string): Promise<void> {
    const sdk = await getSdk();
    if (!sdk) return;
    if (configuredAppUserId === appUserId) return;

    await sdk.Purchases.configure({
      apiKey: import.meta.env.VITE_REVENUECAT_ANDROID_PUBLIC_SDK_KEY,
      appUserID: appUserId,
    });
    configuredAppUserId = appUserId;
  }

  async function logOut(): Promise<void> {
    const sdk = await getSdk();
    if (!sdk || !configuredAppUserId) return;

    await sdk.Purchases.logOut();
    configuredAppUserId = null;
    packageRegistry.clear();
  }

  async function getOfferings(): Promise<SubscriptionOfferingSummary | null> {
    const sdk = await getSdk();
    if (!sdk) return null;

    const offerings = await sdk.Purchases.getOfferings();
    const normalized = mapOfferings(offerings as Record<string, any>);

    if (normalized) {
      for (const subscriptionPackage of normalized.packages) {
        packageRegistry.set(subscriptionPackage.identifier, subscriptionPackage);
      }
    }

    return normalized;
  }

  async function getCustomerInfo(): Promise<SubscriptionCustomerSnapshot | null> {
    const sdk = await getSdk();
    if (!sdk) return null;

    const { customerInfo } = await sdk.Purchases.getCustomerInfo();
    return normalizeCustomerInfo(customerInfo as Record<string, any>);
  }

  async function purchasePackage(subscriptionPackage: SubscriptionPackageSummary): Promise<SubscriptionCustomerSnapshot> {
    const sdk = await getSdk();
    if (!sdk) {
      throw new Error('RevenueCat is not available on this platform');
    }

    const packageHandle = packageRegistry.get(subscriptionPackage.identifier) ?? subscriptionPackage;
    const purchaseResult = await sdk.Purchases.purchasePackage({ aPackage: packageHandle.nativePackage as any });
    return normalizeCustomerInfo(purchaseResult.customerInfo as Record<string, any>);
  }

  async function restorePurchases(): Promise<SubscriptionCustomerSnapshot> {
    const sdk = await getSdk();
    if (!sdk) {
      throw new Error('RevenueCat is not available on this platform');
    }

    const restoreResult = await sdk.Purchases.restorePurchases();
    return normalizeCustomerInfo(restoreResult.customerInfo as Record<string, any>);
  }

  async function openManageSubscriptions(productId?: string | null): Promise<void> {
    if (!isNativeAndroid()) return;

    const sku = productId || packageRegistry.values().next().value?.productId || '';
    const url = sku
      ? `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(sku)}&package=${encodeURIComponent(ANDROID_PACKAGE_NAME)}`
      : `https://play.google.com/store/account/subscriptions?package=${encodeURIComponent(ANDROID_PACKAGE_NAME)}`;

    await Browser.open({ url });
  }

  function isPurchaseCancelled(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    const candidate = error as { code?: string; message?: string; name?: string };
    const haystack = `${candidate.code || ''} ${candidate.message || ''} ${candidate.name || ''}`.toLowerCase();
    return haystack.includes('cancel');
  }

  return {
    isAvailable: () => isNativeAndroid() && SUBSCRIPTION_FEATURE_FLAG,
    configure,
    logOut,
    getOfferings,
    getCustomerInfo,
    purchasePackage,
    restorePurchases,
    openManageSubscriptions,
    isPurchaseCancelled,
  };
}

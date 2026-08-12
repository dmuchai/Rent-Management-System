import { App } from '@capacitor/app';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { trackEvent } from '@/lib/analytics';
import {
  createRevenueCatService,
  type RevenueCatService,
  type SubscriptionCustomerSnapshot,
  type SubscriptionOfferingSummary,
  type SubscriptionPackageSummary,
} from '@/lib/revenuecat';

interface SubscriptionContextValue {
  enabled: boolean;
  isLoading: boolean;
  isConfiguring: boolean;
  isPurchasing: boolean;
  isRestoring: boolean;
  account: SubscriptionAccountSnapshot | null;
  offerings: SubscriptionOfferingSummary | null;
  customerInfo: SubscriptionCustomerSnapshot | null;
  error: string | null;
  purchasePackage: (subscriptionPackage: SubscriptionPackageSummary) => Promise<void>;
  restorePurchases: () => Promise<void>;
  manageSubscription: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

export interface SubscriptionAccountSnapshot {
  enabled: boolean;
  billingAccount: {
    id: string;
    ownerUserId: string;
    revenuecatAppUserId: string;
    planCode: string;
    subscriptionStatus: string;
    productId: string | null;
    basePlanId: string | null;
    store: string;
    trialEndsAt: string | null;
    currentPeriodEndsAt: string | null;
    gracePeriodEndsAt: string | null;
    transitionEndsAt: string | null;
    willRenew: boolean;
    lastEventAt: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  plan: {
    code: string;
    displayName: string;
    maxActiveProperties: number | null;
    maxActiveUnits: number | null;
    maxManagementUsers: number | null;
    enabledFeatures: string[];
    googlePlayProductId: string | null;
    upgradeOrder: number;
  };
  access: {
    premium: boolean;
    subscriptionStatus: string;
    planCode: string;
    storedPlanCode: string;
    transitionActive: boolean;
    transitionEndsAt: string | null;
  };
  usage: {
    activeProperties: number;
    activeUnits: number;
    managementUsers: number;
  };
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

function useSubscriptionApiSnapshot(enabled: boolean) {
  return useQuery<SubscriptionAccountSnapshot>({
    queryKey: ['/api/subscription'],
    enabled,
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/subscription');
      if (!response.ok) {
        throw new Error(`Failed to load subscription state: ${response.status}`);
      }
      return await response.json();
    },
    retry: false,
  });
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const serviceRef = useRef<RevenueCatService>(createRevenueCatService());
  const configuredUserIdRef = useRef<string | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<SubscriptionCustomerSnapshot | null>(null);
  const [offerings, setOfferings] = useState<SubscriptionOfferingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isBillingOwner = user?.role === 'landlord' || user?.role === 'property_manager';
  const nativePurchasesAvailable = serviceRef.current.isAvailable() && isBillingOwner;
  const { data: account, isLoading } = useSubscriptionApiSnapshot(Boolean(user?.id && isBillingOwner));
  const enabled = Boolean(account?.enabled);

  const refreshSubscription = async () => {
    if (!nativePurchasesAvailable || !user?.id) {
      return;
    }

    try {
      const [nextCustomerInfo, nextOfferings, nextAccount] = await Promise.all([
        serviceRef.current.getCustomerInfo().catch(() => null),
        serviceRef.current.getOfferings().catch(() => null),
        queryClient.fetchQuery({
          queryKey: ['/api/subscription'],
          queryFn: async () => {
            const response = await apiRequest('GET', '/api/subscription');
            if (!response.ok) {
              throw new Error(`Failed to load subscription state: ${response.status}`);
            }
            return await response.json();
          },
        }),
      ]);

      setCustomerInfo(nextCustomerInfo);
      setOfferings(nextOfferings);
      setError(null);
      queryClient.setQueryData(['/api/subscription'], nextAccount);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Failed to refresh subscription state');
    }
  };

  useEffect(() => {
    let isActive = true;

    const syncRevenueCat = async () => {
      if (!nativePurchasesAvailable) {
        configuredUserIdRef.current = null;
        setCustomerInfo(null);
        setOfferings(null);
        return;
      }

      if (!user?.id) {
        if (configuredUserIdRef.current) {
          await serviceRef.current.logOut().catch(() => undefined);
          configuredUserIdRef.current = null;
        }
        setCustomerInfo(null);
        setOfferings(null);
        return;
      }

      if (configuredUserIdRef.current !== user.id) {
        setIsConfiguring(true);
        try {
          await serviceRef.current.configure(user.id);
          configuredUserIdRef.current = user.id;
        } catch (configurationError) {
          setError(configurationError instanceof Error ? configurationError.message : 'Failed to configure RevenueCat');
        } finally {
          if (isActive) {
            setIsConfiguring(false);
          }
        }
      }

      await refreshSubscription();
    };

    syncRevenueCat().catch((syncError) => {
      if (isActive) {
        setError(syncError instanceof Error ? syncError.message : 'Failed to sync subscription state');
      }
    });

    return () => {
      isActive = false;
    };
  }, [nativePurchasesAvailable, user?.id]);

  useEffect(() => {
    if (!nativePurchasesAvailable) {
      return;
    }

    const subscription = App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        await refreshSubscription();
      }
    });

    return () => {
      void subscription.then((listener) => listener.remove());
    };
  }, [nativePurchasesAvailable]);

  const purchasePackage = async (subscriptionPackage: SubscriptionPackageSummary) => {
    setIsPurchasing(true);
    setError(null);
    trackEvent('purchase_started', {
      plan: subscriptionPackage.planCode,
      productId: subscriptionPackage.productId,
      billingPeriod: subscriptionPackage.billingPeriod,
    });

    try {
      const nextCustomerInfo = await serviceRef.current.purchasePackage(subscriptionPackage);
      setCustomerInfo(nextCustomerInfo);
      trackEvent('purchase_completed', {
        plan: subscriptionPackage.planCode,
        productId: subscriptionPackage.productId,
      });
      if (nextCustomerInfo.subscriptionStatus === 'trialing') {
        trackEvent('trial_started', {
          plan: subscriptionPackage.planCode,
          productId: subscriptionPackage.productId,
          source: window.sessionStorage.getItem('landee_trial_source') || 'subscription_page',
        });
      }
      await refreshSubscription();
    } catch (purchaseError) {
      if (serviceRef.current.isPurchaseCancelled(purchaseError)) {
        trackEvent('purchase_cancelled', {
          plan: subscriptionPackage.planCode,
          productId: subscriptionPackage.productId,
        });
        return;
      }

      trackEvent('purchase_failed', {
        plan: subscriptionPackage.planCode,
        productId: subscriptionPackage.productId,
      });
      setError(purchaseError instanceof Error ? purchaseError.message : 'Purchase failed');
      throw purchaseError;
    } finally {
      setIsPurchasing(false);
    }
  };

  const restorePurchases = async () => {
    setIsRestoring(true);
    setError(null);
    trackEvent('restore_started');

    try {
      const nextCustomerInfo = await serviceRef.current.restorePurchases();
      setCustomerInfo(nextCustomerInfo);
      trackEvent('restore_completed');
      await refreshSubscription();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Failed to restore purchases');
      throw restoreError;
    } finally {
      setIsRestoring(false);
    }
  };

  const manageSubscription = async () => {
    trackEvent('manage_subscription_opened');
    await serviceRef.current.openManageSubscriptions(account?.billingAccount?.productId || customerInfo?.activeProductId || null);
  };

  const value = useMemo<SubscriptionContextValue>(() => ({
    enabled,
    isLoading,
    isConfiguring,
    isPurchasing,
    isRestoring,
    account: account ?? null,
    offerings,
    customerInfo,
    error,
    purchasePackage,
    restorePurchases,
    manageSubscription,
    refreshSubscription,
  }), [account, customerInfo, enabled, error, isConfiguring, isLoading, isPurchasing, isRestoring, offerings]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const value = useContext(SubscriptionContext);

  if (!value) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }

  return value;
}

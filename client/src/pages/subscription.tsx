import { useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import { trackEvent } from '@/lib/analytics';
import { getPlanConfig, type PlanCode } from '../../../shared/subscription/index.js';
import type { SubscriptionPackageSummary } from '@/lib/revenuecat';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatMoney(priceString: string): string {
  return priceString || 'Price unavailable';
}

function parsePriceValue(priceString: string): number | null {
  const numeric = Number(priceString.replace(/[^0-9.,]/g, '').replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : null;
}

function getPlanCycleLabel(billingPeriod: 'monthly' | 'annual' | 'unknown'): string {
  if (billingPeriod === 'monthly') return 'Monthly';
  if (billingPeriod === 'annual') return 'Annual';
  return 'Billing period';
}

export function SubscriptionContent({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { enabled, isLoading, isPurchasing, isRestoring, account, offerings, purchasePackage, restorePurchases, manageSubscription, refreshSubscription, error } = useSubscription();

  useEffect(() => {
    trackEvent('subscription_page_viewed', { embedded });
  }, [embedded]);

  useEffect(() => {
    if (account?.access.planCode === 'free') {
      trackEvent('trial_offer_viewed', {
        plan: 'silver',
        source: window.sessionStorage.getItem('landee_trial_source') || 'subscription_page',
      });
    }
  }, [account?.access.planCode, account?.access.subscriptionStatus]);

  const currentPlanCode = (account?.access.planCode || 'free') as PlanCode;
  const currentPlanConfig = getPlanConfig(currentPlanCode);
  const trialDaysRemaining = useMemo(() => {
    if (account?.access.subscriptionStatus !== 'trialing' || !account.billingAccount?.trialEndsAt) return null;
    return Math.max(0, Math.ceil((Date.parse(account.billingAccount.trialEndsAt) - Date.now()) / 86_400_000));
  }, [account?.access.subscriptionStatus, account?.billingAccount?.trialEndsAt]);

  useEffect(() => {
    if (trialDaysRemaining !== null && [7, 3, 1].includes(trialDaysRemaining)) {
      trackEvent('trial_reminder_viewed', { daysRemaining: trialDaysRemaining, plan: 'silver' });
    }
  }, [trialDaysRemaining]);

  const packagesByPlan = useMemo(() => {
    const map = new Map<PlanCode, SubscriptionPackageSummary[]>();

    for (const subscriptionPackage of offerings?.packages || []) {
      const existing = map.get(subscriptionPackage.planCode as PlanCode) || [];
      map.set(subscriptionPackage.planCode as PlanCode, [...existing, subscriptionPackage]);
    }

    return map;
  }, [offerings]);

  const plansToDisplay = (['bronze', 'silver', 'gold'] as PlanCode[])
    .map((planCode) => {
      const planConfig = getPlanConfig(planCode);
      const planPackages = packagesByPlan.get(planCode) || [];
      const monthly = planPackages.find((planPackage) => planPackage.billingPeriod === 'monthly');
      const annual = planPackages.find((planPackage) => planPackage.billingPeriod === 'annual');

      return {
        planCode,
        planConfig,
        monthly,
        annual,
        packages: planPackages,
      };
    })
    .filter((entry) => entry.packages.length > 0);

  const handlePurchase = async (subscriptionPackage: SubscriptionPackageSummary) => {
    try {
      await purchasePackage(subscriptionPackage);
      toast({
        title: 'Purchase complete',
        description: `${getPlanConfig(subscriptionPackage.planCode).displayName} is now active.`,
      });
      await refreshSubscription();
    } catch (purchaseError) {
      if (String((purchaseError as Error)?.message || '').toLowerCase().includes('cancel')) {
        toast({
          title: 'Purchase cancelled',
          description: 'No subscription changes were made.',
        });
        return;
      }

      toast({
        title: 'Purchase failed',
        description: purchaseError instanceof Error ? purchaseError.message : 'Store billing is temporarily unavailable.',
        variant: 'destructive',
      });
    }
  };

  const handleRestore = async () => {
    try {
      await restorePurchases();
      toast({
        title: 'Purchases restored',
        description: 'Your active entitlement has been refreshed.',
      });
      await refreshSubscription();
    } catch (restoreError) {
      toast({
        title: 'Restore failed',
        description: restoreError instanceof Error ? restoreError.message : 'We could not restore your purchases right now.',
        variant: 'destructive',
      });
    }
  };

  const handleManageSubscription = async () => {
    try {
      await manageSubscription();
    } catch (manageError) {
      toast({
        title: 'Could not open subscription settings',
        description: manageError instanceof Error ? manageError.message : 'Try again from Google Play.',
        variant: 'destructive',
      });
    }
  };

  const handleDataExport = async () => {
    try {
      const response = await apiRequest('GET', '/api/export');
      if (!response.ok) throw new Error(`Export failed: ${response.status}`);
      const data = await response.json();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `landee-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      trackEvent('premium_feature_used', { feature: 'data_export', plan: currentPlanCode });
    } catch (exportError) {
      toast({ title: 'Export failed', description: exportError instanceof Error ? exportError.message : 'Please try again.', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscriptions are not enabled yet</CardTitle>
          <CardDescription>
            The RevenueCat feature flag or native Android setup is still disabled.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const annualNote = plansToDisplay.some((entry) => entry.monthly && entry.annual);

  return (
    <div className={embedded ? 'space-y-6' : 'mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8'}>
      {!embedded && (
        <div className="flex flex-col gap-4 rounded-3xl border bg-card p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Subscription</p>
            <h1 className="mt-2 text-3xl font-semibold">Choose the plan for this portfolio</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Prices come directly from Google Play. The optional 30-day Silver trial renews automatically unless cancelled before the renewal date.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleRestore} disabled={isRestoring}>
              {isRestoring ? 'Restoring...' : 'Restore purchases'}
            </Button>
            <Button variant="secondary" onClick={handleManageSubscription}>
              Manage subscription
            </Button>
          </div>
        </div>
      )}

      {account?.access.transitionActive && (
        <Card className="border-sky-200 bg-sky-50/70">
          <CardHeader>
            <CardTitle>Existing-customer transition access</CardTitle>
            <CardDescription>
              Your current features remain available through {formatDate(account.access.transitionEndsAt)}. Your data will remain readable afterward; choose a plan before then to avoid new-resource limits.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {trialDaysRemaining !== null && trialDaysRemaining <= 7 && (
        <Card className="border-amber-200 bg-amber-50/70">
          <CardHeader>
            <CardTitle>{trialDaysRemaining} day{trialDaysRemaining === 1 ? '' : 's'} left in your Silver trial</CardTitle>
            <CardDescription>
              Review the localized renewal price below. The subscription renews automatically unless cancelled in Google Play before the renewal date.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {account?.access.subscriptionStatus === 'grace_period' && (
        <Card className="border-amber-300 bg-amber-50/80">
          <CardHeader><CardTitle>Payment issue—access is in grace period</CardTitle><CardDescription>Update your payment method in Google Play before {formatDate(account.billingAccount?.gracePeriodEndsAt)} to keep premium access.</CardDescription></CardHeader>
        </Card>
      )}

      {account?.access.subscriptionStatus === 'billing_retry' && (
        <Card className="border-red-300 bg-red-50/80">
          <CardHeader><CardTitle>Premium access is temporarily suspended</CardTitle><CardDescription>Google Play could not complete renewal and the grace period has ended. Your records remain safe and readable; update billing to restore access automatically.</CardDescription></CardHeader>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span>Current plan</span>
              <Badge variant={account?.access.premium ? 'default' : 'secondary'} className="capitalize">
                {account?.access.transitionActive ? 'Transition access' : currentPlanConfig.displayName}
              </Badge>
            </CardTitle>
            <CardDescription>
              Status: <span className="capitalize text-foreground">{account?.access.subscriptionStatus || 'free'}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Properties</p>
              <p className="mt-1 text-2xl font-semibold">{account?.usage.activeProperties ?? 0}</p>
              <p className="text-xs text-muted-foreground">
                Limit: {account?.plan.maxActiveProperties ?? 'Unlimited'}
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Units</p>
              <p className="mt-1 text-2xl font-semibold">{account?.usage.activeUnits ?? 0}</p>
              <p className="text-xs text-muted-foreground">
                Limit: {account?.plan.maxActiveUnits ?? 'Unlimited'}
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Management users</p>
              <p className="mt-1 text-2xl font-semibold">{account?.usage.managementUsers ?? 1}</p>
              <p className="text-xs text-muted-foreground">
                Limit: {account?.plan.maxManagementUsers ?? 'Unlimited'}
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Renewal / trial</p>
              <p className="mt-1 text-lg font-semibold">
                {formatDate(account?.billingAccount?.trialEndsAt || account?.billingAccount?.currentPeriodEndsAt)}
              </p>
              <p className="text-xs text-muted-foreground">
                {account?.billingAccount?.willRenew ? 'Auto-renews unless cancelled' : 'Renewal paused or pending'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan details</CardTitle>
            <CardDescription>
              Billing is tied to the owner user who controls this portfolio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Billing account</span>
              <span className="font-medium">{account?.billingAccount?.revenuecatAppUserId || 'Not connected'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Next renewal</span>
              <span className="font-medium">{formatDate(account?.billingAccount?.currentPeriodEndsAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Grace period</span>
              <span className="font-medium">{formatDate(account?.billingAccount?.gracePeriodEndsAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Current product</span>
              <span className="font-medium">{account?.billingAccount?.productId || 'Free'}</span>
            </div>
            {error && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-destructive">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {annualNote && (
        <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Annual packages typically save money versus paying monthly across 12 months.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plansToDisplay.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardHeader>
              <CardTitle>No packages loaded</CardTitle>
              <CardDescription>
                We could not load the default RevenueCat offering from Google Play.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : plansToDisplay.map(({ planCode, planConfig, monthly, annual }) => {
          const monthlyPrice = monthly ? parsePriceValue(monthly.priceString) : null;
          const annualPrice = annual ? parsePriceValue(annual.priceString) : null;
          const annualSavings = monthlyPrice && annualPrice
            ? Math.max(0, Math.round(((monthlyPrice * 12 - annualPrice) / (monthlyPrice * 12)) * 100))
            : null;
          const hasCurrentPlan = currentPlanCode === planCode;
          const planIsLower = getPlanConfig(currentPlanCode).upgradeOrder > planConfig.upgradeOrder;

          return (
            <Card key={planCode} className={hasCurrentPlan ? 'border-primary/60 shadow-md' : undefined}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>{planConfig.displayName}</span>
                  {hasCurrentPlan && <Badge>Current</Badge>}
                </CardTitle>
                <CardDescription>
                  {planConfig.maxActiveUnits ?? 'Unlimited'} units and {planConfig.maxManagementUsers ?? 'Unlimited'} management users.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {monthly && (
                  <div className="rounded-2xl border bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{getPlanCycleLabel(monthly.billingPeriod)}</p>
                        <p className="text-xs text-muted-foreground">{formatMoney(monthly.priceString)}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => void handlePurchase(monthly)}
                        disabled={isPurchasing || (hasCurrentPlan && !planIsLower)}
                      >
                        {hasCurrentPlan && !planIsLower ? 'Active' : planCode === 'silver' ? 'Start trial / choose' : 'Choose'}
                      </Button>
                    </div>
                    {planCode === 'silver' && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        30-day Silver trial available where eligible. After the trial, it renews at {formatMoney(monthly.priceString)} per month around {new Date(Date.now() + 30 * 86_400_000).toLocaleDateString()} unless cancelled. Google Play confirms the exact charge date before purchase.
                      </p>
                    )}
                  </div>
                )}

                {annual && (
                  <div className="rounded-2xl border bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{getPlanCycleLabel(annual.billingPeriod)}</p>
                        <p className="text-xs text-muted-foreground">{formatMoney(annual.priceString)}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handlePurchase(annual)}
                        disabled={isPurchasing || (hasCurrentPlan && !planIsLower)}
                      >
                        {hasCurrentPlan && !planIsLower ? 'Active' : 'Choose'}
                      </Button>
                    </div>
                    {annualSavings !== null && (
                      <p className="mt-3 text-xs text-emerald-600">Save about {annualSavings}% compared to monthly billing.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span>{getPlanConfig('enterprise').displayName}</span>
              <Badge variant="secondary">Custom</Badge>
            </CardTitle>
            <CardDescription>For portfolios above 100 active units, onboarding, migration, and custom integrations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Custom pricing, support SLAs, and branded reporting.</p>
            <Button variant="outline" onClick={() => window.location.href = 'mailto:sales@landee.app'}>Contact sales</Button>
          </CardContent>
        </Card>
      </div>

      {!embedded && (
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => void handleDataExport()}>Export my data</Button>
          <Button variant="outline" onClick={handleRestore} disabled={isRestoring}>
            {isRestoring ? 'Restoring...' : 'Restore purchases'}
          </Button>
          <Button variant="secondary" onClick={handleManageSubscription}>
            Manage subscription
          </Button>
          <Button variant="ghost" onClick={() => setLocation('/dashboard')}>
            Back to dashboard
          </Button>
        </div>
      )}
    </div>
  );
}

export default function SubscriptionPage() {
  return <SubscriptionContent />;
}

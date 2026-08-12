export type AnalyticsEventName =
  | 'subscription_page_viewed'
  | 'trial_offer_viewed'
  | 'trial_started'
  | 'purchase_started'
  | 'purchase_completed'
  | 'purchase_cancelled'
  | 'purchase_failed'
  | 'restore_started'
  | 'restore_completed'
  | 'plan_limit_reached'
  | 'upgrade_prompt_viewed'
  | 'manage_subscription_opened'
  | 'premium_feature_used'
  | 'trial_reminder_viewed'
  | 'subscription_status_viewed';

export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

function isAnalyticsEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_ANALYTICS !== 'false';
}

export function trackEvent(name: AnalyticsEventName, properties: AnalyticsProperties = {}): void {
  if (!isAnalyticsEnabled()) {
    return;
  }

  if (import.meta.env.MODE !== 'production') {
    console.log('[Analytics]', name, properties);
  }

  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;

  if (typeof gtag === 'function') {
    gtag('event', name, properties);
  }
}

# RevenueCat Subscription Setup

Landee uses Google Play Billing through RevenueCat for Android subscriptions. Complete the sections below in order. Migrations `009`, `010`, and `011` must be applied before subscriptions are enabled.

## 1. Google Play products and KES prices

The Android package name is:

```text
com.rentmanagement.app
```

Upload an Android App Bundle to at least an internal or closed testing track before creating the subscription products. In Google Play Console, open **Monetize with Play > Products > Subscriptions** and create these products:

| Plan | Subscription product ID | Base plan ID | Billing period | Kenya price |
| --- | --- | --- | --- | ---: |
| Bronze | `landee_bronze` | `monthly-autorenewing` | Monthly, auto-renewing | KES 2,000 |
| Silver | `landee_silver` | `monthly-autorenewing` | Monthly, auto-renewing | KES 4,000 |
| Gold | `landee_gold` | `monthly-autorenewing` | Monthly, auto-renewing | KES 6,000 |

Set Kenya availability and the exact KES price on every base plan. Review Google Play's converted prices for any additional countries. Activate all three base plans.

Configure Google Play's grace period and account hold for the auto-renewing base plans. The application recognizes RevenueCat's `grace_period`, `billing_retry`, `paused`, `expired`, and `cancelled` lifecycle states.

### Silver 30-day trial

On the Silver `monthly-autorenewing` base plan, create and activate an offer with:

```text
Offer ID: silver-30d-trial
Phase: Free
Duration: 30 days
Eligibility: Never had any subscription in this app
```

Use Google Play's new-customer eligibility rather than developer-determined eligibility. The app does not start a trial at signup; the eligible customer chooses the Silver package and Google Play applies the trial during checkout.

## 2. RevenueCat project and products

1. Create a RevenueCat project and add a Google Play app with package name `com.rentmanagement.app`.
2. In Google Play Console, create a service account for RevenueCat, grant it the required app-information, financial-data, and subscription/order permissions, and upload its JSON credentials to the RevenueCat app configuration. New credentials can take time to become active.
3. Import the three activated Google Play subscriptions into RevenueCat. With Google Play Billing's base-plan model, RevenueCat may display identifiers such as `landee_silver:monthly-autorenewing`; the Landee plan mapper supports both the plain and colon-qualified forms.
4. Create one entitlement named `landee_access` and attach all three products to it. Landee derives the tier from the purchased product ID.
5. Create an offering named `default`, make it the current offering, and add three **custom** packages:

| RevenueCat package ID | Product |
| --- | --- |
| `bronze_monthly` | Bronze monthly base plan |
| `silver_monthly` | Silver monthly base plan, including the trial offer |
| `gold_monthly` | Gold monthly base plan |

Custom package IDs are required because a single offering cannot contain three packages that all use the same predefined `$rc_monthly` identifier.

Copy the public Google/Android SDK key from RevenueCat project settings. It normally starts with `goog_`. This is a public client key; do not use a RevenueCat secret API key in the app.

## 3. Webhook authorization

Generate a dedicated random secret locally:

```bash
openssl rand -hex 32
```

Store the generated value in the backend deployment as `REVENUECAT_WEBHOOK_SECRET`. Do not commit it and do not prefix this environment-variable value with `Bearer`.

In RevenueCat, open **Project settings > Integrations > Webhooks** and add:

```text
URL: https://landee.kejalink.co.ke/api/webhooks/revenuecat
Authorization header: Bearer <the same generated secret>
App filter: com.rentmanagement.app
Environment: Production and Sandbox during closed testing
```

If the API is deployed on a different canonical domain, use that domain instead. The endpoint accepts either the exact secret or `Bearer <secret>` in the `Authorization` header. It does not use RevenueCat's optional HMAC signature feature.

Use only Google Play license-test accounts for sandbox purchases against the production webhook. After closed testing, choose whether to keep sandbox events enabled based on the operational testing policy.

## 4. Transition dates from migration 011

Migration `011` provisioned existing billing owners and assigned their transition deadline. Inspect the actual deadline it wrote instead of copying an old example date:

```sql
select
  min(transition_ends_at) as earliest_transition_end,
  max(transition_ends_at) as latest_transition_end,
  count(*) filter (where transition_ends_at is not null) as transitioning_accounts
from public.billing_accounts;
```

Set `SUBSCRIPTION_TRANSITION_END_AT` to that production deadline. Set `SUBSCRIPTION_EXISTING_USER_CUTOFF` to the subscription launch instant, in UTC, that separates existing accounts from new accounts. The cutoff must precede the transition deadline and the intended window is 30 days.

Example format only:

```bash
SUBSCRIPTION_EXISTING_USER_CUTOFF=2026-08-09T12:00:00Z
SUBSCRIPTION_TRANSITION_END_AT=2026-09-08T12:00:00Z
```

Do not use those example timestamps unless they match the production rollout decision. Existing rows already provisioned by migration `011` keep their database deadline; these variables control fallback provisioning for an existing owner whose billing row is created on demand.

## 5. Deployment environment variables

Required backend variables:

```bash
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
REVENUECAT_WEBHOOK_SECRET=...
ENABLE_SUBSCRIPTIONS=true
SUBSCRIPTION_EXISTING_USER_CUTOFF=...
SUBSCRIPTION_TRANSITION_END_AT=...
```

Required client/build variables:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_ENABLE_SUBSCRIPTIONS=true
VITE_REVENUECAT_ANDROID_PUBLIC_SDK_KEY=goog_...
```

Optional client variable:

```bash
VITE_ENABLE_ANALYTICS=true
```

`VITE_*` values are embedded at build time. Add them to the environment that runs the Android/Vite build and rebuild the Android application after changing them. Never expose `REVENUECAT_WEBHOOK_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` through a `VITE_*` variable.

## 6. Feature-flag rollout

1. Configure and activate the Google Play products, base plans, and Silver offer.
2. Configure RevenueCat credentials, products, entitlement, current offering, packages, SDK key, and webhook.
3. Add the backend and client variables to the production deployment and Android build environment.
4. Build a new signed Android App Bundle and publish it to a closed testing track.
5. Set both `ENABLE_SUBSCRIPTIONS=true` and `VITE_ENABLE_SUBSCRIPTIONS=true`, then redeploy/rebuild. The backend flag enables enforcement and webhook processing; the Vite flag exposes the native subscription UI.
6. Complete the sandbox verification below before promoting the Android release.

Build the signed App Bundle with:

```bash
VITE_REVENUECAT_ANDROID_PUBLIC_SDK_KEY=goog_... npm run aab:build
```

The release script enables subscriptions, rejects missing or non-Google public
SDK keys, syncs the RevenueCat native Capacitor plugin, and prints the AAB's
SHA-256 checksum. The current Android release is `1.1.19` (version code `33`).

## 7. What is gated

- Free plan: 1 active property, 4 active units, 1 management user
- Bronze plan: up to 20 active units and 2 management users
- Silver plan: up to 50 active units and 5 management users, plus advanced reports
- Gold plan: up to 100 active units and 15 management users, plus owner reporting and priority support
- Management-user limits apply when creating caretaker invitations
- Premium reports require the `advanced_reports` feature, which is enabled on Silver, Gold, and Enterprise plans
- Soft-deleting a unit archives it instead of removing it, so users can recover from downgrades
- Archived units and properties do not consume limits; all historical records remain readable
- Expired, cancelled, held, and paused subscriptions use Free limits regardless of their last purchased product
- Payment reconciliation endpoints and workers require Silver or higher

## 8. Verify the flow

1. Add a Google Play license tester and install the closed-track build from Google Play. Sideloaded builds do not provide a reliable end-to-end billing test.
2. Sign in as a real landlord so the RevenueCat app user ID matches a row in `public.users`.
3. Open the subscription page and confirm Bronze, Silver, and Gold show the expected localized KES prices.
4. Purchase Silver with an eligible test account and confirm Google Play shows the free trial before accepting payment.
5. Confirm the RevenueCat customer has active `landee_access` and the webhook delivery returns a successful HTTP status.
6. Check `public.billing_accounts` for the expected `plan_code`, `subscription_status`, product ID, and period dates, and check `public.subscription_events` for the event.
7. Restore purchases and confirm access remains synchronized.
8. Verify property, unit, caretaker, reconciliation, and report gates at the relevant plan limits.
9. Test cancellation and renewal/recovery behavior using Google Play's accelerated license-test timeline.

## 9. Troubleshooting

- If the subscription UI does not appear, confirm `VITE_ENABLE_SUBSCRIPTIONS=true`, confirm `VITE_REVENUECAT_ANDROID_PUBLIC_SDK_KEY` was present when the Android assets were built, and confirm the app is running natively on Android.
- If no products appear, confirm all Google Play base plans are active, the products are imported into the current RevenueCat offering, and the installed build came from a Google Play testing track.
- If plan changes do not sync, confirm `ENABLE_SUBSCRIPTIONS=true`, verify the RevenueCat webhook URL, and confirm its authorization value matches `REVENUECAT_WEBHOOK_SECRET`.
- A `401` webhook response means the authorization secret does not match. A `404` can mean RevenueCat's app user ID does not match a user in `public.users`. A `503` means the backend feature flag is off.
- If report access is blocked unexpectedly, inspect the owner's row in `public.billing_accounts` and the recent rows in `public.subscription_events`.

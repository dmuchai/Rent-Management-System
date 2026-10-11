# Paid-first Starter rollout

Starter: KES 1,000/month, up to 10 active units, 30-day trial for eligible first-time subscribers. Bronze: KES 2,000/20 units; Silver: KES 4,000/50; Gold: KES 6,000/100; Enterprise: custom. All active plans include all standard features, unlimited properties and management users. SMS and payment-provider usage charges remain separate.

## Billing identifiers

- Google Play app: `com.rentmanagement.app`.
- New product: `landee_starter_v2` (do not reuse historical `landee_starter`, which maps to Bronze).
- Monthly base plan: `monthly-autorenewing`.
- Trial offer: `trial-30-days`, new customer acquisition, never had any subscription, free phase of 30 days.
- RevenueCat project: `e9181d6c`, entitlement `landee_access`, current offering `default`, package `starter_monthly` -> `landee_starter_v2:monthly-autorenewing`.
- Preserve all existing paid products and subscriber prices.

## Release sequence

1. Verify the active Starter base plan charges exactly KES 1,000 in Kenya and the active offer has a free 30-day phase. Verify the product is attached to `landee_access` and included in `default`. Verify Play real-time developer notifications are connected to RevenueCat before relying on deferred downgrades.
2. Fetch this change branch into the existing Linux Android build checkout without overwriting local signing files or unrelated work. Use the existing production environment and signing configuration. Increment Android versionCode above the highest uploaded version and versionName accordingly. Build and sign the Android App Bundle using the existing release key; never create a replacement key or commit credentials.
3. Test through Play internal testing: eligible new account sees Starter first; purchase confirmation says 30 days free then KES 1,000/month; cancellation is not reported as a completed purchase; restore works; a deferred downgrade retains its current capacity until renewal. Test accounts must be designated test accounts, not real customer subscriptions.
4. Do not activate paid-first server restrictions while the distributed Android version cannot display Starter. Complete the app release, then run `db/migrations/012_paid_first_starter.sql` on the intended production Supabase project immediately before the website/API release. The migration snapshots existing `auth.users` and `public.users` once and protects eligibility against profile updates. Its first execution defines the existing-account cohort; rerunning must not expand it.
5. Deploy the tested change to Vercel project `rent-management-system` (`prj_iOFaCSouh90g0jpHQJHA5jKX0J3K`, team `team_VubFEBaxh4u680MODtpfqZYO`), serving `landee.kejalink.co.ke`. Existing `ENABLE_SUBSCRIPTIONS` and `VITE_ENABLE_SUBSCRIPTIONS` must remain enabled. Do not change secrets. Keep any existing transition-end settings unless their planned transition has ended.
6. Verify production: an existing account without a billing row retains Free/4; a new registration without a trial/purchase gets read-only access; active Starter gets 10; adding unit 11 requires Bronze; expiry is enforced even if a webhook is delayed; account hold suspends access; grace remains valid until its end. Confirm profile edits cannot alter `legacy_free_eligible`.

## Downgrade recovery

Cancellation only stops renewal. Current access continues to its entitlement expiry. Product-change announcements do not prematurely change the plan; activation comes from INITIAL_PURCHASE/RENEWAL. Downgrades request the provider's DEFERRED replacement; upgrades request CHARGE_PRORATED_PRICE.

After access ends, existing cohort accounts fall back to Free/4. Other accounts get zero active management capacity, while reads/export and tenant self-service remain available. If active units exceed the current allowance, portfolio mutations and recurring billing/reminders pause until the owner archives enough units or upgrades. Archiving is allowed during read-only recovery, preserves leases/history, and stops future automated invoicing for archived units. No units are automatically deleted or selected on the owner's behalf. Incoming bank callbacks continue to retain payment evidence. Restore requires paid/legacy capacity.

Rollback: retain the cohort table and protected eligibility flag. If reverting code, preserve records and investigate paid purchase events before disabling access. Never delete billing/event history or overwrite current paid plans as part of recovery.

## Validation

Run `npm run check`, `npx tsx --test tests/subscription/*.test.ts tests/account-deletion/*.test.ts`, and `npm run build:frontend`. Windows verification passed type checking, the frontend production build, and 22 subscription/account-deletion tests. Android store/device purchase verification and the production migration still require the Linux release environment.

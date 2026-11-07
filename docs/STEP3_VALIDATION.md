# Step 3 validation — 7 November 2026

## Current release

- Branch: `codex/staging-step3-fixes`
- Current commit: `e835783` (`Record authenticated caretaker UI checks`)
- Staging project: `landee-staging` (`prj_LqYUx67llEO5sE2nVrBUsLjynH75`)
- Staging URL: https://landee-staging.vercel.app
- Staging Supabase project: `mcclctunrpyhumubpeyo`
- Live Supabase project remains excluded from mutations: `emdahodfztpfdjkrbnqz`
- Validation date: 7 November 2026 (EAT)

The three previously reported defects are present in `df9c16e`: unit-scoped caretaker access is narrowed to the assigned unit, manager aggregates use the authorised context owner, and STK callback persistence/replay accepts only one legacy JSON-string layer while preserving strict validation.

This release also fixes invoice and SMS reminder metadata. The writer now passes an object through `sql.json(...)`; it does not stringify JSONB values. No historical records are rewritten.

The staging fixture bootstrap is implemented in [STAGING_VALIDATION_BOOTSTRAP.md](./STAGING_VALIDATION_BOOTSTRAP.md) and [bootstrap-staging-validation.ts](../scripts/bootstrap-staging-validation.ts). It is guarded to Supabase project `mcclctunrpyhumubpeyo`, requires explicit `STAGING_ALLOW_MUTATION=true`, and refuses production-looking configuration. It is type-checked and its missing-configuration refusal was verified locally.

On 6 November 2026 the bootstrap was executed successfully against the staging project using the operator-provided ignored `.env.test.local`. Seven synthetic Auth users, matching profiles, portfolios, memberships, caretaker assignments, leases, and the controlled invoice were created or updated under the `step3-` fixture prefix. Direct unauthenticated HTTP probes returned `401` from Vercel Deployment Protection before reaching Landee Auth; this is not evidence of invalid staging credentials. Complete hosted checks require an authenticated Vercel SSO browser session followed by the normal Landee login.

The authenticated staging browser subsequently passed genuine hosted UI checks for the seeded identities. Landlord A displayed the Step 3 portfolio, one overdue invoice, 50% occupancy (1/2 units), and the active Step 3 Tenant A lease; its Properties, Tenants, and Leases views showed only the authorised portfolio. Landlord B displayed only Property B/Unit B1 and Tenant B. Manager A displayed the authorised Landlord A totals (1 property, 1 active tenant, 50% occupancy, and 1 overdue invoice), rather than the manager's own empty portfolio. Property Caretaker A displayed one assigned property and Tenant A; Unit Caretaker A displayed the assigned Tenant A/unit scope. Tenant A displayed only Property A/Unit A1 and Tenant B displayed only Property B/Unit B1. These are hosted staging observations, not local handler tests.

On 7 November, the shared browser was re-authenticated as Unit Caretaker A (`0700000307`). Its hosted dashboard showed one assigned tenant and one assigned property; the Properties view showed only Step 3 Property A with one tenant/lease, and the Tenants view contained only Step3 Tenant A. The tenant-creation dialog was opened and cancelled without submitting a write. This confirms hosted UI scoping, but not the required authenticated API list/create/update response assertions. The Subscription view for the landlord session displayed “Subscriptions are not enabled yet”; hosted legacy-Free versus noneligible enforcement therefore remains unverified.

## Evidence

### Completed locally

- `npm run check` — passed.
- Focused invoicing suite, including a disposable PostgreSQL assertion of `jsonb_typeof(metadata) = 'object'` and `metadata->>'leaseId'` — passed.
- `npm run test:financial-integrity` — passed.
- `npm run test:subscription` — passed.
- `npm run test:kcb` — passed.
- Existing branch release CI for `df9c16e` passed: https://github.com/dmuchai/Rent-Management-System/actions/runs/42032686496
- `git diff --check` — passed.

These are local tests using disposable PostgreSQL and controlled provider transports. They are not hosted browser tests and do not prove live Safaricom, email, SMS, RevenueCat, or Google Play delivery.

### Staging deployment

The current deployment is Vercel deployment `dpl_2MVNEXsVLgdi7FGY8TrgVhJoutoH`, Ready at `1087d9e`, with aliases `https://landee-staging.vercel.app` and `https://landee-staging-jvs031fng-dmmuchai-1174s-projects.vercel.app`. Its Vercel target is `production` within the isolated `landee-staging` project; it is not the live Landee project. The sign-in route returns the expected Vercel SSO protection response. The repository branch guard disables automatic Git deployment for `codex/staging-step3-fixes`; deployment was explicitly targeted to the isolated project.

The guarded staging bootstrap and authenticated browser session are available only when the operator shares an active Vercel SSO session. The hosted role smoke checks above passed after normal Landee login/logout. In this validation pass, all six synthetic identities authenticated successfully against isolated staging Supabase, but direct requests to `https://landee-staging.vercel.app/api/*` were intercepted by Vercel Deployment Protection before reaching Landee Auth; the opened browser likewise resolved to the Vercel login page. A staging-only invoicing run for November 2026 generated one invoice and an email reminder; a direct staging database query returned `jsonb_typeof(metadata) = 'object'` and `metadata->>'leaseId' = 'step3-lease-b'`. Repeating the same invoicing run generated zero additional invoices, providing staging idempotency evidence. The deployment listed above predates `d986eac`; no new deployment was made during this validation pass because deployment credentials were not present in the shell.

A guarded `npm run staging:validate-api` harness is now implemented in [validate-staging-api.ts](../scripts/validate-staging-api.ts). It accepts a session access token and optional Vercel SSO cookie through environment variables, performs read checks and an empty non-mutating unit-create role check, never logs credentials, and fails closed when the staging URL or token is missing. It is ready for one run per synthetic identity once the authenticated browser can provide both values.

## Matrix status

| Area | Status | Evidence or blocker |
|---|---|---|
| Unit-scoped caretaker list/create/update | Hosted UI scope passed; API mutation paths blocked | Re-authenticated Unit Caretaker A showed exactly one assigned property and Tenant A in hosted views; no create was submitted. Direct list/create/update and sibling-denial API assertions still need an authenticated request harness |
| Property-scoped caretaker portfolio | Local complete; hosted scope smoke passed | Property Caretaker A hosted dashboard showed only the assigned Property A and Tenant A |
| Manager dashboard totals | Local complete; hosted passed | Manager A hosted dashboard showed Landlord A's 1 property, 1 active tenant, 50% occupancy, and 1 overdue invoice |
| Callback verification, retry, duplicate idempotency | Local complete; hosted blocked | Provider was mocked locally; no live Daraja request |
| Invoice reminder metadata | Local and staging query complete | Staging invoice `b0bab968-52df-4020-bd21-1daa58457e02` produced an email queue row with `jsonb_typeof(metadata) = 'object'` and `metadata->>'leaseId' = 'step3-lease-b'`; historical rows were not rewritten |
| Partial/excess payments and reversals | Local complete | Disposable PostgreSQL financial-integrity tests |
| Cross-landlord isolation and tenant restrictions | Local complete; hosted identity smoke passed | Tenant A saw only Property A/Unit A1; Tenant B saw only Property B/Unit B1; forged request and mutation assertions remain blocked |
| Forged/revoked contexts | Local complete; hosted blocked | Local authorization tests; no staging token-revocation/request-forgery harness was executed |
| Queue concurrency and recovery | Local complete | Disposable PostgreSQL claim/lease tests |
| Invoice-generation idempotency and lease expiry | Staging database evidence complete; authenticated cron capture blocked | The November 2026 staging invoicing run generated one invoice, and the identical second run generated zero. Existing staging fixtures show `step3-expired-lease` as `expired/is_active=false` with `step3-expired-unit.is_occupied=false`, and `step3-active-lease` as `active/is_active=true` with its unit occupied. A fresh authenticated cron/API capture remains blocked by Vercel SSO. |
| Subscription enforcement | Local complete; hosted feature disabled | The hosted Subscription view reported subscriptions are not enabled; legacy Free versus noneligible write enforcement was not exercised |
| Full backup restoration | Blocked | Migration 015 was only a synthetic structural rehearsal; no verified complete production backup restoration |

## Rollout boundaries and next actions

- Do not mutate the live Supabase project, deploy the live Landee project, delete accounts, or alter the KES 15,000 historical mismatch without explicit approval.
- Preserve the existing automatic-deployment guard and verify the target project before each deployment.
- Run hosted checks with genuine staging Auth identities for landlord A/B, tenant A/B, manager A, property-scoped caretaker A, and unit-scoped caretaker A.
- Capture only isolated staging notification transports. Do not send real messages or payments.
- Before Step 4, obtain Daraja sandbox/approved credentials, designated test identities/devices, and decisions for callback evidence, reversals, and settlement. Prepare Google Play and RevenueCat test products plus a device for purchase, renewal, cancellation, expiry, and web entitlement-sync checks. None of these provider flows has passed yet.
- Per-landlord Safaricom onboarding and settlement remains a separate design phase; merchant configuration, settlement ownership, reconciliation evidence, and provider capabilities require explicit decisions. No speculative settlement behavior is implemented.

Step 3 is **not ready to close**. Hosted role/isolation UI checks, staging invoice metadata, invoice-generation idempotency, and representative lease-expiry state are evidenced, but authenticated API mutation/negative paths, callback recovery, subscription enforcement, fresh cron capture, and full backup restoration remain outstanding. The shared browser can authenticate the application, but its dedicated automation/evaluation channel is unstable and the application token was not available for a direct request harness; UI observations must not be promoted to API evidence.

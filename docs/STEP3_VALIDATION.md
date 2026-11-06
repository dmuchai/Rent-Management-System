# Step 3 validation — 5 November 2026

## Current release

- Branch: `codex/staging-step3-fixes`
- Current commit: `1087d9e4c2f0e7a1fd731311813da9f2b117762c`
- Staging project: `landee-staging` (`prj_LqYUx67llEO5sE2nVrBUsLjynH75`)
- Staging URL: https://landee-staging.vercel.app
- Staging Supabase project: `mcclctunrpyhumubpeyo`
- Live Supabase project remains excluded from mutations: `emdahodfztpfdjkrbnqz`
- Validation date: 5 November 2026 (EAT)

The three previously reported defects are present in `df9c16e`: unit-scoped caretaker access is narrowed to the assigned unit, manager aggregates use the authorised context owner, and STK callback persistence/replay accepts only one legacy JSON-string layer while preserving strict validation.

This release also fixes invoice and SMS reminder metadata. The writer now passes an object through `sql.json(...)`; it does not stringify JSONB values. No historical records are rewritten.

The staging fixture bootstrap is implemented in [STAGING_VALIDATION_BOOTSTRAP.md](./STAGING_VALIDATION_BOOTSTRAP.md) and [bootstrap-staging-validation.ts](../scripts/bootstrap-staging-validation.ts). It is guarded to Supabase project `mcclctunrpyhumubpeyo`, requires explicit `STAGING_ALLOW_MUTATION=true`, and refuses production-looking configuration. It is type-checked and its missing-configuration refusal was verified locally.

On 6 November 2026 the bootstrap was executed successfully against the staging project using the operator-provided ignored `.env.test.local`. Seven synthetic Auth users, matching profiles, portfolios, memberships, caretaker assignments, leases, and the controlled invoice were created or updated under the `step3-` fixture prefix. Direct unauthenticated HTTP probes returned `401` from Vercel Deployment Protection before reaching Landee Auth; this is not evidence of invalid staging credentials. Complete hosted checks require an authenticated Vercel SSO browser session followed by the normal Landee login.

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

This release still requires a post-deploy authenticated check of the new invoice metadata writer. The guarded staging bootstrap is complete; the hosted authenticated regression matrix is blocked at Vercel Deployment Protection until a Vercel SSO browser session is authenticated.

## Matrix status

| Area | Status | Evidence or blocker |
|---|---|---|
| Unit-scoped caretaker list/create/update | Local complete; hosted blocked | Local authenticated handler harness passed; hosted Auth session pending |
| Property-scoped caretaker portfolio | Local complete; hosted blocked | Local scope checks passed; hosted Auth session pending |
| Manager dashboard totals | Local complete; hosted blocked | Authorised-context regression passed locally |
| Callback verification, retry, duplicate idempotency | Local complete; hosted blocked | Provider was mocked locally; no live Daraja request |
| Invoice reminder metadata | Local complete; staging recheck pending | Disposable PostgreSQL proves object storage and `leaseId` queryability |
| Partial/excess payments and reversals | Local complete | Disposable PostgreSQL financial-integrity tests |
| Cross-landlord isolation and tenant restrictions | Local complete; hosted blocked | Local auth/handler evidence; no hosted identity run |
| Forged/revoked contexts | Local complete; hosted blocked | Local authorization tests; hosted identity lifecycle pending |
| Queue concurrency and recovery | Local complete | Disposable PostgreSQL claim/lease tests |
| Invoice-generation idempotency and lease expiry | Local/structural evidence | Hosted scheduler and representative staging data pending |
| Subscription enforcement | Local complete; hosted blocked | Subscription tests cover legacy Free allowance and noneligible plans; staging flags/accounts need hosted verification |
| Full backup restoration | Blocked | Migration 015 was only a synthetic structural rehearsal; no verified complete production backup restoration |

## Rollout boundaries and next actions

- Do not mutate the live Supabase project, deploy the live Landee project, delete accounts, or alter the KES 15,000 historical mismatch without explicit approval.
- Preserve the existing automatic-deployment guard and verify the target project before each deployment.
- Run hosted checks with genuine staging Auth identities for landlord A/B, tenant A/B, manager A, property-scoped caretaker A, and unit-scoped caretaker A.
- Capture only isolated staging notification transports. Do not send real messages or payments.
- Before Step 4, obtain Daraja sandbox/approved credentials, designated test identities/devices, and decisions for callback evidence, reversals, and settlement. Prepare Google Play and RevenueCat test products plus a device for purchase, renewal, cancellation, expiry, and web entitlement-sync checks. None of these provider flows has passed yet.
- Per-landlord Safaricom onboarding and settlement remains a separate design phase; merchant configuration, settlement ownership, reconciliation evidence, and provider capabilities require explicit decisions. No speculative settlement behavior is implemented.

Step 3 is **not ready to close** until the hosted authenticated matrix and staging metadata recheck complete, and backup/recovery evidence is clearly separated from the synthetic rehearsal.

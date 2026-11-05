# Step 3 validation — 5 November 2026

## Current release

- Branch: `codex/staging-step3-fixes`
- Commit before this defect fix: `df9c16ee408d410472f515105ac09953a5b1c947`
- Staging project: `landee-staging` (`prj_LqYUx67llEO5sE2nVrBUsLjynH75`)
- Staging URL: https://landee-staging.vercel.app
- Staging Supabase project: `mcclctunrpyhumubpeyo`
- Live Supabase project remains excluded from mutations: `emdahodfztpfdjkrbnqz`
- Validation date: 5 November 2026 (EAT)

The three previously reported defects are present in `df9c16e`: unit-scoped caretaker access is narrowed to the assigned unit, manager aggregates use the authorised context owner, and STK callback persistence/replay accepts only one legacy JSON-string layer while preserving strict validation.

This release also fixes invoice and SMS reminder metadata. The writer now passes an object through `sql.json(...)`; it does not stringify JSONB values. No historical records are rewritten.

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

The prior deployment was Vercel deployment `33uXB4VwAcTxyzPuALvs4CAky3sS`, Ready at `df9c16e`, with the sign-in page smoke-tested. Staging is protected by Vercel SSO. The repository branch guard disables automatic Git deployment for `codex/staging-step3-fixes`; deployment must target the isolated `landee-staging` project explicitly.

This release still requires a post-deploy check of the new invoice metadata writer. The hosted authenticated regression matrix is blocked until genuine staging Auth identities and a protected browser/API session are available.

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

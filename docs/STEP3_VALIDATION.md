# Step 3 validation — 7 November 2026

## Current release

- Branch: `codex/staging-step3-fixes`
- Current commit: `2b7d729` (`Clarify staging authorization evidence`)
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

The operator subsequently completed the corrected authenticated API harness for all six required identities. Each run verified the expected trusted role, returned `200` for permitted list/profile reads applicable to that identity, and returned explicit `403` for the schema-valid foreign-property unit-create probe and the existing foreign/sibling-unit probe. The six sanitized results are recorded below; no credential, token, cookie, or response body containing secrets was retained.

On 7 November, the shared browser was re-authenticated as Unit Caretaker A (`0700000307`). Its hosted dashboard showed one assigned tenant and one assigned property; the Properties view showed only Step 3 Property A with one tenant/lease, and the Tenants view contained only Step3 Tenant A. The tenant-creation dialog was opened and cancelled without submitting a write. The later corrected API harness supplies the list/create-denial evidence for this identity; it does not cover a successful assigned-unit update. The Subscription view for the landlord session displayed “Subscriptions are not enabled yet”; hosted legacy-Free versus noneligible enforcement therefore remains unverified.

## Evidence

### Completed locally

- `npm run check` — passed.
- Focused invoicing suite, including a disposable PostgreSQL assertion of `jsonb_typeof(metadata) = 'object'` and `metadata->>'leaseId'` — passed.
- `npm run test:financial-integrity` — passed.
- `npm run test:subscription` — passed.
- `npm run test:kcb` — passed.
- `npm run test:account-deletion` — passed.
- `npm run test:tenant-payments` — passed.
- `npm run check:route-entrypoints` — passed.
- `npm run build`, `npm run build:frontend`, and `npm run build:vercel` — passed.
- Existing branch release CI for `df9c16e` passed: https://github.com/dmuchai/Rent-Management-System/actions/runs/42032686496
- `git diff --check` — passed.

These are local tests using disposable PostgreSQL and controlled provider transports. They are not hosted browser tests and do not prove live Safaricom, email, SMS, RevenueCat, or Google Play delivery.

### Staging deployment

The current deployment is Vercel deployment `dpl_2MVNEXsVLgdi7FGY8TrgVhJoutoH`, Ready at `1087d9e`, with aliases `https://landee-staging.vercel.app` and `https://landee-staging-jvs031fng-dmmuchai-1174s-projects.vercel.app`. Its Vercel target is `production` within the isolated `landee-staging` project; it is not the live Landee project. The sign-in route returns the expected Vercel SSO protection response. The repository branch guard disables automatic Git deployment for `codex/staging-step3-fixes`; deployment was explicitly targeted to the isolated project.

The guarded staging bootstrap and authenticated browser session are available only when the operator shares an active Vercel SSO session. The hosted role smoke checks above passed after normal Landee login/logout. In this validation pass, all six synthetic identities authenticated successfully against isolated staging Supabase, but direct requests to `https://landee-staging.vercel.app/api/*` were intercepted by Vercel Deployment Protection before reaching Landee Auth; the opened browser likewise resolved to the Vercel login page. A staging-only invoicing run for November 2026 generated one invoice and an email reminder; a direct staging database query returned `jsonb_typeof(metadata) = 'object'` and `metadata->>'leaseId' = 'step3-lease-b'`. Repeating the same invoicing run generated zero additional invoices, providing staging idempotency evidence. The deployment listed above predates `d986eac`; no new deployment was made during this validation pass because deployment credentials were not present in the shell.

A guarded `npm run staging:validate-api` harness is now implemented in [validate-staging-api.ts](../scripts/validate-staging-api.ts). It accepts a session access token and optional Vercel SSO cookie through environment variables, performs read checks and a schema-valid unit-create authorization probe against a supplied foreign fixture property without creating data, never logs credentials, and fails closed when the staging URL or token is missing. It is ready for one run per synthetic identity once the authenticated browser can provide both values.

The harness now accepts `STAGING_EXPECTED_ROLE` and verifies the trusted role returned by `/api/auth?action=user`. The earlier Landlord A `404/400/400` output was correctly rejected as authorization evidence because it represented a missing tenant profile and malformed probes. The corrected six-identity run completed with valid fixture inputs and explicit `403` authorization responses.

### Corrected authenticated API matrix

| Identity | Expected role | Permitted reads | Foreign unit-create probe | Sibling-unit probe | Evidence |
|---|---|---:|---:|---:|---|
| Landlord A | `landlord` | `200` | `403` | `403` | Sanitized operator harness output |
| Landlord B | `landlord` | `200` | `403` | `403` | Sanitized operator harness output |
| Property Manager A | `property_manager` | `200` | `403` | `403` | Sanitized operator harness output |
| Property Caretaker A | `caretaker` | `200` | `403` | `403` | Sanitized operator harness output |
| Tenant A | `tenant` | `200` | `403` | `403` | Sanitized operator harness output |
| Tenant B | `tenant` | `200` | `403` | `403` | Sanitized operator harness output |

The harness probes are non-destructive: the create payload targets a valid
property outside the identity's portfolio, and the sibling probe targets an
existing foreign fixture. This is hosted API evidence, distinct from the
hosted UI observations and local handler/provider tests.

## Matrix status

| Area | Status | Evidence or blocker |
|---|---|---|
| Unit-scoped caretaker list/create/update | Corrected hosted list/create-denial/sibling-denial run passed; update still pending | The valid foreign-property create and existing sibling probes returned 403 for Unit Caretaker A. A successful assigned-unit update and corresponding sibling update denial remain pending |
| Property-scoped caretaker portfolio | Local complete; hosted scope smoke passed | Property Caretaker A hosted dashboard showed only the assigned Property A and Tenant A |
| Manager dashboard totals | Local complete; hosted passed | Manager A hosted dashboard showed Landlord A's 1 property, 1 active tenant, 50% occupancy, and 1 overdue invoice |
| Callback verification, retry, duplicate idempotency | Local complete; hosted blocked | Provider was mocked locally; no live Daraja request |
| Invoice reminder metadata | Local and staging query complete | Staging invoice `b0bab968-52df-4020-bd21-1daa58457e02` produced an email queue row with `jsonb_typeof(metadata) = 'object'` and `metadata->>'leaseId' = 'step3-lease-b'`; historical rows were not rewritten |
| Partial/excess payments and reversals | Local complete | Disposable PostgreSQL financial-integrity tests |
| Cross-landlord isolation and tenant restrictions | Local complete; hosted UI/API matrix passed; update coverage pending | Tenant A/B UI isolation passed, and all six corrected API runs returned expected role/read/403 results. Assigned-unit and portfolio update assertions remain pending |
| Forged/revoked contexts | Local complete; hosted blocked | Local authorization tests; no staging token-revocation/request-forgery harness was executed |
| Queue concurrency and recovery | Local complete | Disposable PostgreSQL claim/lease tests |
| Invoice-generation idempotency and lease expiry | Staging database evidence complete; authenticated cron capture blocked | The November 2026 staging invoicing run generated one invoice, and the identical second run generated zero. Existing staging fixtures show `step3-expired-lease` as `expired/is_active=false` with `step3-expired-unit.is_occupied=false`, and `step3-active-lease` as `active/is_active=true` with its unit occupied. A fresh authenticated cron/API capture remains blocked by Vercel SSO. |
| Subscription enforcement | Local complete; hosted feature disabled | The hosted Subscription view reported subscriptions are not enabled; legacy Free versus noneligible write enforcement was not exercised |
| Full backup restoration | Blocked | Migration 015 was only a synthetic structural rehearsal; no verified complete production backup restoration |
| Independent database RLS policy verification | Blocked pending direct staging query | Source review confirms RLS is enabled on the legacy resource tables and on the migration-015 evidence/membership/job tables. The checked-in legacy policy file is owner-only and does not independently demonstrate the scoped property-manager/caretaker/tenant rules; migration 015 adds no end-user policies for its newly protected tables. A direct staging `pg_policies`/`relrowsecurity` query under a non-service database role is still required. |

## Independent control review

- **Database RLS:** The repository source audit found `ENABLE ROW LEVEL SECURITY` on the legacy resources and on `payment_audit_history`, `user_context_memberships`, and `operational_job_runs`. The checked-in `supabase-rls-policies.sql` only grants owner-based policies for properties/units and limited tenant/document reads; it does not prove the API's scoped authority model for managers and caretakers. The API uses server-side database credentials, so HTTP `403` results are not RLS evidence. No production database was queried. Step 3 requires a staging-only `pg_class`/`pg_policies` inspection and representative anon/authenticated-role read/write probes before this control can be marked complete.
- **Frontend roles:** `Sidebar` filters navigation by trusted role; `App` routes tenants and caretakers to dedicated dashboards and routes landlords/property managers to the management dashboard; subscription purchasing is limited to landlord/property-manager roles. These are usability controls only. Backend `requireAuth` and portfolio checks remain authoritative, and the six hosted API runs exercised those controls.
- **Subscription/free tier:** Local tests pass for legacy Free eligibility, new-account ineligibility, plan limits, expiry/read-only behavior, and write-policy exceptions. The hosted staging Subscription view previously reported that subscriptions were disabled, so legacy-Free versus noneligible-new-account enforcement, purchase, renewal, cancellation, expiry, and entitlement sync remain unverified in staging.
- **Authentication and recovery:** Normal Supabase login was used for the six hosted identities. Password recovery has separate forgot/reset routes and uses Supabase recovery sessions; no reset email was sent or consumed during this pass. Recovery remains a manual hosted check, not a claimed pass.
- **Payment webhook isolation:** Local callback verification, retry, duplicate, allocation, reversal, and financial-integrity suites pass with controlled transports. No live Daraja/Safaricom request was made; staging provider isolation and a hosted retry/duplicate transport capture remain pending.
- **Backup/recovery:** Migration 015's synthetic rehearsal is not a complete backup restore. Data, Auth, Storage, RLS, triggers, indexes, and policies have not been restored and verified together in an isolated environment.

## Rollout boundaries and next actions

- Do not mutate the live Supabase project, deploy the live Landee project, delete accounts, or alter the KES 15,000 historical mismatch without explicit approval.
- Preserve the existing automatic-deployment guard and verify the target project before each deployment.
- Run hosted checks with genuine staging Auth identities for landlord A/B, tenant A/B, manager A, property-scoped caretaker A, and unit-scoped caretaker A.
- Capture only isolated staging notification transports. Do not send real messages or payments.
- Before Step 4, obtain Daraja sandbox/approved credentials, designated test identities/devices, and decisions for callback evidence, reversals, and settlement. Prepare Google Play and RevenueCat test products plus a device for purchase, renewal, cancellation, expiry, and web entitlement-sync checks. None of these provider flows has passed yet.
- Per-landlord Safaricom onboarding and settlement remains a separate design phase; merchant configuration, settlement ownership, reconciliation evidence, and provider capabilities require explicit decisions. No speculative settlement behavior is implemented.

Step 3 is **not ready to close**. The six corrected authenticated API runs are complete, but independent staging RLS verification, assigned-unit update coverage, hosted callback recovery/duplicate evidence, subscription enforcement with the feature enabled, fresh authenticated cron capture, and full backup restoration remain release blockers. UI observations must not be promoted to API or RLS evidence.

## Remaining authenticated API runs

Run the harness once per identity with a fresh token and the same Vercel SSO cookie. Keep the environment variables in the local protected shell; never paste them into chat or commit them.

| Identity | Phone | Expected role | Sibling probe |
|---|---:|---|---|
| Landlord A | `0700000301` | `landlord` | `step3-unit-b1` |
| Landlord B | `0700000302` | `landlord` | `step3-unit-a2` |
| Manager A | `0700000305` | `property_manager` | `step3-unit-b1` |
| Property Caretaker A | `0700000306` | `caretaker` | `step3-unit-b1` |
| Tenant A | `0700000303` | `tenant` | `step3-unit-b1` |
| Tenant B | `0700000304` | `tenant` | `step3-unit-a2` |

The highest-priority remaining runs are Property Manager A (`0700000305`, expected
`property_manager`) and Tenant B (`0700000304`, expected `tenant`). Manager A
must produce `200` for its authorised lists and explicit `403` responses for
the foreign-property create and sibling-unit probes. Tenant B must produce
`200` for its tenant profile and scoped reads, plus explicit `403` responses
for both authorization probes. Landlord A's reported tenant-profile `404` is
an expected missing-profile result, while its `400` create and sibling
responses were invalid-request results; none is authorization evidence until
the corrected harness produces explicit `403` responses.

For each row, authenticate normally, export only the resulting access token and
SSO cookie into the shell, set `STAGING_EXPECTED_ROLE`,
`STAGING_CREATE_PROPERTY_ID` to a property outside that identity's portfolio,
and `STAGING_SIBLING_UNIT_ID` to an existing sibling fixture, then run:

```bash
STAGING_BASE_URL=https://landee-staging.vercel.app \
STAGING_API_TOKEN="$STAGING_API_TOKEN" \
STAGING_VERCEL_COOKIE="$STAGING_VERCEL_COOKIE" \
STAGING_EXPECTED_ROLE=caretaker \
STAGING_CREATE_PROPERTY_ID=step3-property-b \
STAGING_SIBLING_UNIT_ID=step3-unit-a2 \
npm run staging:validate-api
```

Replace only the expected role and sibling fixture for each table row. Do not
reuse a token after switching identity. Record the sanitized PASS/INFO lines and the identity/role, not the credential
values. HTTP 400 or 404 must be investigated from the response body and must
not be recorded as authorization passes. A complete API sign-off also
requires an assigned-unit update assertion for Unit Caretaker A and equivalent
portfolio/update checks for the landlord, manager, and property caretaker
roles; the current harness intentionally performs no successful mutation.

# Step 3 validation — 13 November 2026

## 13 November candidate freeze

Staging isolation was re-verified before mutation. Supabase project
`mcclctunrpyhumubpeyo` is the healthy `landee-staging` project; production
project `emdahodfztpfdjkrbnqz` was excluded. The linked Vercel project is
`landee-staging` (`prj_LqYUx67llEO5sE2nVrBUsLjynH75`) on Node.js 26.x, and
`landee-staging.vercel.app` remains on the prior Ready deployment
`dpl_2MVNEXsVLgdi7FGY8TrgVhJoutoH` pending candidate validation.

The six Supabase/database runtime variables in the isolated Vercel project
were rebound from the ignored, mode-`0600` staging credential file without
printing values. Server values are Secret variables; the intentionally
browser-visible `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are Config
variables. No payment, email, or SMS provider credentials are configured in
this Vercel project. `CRON_SECRET` remains a Secret.

The reviewed persistent script
[`staging-storage-apply.sql`](./reviews/staging-storage-apply.sql) was applied
only to `mcclctunrpyhumubpeyo`. Before application the bucket, object, and
matching-policy counts were `0/0/0`. Persistent verification now shows one
private `property-images` bucket, a 5,242,880-byte limit, exactly
`image/jpeg`, `image/png`, `image/webp`, and `image/gif`, zero objects, and
zero client Storage policies. The 26 Supabase `rls_enabled_no_policy`
informational notices are unchanged and intentional for the server-mediated,
default-deny business tables; the database health advisor has no findings.

### Review finding disposition

| Finding | Disposition and evidence |
|---|---|
| Context clearing on every 401 and mutation replay | **Fixed.** [`shared/authority-context.ts`](../shared/authority-context.ts), [`api/_lib/auth.ts`](../api/_lib/auth.ts), and [`server/supabaseAuth.ts`](../server/supabaseAuth.ts) emit an explicit `AUTHORITY_CONTEXT_INVALID` response only for a rejected selected membership. [`client/src/lib/queryClient.ts`](../client/src/lib/queryClient.ts) retries only read queries carrying that explicit code; mutations are never replayed. |
| Subscription confirmation and buttons used different baselines | **Fixed.** [`shared/subscription/plans.ts`](../shared/subscription/plans.ts) supplies one transition-aware comparison baseline used by both plan buttons and confirmation logic in [`client/src/pages/subscription.tsx`](../client/src/pages/subscription.tsx). |
| Trial eligibility inferred from `trialDays` | **Fixed.** Package metadata is described only as an introductory offer subject to Google Play eligibility. A trial-confirmed message is shown only when the returned customer snapshot is actually `trialing`. |
| Only six fixture identities accounted for | **Fixed.** [`scripts/validate-staging-rls-fresh.ts`](../scripts/validate-staging-rls-fresh.ts) and [`scripts/validate-staging-rls.ts`](../scripts/validate-staging-rls.ts) include Unit Caretaker A. Fresh authentication, identity checks, JWT preflight, and default-deny probes passed for all seven identities. |
| Caretaker invitation partial failure | **Fixed.** [`api/caretaker-invitations/index.ts`](../api/caretaker-invitations/index.ts) recovers an existing Auth-only user, updates credentials before the database transaction, and makes assignment creation retry-safe. [`server/routes/caretakers.ts`](../server/routes/caretakers.ts) mirrors resumable Auth lookup and idempotent database steps. |
| Unit listing ignored `contextOwnerId`/ownership | **Fixed.** [`api/units/index.ts`](../api/units/index.ts) and [`server/routes/units.ts`](../server/routes/units.ts) scope landlord/manager listings to `contextOwnerId` and filter caretakers by property/unit assignment. Unit-specific caretakers cannot list or update sibling units. |

### Freeze checks

| Check | Result |
|---|---|
| TypeScript and route entrypoints | **PASS** |
| Financial-integrity regression | **PASS — 17/17** |
| Invoicing/disposable PostgreSQL | **PASS — 26/26** |
| Subscription, including four-unit legacy Free and manager owner-context totals | **PASS — 16/16** |
| Account deletion | **PASS — 8/8** |
| KCB controlled fixtures | **PASS — 28/28** |
| Tenant payment validation | **PASS — 10/10** |
| OTP mocked transport | **PASS — 7/7** |
| Private-image, frontend Storage/Realtime, role-boundary, and Storage-package contracts | **PASS** |
| Vercel frontend build on local Node.js 22 | **PASS**; only existing bundle-size/import warnings |
| Fresh staging RLS authentication/default-deny matrix | **PASS — 7/7**, read-only |
| Hosted candidate/API/browser matrix | **PENDING** until the committed `--skip-domain` candidate is created |

The manager subscription route also resolves plan and usage from
`auth.contextOwnerId`, matching the selected portfolio used by its listings
and dashboard totals.

The React review checklist found no new component-structure, hook,
accessibility, or TypeScript issue in the subscription changes. The legacy
Free plan remains capped at four active units across the whole owner
portfolio; serialized create/restore checks remain in place.

## Current release

- Branch: `codex/staging-step3-fixes`
- Current commit: `7815256` (`Clarify staging RLS fixture diagnosis`), with uncommitted validation-harness/documentation changes
- Staging project: `landee-staging` (`prj_LqYUx67llEO5sE2nVrBUsLjynH75`)
- Staging URL: https://landee-staging.vercel.app
- Staging Supabase project: `mcclctunrpyhumubpeyo`
- Live Supabase project remains excluded from mutations: `emdahodfztpfdjkrbnqz`
- Continuation validation date: 9 November 2026 (EAT)

## 9 November continuation review

The working tree was preserved and reviewed from `7815256`; it remains
uncommitted and is not deployed. Read-only Vercel CLI inspection reconfirmed
that the linked isolated project is `landee-staging`
(`prj_LqYUx67llEO5sE2nVrBUsLjynH75`). Its current Ready deployment is
`dpl_2MVNEXsVLgdi7FGY8TrgVhJoutoH`, created 5 November 2026, with the
`landee-staging.vercel.app` alias. It contains commit `1087d9e`, which is an
ancestor of the current branch. All later commits and all current working-tree
changes therefore remain local.

The continuation review closed the following local defects without deploying:

- Vercel writes use `/api/property-images/:propertyId`; the rewrite now passes
  the named segment explicitly as `propertyId`, while signed reads continue to
  use `/api/property-images?propertyId=...`. Express and Vercel handlers now
  implement the same contract.
- Property-image writes are limited to the portfolio landlord and trusted
  property manager. Property/unit-scoped caretakers and active tenants receive
  read access only inside their selected trusted owner context. Cross-context
  role reuse does not grant image access.
- Finalization now verifies that the uploaded object exists and that its stored
  size, MIME type, extension, JPEG/PNG/WebP/GIF byte signature, uploader UUID,
  property ID, and random UUID match the private-image contract. Failed
  finalization removes the candidate object; successful replacement attempts
  to remove the prior stable object. The API refuses to delete the image
  currently referenced by the property.
- Archived-unit restore now checks caretaker property/unit assignments in both
  Vercel and Express paths. Both paths serialize the portfolio-wide active-unit
  count and restore update with the owner advisory lock and row locks.
- The disposable-database guard is now matched by release CI, and the legacy
  API smoke command now fails on network or unexpected-status results and
  refuses non-loopback targets.
- Manual payment replay now changes only `failed` or `review` events to `retry`
  inside the same transaction as its audit row; an already queued retry cannot
  be claimed repeatedly.
- The rollback-only Storage rehearsal was executed against the independently
  verified staging database. Before and after the transaction, the
  `property-images` bucket, object, and matching-policy counts were all zero.
  Inside the transaction the candidate bucket was private, limited to 5 MiB,
  and restricted to JPEG/PNG/WebP/GIF; the transaction ended in `ROLLBACK`.
- The exact working tree passed dependency resolution, type-checking,
  server/frontend builds, private-image tests, financial-integrity 14/14, and
  subscription 14/14 under Node.js 26.13.0. The staging Node 26 setting is
  compatible with the reviewed code. `tsx` emitted a non-blocking test-loader
  deprecation warning; no application incompatibility was found.

### Continuation test results

| Check | Result on 9 November 2026 |
|---|---|
| `npm run check` | **PASS** |
| Private-image, frontend Storage/Realtime, frontend role-boundary, and staging Storage-package contracts | **PASS** |
| `npm run test:financial-integrity` | **PASS — 14/14** |
| `npm run test:invoicing` | **PASS — 26/26** using a disposable PostgreSQL 16 cluster under `/tmp` |
| `npm run test:subscription` | **PASS — 14/14** |
| `npm run test:kcb` | **PASS — 28/28**, controlled local fixtures only |
| `npm run test:tenant-payments` | **PASS — 10/10** |
| `npm run test:account-deletion` | **PASS — 8/8** |
| `npm run test:otp` | **PASS — 7/7**, mocked provider transport |
| `npm run check:route-entrypoints` | **PASS** |
| `npm run test:api` | **PASS — 3/3 expected 401 auth-boundary probes** against a local server with loopback-only placeholder configuration; authenticated behavior is not claimed |
| `npm run build`, `npm run build:frontend`, `npm run build:vercel` | **PASS**; existing bundle-size and mixed static/dynamic import warnings remain |
| `git diff --check` | **PASS** |
| Fresh-auth direct staging RLS matrix | **PASS — 6/6 identities authenticated, identity-matched, and received zero direct business/membership rows** |
| Rollback-only staging Storage SQL rehearsal | **PASS — candidate configuration verified; before/after bucket, object, and matching-policy counts remained 0/0/0** |
| Node.js 26 staging-runtime compatibility | **PASS — dependency dry-run, type-check, builds, private-image, financial-integrity 14/14, and subscription 14/14** |
| Hosted private-image/API/browser matrix | **BLOCKED / NOT RUN**: no bucket or current code was deployed; fresh API/Vercel session credentials remain required |

The linked staging Vercel project currently has encrypted `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `DATABASE_URL`,
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `CRON_SECRET` values. No
additional private-image secret is needed. `ENABLE_SUBSCRIPTIONS` and
`VITE_ENABLE_SUBSCRIPTIONS` are absent, so hosted subscription enforcement
remains disabled until a separate staging-only configuration approval.

The active local `.env` resolves to the excluded production Supabase and
database targets. It was not used for hosted validation or mutation. The
ignored, mode-`0600` `.env.test.local` contains staging credentials under
legacy generic names; they were mapped ephemerally to explicit `STAGING_*`
names only after target verification. No value was printed or persisted under
a new name. Generic runtime fallbacks remain prohibited for the approval run.

The three previously reported defects are present in `df9c16e`: unit-scoped caretaker access is narrowed to the assigned unit, manager aggregates use the authorised context owner, and STK callback persistence/replay accepts only one legacy JSON-string layer while preserving strict validation.

This release also fixes invoice and SMS reminder metadata. The writer now passes an object through `sql.json(...)`; it does not stringify JSONB values. No historical records are rewritten.

The staging fixture bootstrap is implemented in [STAGING_VALIDATION_BOOTSTRAP.md](./STAGING_VALIDATION_BOOTSTRAP.md) and [bootstrap-staging-validation.ts](../scripts/bootstrap-staging-validation.ts). It is guarded to Supabase project `mcclctunrpyhumubpeyo`, requires explicit `STAGING_ALLOW_MUTATION=true`, and refuses production-looking configuration. It is type-checked and its missing-configuration refusal was verified locally.

On 6 November 2026 the bootstrap was executed successfully against the staging project using the operator-provided ignored `.env.test.local`. Seven synthetic Auth users, matching profiles, portfolios, memberships, caretaker assignments, leases, and the controlled invoice were created or updated under the `step3-` fixture prefix. Direct unauthenticated HTTP probes returned `401` from Vercel Deployment Protection before reaching Landee Auth; this is not evidence of invalid staging credentials. Complete hosted checks require an authenticated Vercel SSO browser session followed by the normal Landee login.

The authenticated staging browser subsequently passed genuine hosted UI checks for the seeded identities. Landlord A displayed the Step 3 portfolio, one overdue invoice, 50% occupancy (1/2 units), and the active Step 3 Tenant A lease; its Properties, Tenants, and Leases views showed only the authorised portfolio. Landlord B displayed only Property B/Unit B1 and Tenant B. Manager A displayed the authorised Landlord A totals (1 property, 1 active tenant, 50% occupancy, and 1 overdue invoice), rather than the manager's own empty portfolio. Property Caretaker A displayed one assigned property and Tenant A; Unit Caretaker A displayed the assigned Tenant A/unit scope. Tenant A displayed only Property A/Unit A1 and Tenant B displayed only Property B/Unit B1. These are hosted staging observations, not local handler tests.

The operator subsequently completed the corrected authenticated API harness for the six primary matrix identities, with the separately recorded Unit Caretaker A run included in the same evidence table. Each run verified the expected trusted role, returned `200` for permitted list/profile reads applicable to that identity, and returned explicit `403` for the schema-valid foreign-property unit-create probe and the existing foreign/sibling-unit probe. No credential, token, cookie, or response body containing secrets was retained.

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

The harness now accepts `STAGING_EXPECTED_ROLE` and verifies the trusted role returned by `/api/auth?action=user`. The earlier Landlord A `404/400/400` output was correctly rejected as authorization evidence because it represented a missing tenant profile and malformed probes. The corrected primary-identity runs and the separately recorded Unit Caretaker A run completed with valid fixture inputs and explicit `403` authorization responses.

### Corrected authenticated API matrix

| Identity | Expected role | Permitted reads | Foreign unit-create probe | Sibling-unit probe | Evidence |
|---|---|---:|---:|---:|---|
| Landlord A | `landlord` | `200` | `403` | `403` | Sanitized operator harness output |
| Landlord B | `landlord` | `200` | `403` | `403` | Sanitized operator harness output |
| Property Manager A | `property_manager` | `200` | `403` | `403` | Sanitized operator harness output |
| Property Caretaker A | `caretaker` | `200` | `403` | `403` | Sanitized operator harness output |
| Unit Caretaker A | `caretaker` | `200` | `403` | `403` | Sanitized operator harness output |
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
| Cross-landlord isolation and tenant restrictions | Local complete; hosted UI/API matrix passed; update coverage pending | Tenant A/B UI isolation passed, and the corrected API runs represented in the matrix returned expected role/read/403 results. Assigned-unit and portfolio update assertions remain pending |
| Forged/revoked contexts | Local complete; hosted blocked | Local authorization tests; no staging token-revocation/request-forgery harness was executed |
| Queue concurrency and recovery | Local complete | Disposable PostgreSQL claim/lease tests |
| Invoice-generation idempotency and lease expiry | Staging database evidence complete; authenticated cron capture blocked | The November 2026 staging invoicing run generated one invoice, and the identical second run generated zero. Existing staging fixtures show `step3-expired-lease` as `expired/is_active=false` with `step3-expired-unit.is_occupied=false`, and `step3-active-lease` as `active/is_active=true` with its unit occupied. A fresh authenticated cron/API capture remains blocked by Vercel SSO. |
| Subscription enforcement | Local complete; hosted feature disabled | The hosted Subscription view reported subscriptions are not enabled; legacy Free versus noneligible write enforcement was not exercised |
| Full backup restoration | Blocked | Migration 015 was only a synthetic structural rehearsal; no verified complete production backup restoration |
| Independent database RLS policy verification | Verified staging defect; authorization run blocked | An authorized staging metadata query confirmed both fixture properties exist and map to the expected synthetic landlords. `relrowsecurity` is enabled on the protected tables, but `pg_policies` returned zero rows for `public` and `storage`; direct client reads therefore return empty results under default deny. No policy migration was applied. Install and review the intended staging policies, then rerun the JWT harness; production remains untouched. |

| Frontend role-boundary contract | Verified pass (source-level); browser authorization remains separate | `npm run test:frontend-role-boundaries` passed. It verifies role routing for landlord/property manager, caretaker, and tenant, role-filtered sidebar navigation, and subscription-owner gating. It is not a browser E2E test and does not replace backend/RLS checks. |

## Independent control review

### Data-access architecture audit

| Resource/path | Current access path | Direct authenticated client access required? | RLS implication |
|---|---|---:|---|
| Properties, units, tenants, leases, invoices, payments, maintenance, reports, subscriptions, reconciliation, memberships, queue/audit tables | Authenticated Express compatibility routes and Vercel functions using server-side Supabase/database access | No | Keep direct REST access default-deny. API authority and transaction checks remain the security boundary. |
| Supabase Auth sessions, login, recovery, OAuth callback | Supabase browser client plus `/api/auth` synchronization | Yes, for Auth protocol only | Auth endpoints are not business-table RLS evidence. |
| `storage.objects` / `property-images` | Authenticated Express/Vercel API upload and signed-read endpoint; document uploads use the API upload URL | No direct browser Storage access | Private bucket, 5 MiB/MIME validation, non-overwriting `<auth-user-uuid>/<property-id>/<random-uuid>.<extension>` paths, zero client Storage policies, and server-authorized 90-second signed reads. |
| Realtime subscriptions for properties, tenants, leases, payments, invoices, and units | Browser `supabase.channel(... postgres_changes ...)`; callback only invalidates API queries and does not log row payloads | Operationally yes, data payload access is not required | Keep the staging publication empty until a least-privilege design is approved. Do not enable all-table publication or use Realtime as a substitute for API authorization. |
| Supabase RPC functions | No browser or server RPC call was found in the audited source | No | No RPC policy remediation is justified by this audit. |

- **Database RLS:** The repository source audit found `ENABLE ROW LEVEL SECURITY` on the legacy resources and on `payment_audit_history`, `user_context_memberships`, and `operational_job_runs`. The browser does not query those business tables directly; the checked-in `supabase-rls-policies.sql` is therefore not a required client-access migration for the current API architecture and is not applied. The API uses server-side database credentials, so HTTP `403` results are not RLS evidence. No production database was queried. Direct RLS validation now checks that authenticated REST clients cannot read server-owned business rows.
- **Direct RLS harness:** [validate-staging-rls.ts](../scripts/validate-staging-rls.ts) is guarded to project `mcclctunrpyhumubpeyo`, performs no writes, and uses only the anon key plus six individual user JWTs. Before any table query it reports each token as `VALID`, `EXPIRED`, `MISSING`, or `INVALID`. Because business data is server-owned, the harness now expects each representative direct REST query to return HTTP 200 with zero rows (or HTTP 401/403), and fails if any row is visible. This is a default-deny control, not proof that the Express API is authorized.
- **JWT preflight execution:** With a placeholder anon key and no token variables, the harness safely reported all six identities as `MISSING` and stopped before any table request. A synthetic expired token was separately classified as `EXPIRED`; no real token or credential was used. This confirms unavailable/expired credentials are distinguished without exposing token contents. Direct client-context RLS remains unverified.
- **RLS metadata inspection:** The authorized staging read-only inspection confirmed all 26 public tables have RLS enabled, zero public policies are installed, zero storage policies are installed, and the two fixture properties exist with valid owners. The inspection SQL reports ordinary/partitioned tables, per-table policy counts, and storage counts so the catalog scope is explicit. This is an intentional default-deny state for server-owned business tables. The new signed-upload token flow does not require a broad client Storage policy, but it still requires the approved private bucket; Realtime behavior remains unverified. No schema change was applied.
- **Frontend roles:** `Sidebar` filters navigation by trusted role; `App` routes tenants and caretakers to dedicated dashboards and routes landlords/property managers to the management dashboard; subscription purchasing is limited to landlord/property-manager roles. These are usability controls only. Backend `requireAuth` and portfolio checks remain authoritative, and the six hosted API runs exercised those controls.
- **Storage and Realtime local review:** `npm run test:frontend-storage-realtime` and `npm run test:private-property-image` pass. Property-image uploads reject unsupported/over-5 MiB objects, require authenticated server authorization, use `<auth-user-uuid>/<property-id>/<random-uuid>.<extension>` paths, finalize only after trusted object metadata and JPEG/PNG/WebP/GIF byte-signature validation, and persist only stable private references. Reads use 90-second signed redirects; no signed or public Storage URL is stored. Realtime callbacks no longer log event payloads; they only invalidate API query caches. Hosted bucket, direct-denial, upload, replacement, expiry, cleanup, and publication checks remain blocked pending approved staging configuration.
- **Subscription/free tier:** Local tests pass for legacy Free eligibility, new-account ineligibility, plan limits, expiry/read-only behavior, and write-policy exceptions. The hosted staging Subscription view previously reported that subscriptions were disabled, so legacy-Free versus noneligible-new-account enforcement, purchase, renewal, cancellation, expiry, and entitlement sync remain unverified in staging.
- **Authentication and recovery:** Normal Supabase login was used for the six hosted identities. Password recovery has separate forgot/reset routes and uses Supabase recovery sessions; no reset email was sent or consumed during this pass. Recovery remains a manual hosted check, not a claimed pass.
- **Payment webhook isolation:** Local callback verification, retry, duplicate, allocation, reversal, and financial-integrity suites pass with controlled transports. No live Daraja/Safaricom request was made; staging provider isolation and a hosted retry/duplicate transport capture remain pending.
- **Backup/recovery:** Migration 015's synthetic rehearsal is not a complete backup restore. Data, Auth, Storage, RLS, triggers, indexes, and policies have not been restored and verified together in an isolated environment.

## Rollout boundaries and next actions

- Do not mutate the live Supabase project, deploy the live Landee project, delete accounts, or alter the KES 15,000 historical mismatch without explicit approval.
- Preserve the existing automatic-deployment guard and verify the target project before each deployment.
- Run hosted checks with genuine staging Auth identities for landlord A/B, tenant A/B, manager A, property-scoped caretaker A, and unit-scoped caretaker A.
- Capture only isolated staging notification transports. Do not send real messages or payments.
- Before Step 4, raja sandbox/approved credentials, designated test identities/devices, and decisions for callback evidence, reversals, and settlement. Prepare Google Play and RevenueCat test products plus a device for purchase, renewal, cancellation, expiry, and web entitlement-sync checks. None of these provider flows has passed yet.
- Per-landlord Safaricom onboarding and settlement remains a separate design phase; merchant configuration, settlement ownership, reconciliation evidence, and provider capabilities require explicit decisions. No speculative settlement behavior is implemented.

Step 3 is **not ready to close**. The corrected authenticated API runs represented in the matrix are complete, but hosted private-Storage validation, assigned-unit update coverage, hosted callback recovery/duplicate evidence, subscription enforcement with the feature enabled, fresh authenticated cron capture, and full backup restoration remain release blockers. Direct business-table RLS is intentionally default-deny and must be revalidated after deployment; no broad client policy installation is required. UI observations must not be promoted to API or RLS evidence.

## Authenticated API harness instructions

Run the harness once per identity with a fresh token and the same Vercel SSO cookie. Keep the environment variables in the local protected shell; never paste them into chat or commit them.

| Identity | Phone | Expected role | Sibling probe |
|---|---:|---|---|
| Landlord A | `0700000301` | `landlord` | `step3-unit-b1` |
| Landlord B | `0700000302` | `landlord` | `step3-unit-a2` |
| Manager A | `0700000305` | `property_manager` | `step3-unit-b1` |
| Property Caretaker A | `0700000306` | `caretaker` | `step3-unit-b1` |
| Unit Caretaker A | `0700000307` | `caretaker` | `step3-unit-a2` |
| Tenant A | `0700000303` | `tenant` | `step3-unit-b1` |
| Tenant B | `0700000304` | `tenant` | `step3-unit-a2` |

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

The values in this example are placeholders. Replace the expected role and
fixture probe values with those for the intended identity before running it.

Replace only the expected role and sibling fixture for each table row. Do not
reuse a token after switching identity. Record the sanitized PASS/INFO lines and the identity/role, not the credential
values. HTTP 400 or 404 must be investigated from the response body and must
not be recorded as authorization passes. A complete API sign-off also
requires an assigned-unit update assertion for Unit Caretaker A and equivalent
portfolio/update checks for the landlord, manager, and property caretaker
roles; the current harness intentionally performs no successful mutation.

### Direct RLS token preflight and execution

The direct RLS harness requires the staging anon key and one fresh access token
for each of Landlord A, Landlord B, Manager A, Property Caretaker A, Tenant A,
and Tenant B. It does not accept a service-role key for authorization probes.
Before querying any table it checks each token's issuer, expiry, minimum
remaining lifetime (300 seconds by default), and `/auth/v1/user`. It prints
only the identity name and `VALID`, `EXPIRED`, `MISSING`, or `INVALID`; it
never prints token claims or response bodies.

The active validation shell had all six token variables unset. To obtain fresh
synthetic-user tokens safely, sign in through the isolated staging login (or
use the staging Auth password supplied to the operator), then keep the
following workflow in a protected subshell. The response and tokens remain in
shell variables and are not echoed:

```bash
(
  set -euo pipefail
  read -rsp 'Staging fixture password: ' STAGING_TEST_PASSWORD
  printf '\n'
  for fixture in \
    'LANDLORD_A:step3-landlord-a@staging.landee.test' \
    'LANDLORD_B:step3-landlord-b@staging.landee.test' \
    'MANAGER_A:step3-manager-a@staging.landee.test' \
    'PROPERTY_CARETAKER_A:step3-caretaker-property-a@staging.landee.test' \
    'TENANT_A:step3-tenant-a@staging.landee.test' \
    'TENANT_B:step3-tenant-b@staging.landee.test'; do
    IFS=: read -r name email <<< "$fixture"
    response="$(
      printf '{"email":"%s","password":"%s"}' "$email" "$STAGING_TEST_PASSWORD" |
        curl --fail-with-body --silent --show-error \
          -H 'Content-Type: application/json' \
          -H "apikey: $STAGING_SUPABASE_ANON_KEY" \
          --data-binary @- \
          "$STAGING_SUPABASE_URL/auth/v1/token?grant_type=password"
    )"
    token="$(printf '%s' "$response" | jq --raw-output --exit-status '.access_token')"
    export "STAGING_RLS_TOKEN_${name}=$token"
  done
  STAGING_RLS_MIN_REMAINING_SECONDS=300 npm run staging:validate-rls
)
```

Set `STAGING_SUPABASE_URL` to the exact isolated staging URL and provide
`STAGING_SUPABASE_ANON_KEY` from the protected secret store before running the
subshell. Do not paste tokens, passwords, the JSON response, or a service-role
key into documentation, shell history, CI logs, or issue comments. If the
preflight reports `EXPIRED` or `INVALID`, repeat the sign-in flow; do not
decode or edit a token and do not lower the lifetime threshold to force a run.

The metadata query in [inspect-staging-rls.sql](../scripts/inspect-staging-rls.sql)
must be run separately with an authorized staging database connection. It
reports RLS enablement for ordinary and partitioned tables, per-table policy
counts, and storage policy counts. A zero policy count is therefore
distinguished from an inspection that omitted the table or schema. The
review-only proposal in
[staging-scoped-rls-proposal.sql](reviews/staging-scoped-rls-proposal.sql)
captures the minimum membership-aware read policies for staging review; its
transaction ends in `ROLLBACK` and it must not be applied until the direct
client-context tests and policy review pass.

For fresh direct-RLS authentication, use the dedicated local command
`npm run staging:validate-rls:fresh`. It requires the exact staging URL and
anon key, plus either the bootstrap-supported `STAGING_TEST_PASSWORD`, six
individual `STAGING_RLS_PASSWORD_*` variables, or a manual
`STAGING_RLS_TOKEN_*` fallback for each identity. Password sign-in uses the
six fixed synthetic emails, checks the returned user email, keeps tokens in
memory only, and then invokes the existing fail-closed RLS harness. It never
uses the service-role key or changes Auth state.

Expected successful output is one sanitized `AUTH <identity>: acquired and
identity-checked` line per identity, plus `signIn=OK` or
`signIn=SKIPPED_MANUAL_TOKEN`, `getUser=OK`, and `identity=MATCH`
diagnostics, followed by six `PREFLIGHT ...: VALID`
lines and `PASS ...` RLS assertions. On 9 November 2026 the protected local
staging values were target-checked, mapped ephemerally to the required
`STAGING_*` names, and the command passed for all six identities. Every
password sign-in returned `getUser=OK` and `identity=MATCH`; all six JWTs were
classified `VALID`; representative direct business and membership reads
returned HTTP 200 with zero rows, confirming the intended client-context
default deny. No business row was written and no credential was printed.

The bootstrap maps all six tested identities to confirmed synthetic email
addresses and also creates confirmed phone values. The runner uses email
sign-in, normalizes expected and returned emails with `trim().toLowerCase()`,
and separately reports sign-in failure, `getUser` failure, and identity
mismatch. Optional protected `STAGING_RLS_USER_ID_*` values add exact Auth
UUID checks; neither UUIDs nor email addresses are printed by diagnostics.

The 9 November rerun supersedes the 8 November missing-environment attempt for
the six primary identities. It verified the configured synthetic email for
Landlord A, Landlord B, Manager A, Property Caretaker A, Tenant A, and Tenant B
through the live staging Auth endpoint. Optional exact UUID assertions were
not configured, so this evidence is email-identity plus authenticated-user
verification rather than an operator-supplied UUID comparison.

## Staging Storage and Realtime rollout checklist

This remains a preparation package only. The rollback-only rehearsal completed
successfully on 9 November 2026 and left no bucket, object, Storage policy,
publication, or schema change. The rehearsal SQL is
[`docs/reviews/staging-storage-deploy.sql`](reviews/staging-storage-deploy.sql)
and deliberately ends in `ROLLBACK`. The separate persistent, approval-only
package is
[`docs/reviews/staging-storage-apply.sql`](reviews/staging-storage-apply.sql)
and ends in `COMMIT`; it must not be executed before approval.
It targets only `mcclctunrpyhumubpeyo`, configures a private
`property-images` bucket with a 5 MiB limit and JPEG/PNG/WebP/GIF MIME
allowlist, creates no client Storage policies because uploads and reads are
server-mediated. Only the rehearsal ends with `ROLLBACK`; the apply file ends
with `COMMIT` and remains prohibited until the approval gate is granted.

### Authorization boundary and known risk

The server-authorized upload path is
`<auth-user-uuid>/<property-id>/<random-uuid>.<extension>`. The private bucket
has no client Storage policies. The API therefore proves:

- the caller is authenticated and authorized for the target property;
- the generated path binds the object to the authenticated user and property;
- signed reads are issued only after property visibility checks; and
- failed attachment cleanup removes a newly uploaded object.

Storage never queries the default-deny `public.properties` table and does not
grant direct object SELECT/INSERT/UPDATE/DELETE. The authenticated API remains
the sole property-authorization boundary; do not add broad Storage policies or
`USING (true)`.

The principal security risk requiring approval is bearer-link exposure during
the 90-second signed-URL lifetime. Signed URLs are not stored in the database,
local storage, analytics, or logs. Legacy external URLs remain public by their
existing nature and are preserved only for backward compatibility.

### Approval and deployment order

1. Confirm the isolated target by read-only connection metadata before
   opening the SQL editor: project reference
   `mcclctunrpyhumubpeyo`; production `emdahodfztpfdjkrbnqz` is prohibited.
   The SQL editor cannot reliably expose the Supabase project reference, so
   the SQL file documents this as an operator precondition. The package fails
   instead of overwriting an existing `property-images` bucket.
2. Run `npm run test:staging-storage-package`,
   `npm run test:frontend-storage-realtime`, `npm run check`, and the focused
   frontend role-boundary test.
3. The protected staging execution of `staging-storage-deploy.sql` is complete:
   it showed the expected private bucket row and zero matching policies, then
   rolled back; independent before/after queries both returned zero bucket,
   object, and matching-policy rows. Do not repeat it unless the SQL or staging
   Storage state changes. After explicit approval, execute the separately
   reviewed `staging-storage-apply.sql` unchanged. Never edit the rehearsal in
   place or run either package against production.
4. Verify configuration:

   ```sql
   SELECT id, name, public, file_size_limit, allowed_mime_types
   FROM storage.buckets WHERE id = 'property-images';

   SELECT policyname, cmd, roles, qual, with_check
   FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname LIKE 'landee_private_images_%'
   ORDER BY policyname;
   ```

   Expected results are one newly-created private bucket with `public = false`,
   `file_size_limit = 5242880`, four allowed MIME types, and zero
   `landee_private_images_*` policies. Verify that no Storage object policy
   grants client SELECT, INSERT, UPDATE, or DELETE and no unrelated Storage
   policies changed.
5. With six fresh protected staging identities, run
   `npm run staging:validate-rls:fresh`. Expected direct business-table
   results remain default-deny (`200` with zero rows or `401/403`), and the
   command must report six valid, identity-matched JWTs. Authentication
   failures and malformed requests are blockers, not passes.
6. Run browser checks against staging only: authorized API upload, missing or
   expired auth denial, cross-landlord and cross-property upload/attachment
   denial, duplicate/replacement denial, invalid MIME and over-5 MiB rejection,
   authorized tenant signed retrieval, unauthorized retrieval denial, signed
   link expiry, and direct anonymous/authenticated Storage listing/download/
   update/delete denial. Record HTTP status and sanitized visible counts; do
   not record signed URLs, tokens, or personal account data.

### Exact approval-gated Vercel order

1. Freeze the reviewed working tree in a named commit; never deploy an
   uncommitted directory.
2. Reconfirm project `prj_LqYUx67llEO5sE2nVrBUsLjynH75` and Supabase project
   `mcclctunrpyhumubpeyo`. The public Vercel Supabase URLs were independently
   classified as staging, and the Vercel browser anon key exactly matched the
   protected staging anon key. Because Vercel does not export the encrypted
   server values, an operator must confirm or explicitly rebind
   `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `DATABASE_URL` to the
   protected staging values before deployment.
3. Apply only the approved persistent bucket SQL and rerun the verification
   selects. Do not create client Storage policies or Realtime publications.
4. Build the reviewed commit under Node.js 26, create an isolated staging
   production-target deployment with `--skip-domain`, and retain the exact
   deployment URL. Do not assign `landee-staging.vercel.app` yet.
5. Use an authorized Vercel SSO session to run the private-image/API matrix on
   that exact deployment. If any security assertion fails, discard the
   candidate deployment and leave the current alias unchanged.
6. Only after the candidate passes, promote that same tested deployment to the
   `landee-staging.vercel.app` alias. Rerun a short alias smoke test. Production
   Landee projects, aliases, databases, and credentials remain prohibited.

### Realtime decision

Realtime publication changes are **not required for the security milestone**.
The existing subscriptions are cache-invalidation hints, not an authorization
path, and staging currently has an empty `supabase_realtime` publication.
Leaving it empty preserves default-deny behavior. Enabling publication for
business tables would require a separate least-privilege privacy review,
including payload exposure and cross-account isolation; do not enable all
tables. If near-real-time invalidation is later required, prefer a
server-mediated signal or publish only the minimum non-sensitive change
notifications, then run dedicated isolation tests.

### Rollback

Before any approved apply, capture the bucket row and existing
`storage.objects` policy rows. To roll back, remove only
any package-created policies (there are none), then remove the
`property-images` bucket only after confirming it contains no approved staging
objects. Do not delete
objects or alter unrelated policies. If real test objects exist, preserve
them for evidence and remove them only under an explicit staging cleanup
decision.

After hosted testing, inventory stale unreferenced candidates without deleting
them automatically:

```sql
SELECT o.name, o.created_at, o.updated_at
FROM storage.objects o
LEFT JOIN public.properties p
  ON p.image_url = 'storage:property-images:' || o.name
WHERE o.bucket_id = 'property-images'
  AND p.id IS NULL
  AND o.created_at < NOW() - INTERVAL '1 hour'
ORDER BY o.created_at;
```

The API and browser remove candidates on handled failures, and finalization
removes invalid files. A browser disappearing between direct upload and
finalization can still leave an unreferenced private object. Removal of rows
returned by this inventory requires a separate staging cleanup decision.

### Ranked operational blockers

1. **Critical:** no approved staging Storage configuration or browser
   evidence; the current upload flow cannot be validated until the isolated
   bucket/policies are approved and applied.
2. **High:** the private bucket and server-mediated signed-read flow have not
   yet been applied or exercised in hosted staging.
3. **High:** fresh Landee API access tokens and, while Deployment Protection is
   enabled, an authorized Vercel session are still needed for the hosted API
   and browser matrix. The direct Supabase RLS matrix is complete.
4. **Medium:** Realtime publication is empty, so cache invalidation events are
   not demonstrated. This is an operational limitation, not a reason to
   weaken RLS.
5. **High:** subscription enforcement, provider callback staging captures,
   cron authentication, and complete backup restoration remain unverified as
   recorded above.
6. **Medium:** failure paths remove candidate property images, but a browser
   that disappears after direct upload and before finalization can leave an
   unreferenced private object. Inventory and clean only stale, unreferenced
   staging candidates under an explicit cleanup decision; a scheduled
   scavenger is outside this rollout.

## Final staging deployment approval gate

**Current recommendation: NO-GO.** The code and preparation package are ready
for review, but the isolated bucket has not been approved or applied, the
current working tree has not been deployed, and the post-deployment hosted
matrix has not run. This is a staging-only gate; production remains excluded.

The rollback-only rehearsal is complete and requires no further approval.
Approval must explicitly authorize all four of the following, in order:

1. Confirm or rebind the encrypted Vercel server environment values to the
   protected staging Supabase/database values without printing them.
2. Execute the unchanged `staging-storage-apply.sql` persistent package against
   that same isolated project. Do not add client Storage policies or Realtime
   publication changes.
3. Freeze the reviewed working tree in a commit and create a `--skip-domain`
   candidate deployment in Vercel project `landee-staging`.
4. Run the protected API/private-image matrix against that exact candidate and
   promote it to the staging alias only if every required assertion passes.

`ENABLE_SUBSCRIPTIONS` and `VITE_ENABLE_SUBSCRIPTIONS` are a separate approval;
they must not be bundled into the Storage rollout. If deployment validation
fails, redeploy the recorded prior Vercel deployment. Remove the new bucket
only after confirming it contains no retained evidence objects and receiving
an explicit staging cleanup decision.

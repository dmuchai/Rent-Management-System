# Staging validation bootstrap

This command creates synthetic Step 3 identities and authorization fixtures only in Supabase project `mcclctunrpyhumubpeyo`. It refuses other Supabase hosts, production-looking values, and mutation unless explicitly enabled.

## Required operator setup

Use a protected shell or secret manager. Do not commit the values or place them in `VITE_*` variables.

```bash
export STAGING_SUPABASE_URL=https://mcclctunrpyhumubpeyo.supabase.co
export STAGING_SUPABASE_SERVICE_ROLE_KEY='staging-only-service-role-key'
export STAGING_DATABASE_URL='postgresql://staging-connection-string'
export STAGING_TEST_PASSWORD='staging-only-password'
export STAGING_ALLOW_MUTATION=true
npm run staging:bootstrap-validation
```

The script is idempotent and uses the `step3-` fixture prefix. It creates or updates seven synthetic Auth users, matching `public.users` profiles, two landlord portfolios, three units, two tenants, two leases, caretaker assignments, scoped memberships, and one KES 1,000 invoice. It does not copy production records, delete users, send notifications, or activate payment providers.

The generated staging users are:

| Role | Login phone |
|---|---|
| Landlord A | `0700000301` |
| Landlord B | `0700000302` |
| Tenant A | `0700000303` |
| Tenant B | `0700000304` |
| Manager A | `0700000305` |
| Property caretaker A | `0700000306` |
| Unit caretaker A | `0700000307` |

All use the operator-supplied `STAGING_TEST_PASSWORD`. The synthetic email addresses are visible in [bootstrap-staging-validation.ts](../scripts/bootstrap-staging-validation.ts).

After bootstrap, sign in at `https://landee-staging.vercel.app/login`, obtain tokens through the normal login flow, and run the hosted matrix. Never use these credentials against production.

## Fresh direct-RLS authentication

The direct client-context RLS runner signs in each synthetic user immediately
before testing through Supabase Auth's public password flow. It never uses the
service-role key, admin-generated tokens, or a persistent session. The runner
accepts either the common password used by the bootstrap or an individual
password for each identity:

```bash
export STAGING_SUPABASE_URL=https://mcclctunrpyhumubpeyo.supabase.co
export STAGING_SUPABASE_ANON_KEY='staging-anon-key-from-secret-store'
export STAGING_TEST_PASSWORD='the-password-used-for-the-step3-fixtures'
npm run staging:validate-rls:fresh
```

For separate credentials, use
`STAGING_RLS_PASSWORD_LANDLORD_A`, `STAGING_RLS_PASSWORD_LANDLORD_B`,
`STAGING_RLS_PASSWORD_MANAGER_A`, `STAGING_RLS_PASSWORD_PROPERTY_CARETAKER_A`,
`STAGING_RLS_PASSWORD_UNIT_CARETAKER_A`,
`STAGING_RLS_PASSWORD_TENANT_A`, and `STAGING_RLS_PASSWORD_TENANT_B` instead
of `STAGING_TEST_PASSWORD`. Do not set both an identity password and its
manual-token variable. If password authentication is unavailable for an
identity, provide its already-issued token in the corresponding
`STAGING_RLS_TOKEN_*` variable; the runner still performs the existing issuer,
expiry, lifetime, `/auth/v1/user`, and RLS checks. The manual-token fallback
is for protected local shells only and never writes tokens to disk.

The bootstrap creates each Auth user with both an email and a confirmed phone,
but the runner intentionally signs in by the authoritative synthetic email.
The phone values are fixture metadata, not alternate identity mappings. If an
operator has recorded the generated Auth UUIDs in a protected secret store,
the optional `STAGING_RLS_USER_ID_LANDLORD_A`, `STAGING_RLS_USER_ID_LANDLORD_B`,
`STAGING_RLS_USER_ID_MANAGER_A`, `STAGING_RLS_USER_ID_PROPERTY_CARETAKER_A`,
`STAGING_RLS_USER_ID_UNIT_CARETAKER_A`,
`STAGING_RLS_USER_ID_TENANT_A`, and `STAGING_RLS_USER_ID_TENANT_B` variables
enable an additional exact UUID check. The runner never prints those IDs.

The runner is hard-coded to the seven `step3-*` synthetic email identities,
requires the exact staging Supabase project URL, verifies each password
sign-in returns the expected email, and fails closed on missing or conflicting
configuration. It does not create users, change passwords, or alter Auth/RLS
configuration. It prints only identity labels and sanitized status lines.

## RLS scope decision

The application reads and writes business data through authenticated Express
and Vercel API handlers. The browser does not use Supabase REST queries for
properties, units, tenants, leases, invoices, payments, or memberships.
Accordingly, the direct RLS harness checks default-deny for those tables: an
authenticated client must receive no rows (HTTP 200 with an empty array, or
HTTP 401/403). This must not be confused with the separate API authorization
matrix.

The application uses a private Supabase Storage bucket for `property-images`.
The browser sends image bytes to the authenticated Express/Vercel API; it does
not require a browser Supabase Auth session. The server verifies property
management authority, validates JPEG/PNG/WebP/GIF content and the 5 MiB limit,
generates `<auth-user-uuid>/<property-id>/<random-uuid>.<extension>`, uploads
with `upsert: false`, and stores only a stable
`storage:property-images:` reference. The server generates a 90-second signed
URL only after checking property visibility. Legacy external image URLs remain
unchanged and are not sent through Storage.

The review-only package
[staging-storage-deploy.sql](reviews/staging-storage-deploy.sql) is blocked
until the isolated project is verified and explicitly approved. It creates a
private bucket and no client Storage policies; it deliberately creates no
Storage SELECT, UPDATE, or DELETE policies because reads and replacement are
server-mediated. No policy should be installed in production as part of Step 3
validation.

That file is a rehearsal and always ends in `ROLLBACK`. The separate
[staging-storage-apply.sql](reviews/staging-storage-apply.sql) file is the
persistent approval-only package and ends in `COMMIT`. Run the rehearsal first,
compare its sanitized verification rows with the expected private bucket and
zero matching policies, and execute the apply file only after explicit staging
approval. Do not edit the rehearsal's final transaction statement in place.

The browser Realtime hook listens only for `postgres_changes` and invalidates
API queries without logging row payloads. The staging publication is currently
empty; do not enable all-table publication.

## Authenticated API validation

The read and negative-role checks can be run with an access token obtained from
the normal staging login. Vercel Deployment Protection may additionally require
the SSO cookie from the same authorized browser session:

```bash
STAGING_BASE_URL=https://landee-staging.vercel.app \
STAGING_API_TOKEN='staging-access-token' \
STAGING_VERCEL_COOKIE='authorized-cookie-header-value' \
STAGING_EXPECTED_ROLE='caretaker' \
STAGING_CREATE_PROPERTY_ID='step3-property-b' \
STAGING_SIBLING_UNIT_ID='step3-unit-a2' \
npm run staging:validate-api
```

Run the command once per synthetic identity. `STAGING_CREATE_PROPERTY_ID` must
identify a valid property outside the identity's authorised portfolio (for
example `step3-property-b` for Landlord A, Manager A, and the caretakers).
The harness sends a schema-valid unit payload and requires HTTP 403; a 400 is
treated as malformed-request evidence, not authorization evidence. The request
cannot insert because the property is outside the identity's portfolio.
When `STAGING_SIBLING_UNIT_ID` is set, it sends a PATCH denial probe against
that existing fixture and requires HTTP 403; a 400 is treated as invalid
restore input, not authorization evidence. When `STAGING_EXPECTED_ROLE` is set, it checks
`/api/auth?action=user` and fails if the trusted role differs. Use
`landlord`, `property_manager`, `caretaker`, or `tenant` as the expected role.
It never prints or persists the access token or cookie. Deployment-protection
HTML or a `401` response is reported as a failed prerequisite rather than
treated as Landee API evidence.

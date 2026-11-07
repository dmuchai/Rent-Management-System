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

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

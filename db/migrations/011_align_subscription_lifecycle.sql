-- Bring already-migrated installations in line with the final subscription
-- lifecycle. This migration is intentionally additive and safe to re-run.

alter table public.billing_accounts
  add column if not exists transition_ends_at timestamptz;

alter table public.properties
  add column if not exists archived_at timestamptz;

create index if not exists idx_properties_archived_at
  on public.properties(archived_at);

-- Provision trusted billing identities for landlords that existed before the
-- rollout. The transition end is controlled at deploy time by replacing the
-- value below or by setting SUBSCRIPTION_TRANSITION_END_AT for on-demand rows.
-- Existing installations may choose a later date before applying the migration.
insert into public.billing_accounts (
  owner_user_id,
  revenuecat_app_user_id,
  plan_code,
  subscription_status,
  transition_ends_at
)
select
  u.id,
  u.id::text,
  'free',
  'free',
  now() + interval '30 days'
from public.users u
where u.role in ('landlord', 'property_manager')
on conflict (owner_user_id) do nothing;

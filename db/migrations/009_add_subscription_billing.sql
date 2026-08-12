create extension if not exists pgcrypto;

create table if not exists public.billing_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  -- public.users.id is varchar in the existing Landee schema. Foreign-key
  -- columns must use the same PostgreSQL type (Supabase Auth UUIDs are stored
  -- as their string representation in this application table).
  owner_user_id varchar not null references public.users(id) on delete cascade,
  revenuecat_app_user_id text not null,
  plan_code text not null default 'free' check (plan_code in ('free', 'bronze', 'silver', 'gold', 'enterprise')),
  subscription_status text not null default 'free' check (subscription_status in ('free', 'trialing', 'active', 'grace_period', 'billing_retry', 'paused', 'expired', 'cancelled', 'unknown')),
  product_id text,
  base_plan_id text,
  store text not null default 'google_play',
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  grace_period_ends_at timestamptz,
  transition_ends_at timestamptz,
  will_renew boolean not null default false,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_accounts_owner_unique unique (owner_user_id),
  constraint billing_accounts_revenuecat_unique unique (revenuecat_app_user_id)
);

create index if not exists idx_billing_accounts_owner_user_id on public.billing_accounts(owner_user_id);
create index if not exists idx_billing_accounts_plan_code on public.billing_accounts(plan_code);
create index if not exists idx_billing_accounts_status on public.billing_accounts(subscription_status);
create index if not exists idx_billing_accounts_last_event_at on public.billing_accounts(last_event_at desc);

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  revenuecat_event_id text not null unique,
  event_type text not null,
  app_user_id text not null,
  billing_account_id uuid references public.billing_accounts(id) on delete cascade,
  event_timestamp timestamptz not null,
  raw_payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_subscription_events_billing_account_id on public.subscription_events(billing_account_id);
create index if not exists idx_subscription_events_event_timestamp on public.subscription_events(event_timestamp desc);
create index if not exists idx_subscription_events_event_type on public.subscription_events(event_type);

alter table public.units
  add column if not exists archived_at timestamptz;

alter table public.properties
  add column if not exists archived_at timestamptz;

create index if not exists idx_units_archived_at on public.units(archived_at);
create index if not exists idx_properties_archived_at on public.properties(archived_at);

alter table public.billing_accounts enable row level security;
alter table public.subscription_events enable row level security;

drop policy if exists billing_accounts_select_own on public.billing_accounts;
create policy billing_accounts_select_own
on public.billing_accounts
for select
to authenticated
using (
  owner_user_id = auth.uid()::text
);

drop policy if exists billing_accounts_write_service_role on public.billing_accounts;
create policy billing_accounts_write_service_role
on public.billing_accounts
for all
to authenticated
using (false)
with check (false);

drop policy if exists subscription_events_select_own on public.subscription_events;
create policy subscription_events_select_own
on public.subscription_events
for select
to authenticated
using (
  exists (
    select 1
    from public.billing_accounts billing_accounts
    where billing_accounts.id = subscription_events.billing_account_id
      and billing_accounts.owner_user_id = auth.uid()::text
  )
);

drop policy if exists subscription_events_write_service_role on public.subscription_events;
create policy subscription_events_write_service_role
on public.subscription_events
for all
to authenticated
using (false)
with check (false);

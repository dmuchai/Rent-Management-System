DO $$
BEGIN
  CREATE TYPE lease_status AS ENUM (
    'draft',
    'pending_landlord_signature',
    'pending_tenant_signature',
    'active',
    'rejected',
    'cancelled',
    'expired'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS status lease_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS landlord_signed_at timestamp,
  ADD COLUMN IF NOT EXISTS tenant_signed_at timestamp,
  ADD COLUMN IF NOT EXISTS landlord_signed_by varchar REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS tenant_signed_by varchar REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS created_by varchar REFERENCES public.users(id);

UPDATE public.leases
SET status = CASE
  WHEN is_active = true AND end_date >= NOW() THEN 'active'::lease_status
  WHEN end_date < NOW() THEN 'expired'::lease_status
  ELSE 'cancelled'::lease_status
END;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by VARCHAR REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamp,
  ADD COLUMN IF NOT EXISTS assigned_unit_id VARCHAR REFERENCES public.units(id),
  ADD COLUMN IF NOT EXISTS assigned_start_date timestamp,
  ADD COLUMN IF NOT EXISTS assigned_end_date timestamp,
  ADD COLUMN IF NOT EXISTS assigned_monthly_rent decimal(10, 2),
  ADD COLUMN IF NOT EXISTS assigned_security_deposit decimal(10, 2),
  ADD COLUMN IF NOT EXISTS assigned_at timestamp,
  ADD COLUMN IF NOT EXISTS assigned_by VARCHAR REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS idx_tenants_assigned_unit_id ON public.tenants(assigned_unit_id);

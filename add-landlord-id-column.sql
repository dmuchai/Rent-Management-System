-- Add landlord_id column to tenants table to track ownership
-- This separates landlord ownership from tenant's user account

-- Add the column (nullable initially)
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS landlord_id VARCHAR REFERENCES public.users(id);

-- Migrate existing data: set landlord_id from user_id for invited/pending tenants
UPDATE public.tenants
SET landlord_id = user_id
WHERE account_status IN ('pending_invitation', 'invited')
AND user_id IS NOT NULL;

-- Set landlord_id for active tenants by finding through leases->units->properties
UPDATE public.tenants t
SET landlord_id = subquery.owner_id
FROM (
  SELECT DISTINCT l.tenant_id, p.owner_id
  FROM public.leases l
  JOIN public.units u ON l.unit_id = u.id
  JOIN public.properties p ON u.property_id = p.id
) AS subquery
WHERE t.id = subquery.tenant_id
AND t.account_status = 'active'
AND t.landlord_id IS NULL;

-- Now set user_id to NULL for pending/invited tenants (they haven't accepted yet)
UPDATE public.tenants
SET user_id = NULL
WHERE account_status IN ('pending_invitation', 'invited');

-- Check for any tenants still without landlord_id and delete them (orphaned records)
-- These would be tenants created without proper landlord association
DELETE FROM public.tenants
WHERE landlord_id IS NULL;

-- Make landlord_id NOT NULL after data migration
ALTER TABLE public.tenants 
ALTER COLUMN landlord_id SET NOT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_tenants_landlord_id ON public.tenants(landlord_id);

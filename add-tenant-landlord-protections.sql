-- Database-level protections for tenants.landlord_id integrity
-- Ensures landlord_id remains consistent with property ownership

-- 1. Function to sync landlord_id when lease is created/updated
CREATE OR REPLACE FUNCTION sync_tenant_landlord_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Update tenant's landlord_id to match property owner when lease is created/updated
  UPDATE public.tenants t
  SET landlord_id = p.owner_id
  FROM public.units u
  JOIN public.properties p ON u.property_id = p.id
  WHERE t.id = NEW.tenant_id
  AND u.id = NEW.unit_id
  AND t.landlord_id IS DISTINCT FROM p.owner_id; -- Only update if different
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger on leases table to sync landlord_id
DROP TRIGGER IF EXISTS trigger_sync_tenant_landlord ON public.leases;
CREATE TRIGGER trigger_sync_tenant_landlord
  AFTER INSERT OR UPDATE OF unit_id ON public.leases
  FOR EACH ROW
  EXECUTE FUNCTION sync_tenant_landlord_id();

-- 3. Function to validate landlord_id matches property ownership (for tenants with leases)
CREATE OR REPLACE FUNCTION validate_tenant_landlord_id()
RETURNS TRIGGER AS $$
DECLARE
  property_owner_id VARCHAR;
BEGIN
  -- If tenant has an active lease, verify landlord_id matches property owner
  SELECT p.owner_id INTO property_owner_id
  FROM public.leases l
  JOIN public.units u ON l.unit_id = u.id
  JOIN public.properties p ON u.property_id = p.id
  WHERE l.tenant_id = NEW.id
  AND l.is_active = true
  LIMIT 1;
  
  -- If tenant has active lease, landlord_id MUST match property owner
  IF property_owner_id IS NOT NULL AND NEW.landlord_id != property_owner_id THEN
    RAISE EXCEPTION 'landlord_id must match property owner for tenants with active leases. Expected: %, Got: %', 
      property_owner_id, NEW.landlord_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger to prevent invalid landlord_id updates
DROP TRIGGER IF EXISTS trigger_validate_tenant_landlord ON public.tenants;
CREATE TRIGGER trigger_validate_tenant_landlord
  BEFORE UPDATE OF landlord_id ON public.tenants
  FOR EACH ROW
  WHEN (OLD.landlord_id IS DISTINCT FROM NEW.landlord_id)
  EXECUTE FUNCTION validate_tenant_landlord_id();

-- 5. Function to sync landlord_id when property ownership changes
CREATE OR REPLACE FUNCTION sync_tenants_on_property_transfer()
RETURNS TRIGGER AS $$
BEGIN
  -- When property owner changes, update all associated tenant landlord_ids
  UPDATE public.tenants t
  SET landlord_id = NEW.owner_id
  FROM public.leases l
  JOIN public.units u ON l.unit_id = u.id
  WHERE u.property_id = NEW.id
  AND t.id = l.tenant_id
  AND t.landlord_id != NEW.owner_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger on properties table for ownership transfers
DROP TRIGGER IF EXISTS trigger_sync_tenants_on_transfer ON public.properties;
CREATE TRIGGER trigger_sync_tenants_on_transfer
  AFTER UPDATE OF owner_id ON public.properties
  FOR EACH ROW
  WHEN (OLD.owner_id IS DISTINCT FROM NEW.owner_id)
  EXECUTE FUNCTION sync_tenants_on_property_transfer();

-- 7. Add check constraint (commented out - may be too restrictive for new tenant creation)
-- ALTER TABLE public.tenants
-- ADD CONSTRAINT check_landlord_exists 
-- CHECK (landlord_id IN (SELECT id FROM public.users WHERE role = 'landlord'));

-- 8. Ensure index exists for performance
CREATE INDEX IF NOT EXISTS idx_tenants_landlord_id ON public.tenants(landlord_id);
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id ON public.leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_units_property_id ON public.units(property_id);

-- 9. Add helpful comment to landlord_id column
COMMENT ON COLUMN public.tenants.landlord_id IS 
'Denormalized landlord ID for performance. Auto-synced via triggers when lease/property ownership changes. Source of truth is properties.owner_id through lease chain.';

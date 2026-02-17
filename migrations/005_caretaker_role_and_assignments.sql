-- Migration: Caretaker role + assignments + audit fields
-- Created: 2026-02-16
-- Description: Adds caretaker support, assignment scoping, and onboarding/maintenance audit fields

-- 1) Users: track creator (landlord) and status
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended'));

CREATE INDEX IF NOT EXISTS idx_users_created_by ON public.users(created_by);

-- 2) Caretaker assignments (scope by property or unit)
CREATE TABLE IF NOT EXISTS caretaker_assignments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  caretaker_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  landlord_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id VARCHAR REFERENCES properties(id) ON DELETE CASCADE,
  unit_id VARCHAR REFERENCES units(id) ON DELETE CASCADE,
  status VARCHAR DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE caretaker_assignments
ADD CONSTRAINT caretaker_assignments_scope_check
CHECK (property_id IS NOT NULL OR unit_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_caretaker_assignments_caretaker ON caretaker_assignments(caretaker_id);
CREATE INDEX IF NOT EXISTS idx_caretaker_assignments_landlord ON caretaker_assignments(landlord_id);
CREATE INDEX IF NOT EXISTS idx_caretaker_assignments_property ON caretaker_assignments(property_id);
CREATE INDEX IF NOT EXISTS idx_caretaker_assignments_unit ON caretaker_assignments(unit_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_caretaker_assignments_active_property
ON caretaker_assignments(caretaker_id, landlord_id, property_id)
WHERE status = 'active' AND property_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_caretaker_assignments_active_unit
ON caretaker_assignments(caretaker_id, landlord_id, unit_id)
WHERE status = 'active' AND unit_id IS NOT NULL;

CREATE OR REPLACE FUNCTION set_caretaker_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS caretaker_assignments_set_updated_at ON caretaker_assignments;
CREATE TRIGGER caretaker_assignments_set_updated_at
BEFORE UPDATE ON caretaker_assignments
FOR EACH ROW
EXECUTE FUNCTION set_caretaker_assignments_updated_at();

-- 3) Tenants: track creator and approval
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approval_status VARCHAR DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_tenants_created_by ON tenants(created_by);
CREATE INDEX IF NOT EXISTS idx_tenants_approval_status ON tenants(approval_status);

-- 4) Maintenance: track actor + optional approval
ALTER TABLE public.maintenance_requests
ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS closed_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approval_status VARCHAR DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_maintenance_created_by ON maintenance_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_maintenance_approval_status ON maintenance_requests(approval_status);

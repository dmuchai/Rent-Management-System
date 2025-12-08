-- Fix Existing Database Schema - Add Missing Columns and Constraints
-- Run this script in Supabase SQL Editor

-- Step 1: Add missing columns to existing tables

-- Add owner_id to properties table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'properties' AND column_name = 'owner_id'
    ) THEN
        ALTER TABLE properties ADD COLUMN owner_id VARCHAR;
    END IF;
END $$;

-- Add owner_id to tenants table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenants' AND column_name = 'owner_id'
    ) THEN
        ALTER TABLE tenants ADD COLUMN owner_id VARCHAR;
    END IF;
END $$;

-- Add created_at to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;

-- Add updated_at to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;

-- Step 2: Update existing data to set owner_id to a valid user
-- (This assumes you want to assign all existing properties/tenants to the first user)
DO $$
DECLARE
    first_user_id VARCHAR;
BEGIN
    -- Get the first user's ID
    SELECT id INTO first_user_id FROM users ORDER BY email LIMIT 1;
    
    IF first_user_id IS NOT NULL THEN
        -- Update properties without owner_id
        UPDATE properties SET owner_id = first_user_id WHERE owner_id IS NULL;
        
        -- Update tenants without owner_id
        UPDATE tenants SET owner_id = first_user_id WHERE owner_id IS NULL;
    END IF;
END $$;

-- Step 3: Make owner_id NOT NULL and add foreign key constraints

-- Properties table
DO $$ 
BEGIN
    -- Make owner_id NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'properties' 
        AND column_name = 'owner_id' 
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE properties ALTER COLUMN owner_id SET NOT NULL;
    END IF;
    
    -- Add foreign key constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'properties_owner_id_fkey'
    ) THEN
        ALTER TABLE properties 
        ADD CONSTRAINT properties_owner_id_fkey 
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Tenants table
DO $$ 
BEGIN
    -- Add foreign key constraint if it doesn't exist (owner_id can be NULL)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'tenants_owner_id_fkey'
    ) THEN
        ALTER TABLE tenants 
        ADD CONSTRAINT tenants_owner_id_fkey 
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add user_id foreign key if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'tenants_user_id_fkey'
    ) THEN
        ALTER TABLE tenants 
        ADD CONSTRAINT tenants_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Units table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'units_property_id_fkey'
    ) THEN
        ALTER TABLE units 
        ADD CONSTRAINT units_property_id_fkey 
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Leases table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'leases_tenant_id_fkey'
    ) THEN
        ALTER TABLE leases 
        ADD CONSTRAINT leases_tenant_id_fkey 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'leases_unit_id_fkey'
    ) THEN
        ALTER TABLE leases 
        ADD CONSTRAINT leases_unit_id_fkey 
        FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Payments table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payments_lease_id_fkey'
    ) THEN
        ALTER TABLE payments 
        ADD CONSTRAINT payments_lease_id_fkey 
        FOREIGN KEY (lease_id) REFERENCES leases(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Maintenance requests table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'maintenance_requests_unit_id_fkey'
    ) THEN
        ALTER TABLE maintenance_requests 
        ADD CONSTRAINT maintenance_requests_unit_id_fkey 
        FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'maintenance_requests_tenant_id_fkey'
    ) THEN
        ALTER TABLE maintenance_requests 
        ADD CONSTRAINT maintenance_requests_tenant_id_fkey 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Documents table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'documents_property_id_fkey'
    ) THEN
        ALTER TABLE documents 
        ADD CONSTRAINT documents_property_id_fkey 
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'documents_unit_id_fkey'
    ) THEN
        ALTER TABLE documents 
        ADD CONSTRAINT documents_unit_id_fkey 
        FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'documents_lease_id_fkey'
    ) THEN
        ALTER TABLE documents 
        ADD CONSTRAINT documents_lease_id_fkey 
        FOREIGN KEY (lease_id) REFERENCES leases(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_units_property_id ON units(property_id);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_id ON tenants(owner_id);
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id ON leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_unit_id ON leases(unit_id);
CREATE INDEX IF NOT EXISTS idx_payments_lease_id ON payments(lease_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_unit_id ON maintenance_requests(unit_id);
CREATE INDEX IF NOT EXISTS idx_documents_property_id ON documents(property_id);

-- Step 5: Verify the schema
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name IN ('users', 'properties', 'tenants')
    AND column_name IN ('id', 'owner_id', 'email', 'created_at', 'updated_at')
ORDER BY table_name, ordinal_position;

-- Show all foreign key constraints
SELECT
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- Success message
SELECT 'Schema migration completed successfully! All missing columns and foreign keys added.' as result;

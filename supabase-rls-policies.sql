-- Row Level Security Policies for Rent Management System
-- Run this AFTER the basic schema is created successfully

-- Enable Row Level Security
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Add foreign key constraints
ALTER TABLE properties ADD CONSTRAINT fk_properties_owner_id FOREIGN KEY (owner_id) REFERENCES users(id);
ALTER TABLE units ADD CONSTRAINT fk_units_property_id FOREIGN KEY (property_id) REFERENCES properties(id);
ALTER TABLE tenants ADD CONSTRAINT fk_tenants_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE leases ADD CONSTRAINT fk_leases_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE leases ADD CONSTRAINT fk_leases_unit_id FOREIGN KEY (unit_id) REFERENCES units(id);
ALTER TABLE payments ADD CONSTRAINT fk_payments_lease_id FOREIGN KEY (lease_id) REFERENCES leases(id);
ALTER TABLE maintenance_requests ADD CONSTRAINT fk_maintenance_requests_unit_id FOREIGN KEY (unit_id) REFERENCES units(id);
ALTER TABLE maintenance_requests ADD CONSTRAINT fk_maintenance_requests_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE documents ADD CONSTRAINT fk_documents_property_id FOREIGN KEY (property_id) REFERENCES properties(id);
ALTER TABLE documents ADD CONSTRAINT fk_documents_unit_id FOREIGN KEY (unit_id) REFERENCES units(id);
ALTER TABLE documents ADD CONSTRAINT fk_documents_lease_id FOREIGN KEY (lease_id) REFERENCES leases(id);
ALTER TABLE documents ADD CONSTRAINT fk_documents_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id);

-- Create RLS Policies for Properties
DROP POLICY IF EXISTS "Users can view their own properties" ON properties;
CREATE POLICY "Users can view their own properties" ON properties 
FOR SELECT USING (owner_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can insert their own properties" ON properties;
CREATE POLICY "Users can insert their own properties" ON properties 
FOR INSERT WITH CHECK (owner_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update their own properties" ON properties;
CREATE POLICY "Users can update their own properties" ON properties 
FOR UPDATE USING (owner_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete their own properties" ON properties;
CREATE POLICY "Users can delete their own properties" ON properties 
FOR DELETE USING (owner_id = auth.uid()::text);

-- Create RLS Policies for Units
DROP POLICY IF EXISTS "Users can view units of their properties" ON units;
CREATE POLICY "Users can view units of their properties" ON units 
FOR SELECT USING (
    property_id IN (
        SELECT id FROM properties WHERE owner_id = auth.uid()::text
    )
);

DROP POLICY IF EXISTS "Users can insert units to their properties" ON units;
CREATE POLICY "Users can insert units to their properties" ON units 
FOR INSERT WITH CHECK (
    property_id IN (
        SELECT id FROM properties WHERE owner_id = auth.uid()::text
    )
);

DROP POLICY IF EXISTS "Users can update units of their properties" ON units;
CREATE POLICY "Users can update units of their properties" ON units 
FOR UPDATE USING (
    property_id IN (
        SELECT id FROM properties WHERE owner_id = auth.uid()::text
    )
);

DROP POLICY IF EXISTS "Users can delete units of their properties" ON units;
CREATE POLICY "Users can delete units of their properties" ON units 
FOR DELETE USING (
    property_id IN (
        SELECT id FROM properties WHERE owner_id = auth.uid()::text
    )
);

-- Create RLS Policies for Tenants
DROP POLICY IF EXISTS "Landlords can view their tenants" ON tenants;
CREATE POLICY "Landlords can view their tenants" ON tenants 
FOR SELECT USING (
    id IN (
        SELECT l.tenant_id FROM leases l
        JOIN units u ON l.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
        WHERE p.owner_id = auth.uid()::text
    ) OR user_id = auth.uid()::text
);

-- Create RLS Policies for Documents
DROP POLICY IF EXISTS "Users can view their documents" ON documents;
CREATE POLICY "Users can view their documents" ON documents 
FOR SELECT USING (
    property_id IN (
        SELECT id FROM properties WHERE owner_id = auth.uid()::text
    ) OR uploaded_by = auth.uid()::text
);
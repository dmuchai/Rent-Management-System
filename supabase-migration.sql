-- Rent Management System Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
CREATE TYPE maintenance_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Session storage table (for authentication)
CREATE TABLE IF NOT EXISTS sessions (
    sid VARCHAR PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions(expire);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email VARCHAR UNIQUE,
    first_name VARCHAR,
    last_name VARCHAR,
    profile_image_url VARCHAR,
    role VARCHAR NOT NULL DEFAULT 'landlord',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR NOT NULL,
    address TEXT NOT NULL,
    property_type VARCHAR NOT NULL,
    total_units INTEGER NOT NULL,
    description TEXT,
    image_url VARCHAR,
    owner_id VARCHAR NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Units table
CREATE TABLE IF NOT EXISTS units (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    property_id VARCHAR NOT NULL REFERENCES properties(id),
    unit_number VARCHAR NOT NULL,
    bedrooms INTEGER,
    bathrooms INTEGER,
    size DECIMAL,
    rent_amount DECIMAL(10,2) NOT NULL,
    is_occupied BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR REFERENCES users(id),
    first_name VARCHAR NOT NULL,
    last_name VARCHAR NOT NULL,
    email VARCHAR NOT NULL,
    phone VARCHAR NOT NULL,
    emergency_contact VARCHAR,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Leases table
CREATE TABLE IF NOT EXISTS leases (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id VARCHAR NOT NULL REFERENCES tenants(id),
    unit_id VARCHAR NOT NULL REFERENCES units(id),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    monthly_rent DECIMAL(10,2) NOT NULL,
    security_deposit DECIMAL(10,2),
    lease_document_url VARCHAR,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    lease_id VARCHAR NOT NULL REFERENCES leases(id),
    amount DECIMAL(10,2) NOT NULL,
    due_date TIMESTAMP NOT NULL,
    paid_date TIMESTAMP,
    status payment_status DEFAULT 'pending',
    payment_method VARCHAR,
    transaction_id VARCHAR,
    notes TEXT,
    late_fee DECIMAL(10,2) DEFAULT 0,
    receipt_url VARCHAR,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Maintenance requests table
CREATE TABLE IF NOT EXISTS maintenance_requests (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    unit_id VARCHAR NOT NULL REFERENCES units(id),
    tenant_id VARCHAR REFERENCES tenants(id),
    title VARCHAR NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR DEFAULT 'medium',
    status maintenance_status DEFAULT 'pending',
    assigned_to VARCHAR,
    estimated_cost DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    completion_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    property_id VARCHAR REFERENCES properties(id),
    unit_id VARCHAR REFERENCES units(id),
    lease_id VARCHAR REFERENCES leases(id),
    name VARCHAR NOT NULL,
    type VARCHAR NOT NULL,
    file_url VARCHAR NOT NULL,
    file_size INTEGER,
    uploaded_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for Properties
CREATE POLICY "Users can view their own properties" ON properties 
FOR SELECT USING (owner_id = auth.uid()::text);

CREATE POLICY "Users can insert their own properties" ON properties 
FOR INSERT WITH CHECK (owner_id = auth.uid()::text);

CREATE POLICY "Users can update their own properties" ON properties 
FOR UPDATE USING (owner_id = auth.uid()::text);

CREATE POLICY "Users can delete their own properties" ON properties 
FOR DELETE USING (owner_id = auth.uid()::text);

-- Create RLS Policies for Units
CREATE POLICY "Users can view units of their properties" ON units 
FOR SELECT USING (
    property_id IN (
        SELECT id FROM properties WHERE owner_id = auth.uid()::text
    )
);

CREATE POLICY "Users can insert units to their properties" ON units 
FOR INSERT WITH CHECK (
    property_id IN (
        SELECT id FROM properties WHERE owner_id = auth.uid()::text
    )
);

CREATE POLICY "Users can update units of their properties" ON units 
FOR UPDATE USING (
    property_id IN (
        SELECT id FROM properties WHERE owner_id = auth.uid()::text
    )
);

CREATE POLICY "Users can delete units of their properties" ON units 
FOR DELETE USING (
    property_id IN (
        SELECT id FROM properties WHERE owner_id = auth.uid()::text
    )
);

-- Create RLS Policies for Tenants (landlords can see tenants in their properties)
CREATE POLICY "Landlords can view their tenants" ON tenants 
FOR SELECT USING (
    id IN (
        SELECT l.tenant_id FROM leases l
        JOIN units u ON l.unit_id = u.id
        JOIN properties p ON u.property_id = p.id
        WHERE p.owner_id = auth.uid()::text
    ) OR user_id = auth.uid()::text
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_units_property_id ON units(property_id);
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id ON leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_unit_id ON leases(unit_id);
CREATE INDEX IF NOT EXISTS idx_payments_lease_id ON payments(lease_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_unit_id ON maintenance_requests(unit_id);
CREATE INDEX IF NOT EXISTS idx_documents_property_id ON documents(property_id);

-- Create Storage Buckets (run in Storage section or via SQL)
INSERT INTO storage.buckets (id, name, public) VALUES 
('property-images', 'property-images', true),
('documents', 'documents', false),
('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
CREATE POLICY "Users can upload property images" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'property-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public property images" ON storage.objects 
FOR SELECT USING (bucket_id = 'property-images');
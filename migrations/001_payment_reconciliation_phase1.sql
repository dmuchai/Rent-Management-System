-- Payment Reconciliation System - Phase 1 Migration
-- Add new tables for landlord payment channels, invoices, and external payment events

-- Create invoice_status enum
DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM (
        'pending',
        'partially_paid',
        'paid',
        'overdue',
        'cancelled',
        'disputed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Landlord Payment Channels table
CREATE TABLE IF NOT EXISTS landlord_payment_channels (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    landlord_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_type VARCHAR NOT NULL, -- 'mpesa_paybill', 'mpesa_till', 'bank_account'
    
    -- M-Pesa specific
    paybill_number VARCHAR,
    till_number VARCHAR,
    
    -- Bank specific
    bank_name VARCHAR,
    account_number VARCHAR,
    account_name VARCHAR,
    
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    display_name VARCHAR,
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Unique constraint on paybill per landlord
CREATE UNIQUE INDEX IF NOT EXISTS idx_landlord_paybill_unique 
    ON landlord_payment_channels(landlord_id, paybill_number) 
    WHERE paybill_number IS NOT NULL;

-- Unique constraint on till per landlord  
CREATE UNIQUE INDEX IF NOT EXISTS idx_landlord_till_unique 
    ON landlord_payment_channels(landlord_id, till_number) 
    WHERE till_number IS NOT NULL;

-- Index for faster lookups by paybill
CREATE INDEX IF NOT EXISTS idx_payment_channels_paybill 
    ON landlord_payment_channels(paybill_number) 
    WHERE paybill_number IS NOT NULL;

-- Enforce only one primary channel per landlord
CREATE UNIQUE INDEX IF NOT EXISTS idx_landlord_primary_channel_unique
    ON landlord_payment_channels(landlord_id)
    WHERE is_primary = true;

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    
    -- Core fields (nullable to preserve invoice history when entities are deleted)
    lease_id VARCHAR REFERENCES leases(id) ON DELETE SET NULL,
    landlord_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
    tenant_id VARCHAR REFERENCES tenants(id) ON DELETE SET NULL,
    
    -- Financial
    amount DECIMAL(10, 2) NOT NULL,
    amount_paid DECIMAL(10, 2) DEFAULT 0,
    currency VARCHAR DEFAULT 'KES',
    
    -- Timing
    billing_period_start TIMESTAMP NOT NULL,
    billing_period_end TIMESTAMP NOT NULL,
    due_date TIMESTAMP NOT NULL,
    
    -- Reference for payment matching
    reference_code VARCHAR UNIQUE NOT NULL,
    
    -- Type and description
    invoice_type VARCHAR DEFAULT 'rent',
    description TEXT,
    
    -- Status
    status invoice_status DEFAULT 'pending',
    
    -- Audit
    issued_at TIMESTAMP DEFAULT NOW(),
    paid_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_landlord ON invoices(landlord_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_lease ON invoices(lease_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_reference ON invoices(reference_code);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- External Payment Events table
CREATE TABLE IF NOT EXISTS external_payment_events (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    
    -- Source
    event_type VARCHAR NOT NULL,
    provider VARCHAR NOT NULL,
    
    -- Who received money
    landlord_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
    payment_channel_id VARCHAR REFERENCES landlord_payment_channels(id) ON DELETE SET NULL,
    
    -- Transaction details
    external_transaction_id VARCHAR NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR DEFAULT 'KES',
    
    -- Payer details
    payer_phone VARCHAR,
    payer_name VARCHAR,
    payer_account_ref VARCHAR,
    
    -- Timing
    transaction_time TIMESTAMP NOT NULL,
    
    -- Raw data
    raw_payload JSONB NOT NULL,
    
    -- Reconciliation status
    reconciliation_status VARCHAR DEFAULT 'unmatched',
    
    -- Idempotency
    is_verified BOOLEAN DEFAULT false,
    is_duplicate BOOLEAN DEFAULT false,
    
    -- Audit
    received_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Unique constraint to prevent duplicate processing
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_payment_events_txid 
    ON external_payment_events(provider, external_transaction_id);

-- Indexes for external payment events
CREATE INDEX IF NOT EXISTS idx_external_events_landlord ON external_payment_events(landlord_id);
CREATE INDEX IF NOT EXISTS idx_external_events_channel ON external_payment_events(payment_channel_id);
CREATE INDEX IF NOT EXISTS idx_external_events_status ON external_payment_events(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_external_events_time ON external_payment_events(transaction_time);
CREATE INDEX IF NOT EXISTS idx_external_events_ref ON external_payment_events(payer_account_ref);

-- Add optional columns to existing payments table for linking
-- (This is for backward compatibility and gradual migration)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_id VARCHAR REFERENCES invoices(id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Payment Reconciliation System - Phase 1 migration completed successfully';
    RAISE NOTICE 'NOTE: Invoice foreign keys use ON DELETE SET NULL to preserve invoice history';
    RAISE NOTICE 'Application code must handle nullable lease_id, landlord_id, and tenant_id';
END $$;

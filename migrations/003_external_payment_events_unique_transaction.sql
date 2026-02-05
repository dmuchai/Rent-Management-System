-- Migration 003: Ensure unique constraint on external_payment_events
-- Note: The schema already defines unique(provider, external_transaction_id)
-- This migration verifies the constraint exists

-- The constraint should already exist from the schema definition:
-- unique("uq_external_payment_events_provider_txn").on(table.provider, table.externalTransactionId)

-- Verify constraint exists (idempotent - won't fail if already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE c.conname = 'uq_external_payment_events_provider_txn'
          AND n.nspname = 'public'
    ) THEN
        -- Create the constraint if missing
        ALTER TABLE public.external_payment_events
        ADD CONSTRAINT uq_external_payment_events_provider_txn 
        UNIQUE (provider, external_transaction_id);
        
        RAISE NOTICE 'Created unique constraint on (provider, external_transaction_id)';
    ELSE
        RAISE NOTICE 'Unique constraint already exists - no action needed';
    END IF;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 003: Transaction uniqueness verified successfully';
    RAISE NOTICE 'Webhook handlers can now safely use ON CONFLICT for idempotent inserts';
END $$;

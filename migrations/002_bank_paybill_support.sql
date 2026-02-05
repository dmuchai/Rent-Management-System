-- Migration 002: M-Pesa to Bank Paybill Support
-- Adds support for landlords using bank paybills (e.g., Family Bank 222111) with their account numbers

-- Add new columns for M-Pesa to Bank flow
ALTER TABLE landlord_payment_channels
  ADD COLUMN IF NOT EXISTS bank_paybill_number VARCHAR,
  ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR;

-- Unique constraint: one bank account per landlord
-- Prevents duplicate registration of same bank account
CREATE UNIQUE INDEX IF NOT EXISTS idx_landlord_bank_account_unique
  ON landlord_payment_channels(landlord_id, bank_account_number)
  WHERE bank_account_number IS NOT NULL;

-- Index for faster lookup by bank paybill + account (webhook matching)
CREATE INDEX IF NOT EXISTS idx_bank_paybill_account
  ON landlord_payment_channels(bank_paybill_number, bank_account_number)
  WHERE bank_paybill_number IS NOT NULL AND bank_account_number IS NOT NULL;

-- Index for bank account lookups
CREATE INDEX IF NOT EXISTS idx_bank_account_number
  ON landlord_payment_channels(bank_account_number)
  WHERE bank_account_number IS NOT NULL;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 002: Bank Paybill Support completed successfully';
    RAISE NOTICE 'New columns: bank_paybill_number, bank_account_number';
    RAISE NOTICE 'Landlords can now register bank paybills (e.g., Family Bank 222111) with their account numbers';
END $$;

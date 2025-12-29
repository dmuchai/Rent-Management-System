-- Migration: Add payment_type column to payments table
-- Date: 2025-12-29

-- Step 1: Create payment_type enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE payment_type AS ENUM ('rent', 'deposit', 'utility', 'maintenance', 'late_fee', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add payment_type column to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS payment_type payment_type DEFAULT 'rent';

-- Step 3: Update existing records (optional - set a default value)
UPDATE public.payments 
SET payment_type = 'rent' 
WHERE payment_type IS NULL;

-- Step 4: Add comment for documentation
COMMENT ON COLUMN public.payments.payment_type IS 'Type of payment: rent, deposit, utility, maintenance, late_fee, or other';

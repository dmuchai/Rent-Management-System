-- Remove owner_id column from tenants table
-- This field should not exist - tenants use landlord_id instead

-- First, check if the column exists (safe for re-running)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tenants' 
    AND column_name = 'owner_id'
  ) THEN
    -- Drop the owner_id column
    ALTER TABLE public.tenants DROP COLUMN owner_id;
    RAISE NOTICE 'owner_id column dropped from tenants table';
  ELSE
    RAISE NOTICE 'owner_id column does not exist in tenants table - nothing to do';
  END IF;
END $$;

-- Verify the tenants table structure
-- Expected columns: id, landlord_id, user_id, first_name, last_name, email, phone, 
-- emergency_contact, invitation_token, invitation_sent_at, invitation_accepted_at, 
-- account_status, created_at, updated_at
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'tenants'
ORDER BY ordinal_position;

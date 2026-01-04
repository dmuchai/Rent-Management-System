-- Migration: Add invitation fields to tenants table
-- Created: 2026-01-04
-- Description: Add columns to support landlord invitation flow for tenant onboarding

-- Create account status enum (if not exists)
DO $$ BEGIN
    CREATE TYPE account_status AS ENUM ('pending_invitation', 'invited', 'active');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add invitation columns to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS invitation_token VARCHAR,
ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS account_status account_status;

-- Set default value for account_status (separate statement for compatibility)
ALTER TABLE public.tenants 
ALTER COLUMN account_status SET DEFAULT 'pending_invitation';

-- Add unique constraint on invitation_token
DO $ BEGIN
    ALTER TABLE public.tenants ADD CONSTRAINT tenants_invitation_token_unique UNIQUE (invitation_token);
EXCEPTION
    WHEN duplicate_object THEN null;
END $;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenants_invitation_token ON public.tenants(invitation_token) WHERE invitation_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_account_status ON public.tenants(account_status);

-- Update existing tenants with user_id to 'active' status
UPDATE public.tenants 
SET account_status = 'active', 
    invitation_accepted_at = created_at
WHERE user_id IS NOT NULL AND account_status IS NULL;

-- Update existing tenants without user_id to 'pending_invitation' status
UPDATE public.tenants 
SET account_status = 'pending_invitation'
WHERE user_id IS NULL AND account_status IS NULL;

-- Comments for documentation
COMMENT ON COLUMN public.tenants.invitation_token IS 'Unique token for tenant invitation link (expires after 7 days)';
COMMENT ON COLUMN public.tenants.invitation_sent_at IS 'Timestamp when invitation email was sent';
COMMENT ON COLUMN public.tenants.invitation_accepted_at IS 'Timestamp when tenant accepted invitation and created account';
COMMENT ON COLUMN public.tenants.account_status IS 'Status of tenant account: pending_invitation, invited, or active';


-- Add email verification fields to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_token VARCHAR,
ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP;

-- Backfill existing users as verified (to prevent lockout)
UPDATE public.users
SET is_verified = true
WHERE is_verified IS NULL OR is_verified = false;

-- Create index on verification_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON public.users(verification_token);

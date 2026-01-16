-- Add password reset token fields to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR,
ADD COLUMN IF NOT EXISTS password_reset_token_expires_at TIMESTAMP;

-- Create index on password_reset_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON public.users(password_reset_token);

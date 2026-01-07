-- Migration: Allow null role for new OAuth users
-- This enables the role selection flow for Google sign-in users

-- Drop the NOT NULL constraint on the role column
ALTER TABLE users ALTER COLUMN role DROP NOT NULL;

-- Drop the default value for role (no longer auto-assigning landlord)
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;

-- Add a comment to document the nullable role field
COMMENT ON COLUMN users.role IS 'User role: landlord, tenant, or property_manager. Null for new OAuth users pending role selection.';

-- Note: Existing users will keep their roles. Only new OAuth users will have null role initially.

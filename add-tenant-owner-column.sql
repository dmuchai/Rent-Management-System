-- Add owner_id column to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_id VARCHAR REFERENCES users(id);

-- Update existing tenants to have owner_id set to user_id (assuming they are currently using user_id as owner)
-- This is a temporary fix - in production you'd want to set this properly
UPDATE tenants SET owner_id = user_id WHERE owner_id IS NULL;

-- Make owner_id NOT NULL after setting values
ALTER TABLE tenants ALTER COLUMN owner_id SET NOT NULL;

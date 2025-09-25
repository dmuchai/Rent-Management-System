-- Add owner_id column to tenants table (without foreign key constraint initially)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_id VARCHAR(255);

-- Update existing tenants to have owner_id set to user_id (assuming they are currently using user_id as owner)
-- This is a temporary fix - in production you'd want to set this properly
UPDATE tenants SET owner_id = user_id WHERE owner_id IS NULL;

-- Clean up any orphaned owner_id values that don't exist in users table
DELETE FROM tenants WHERE owner_id NOT IN (SELECT id FROM users);

-- Make owner_id NOT NULL after setting values and cleanup
ALTER TABLE tenants ALTER COLUMN owner_id SET NOT NULL;

-- Add foreign key constraint after data is properly backfilled and cleaned
ALTER TABLE tenants ADD CONSTRAINT fk_tenants_owner_id FOREIGN KEY (owner_id) REFERENCES users(id);

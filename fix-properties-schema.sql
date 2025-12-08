-- Fix properties table to add foreign key constraint
-- Run this in Supabase SQL Editor

-- First, drop the existing foreign key if it exists
ALTER TABLE IF EXISTS properties DROP CONSTRAINT IF EXISTS properties_owner_id_users_id_fk;

-- Add the foreign key constraint
ALTER TABLE properties 
ADD CONSTRAINT properties_owner_id_users_id_fk 
FOREIGN KEY (owner_id) REFERENCES users(id) 
ON DELETE CASCADE;

-- Verify the constraint was added
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name='properties';

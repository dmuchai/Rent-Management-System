-- Fix tenant with NULL user_id
-- First, find your user_id from the users table (the one you're logged in as)
-- Then update the tenant to assign it to your user

-- Step 1: Find your user_id (check the email you logged in with)
SELECT id, email, first_name, last_name FROM public.users;

-- Step 2: Update the tenant with NULL user_id to your user_id
-- Replace 'YOUR_USER_ID_HERE' with the actual user_id from Step 1
UPDATE public.tenants 
SET user_id = 'YOUR_USER_ID_HERE'
WHERE user_id IS NULL;

-- Step 3: Verify the update
SELECT id, user_id, first_name, last_name, email FROM public.tenants;

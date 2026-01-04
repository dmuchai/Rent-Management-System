# Running Migrations on Supabase

Since we're running migrations directly in Supabase SQL Editor, follow these steps:

## Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project: `emdahodfztpfdjkrbnqz`
3. Click on "SQL Editor" in the left sidebar
4. Click "New query"

## Step 2: Copy and Run Migration
1. Open the migration file: `migrations/add-tenant-invitation-fields.sql`
2. Copy the entire SQL content
3. Paste into Supabase SQL Editor
4. Click "Run" button

## Step 3: Verify Migration
Run this query to check if columns were added:
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'tenants' 
AND column_name IN ('invitation_token', 'invitation_sent_at', 'invitation_accepted_at', 'account_status');
```

You should see 4 rows returned with the new columns.

## Troubleshooting
If you get errors about existing types or constraints, it's safe - the migration has `IF NOT EXISTS` checks.

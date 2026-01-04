# Running Migrations on Supabase

Since we're running migrations directly in Supabase SQL Editor, follow these steps:

## Pre-Migration Checklist ⚠️

**IMPORTANT:** Before running any migration in production:

1. **Create Database Backup**
   - Navigate to Supabase Dashboard > Database > Backups
   - Click "Create backup" to generate a point-in-time snapshot
   - Wait for backup to complete and verify it appears in the backup list

2. **Review Migration File**
   - Open `migrations/add-tenant-invitation-fields.sql`
   - Read through all SQL statements carefully
   - Verify table names, column types, and constraints match expectations
   - Check for `IF NOT EXISTS` clauses to prevent duplicate objects

3. **Schedule During Off-Peak Hours**
   - Run migrations when application traffic is lowest
   - Notify team members of the maintenance window
   - Have monitoring tools ready to observe database performance

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
5. **Watch for errors in the output panel** - do not proceed if errors occur

## Step 3: Verify Migration
Run this query to check if columns were added:
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'tenants' 
AND column_name IN ('invitation_token', 'invitation_sent_at', 'invitation_accepted_at', 'account_status');
```

You should see 4 rows returned with the new columns.

## After-Migration Verification ✅

1. **Run Verification Query**
   - Execute the query above to confirm all columns exist
   - Verify data types and nullable constraints match expectations
   - Check that existing tenant records have `account_status = 'active'` (default from migration)

2. **Monitor Application Logs**
   - Check backend logs for database errors (30+ minutes after deployment)
   - Watch for failed queries or constraint violations
   - Monitor error tracking (Sentry, Rollbar, etc.) for spike in errors

3. **Test Affected Features**
   - Create a new tenant and verify invitation email is sent
   - Check that invitation tokens are generated correctly
   - Test the `/accept-invitation` flow with a real invitation link
   - Verify tenant status badges display correctly in the UI

## Rollback Procedure 🔄

If the migration causes issues or fails partially:

1. **Restore from Backup**
   - Navigate to Supabase Dashboard > Database > Backups
   - Find the backup created in Pre-Migration Checklist (check timestamp)
   - Click "Restore" next to the backup
   - Confirm the restore operation (this may take several minutes)

2. **Verify Restore Success**
   - Run: `SELECT COUNT(*) FROM tenants;` and compare to expected count
   - Check that critical data is intact
   - Verify application can connect and query database

3. **Investigate and Fix**
   - Review Supabase logs: Dashboard > Logs > Postgres Logs
   - Identify which SQL statement failed
   - Fix the migration file locally
   - Repeat Pre-Migration Checklist before retrying

## Handling Partial Failures ⚠️

If migration completes but some statements failed:

1. **Stop Further Changes**
   - Do NOT run additional migrations until issue is resolved
   - Prevent application deployments that rely on new columns

2. **Assess Impact**
   - Check which statements succeeded: Run verification query for each change
   - Determine if partial state is safe (e.g., enum created but columns not added)

3. **Decision Point**
   - **Minor issue** (e.g., index not created): Manually run failed statement in SQL Editor
   - **Major issue** (e.g., column constraints wrong): Restore from backup per Rollback Procedure

4. **Rerun in Controlled Window**
   - After fixing migration file, schedule new maintenance window
   - Create fresh backup before retry
   - Monitor closely during second attempt

## Troubleshooting
If you get errors about existing types or constraints, it's safe - the migration has `IF NOT EXISTS` checks.

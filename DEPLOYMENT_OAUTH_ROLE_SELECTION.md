# OAuth Role Selection - Deployment Steps

## Quick Summary

✅ **Implementation Complete** - All code changes have been made to enable role selection for new Google OAuth users.

## What Was Changed

### 1. **Database Schema** (`shared/schema.ts`)
- Made `role` field nullable (no default value)
- Allows new OAuth users to be created without a role

### 2. **Backend API** (`api/auth.ts`)
- Enhanced `sync-user` endpoint to detect new OAuth users and return `needsRoleSelection` flag
- Added new `set-role` endpoint for users to set their role (one-time only)
- Updated API documentation comments

### 3. **Frontend Pages**
- **New page**: `/select-role` - Beautiful role selection UI with Landlord, Tenant, and Property Manager options
- **Updated**: `/auth-callback` - Redirects new OAuth users to role selection instead of dashboard
- **Updated**: Router logic in `App.tsx` - Protects against users without roles accessing dashboard

### 4. **Database Migration**
- Created `migrations/allow-null-role-for-oauth-users.sql`

## Deployment Checklist

### Step 1: Run Database Migration
Before deploying the code, run this migration in your Supabase dashboard:

1. Go to Supabase Dashboard → SQL Editor
2. Run this query:
```sql
-- Allow null role for new OAuth users
ALTER TABLE users ALTER COLUMN role DROP NOT NULL;
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
COMMENT ON COLUMN users.role IS 'User role: landlord, tenant, or property_manager. Null for new OAuth users pending role selection.';
```

### Step 2: Deploy Code
Deploy your application as usual. The changes are backward compatible:
- Existing users with roles continue to work normally
- Email/password registration continues to work normally
- Only new Google OAuth users will see the role selection page

### Step 3: Test the Flow
After deployment, test these scenarios:

1. **New Google OAuth User**
   - Go to login page
   - Click "Sign In with Google"
   - Should redirect to `/select-role` after OAuth
   - Select a role
   - Should redirect to dashboard

2. **Existing User with Google**
   - Sign in with Google
   - Should go directly to dashboard (no role selection)

3. **New Email/Password User**
   - Go to register page
   - Fill form and select role
   - Register
   - Should go directly to dashboard after login

## No Breaking Changes

This implementation is **fully backward compatible**:
- ✅ Existing users keep their roles
- ✅ Email/password registration unchanged
- ✅ Existing OAuth users bypass role selection
- ✅ Dashboard routing works as before

## Rollback Plan

If you need to rollback, run this SQL:
```sql
UPDATE users SET role = 'landlord' WHERE role IS NULL;
ALTER TABLE users ALTER COLUMN role SET NOT NULL;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'landlord';
```

Then redeploy the previous version of the code.

## Files Changed

```
✓ api/auth.ts - Backend endpoints
✓ client/src/pages/select-role.tsx - NEW role selection page
✓ client/src/pages/auth-callback.tsx - OAuth callback handling
✓ client/src/App.tsx - Router configuration
✓ shared/schema.ts - Database schema
✓ migrations/allow-null-role-for-oauth-users.sql - NEW migration
✓ OAUTH_ROLE_SELECTION.md - Documentation
```

## Support

For detailed documentation, see `OAUTH_ROLE_SELECTION.md`.

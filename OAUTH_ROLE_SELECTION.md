# OAuth Role Selection Implementation

## Overview

This implementation adds a role selection flow for new users signing in with Google OAuth. Instead of automatically assigning all OAuth users as "landlord", users are now redirected to a role selection page where they can choose to be a Landlord, Tenant, or Property Manager.

## How It Works

### For Google OAuth Sign-In (New Users)

1. **User clicks "Sign In with Google"** on login or register page
2. **OAuth flow completes** and user is redirected to `/auth-callback`
3. **Session is established** via PKCE code exchange
4. **User sync happens** (`/api/auth?action=sync-user`)
   - New OAuth users are created in the database with `role: null`
   - Endpoint returns `{ needsRoleSelection: true }`
5. **Redirect to role selection** (`/select-role`)
6. **User selects their role** (Landlord, Tenant, or Property Manager)
7. **Role is saved** via `/api/auth?action=set-role`
8. **Redirect to dashboard** with appropriate role-based view

### For Email/Password Registration

Email/password registration is **unchanged** - users select their role during registration and it's immediately saved to the database.

### For Existing Users

Existing users with roles already set are **unaffected** - they proceed directly to the dashboard.

## Key Files Modified

### Backend (`api/auth.ts`)

#### 1. `sync-user` Endpoint Enhancement
```typescript
// New behavior:
// - Checks if user has role in metadata (email/password flow)
// - If no role in metadata, creates user with role: null (OAuth flow)
// - Returns needsRoleSelection: true for users without roles
```

#### 2. New `set-role` Endpoint
```typescript
POST /api/auth?action=set-role
Body: { role: "landlord" | "tenant" | "property_manager" }

// Security features:
// - Only authenticated users can set role
// - Role can only be set once (prevents changes after initial setup)
// - Validates role against allowed values
```

### Frontend

#### 1. New Page: `client/src/pages/select-role.tsx`
- Beautiful UI with three role cards
- Shows features/benefits for each role
- Calls `set-role` endpoint on selection
- Redirects to dashboard after successful role assignment

#### 2. Router Updates (`client/src/App.tsx`)
- Added `/select-role` route
- Enhanced redirect logic to catch users without roles
- Ensures users without roles can only access role selection page

#### 3. Auth Callback Enhancement (`client/src/pages/auth-callback.tsx`)
- Checks `needsRoleSelection` flag from sync-user response
- Redirects new OAuth users to `/select-role` instead of dashboard

### Database Schema

#### Schema Update (`shared/schema.ts`)
```typescript
// Before:
role: varchar("role").notNull().default("landlord")

// After:
role: varchar("role") // Nullable, no default
```

#### Migration (`migrations/allow-null-role-for-oauth-users.sql`)
```sql
-- Removes NOT NULL constraint
-- Removes default value
-- Adds documentation comment
```

## User Flows

### Flow 1: New User - Google Sign In
```
Login Page
  ↓ (Click "Sign In with Google")
Google OAuth
  ↓ (Grant permissions)
/auth-callback
  ↓ (Session established)
/api/auth?action=sync-user
  ↓ (User created with role: null)
  ↓ (Returns needsRoleSelection: true)
/select-role
  ↓ (User selects "Landlord")
/api/auth?action=set-role
  ↓ (Role saved to database)
/dashboard (Landlord Dashboard)
```

### Flow 2: New User - Email/Password Registration
```
Register Page
  ↓ (Fill form, select "Tenant")
/api/auth?action=register
  ↓ (User created with role: "tenant")
Login Page
  ↓ (Enter credentials)
/api/auth?action=login
  ↓ (Session established)
/dashboard (Tenant Dashboard)
```

### Flow 3: Existing User - Any Method
```
Login (Email/Password or Google)
  ↓ (Session established)
/api/auth?action=sync-user
  ↓ (User already exists with role set)
  ↓ (Returns needsRoleSelection: false)
/dashboard (Role-specific Dashboard)
```

## Security Considerations

1. **Role Immutability**: Once a role is set via `set-role`, it cannot be changed through this endpoint. Users must contact support for role changes (prevents abuse).

2. **Authentication Required**: The `set-role` endpoint requires a valid session cookie. Unauthenticated users cannot set roles.

3. **Role Validation**: Only valid roles (`landlord`, `tenant`, `property_manager`) are accepted.

4. **Session Security**: Uses httpOnly cookies for session management (CSRF protection).

## Testing Checklist

- [ ] New user signs in with Google → redirected to role selection
- [ ] User selects Landlord role → saved and redirected to landlord dashboard
- [ ] User selects Tenant role → saved and redirected to tenant dashboard
- [ ] User selects Property Manager role → saved and redirected to landlord dashboard
- [ ] New user registers with email/password as Tenant → goes directly to tenant dashboard
- [ ] Existing user logs in with Google → goes directly to their dashboard
- [ ] Unauthenticated user cannot access `/select-role` → redirected to login
- [ ] User tries to set role twice → receives error message
- [ ] User with null role tries to access dashboard → redirected to role selection

## Future Enhancements

1. **Role Change Flow**: Add admin interface or self-service flow for changing roles after initial setup
2. **Property Manager Permissions**: Implement detailed permission system for property managers
3. **Multi-Role Support**: Allow users to have multiple roles (e.g., both landlord and tenant)
4. **Onboarding Wizard**: Extend role selection into a full onboarding flow with profile setup
5. **Role-Specific Features**: Show different features/prompts based on selected role during onboarding

## Database Migration

To apply this change to your database:

```bash
# Run the migration
psql $DATABASE_URL -f migrations/allow-null-role-for-oauth-users.sql
```

Or via Supabase dashboard:
1. Go to SQL Editor
2. Copy contents of `migrations/allow-null-role-for-oauth-users.sql`
3. Execute the query

## Rollback Plan

If issues arise, you can rollback the schema change:

```sql
-- Add back the NOT NULL constraint and default value
UPDATE users SET role = 'landlord' WHERE role IS NULL;
ALTER TABLE users ALTER COLUMN role SET NOT NULL;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'landlord';
```

Note: This will assign 'landlord' role to any users currently without roles.

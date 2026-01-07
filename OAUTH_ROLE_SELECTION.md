# OAuth Role Selection Implementation

## Overview

This implementation adds a role selection flow for new users signing in with Google OAuth. Instead of automatically assigning all OAuth users as "landlord", users are now redirected to a role selection page where they can choose to be a Landlord or Property Manager.

**Important:** Tenants cannot self-register. They must be invited by a landlord or property manager through the tenant invitation system.

## How It Works

### For Google OAuth Sign-In (New Users)

1. **User clicks "Sign In with Google"** on login or register page
2. **OAuth flow completes** and user is redirected to `/auth-callback`
3. **Session is established** via PKCE code exchange
4. **User sync happens** (`/api/auth?action=sync-user`)
   - New OAuth users are created in the database with `role: null`
   - Endpoint returns `{ needsRoleSelection: true }`
5. **Redirect to role selection** (`/select-role`)
6. **User selects their role** (Landlord or Property Manager)
7. **Role is saved** via `/api/auth?action=set-role`
8. **Redirect to dashboard** with appropriate role-based view

### For Email/Password Registration

Email/password registration is **unchanged** - users select their role (Landlord or Property Manager) during registration and it's immediately saved to the database. Tenants cannot use this form - they must accept an invitation.

### For Tenant Registration

Tenants **cannot self-register**. They must:
1. Be invited by a landlord or property manager
2. Receive an invitation email with a unique token
3. Click the invitation link to `/accept-invitation?token=...`
4. Set their password and create their account
5. Their account is automatically created with `role: 'tenant'` and linked to the property/unit

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
Body: { role: "landlord" | "property_manager" }

// Security features:
// - Only authenticated users can set role
// - Role can only be set once (prevents changes after initial setup)
// - Validates role against allowed values (landlord, property_manager)
// - Tenant role is not allowed (tenants must be invited)
```

### Frontend

#### 1. New Page: `client/src/pages/select-role.tsx`
- Beautiful UI with two role cards (Landlord and Property Manager)
- Shows features/benefits for each role
- Displays information about tenant invitation process
- Calls `set-role` endpoint on selection
- Redirects to dashboard after successful role assignment

#### 2. Updated Registration Page: `client/src/pages/register.tsx`
- Removed "Tenant" option from role dropdown
- Added informational message about tenant invitations
- Only allows selection of Landlord or Property Manager
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
/dashboard (4. **Session Security**: Uses httpOnly cookies (XSS mitigation) with SameSite=Lax (CSRF protection) for session management.)
```

### Flow 2: New User - Email/Password Registration (Landlord/Property Manager)
```
Register Page
  ↓ (Fill form, select "Landlord" or "Property Manager")
/api/auth?action=register
  ↓ (User created with role: "landlord" or "property_manager")
Login Page
  ↓ (Enter credentials)
/api/auth?action=login
  ↓ (Session established)
/dashboard (Role-specific Dashboard)
```

### Flow 3: New Tenant - Invitation Flow
```
Landlord Dashboard
  ↓ (Create tenant, send invitation)
Email Sent
  ↓ (Tenant receives invitation link)
/accept-invitation?token=xxx
  ↓ (Tenant creates password)
/api/invitations?action=accept
  ↓ (Account created with role: "tenant", linked to property/unit)
Login Page
  ↓ (Enter credentials)
/dashboard (Tenant Dashboard)
```

### Flow 4: Existing User - Any Method
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

3. **Role Validation**: Only valid roles (`landlord`, `property_manager`) are accepted. Tenant role cannot be set through this endpoint.

4. **Tenant Protection**: Tenants must be created through the invitation system, which ensures proper linking to properties, units, and leases. This prevents unauthorized tenant account creation.

5. **Session Security**: Uses httpOnly cookies for session management (CSRF protection).

## Testing Checklist

- [ ] New user signs in with Google → redirected to role selection
- [ ] User selects Landlord role → saved and redirected to landlord dashboard
- [ ] User selects Property Manager role → saved and redirected to landlord dashboard
- [ ] New user registers with email/password as Landlord → goes directly to landlord dashboard
- [ ] New user registers with email/password as Property Manager → goes directly to landlord dashboard
- [ ] Tenant option is NOT available in role selection or registration
- [ ] Tenant receives invitation email → accepts invitation → creates account as tenant
- [ ] Existing user logs in with Google → goes directly to their dashboard
- [ ] Unauthenticated user cannot access `/select-role` → redirected to login
- [ ] User tries to set role twice → receives error message
- [ ] User with null role tries to access dashboard → redirected to role selection
- [ ] User tries to set role as "tenant" via API → receives error message

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

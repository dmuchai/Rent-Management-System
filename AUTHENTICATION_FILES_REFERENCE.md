# Authentication Files Reference Guide

Complete reference of all files handling authentication in the Rent Management System.

---

## 📁 **Backend / API Files**

### 1. **`/api/auth.ts`** ⭐ MAIN AUTH API
**Purpose:** Consolidated authentication endpoint for all auth operations  
**Location:** `/api/auth.ts` (Vercel Serverless Function)

**Endpoints:**
- `GET /api/auth?action=google` - Initiate Google OAuth flow
- `POST /api/auth?action=login` - Email/password login
- `POST /api/auth?action=register` - User registration
- `POST /api/auth?action=forgot-password` - Send password reset email
- `POST /api/auth?action=logout` - Logout user
- `POST /api/auth?action=exchange-code` - Exchange PKCE code for session
- `POST /api/auth?action=set-session` - Set session from OAuth tokens
- `POST /api/auth?action=sync-user` - Sync user to public.users table
- `GET /api/auth?action=user` - Get current authenticated user
- `GET /api/auth?action=identities` - Get user's linked identities (email, google)
- `POST /api/auth?action=link-google` - Link Google account to existing user

**Key Features:**
- Rate limiting on login, register, forgot-password
- HttpOnly cookie management
- Supabase authentication integration
- User synchronization with public.users table
- Identity/provider management

**Dependencies:**
- `@supabase/supabase-js`
- `zod` for validation
- Custom rate limiting utility

---

### 2. **`/api/_lib/auth.ts`**
**Purpose:** Shared auth utilities for API routes  
**Location:** `/api/_lib/auth.ts`

**Functions:**
- Authentication helper functions
- Token validation utilities

---

### 3. **`/api/_lib/verify-auth.ts`**
**Purpose:** Middleware for verifying authentication  
**Location:** `/api/_lib/verify-auth.ts`

**Functions:**
- `verifyAuth()` - Middleware to protect API routes
- Validates JWT tokens from cookies
- Returns user info or 401 error

---

### 4. **`/api/_lib/rate-limit.ts`**
**Purpose:** Rate limiting for auth endpoints  
**Location:** `/api/_lib/rate-limit.ts`

**Features:**
- Prevents brute force attacks
- Configurable limits for different actions
- IP-based rate limiting

**Rate Limits:**
- Login: 5 attempts per minute
- Register: 2 attempts per minute
- Forgot Password: 3 attempts per minute

---

### 5. **`/server/supabaseAuth.ts`** (Legacy - not used in production)
**Purpose:** Server-side Supabase authentication utilities  
**Location:** `/server/supabaseAuth.ts`

**Note:** This file is part of the old Express server setup. In production, authentication is handled by Vercel Serverless Functions (`/api/auth.ts`).

---

## 📱 **Frontend Files**

### 6. **`/client/src/hooks/useAuth.ts`** ⭐ MAIN AUTH HOOK
**Purpose:** React hook for authentication state management  
**Location:** `/client/src/hooks/useAuth.ts`

**Exports:**
- `useAuth()` - Main authentication hook

**Returns:**
```typescript
{
  user: User | null;           // Current user object
  isAuthenticated: boolean;    // Auth status
  isLoading: boolean;          // Loading state
  error: Error | null;         // Auth errors
}
```

**Features:**
- Fetches user from `/api/auth?action=user`
- React Query integration
- Auto-refetch on window focus
- Error handling

---

### 7. **`/client/src/hooks/useIdentities.ts`** 🆕
**Purpose:** Hook for fetching user's linked authentication providers  
**Location:** `/client/src/hooks/useIdentities.ts`

**Returns:**
```typescript
{
  identities: Identity[];       // List of linked providers
  hasEmailProvider: boolean;    // Has email/password
  hasGoogleProvider: boolean;   // Has Google OAuth
}
```

**Used In:** Profile page to show/manage linked accounts

---

### 8. **`/client/src/lib/auth.ts`**
**Purpose:** Client-side authentication utilities  
**Location:** `/client/src/lib/auth.ts`

**Functions:**
- `logout()` - Logout function
  - Clears React Query cache
  - Clears browser storage (localStorage, sessionStorage)
  - Clears auth cookies
  - Calls `/api/auth/logout`
  - Redirects to home

**Features:**
- `clearAuthStorage()` - Remove auth-related keys from storage
- `clearAuthCookies()` - Expire auth cookies

---

### 9. **`/client/src/lib/authUtils.ts`**
**Purpose:** Authentication utility functions  
**Location:** `/client/src/lib/authUtils.ts`

**Functions:**
- `isUnauthorizedError(error)` - Check if error is 401
- Error handling helpers

---

### 10. **`/client/src/lib/supabase.ts`** ⭐ SUPABASE CLIENT
**Purpose:** Supabase client configuration for frontend  
**Location:** `/client/src/lib/supabase.ts`

**Configuration:**
- `persistSession: true` - Enables OAuth and password reset
- `autoRefreshToken: true` - Keeps sessions alive
- `detectSessionInUrl: true` - Detects OAuth tokens from URL hash
- `flowType: 'implicit'` - Hash-based OAuth flow
- Custom storage using `sessionStorage`

**Used For:**
- OAuth callbacks
- Password reset flows
- Account linking
- Realtime subscriptions

---

## 🔐 **Authentication Pages**

### 11. **`/client/src/pages/login.tsx`** ⭐ LOGIN PAGE
**Purpose:** User login page  
**Location:** `/client/src/pages/login.tsx`

**Features:**
- Email/password login form
- Google OAuth button
- "Forgot password" link
- OAuth error display
- Password reset success message
- Register link

**API Calls:**
- `POST /api/auth?action=login` - Email/password login
- Redirects to `/api/auth?action=google` - Google OAuth

---

### 12. **`/client/src/pages/register.tsx`**
**Purpose:** User registration page  
**Location:** `/client/src/pages/register.tsx`

**Features:**
- Email/password registration form
- First name, last name fields
- Role selection (landlord/tenant)
- Password strength validation
- Terms acceptance

**API Calls:**
- `POST /api/auth?action=register`

---

### 13. **`/client/src/pages/forgot-password.tsx`**
**Purpose:** Request password reset  
**Location:** `/client/src/pages/forgot-password.tsx`

**Features:**
- Email input form
- Sends password reset link
- Success/error messages

**API Calls:**
- `POST /api/auth?action=forgot-password`

---

### 14. **`/client/src/pages/reset-password.tsx`** 🔒
**Purpose:** Reset password with recovery token  
**Location:** `/client/src/pages/reset-password.tsx`

**Features:**
- Validates recovery token from URL hash
- Password strength validation
- Updates password in Supabase
- Signs out recovery session after reset
- Redirects to login

**URL Format:**
```
/reset-password#type=recovery&access_token=...
```

**API Calls:**
- `supabase.auth.updateUser({ password })`
- `supabase.auth.signOut()`

---

### 15. **`/client/src/pages/auth-callback.tsx`** ⭐ OAUTH CALLBACK
**Purpose:** Handle OAuth callback after Google sign-in  
**Location:** `/client/src/pages/auth-callback.tsx`

**Flow:**
1. Receives OAuth tokens from URL hash
2. Validates session with Supabase
3. Sends tokens to backend via `/api/auth?action=set-session`
4. Syncs user to database via `/api/auth?action=sync-user`
5. Redirects to dashboard

**Error Handling:**
- Detects OAuth errors in URL
- Shows user-friendly error messages
- Handles email conflicts (account linking)

---

### 16. **`/client/src/pages/landing.tsx`**
**Purpose:** Landing page with login/register links  
**Location:** `/client/src/pages/landing.tsx`

**Features:**
- Marketing content
- Login/Register buttons
- Feature showcase

---

## 👤 **Profile & Account Management**

### 17. **`/client/src/components/LinkedAccountsSection.tsx`** 🆕
**Purpose:** UI for managing linked authentication providers  
**Location:** `/client/src/components/LinkedAccountsSection.tsx`

**Features:**
- Shows Email/Password provider status
- Shows Google OAuth provider status
- "Link Google" button for account linking
- Uses `supabase.auth.linkIdentity({ provider: 'google' })`

**Used In:** Profile page (landlord/tenant dashboards)

---

### 18. **`/client/src/pages/dashboard/landlord.tsx`**
**Purpose:** Landlord dashboard with profile section  
**Location:** `/client/src/pages/dashboard/landlord.tsx`

**Auth Features:**
- Profile management
- Password change
- Linked accounts section (includes LinkedAccountsSection)
- Auth guards (redirects if not authenticated)

---

### 19. **`/client/src/pages/dashboard/tenant.tsx`**
**Purpose:** Tenant dashboard  
**Location:** `/client/src/pages/dashboard/tenant.tsx`

**Auth Features:**
- Auth guards (redirects if not authenticated)
- User info display
- Uses `useAuth()` hook

---

## ⚙️ **Configuration Files**

### 20. **`/client/src/lib/config.ts`**
**Purpose:** API configuration  
**Location:** `/client/src/lib/config.ts`

**Exports:**
- `API_BASE_URL` - Backend API URL
  - Development: `http://localhost:5000`
  - Production: `''` (same-origin, uses Vercel serverless functions)

---

### 21. **Environment Variables**

**Backend (.env):**
```env
SUPABASE_URL=https://emdahodfztpfdjkrbnqz.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_JWT_SECRET=...
```

**Frontend (environment variables in Vite):**
```env
VITE_SUPABASE_URL=https://emdahodfztpfdjkrbnqz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

---

## 🗄️ **Database Schema**

### 22. **`/shared/schema.ts`**
**Purpose:** Database schema definitions  
**Location:** `/shared/schema.ts`

**Auth Tables:**
- `users` - User profiles (id, email, first_name, last_name, role)
- `sessions` - Session storage (legacy, not used in Supabase auth)

**Note:** Supabase handles its own `auth.users` table. The `public.users` table is synced from `auth.users`.

---

## 🔄 **Authentication Flow Summary**

### **Email/Password Login:**
```
1. User enters credentials on /login
2. POST /api/auth?action=login
3. Supabase validates credentials
4. Backend sets httpOnly cookie
5. Frontend redirects to /dashboard
```

### **Google OAuth Login:**
```
1. User clicks "Sign in with Google"
2. GET /api/auth?action=google
3. Supabase redirects to Google
4. User authorizes with Google
5. Google redirects to /auth-callback with tokens
6. Frontend sends tokens to POST /api/auth?action=set-session
7. Backend sets httpOnly cookie
8. POST /api/auth?action=sync-user syncs user to DB
9. Redirect to /dashboard
```

### **Password Reset:**
```
1. User enters email on /forgot-password
2. POST /api/auth?action=forgot-password
3. Supabase sends email with reset link
4. User clicks link → /reset-password#type=recovery&access_token=...
5. User enters new password
6. supabase.auth.updateUser({ password })
7. supabase.auth.signOut() clears recovery session
8. Redirect to /login with success message
```

### **Account Linking:**
```
1. User logs in with email/password
2. Goes to Profile → Linked Accounts
3. Clicks "Link Google"
4. supabase.auth.linkIdentity({ provider: 'google' })
5. Redirects to Google OAuth
6. Google redirects back with tokens
7. Supabase links Google identity to existing user
8. User can now use both methods to sign in
```

---

## 🔑 **Key Concepts**

### **Authentication Methods:**
1. **Email/Password** - Traditional credentials
2. **Google OAuth** - Social login
3. **Account Linking** - Connect multiple methods to one account

### **Session Management:**
- **Backend:** HttpOnly cookies (`supabase-auth-token`)
- **Frontend:** SessionStorage (temporary, for OAuth callbacks)
- **Supabase:** Manages JWT tokens internally

### **Security Features:**
- Rate limiting on login/register
- HttpOnly cookies (prevent XSS)
- CSRF protection via SameSite cookies
- Password strength validation
- Email verification for password resets

---

## 📊 **File Categories**

| Category | Files |
|----------|-------|
| **Backend API** | `api/auth.ts`, `api/_lib/auth.ts`, `api/_lib/verify-auth.ts`, `api/_lib/rate-limit.ts` |
| **Frontend Hooks** | `hooks/useAuth.ts`, `hooks/useIdentities.ts` |
| **Frontend Utils** | `lib/auth.ts`, `lib/authUtils.ts`, `lib/supabase.ts`, `lib/config.ts` |
| **Pages** | `pages/login.tsx`, `pages/register.tsx`, `pages/forgot-password.tsx`, `pages/reset-password.tsx`, `pages/auth-callback.tsx` |
| **Components** | `components/LinkedAccountsSection.tsx` |
| **Dashboards** | `pages/dashboard/landlord.tsx`, `pages/dashboard/tenant.tsx` |
| **Schema** | `shared/schema.ts` |

---

## 🛠️ **Common Tasks**

### **Add a New OAuth Provider (e.g., GitHub):**
1. Update `api/auth.ts` - Add `GET /api/auth?action=github`
2. Update `LinkedAccountsSection.tsx` - Add GitHub UI
3. Update `useIdentities` hook - Add `hasGithubProvider`
4. Configure in Supabase Dashboard

### **Change Session Duration:**
1. Update `api/auth.ts` - Modify `Max-Age` in cookie settings
2. Current: 7 days (`604800` seconds)

### **Add Custom User Fields:**
1. Update `shared/schema.ts` - Add to `users` table
2. Update `api/auth.ts` - Modify user sync logic
3. Update `useAuth` hook - Include in user object type

---

## 📚 **Documentation Files**

- `AUTH_SETUP_CHECKLIST.md` - Supabase & Google OAuth setup guide
- `ACCOUNT_LINKING_GUIDE.md` - Account linking implementation guide
- `AUTHENTICATION_SECURITY.md` - Security documentation
- `COOKIE_SECURITY.md` - Cookie configuration guide

---

**Last Updated:** January 2, 2026  
**Total Auth Files:** 22+ files  
**Main Entry Points:** `/api/auth.ts` (backend), `useAuth()` hook (frontend)

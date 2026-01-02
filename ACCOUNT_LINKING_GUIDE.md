# Account Linking Guide - Email/Password vs Google OAuth

## ✅ Implementation Complete!

**Manual account linking is now fully implemented.** Users can link their Google account to an existing email/password account directly from their profile page.

---

## 🚀 Quick Setup (Required)

### Step 1: Enable Manual Linking in Supabase Dashboard

1. Go to [Supabase Dashboard](https://app.supabase.com) → Your Project
2. Navigate to **Authentication** → **Providers** → **Sign In / Providers**
3. Find **"Allow manual linking"** toggle
4. ✅ **Turn it ON** (Enable manual linking APIs for your project)
5. Click **"Save changes"**

**This is REQUIRED** for the linking feature to work!

### Step 2: Deploy the Changes

The code is ready. Just deploy to Vercel:
```bash
git add -A
git commit -m "Add Google account linking to profile"
git push origin main
```

Vercel will auto-deploy the changes.

### Step 3: Test the Feature

1. Login as a user who registered with email/password (`movelink47@gmail.com`)
2. Go to **Dashboard** → **Profile**
3. Scroll to **"Linked Accounts"** section
4. Click **"Link Google"** next to Google provider
5. Sign in with Google using the same email
6. ✅ Google account is now linked!
7. Logout and try "Sign in with Google" - should work now!

---

## The Problem

**Scenario:**
- User registers with email `movelink47@gmail.com` and a password
- Later, same user tries to sign in with "Sign in with Google" using the same email
- **Result:** Login fails or creates a duplicate account

**Why This Happens:**
Supabase treats each authentication provider (email, Google, GitHub, etc.) as a **separate identity**. By default:
- Email/password login creates an identity with provider = `email`
- Google OAuth creates an identity with provider = `google`
- Even with the same email, these are **different identities** in Supabase

---

## Solutions

### ✅ **Solution 1: Configure Supabase to Allow Account Linking (Recommended)**

This is the cleanest solution - let Supabase handle it automatically.

#### Steps in Supabase Dashboard:

1. Go to [Supabase Dashboard](https://app.supabase.com) → Your Project
2. Navigate to **Authentication** → **Providers**
3. Click on **Google** provider
4. Look for these settings:

   **Option A: "Confirm email" (if available)**
   - ✅ **Uncheck** "Confirm email" for Google provider
   - This allows linking without email confirmation
   
   **Option B: Check Project-Level Settings**
   - Go to **Authentication** → **Settings**
   - Look for **"Enable manual linking"** or similar
   - Enable it if available

5. **Save** changes

#### What This Does:
- When a user with `movelink47@gmail.com` (email provider) tries Google OAuth
- Supabase will **link** the Google identity to the existing account
- User can now sign in with either method

#### Verification:
After enabling, test:
1. Register with email/password: `test@example.com`
2. Try "Sign in with Google" using the same email
3. Should succeed and link accounts

---

### ✅ **Solution 2: Guide Users to Use Correct Method**

If automatic linking isn't available or desired, clearly guide users.

#### Implementation (Already Added):

**Better error messages:**
- When OAuth fails due to email conflict, show:
  > "This email is already registered. Please sign in with your email and password instead."

**On login page, add a note:**
```
Note: If you registered with email/password, please use that method to sign in.
Google sign-in is only for accounts created with Google.
```

---

### ✅ **Solution 3: Manual Account Linking API (Advanced)**

If Supabase doesn't support automatic linking, implement it in code.

#### Backend Implementation:

Add a new endpoint `/api/auth?action=link-provider`:

```typescript
// POST /api/auth?action=link-provider
if (action === 'link-provider' && req.method === 'POST') {
  const token = req.cookies['supabase-auth-token'];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { provider } = req.body; // 'google', 'github', etc.
  
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Use Supabase Admin API to link identity
  const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // This requires the user to go through OAuth flow again
    // and Supabase will link it if email matches
    const { data, error } = await adminSupabase.auth.admin.linkIdentity({
      userId: user.id,
      provider: provider,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ 
      message: 'Provider linked successfully',
      identities: data 
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to link provider' });
  }
}
```

**Note:** This approach requires Supabase Admin API and may have limitations.

---

### ✅ **Solution 4: Prevent Duplicate Registrations**

Modify the registration flow to suggest existing sign-in methods.

#### Check if email exists before registration:

```typescript
// In registration endpoint
const { data: existingUser } = await adminSupabase
  .from('auth.users')
  .select('email, app_metadata')
  .eq('email', userData.email)
  .single();

if (existingUser) {
  const providers = existingUser.app_metadata?.providers || ['email'];
  return res.status(400).json({ 
    error: 'Email already registered',
    suggestedMethod: `This email is already registered. Please sign in with ${providers.join(' or ')}.`
  });
}
```

---

## Current Implementation Status

✅ **Implemented:**
- Better error messages in OAuth callback
- User-friendly error display on login page
- Clear messaging when account already exists
- **Backend endpoint to fetch user identities (`/api/auth?action=identities`)**
- **Profile page section showing linked accounts**
- **"Link Google Account" button for users with email/password**
- **Client-side `linkIdentity()` integration using Supabase**

❌ **Not Yet Implemented:**
- Automatic account linking (requires Supabase dashboard config - see below)

---

## Implementation Complete! ✅

### **What Was Added:**

#### 1. **Backend API Endpoints** (`api/auth.ts`)
- `GET /api/auth?action=identities` - Returns user's linked providers
- `POST /api/auth?action=link-google` - Configuration endpoint for linking

#### 2. **Custom Hook** (`client/src/hooks/useIdentities.ts`)
- Fetches and manages user's linked identities
- Returns which providers are connected

#### 3. **UI Component** (`client/src/components/LinkedAccountsSection.tsx`)
- Shows Email/Password and Google provider status
- "Link Google" button for users without Google linked
- Visual indicators for linked/not linked status
- Helpful information about account linking

#### 4. **Profile Integration** (`client/src/pages/dashboard/landlord.tsx`)
- Added "Linked Accounts" section to profile page
- Users can see and manage their sign-in methods

---

## How It Works

### **For Existing Email/Password Users:**

1. User logs in with email/password
2. Goes to **Dashboard** → **Profile**
3. Sees "Linked Accounts" section
4. Clicks **"Link Google"** button
5. Redirected to Google OAuth (must use same email)
6. After successful OAuth, Google account is linked
7. User can now sign in with either method!

### **Technical Flow:**

```
1. User clicks "Link Google" in Profile
2. Frontend calls supabase.auth.linkIdentity({ provider: 'google' })
3. Supabase redirects to Google OAuth
4. User authorizes with Google (same email required)
5. Google redirects back to /auth-callback
6. Supabase links Google identity to existing user
7. User redirected to dashboard
8. Profile shows "Google: ✓ Linked"
```

---

## Recommended Approach

**For Your Use Case:**

1. **Enable automatic account linking in Supabase** (Solution 1)
   - Simplest and most user-friendly
   - No code changes needed
   - Users can seamlessly switch between methods

2. **If automatic linking isn't available:**
   - Keep current error messages (Solution 2) ✅ Already done
   - Add a note on the login page about using original sign-in method
   - Consider adding a "Link Google Account" button in user profile settings

---

## Testing Scenarios

### Test Case 1: Email First, Then Google
1. Register with `test@example.com` + password
2. Logout
3. Click "Sign in with Google" using `test@example.com`
4. **Expected:** Should link and login successfully (if linking enabled)
5. **Actual (if linking disabled):** Shows error "Email already registered"

### Test Case 2: Google First, Then Email
1. Sign in with Google (`test@example.com`)
2. Logout
3. Try to register with same email + password
4. **Expected:** Should show "Email already registered" or link accounts
5. **Actual:** Depends on Supabase settings

### Test Case 3: Switching Methods
1. Login with email/password
2. Go to Profile → "Link Google Account"
3. Complete Google OAuth
4. **Expected:** Now can use either method
5. **Actual:** Requires manual linking implementation

---

## Supabase Configuration Checklist

- [ ] Check Supabase Dashboard → Authentication → Providers → Google
- [ ] Look for "Confirm email" setting (uncheck if present)
- [ ] Check Authentication → Settings for "Manual linking" or "Enable account linking"
- [ ] Test with a fresh email to verify linking works
- [ ] Document which sign-in methods are available to users

---

## User Communication

**Add to your login page:**

> **Note for existing users:**  
> If you created your account with email and password, please continue using that method to sign in.  
> If you signed up with Google, use the "Sign in with Google" button.  
> We're working on allowing you to use both methods interchangeably.

**In user profile (future enhancement):**
- Show which providers are linked: Email ✅, Google ⬜
- Allow users to link additional sign-in methods
- Let users set a password if they only have OAuth

---

## Additional Resources

- **Supabase Linking Identities:** https://supabase.com/docs/guides/auth/auth-identity-linking
- **OAuth Best Practices:** https://supabase.com/docs/guides/auth/social-login
- **Managing User Identities:** https://supabase.com/docs/reference/javascript/auth-admin-linkidentity

---

**Last Updated:** January 2, 2026  
**Status:** Error handling improved, automatic linking requires Supabase configuration

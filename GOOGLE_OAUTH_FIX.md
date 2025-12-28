# Google OAuth Fix Guide

## Problem
Google OAuth login failing with "No access token in callback" error.

## Root Cause
Supabase redirect URL not configured properly in Supabase dashboard.

## Solution Steps

### 1. Configure Supabase Redirect URLs

Go to your Supabase Dashboard:
1. Navigate to **Authentication** → **URL Configuration**
2. Add the following URLs to **Redirect URLs**:

   **Production:**
   ```
   https://property-manager-ke.vercel.app/auth-callback
   ```

   **Development (if needed):**
   ```
   http://localhost:5173/auth-callback
   ```

3. Click **Save**

### 2. Verify Google OAuth Provider Settings

In Supabase Dashboard → **Authentication** → **Providers**:

1. Click on **Google**
2. Ensure:
   - ✅ **Enabled** is checked
   - ✅ **Client ID** is set (from Google Cloud Console)
   - ✅ **Client Secret** is set (from Google Cloud Console)
   - ✅ **Authorized Client IDs** (if using additional platforms)

3. **Important**: Verify the **Redirect URL** shown in Supabase matches what you've configured in Google Cloud Console

### 3. Google Cloud Console Configuration

Go to https://console.cloud.google.com/

1. Navigate to **APIs & Services** → **Credentials**
2. Click on your **OAuth 2.0 Client ID**
3. Add to **Authorized redirect URIs**:
   ```
   https://emdahodfztpfdjkrbnqz.supabase.co/auth/v1/callback
   ```
   
   **Note**: Your Supabase project URL is `https://emdahodfztpfdjkrbnqz.supabase.co`
   The callback must be: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

4. Click **Save**

### 4. Test the Flow

1. Clear browser cookies and cache
2. Go to https://property-manager-ke.vercel.app
3. Click "Sign in with Google"
4. Complete OAuth flow
5. Should redirect to `/auth-callback` then `/dashboard`

## Debugging

If still failing, check browser console and Vercel logs for:

- Hash fragment in URL: Should see `#access_token=...`
- Query params: Might see `?code=...` (PKCE flow - not currently supported)
- Error messages in callback handler

## Alternative: Switch to PKCE Flow

If you prefer PKCE (more secure), update `/api/login.ts`:

```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${origin}/auth-callback`,
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
    skipBrowserRedirect: false,
  }
});
```

Then implement code exchange in `auth-callback.tsx` (requires backend endpoint).

## Current Implementation Status

✅ Implicit flow (hash-based) - **Preferred for your setup**  
❌ PKCE flow (code-based) - Not implemented yet


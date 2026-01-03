# PKCE Flow Testing Guide

## Changes Made

### ✅ Updated OAuth Initiation to Use Client-Side PKCE

**Before:** OAuth was initiated from backend API endpoint
- Problem: Code verifier couldn't be stored properly
- Result: Implicit flow with `#access_token=...`

**After:** OAuth initiated from frontend Supabase client
- Solution: Client has proper storage for PKCE code verifier
- Expected: PKCE flow with `?code=...`

### Files Modified

1. **client/src/pages/login.tsx**
   - Now uses `supabase.auth.signInWithOAuth()` directly
   - PKCE code verifier stored in sessionStorage automatically

2. **client/src/pages/register.tsx**
   - Same update for consistency

## How to Test

### 1. Build and Deploy
```bash
npm run build:frontend
# Then deploy to Vercel
```

### 2. Test Locally (Development)
```bash
npm run dev
```

### 3. Test OAuth Flow

1. Open browser DevTools (F12)
2. Go to Network tab
3. Click "Sign in with Google"
4. Watch for the authorization URL - should contain:
   - `code_challenge=...`
   - `code_challenge_method=S256`
5. After Google auth, check redirect URL:
   - ✅ Should be: `/auth-callback?code=ABC123...`
   - ❌ NOT: `/auth-callback#access_token=...`
6. Check sessionStorage:
   - Should contain: `supabase-pkce-code-verifier`
   - Should NOT contain raw access tokens

## What Changed Technically

### PKCE Flow (New)
1. Client generates `code_verifier` (random string)
2. Client computes `code_challenge = SHA256(code_verifier)`
3. Stores `code_verifier` in sessionStorage
4. Redirects to Google with `code_challenge`
5. Google redirects back with `?code=...`
6. Client calls `exchangeCodeForSession(code)` with stored `code_verifier`
7. Supabase validates and returns tokens

### Why This Works
- Supabase client (v2.58.0) has built-in PKCE support
- `flowType: 'pkce'` in client config enables this
- Client-side storage allows proper code verifier handling
- No server-side changes needed for PKCE


# Authentication Setup Checklist

This checklist will help you configure Google OAuth and password reset functionality properly.

## ✅ Supabase Dashboard Configuration

### 1. Configure Redirect URLs

Go to [Supabase Dashboard](https://app.supabase.com) → Select your project → **Authentication** → **URL Configuration**

#### Site URL
Set your production URL:
```
https://property-manager-ke.vercel.app
```

#### Redirect URLs
Add ALL of the following URLs (click "+ Add URL" for each):

**Production:**
```
https://property-manager-ke.vercel.app/auth-callback
https://property-manager-ke.vercel.app/reset-password
https://property-manager-ke.vercel.app/
```

**Development (optional, for local testing):**
```
http://localhost:5173/auth-callback
http://localhost:5173/reset-password
http://localhost:5173/
```

**Important:** Click **Save** after adding all URLs.

---

### 2. Configure Google OAuth Provider

Go to **Authentication** → **Providers** → **Google**

1. ✅ Check **"Enable Sign in with Google"**
2. Enter your **Client ID** from Google Cloud Console
3. Enter your **Client Secret** from Google Cloud Console
4. (Optional) Add **Authorized Client IDs** if using mobile apps
5. Click **Save**

**Note the Callback URL shown in Supabase:**
```
https://emdahodfztpfdjkrbnqz.supabase.co/auth/v1/callback
```
You'll need this for Google Cloud Console setup.

---

### 3. Configure Email Templates (for Password Reset)

Go to **Authentication** → **Email Templates** → **Reset Password**

Ensure the template includes a link like:
```
{{ .SiteURL }}/reset-password#type=recovery&access_token={{ .Token }}
```

**Default template should work**, but verify it redirects to `/reset-password`.

---

## ✅ Google Cloud Console Configuration

### 1. Create/Configure OAuth Credentials

Go to [Google Cloud Console](https://console.cloud.google.com)

1. Select your project (or create a new one)
2. Navigate to **APIs & Services** → **Credentials**
3. If you don't have OAuth credentials, click **+ CREATE CREDENTIALS** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `Landee & Moony Production`

---

### 2. Configure Authorized JavaScript Origins

Add the following origins:

**Production:**
```
https://property-manager-ke.vercel.app
https://emdahodfztpfdjkrbnqz.supabase.co
```

**Development (optional):**
```
http://localhost:5173
```

---

### 3. Configure Authorized Redirect URIs

Add **BOTH** of these URIs:

**Supabase Callback (REQUIRED):**
```
https://emdahodfztpfdjkrbnqz.supabase.co/auth/v1/callback
```

**Your App Callback (for fallback):**
```
https://property-manager-ke.vercel.app/auth-callback
```

**Development (optional):**
```
http://localhost:5173/auth-callback
```

---

### 4. Save Credentials

1. Click **Save**
2. Copy the **Client ID** and **Client Secret**
3. Add them to Supabase (see Supabase step 2 above)

---

## ✅ Vercel Environment Variables

Ensure your Vercel project has these environment variables set:

Go to [Vercel Dashboard](https://vercel.com) → Your Project → **Settings** → **Environment Variables**

Required variables:
```
SUPABASE_URL=https://emdahodfztpfdjkrbnqz.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
VITE_SUPABASE_URL=https://emdahodfztpfdjkrbnqz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

**Important:** After adding/changing environment variables, you must **redeploy** your application.

---

## 🧪 Testing the Setup

### Test Google OAuth

1. Clear browser cache and cookies
2. Go to https://property-manager-ke.vercel.app
3. Click **"Sign in with Google"**
4. Complete Google sign-in
5. Should redirect to `/auth-callback` → then `/dashboard`

**Expected behavior:**
- No 401 errors in console
- Smooth redirect flow
- User lands on dashboard

**If it fails:**
- Check browser console for errors
- Verify redirect URLs are saved in Supabase
- Verify Google OAuth callback URL matches Supabase URL exactly

---

### Test Password Reset

1. Go to https://property-manager-ke.vercel.app/forgot-password
2. Enter your email address
3. Check your email inbox
4. Click the password reset link
5. Should land on `/reset-password` page (NOT show "Invalid Link")
6. Enter new password and submit
7. **Should redirect to `/login` page**
8. **User must sign in again with the new password**

**Expected behavior:**
- Email received within 1-2 minutes
- Reset link opens properly
- No "Invalid Reset Link" error
- Password updates successfully
- **Session is cleared after password reset**
- **User is redirected to login page**
- **Success message shown: "Password Reset Complete"**
- **User must log in with new password (not auto-logged in)**

**If it fails:**
- Check Supabase email template has correct redirect URL
- Verify `/reset-password` is in Supabase redirect URLs
- Check browser console for hash parameter errors

---

## 🔍 Troubleshooting

### Google OAuth 401 Unauthorized

**Causes:**
- Redirect URLs not saved in Supabase
- Google Cloud Console callback URL doesn't match Supabase
- OAuth credentials not properly configured

**Solutions:**
1. Double-check ALL redirect URLs are saved in Supabase (click Save!)
2. Verify Google callback URL is EXACTLY: `https://emdahodfztpfdjkrbnqz.supabase.co/auth/v1/callback`
3. Wait 5-10 minutes for Google OAuth changes to propagate

---

### Password Reset "Invalid Link" Error

**Causes:**
- `/reset-password` not in Supabase redirect URLs
- Hash parameters being stripped from URL
- Session expired before clicking link

**Solutions:**
1. Add `https://property-manager-ke.vercel.app/reset-password` to Supabase redirect URLs
2. Click the reset link within 1 hour of receiving email
3. Ensure email template uses `{{ .SiteURL }}/reset-password` format

---

### Session Not Persisting After OAuth

**Causes:**
- Backend not setting httpOnly cookie
- CORS issues between frontend and API
- Session sync failing

**Solutions:**
1. Check `/api/auth?action=set-session` endpoint is called successfully
2. Verify cookies are set in browser DevTools → Application → Cookies
3. Check Vercel function logs for errors

---

## 📋 Quick Verification Commands

Run these in browser console on your site to verify configuration:

```javascript
// Check if Supabase client is configured
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);

// Check current session
const { data, error } = await window.supabase?.auth.getSession();
console.log('Session:', data, error);

// Check auth cookies
console.log('Cookies:', document.cookie);
```

---

## ✅ Completion Checklist

Before considering setup complete, verify:

- [ ] Supabase Site URL is set to your production domain
- [ ] All redirect URLs added to Supabase (OAuth callback, reset-password, root)
- [ ] Google OAuth provider enabled in Supabase with credentials
- [ ] Google Cloud Console has Supabase callback URL in authorized redirect URIs
- [ ] Environment variables set in Vercel
- [ ] Application redeployed after environment variable changes
- [ ] Google OAuth login tested successfully
- [ ] Password reset flow tested successfully
- [ ] No console errors during authentication

---

## 📞 Support Resources

- **Supabase Auth Docs**: https://supabase.com/docs/guides/auth
- **Google OAuth Setup**: https://developers.google.com/identity/protocols/oauth2
- **Vercel Deployment**: https://vercel.com/docs

---

**Last Updated:** January 2, 2026
**Status:** Configuration updated - requires external setup in Supabase and Google Cloud Console

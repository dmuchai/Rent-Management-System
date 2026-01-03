# PKCE Test Client

This is a standalone HTML test page for verifying PKCE OAuth flow with Supabase.

## Setup Instructions

1. **Copy the example configuration:**
   ```bash
   cp test-pkce-config.example.js test-pkce-config.js
   ```

2. **Add your Supabase credentials:**
   
   Open `test-pkce-config.js` and replace the placeholder values:
   
   ```javascript
   const TEST_SUPABASE_CONFIG = {
     url: 'https://your-project-id.supabase.co',  // Your Supabase project URL
     anonKey: 'eyJhbGc...'  // Your Supabase anon/public key
   };
   ```

3. **Open the test page:**
   
   Open `test-pkce-client.html` in your browser (you can use a local server or just open the file directly).

## Security Notes

- ⚠️ **DO NOT commit** `test-pkce-config.js` with real credentials
- The file `test-pkce-config.js` is git-ignored to prevent accidental commits
- Only the example file (`test-pkce-config.example.js`) is committed to the repository
- The anon key is safe to use in public clients but should still not be hardcoded in committed files

### Verbose Logging Flag

By default, the test page **does not log sensitive values** (authorization codes, access tokens, etc.) to protect against accidental exposure.

To enable detailed logging for debugging:

1. Open `test-pkce-client.html`
2. Find the `VERBOSE_LOGGING` constant (around line 57)
3. Change `const VERBOSE_LOGGING = false;` to `const VERBOSE_LOGGING = true;`
4. **Remember to set it back to `false` before committing or sharing**

When `VERBOSE_LOGGING = false` (default):
- ✅ Authorization codes and tokens are redacted from logs
- ✅ Sensitive data shows as `[REDACTED]` in output
- ✅ Only success/failure status is logged

When `VERBOSE_LOGGING = true`:
- ⚠️ Full authorization codes and tokens are logged to console
- ⚠️ Sensitive data visible in output panels
- ⚠️ **Use only for local debugging, never in production**

## Testing PKCE Flow

1. Click **"Test Google OAuth (PKCE)"** to initiate the OAuth flow
2. Check the Network tab in DevTools for the authorization URL - it should contain:
   - `code_challenge=...`
   - `code_challenge_method=S256`
3. After authentication, the redirect URL should be:
   - ✅ `/test-pkce-client.html?code=...` (query parameter)
   - ❌ NOT `/test-pkce-client.html#access_token=...` (hash fragment)
4. Click **"Check SessionStorage"** to verify the PKCE code verifier is stored
5. Click **"Clear Storage"** to reset for another test

## What This Tests

- ✅ PKCE flow configuration
- ✅ Code verifier generation and storage
- ✅ Authorization code exchange
- ✅ Proper OAuth redirect flow
- ✅ No tokens in URL (security)

## Troubleshooting

**"Configuration Missing" error:**
- Make sure you've created `test-pkce-config.js` from the example file

**"Invalid Configuration" error:**
- You need to replace the placeholder values in `test-pkce-config.js` with your actual Supabase credentials

**OAuth flow shows `#access_token=...` instead of `?code=...`:**
- This means PKCE is not enabled. Check your Supabase dashboard settings and client configuration.

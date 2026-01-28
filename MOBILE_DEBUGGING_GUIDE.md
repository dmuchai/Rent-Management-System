# Debugging Mobile App in Android Emulator

## How to See Console Logs

Since your mobile app is running locally on the emulator (not through Vercel), you need to use **Chrome DevTools** to see the logs:

### Method 1: Chrome Remote Debugging (Recommended)

1. **Open Chrome on your computer** and navigate to:
   ```
   chrome://inspect/#devices
   ```

2. **Make sure the emulator is running** with your app open

3. **You should see your app listed** under "Remote Target"
   - Look for something like "Rent Management System" or "localhost"

4. **Click "inspect"** to open DevTools

5. **Go to the Console tab** to see all `console.log()` statements from your app

### Method 2: Android Studio Logcat

1. In Android Studio, click the **Logcat** tab at the bottom
2. Filter by "chromium" or "Console" to see JavaScript logs
3. Look for messages prefixed with `[Auth]`, `[Login]`, etc.

## Common Issues & Solutions

### Issue 1: Login Not Redirecting

**Symptoms:** Login succeeds but stays on login page

**Debug Steps:**
1. Open Chrome DevTools (chrome://inspect)
2. Look for these log messages after login:
   ```
   [Login] User already authenticated, redirecting to dashboard
   ✅ Auth verification successful
   ```

3. Check if you see any errors in the Console

**Possible Causes:**
- Session not persisting in Capacitor
- API not reachable from emulator
- CORS issues

### Issue 2: Wrong User Profile

**Symptoms:** Logging in with one email shows another user's data

**This indicates a backend issue.** Check:
1. The user ID in the logs
2. Whether the email-to-user lookup is correct

## Testing API Connectivity

To verify the mobile app can reach your backend:

1. Open Chrome DevTools (chrome://inspect)
2. Go to **Network tab**
3. Try to login
4. Look for requests to your API (e.g., `https://property-manager-ke.vercel.app/api/auth`)
5. Check if they return 200 OK or errors

## Quick Fixes

### If Login Redirect Doesn't Work:

Try adding this to your `capacitor.config.ts`:

```typescript
server: {
  cleartext: true,
  // Remove or comment out the url property for local testing
  // url: process.env.CAPACITOR_SERVER_URL,
}
```

Then rebuild:
```bash
npm run mobile:build
```

### If You See CORS Errors:

The backend needs to allow requests from `capacitor://localhost`. Check the CORS configuration in your API.

## Viewing Logs in Real-Time

Run this in Chrome DevTools Console to see auth state:

```javascript
// Check current session
supabase.auth.getSession().then(({data}) => console.log('Session:', data));

// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event, 'Session:', session);
});
```

## Next Steps

Once you have Chrome DevTools open:
1. Clear the app data (Settings → Apps → Rent Management System → Clear Data)
2. Restart the app
3. Try logging in again
4. Watch the Console tab for errors
5. Share any error messages you see

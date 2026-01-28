# Quick Fix: Clear App Data

The issue is that React Query has cached stale data. Here's what to do:

## Steps to Fix

1. **Clear app data completely**:
   - Go to Settings → Apps → Landee & Moony
   - Tap "Storage"
   - Tap "Clear Data" (not just cache)
   - Tap "Clear Cache" as well

2. **Force stop the app**:
   - Settings → Apps → Landee & Moony
   - Tap "Force Stop"

3. **Restart the app** from the emulator

4. **Try logging in again**

The new code should now run properly since there's no cached query data.

## If Still Not Working

The fundamental issue is that `useAuth()` query is cached and not re-running. We need to either:
- Use a different approach that doesn't rely on React Query caching
- Force invalidate all queries on app start
- Use Supabase session directly without the API call

Let me know the results after clearing data!

# Migration to Vercel Serverless Functions

## Overview
Migrated from split-stack architecture (Vercel Frontend + Render Backend) to unified Vercel deployment with serverless functions.

## Architecture Change

### Before (Split-Stack)
```
Vercel (Frontend) → CORS → Render (Backend) → Supabase (Database)
- Cold starts (30-60s on Render free tier)
- Cross-domain authentication complexity
- CORS configuration required
- Token management in localStorage
```

### After (Unified Stack)
```
Vercel (Frontend + API Functions) → Supabase (Database)
- No cold starts (instant serverless functions)
- Same-origin requests (no CORS)
- Simplified authentication
- Better performance
```

## Changes Made

### 1. API Routes Structure
Created `/api` directory with serverless functions:
- `/api/_lib/auth.ts` - Shared authentication utilities
- `/api/_lib/db.ts` - Database connection with postgres-js
- `/api/auth/user.ts` - GET user profile
- `/api/auth/logout.ts` - POST logout
- `/api/auth/sync-user.ts` - POST sync user to database
- `/api/properties/index.ts` - GET/POST properties
- `/api/properties/[id].ts` - GET/PUT/DELETE specific property
- `/api/units/index.ts` - GET/POST units
- `/api/units/[id].ts` - GET/PUT/DELETE specific unit
- `/api/tenants/index.ts` - GET/POST tenants
- `/api/tenants/[id].ts` - PUT specific tenant
- `/api/payments/index.ts` - GET/POST payments
- `/api/leases/index.ts` - GET/POST leases
- `/api/dashboard/stats.ts` - GET dashboard statistics

### 2. Frontend Configuration
Updated `client/src/lib/config.ts`:
- Changed `API_BASE_URL` to empty string for production (same-origin)
- Removed Render backend references
- Simplified configuration

### 3. Vercel Configuration
Updated `vercel.json`:
- Added `/api/*` rewrites for serverless functions
- Configured Node.js runtime for TypeScript functions
- Set environment variables for Supabase and database

### 4. Dependencies
Added:
- `@vercel/node` - TypeScript types for Vercel functions
- `postgres` - PostgreSQL client for serverless (already installed)

## Deployment Steps

### 1. Set Environment Variables in Vercel
Go to Project Settings → Environment Variables and add:
- `DATABASE_URL` - Your Supabase PostgreSQL connection string
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for admin operations)

### 2. Deploy to Vercel
```bash
git add .
git commit -m "Migrate to Vercel serverless functions"
git push origin main
```

Vercel will automatically:
1. Build the frontend (React/Vite)
2. Deploy serverless functions from `/api` directory
3. Configure routing

### 3. Test Authentication
The authentication flow now works as follows:
1. User visits `/api/login` (will need to create login function or use Supabase Auth UI)
2. After login, Supabase returns JWT token
3. Frontend stores token in localStorage
4. All API requests include `Authorization: Bearer <token>` header
5. Serverless functions verify token with Supabase

### 4. Update Frontend Login Flow
You'll need to update the login flow since we're using serverless functions:

Option A: Use Supabase Auth directly in frontend
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

// Store token
if (data.session) {
  localStorage.setItem('supabase-auth-token', data.session.access_token)
}
```

Option B: Create login serverless function
Create `/api/auth/login.ts` to handle email/password login

## Benefits

### Performance
- ✅ **Reduced cold starts** - Vercel functions use Fluid compute to minimize cold starts, though they can still occur on first invocation or after periods of inactivity (especially on Hobby plan). Significantly better than Render's 30-60s cold starts.
- ✅ **Global CDN** - Functions deployed to edge locations
- ✅ **Same-origin** - Faster requests, no pre-flight CORS checks

### Developer Experience
- ✅ **Single deployment** - One git push deploys everything
- ✅ **No CORS config** - Same-origin requests
- ✅ **Better debugging** - Vercel logs integrated with frontend

### Cost
- ✅ **Free tier** - Vercel Hobby plan includes:
  - 100GB bandwidth
  - 150,000 Function Invocations per month
  - 100 hours function execution time
  - Far exceeds typical usage for this app

### Scalability
- ✅ **Automatic scaling** - Vercel handles traffic spikes
- ✅ **Serverless** - No server management
- ✅ **PostgreSQL** - Keep relational database benefits

## Removed Components

You can now remove:
- `server/` directory (Express backend no longer needed)
- Render deployment configuration
- CORS configuration in routes
- Cross-domain authentication logic (simplified)

## Next Steps

1. ✅ Deploy to Vercel
2. ✅ Set environment variables
3. ⏳ Test all API endpoints
4. ⏳ Update authentication flow (if using custom login)
5. ⏳ Remove old Render deployment
6. ⏳ Update documentation

## Troubleshooting

### Issue: 404 on API routes
**Solution**: Check `vercel.json` rewrites are correct and functions are in `/api` directory

### Issue: Database connection errors
**Solution**: Verify `DATABASE_URL` environment variable is set in Vercel

### Issue: Authentication failing
**Solution**: Check `SUPABASE_SERVICE_ROLE_KEY` is set and valid

### Issue: Function timeout
**Solution**: Optimize database queries or increase `maxDuration` in `vercel.json` (max 60s on Hobby plan)

## Rollback Plan

If needed, revert by:
1. Change `API_BASE_URL` back to Render URL in `config.ts`
2. Revert `vercel.json` to previous version
3. Keep using Render backend

## Migration Date
December 5, 2025

## Author
Automated migration with guidance

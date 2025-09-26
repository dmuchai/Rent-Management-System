# Railway Backend Deployment Guide

## Quick Deploy to Railway (Recommended)

Railway is the easiest platform for deploying your Express.js backend. Follow these steps:

### Step 1: Create Railway Account & Deploy

1. **Sign up**: Go to [railway.app](https://railway.app) and sign up with GitHub
2. **New Project**: Click "New Project" → "Deploy from GitHub repo"
3. **Select Repository**: Choose `dmuchai/Rent-Management-System`
4. **Deploy**: Railway will automatically detect and deploy your Node.js app

### Step 2: Configure Environment Variables

In Railway dashboard, go to your project → Variables tab and add:

```bash
# Required Supabase Variables
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret

# Production Settings
NODE_ENV=production

# Railway automatically sets PORT - don't override this
```

### Step 3: Get Your Backend URL

After deployment, Railway will provide a URL like:
```
https://rent-management-system-production.up.railway.app
```

### Step 4: Update Frontend Configuration

Update `client/src/lib/config.ts` with your Railway URL:

```typescript
// Replace this line:
railway: 'https://rent-management-system-production.up.railway.app',

// With your actual Railway URL:
railway: 'https://your-actual-railway-url.up.railway.app',
```

### Step 5: Test Your Backend

Visit these URLs to test:
- Health check: `https://your-railway-url.up.railway.app/api/health` (should return 404, that's expected)
- Login page: `https://your-railway-url.up.railway.app/api/login`

### Step 6: Update Frontend & Redeploy

1. **Commit changes**:
```bash
git add .
git commit -m "Configure frontend for Railway backend deployment"
git push origin main
```

2. **Vercel auto-deploys**: Your frontend will automatically update with the new backend URL

## Alternative: Render Deployment

If you prefer Render (has free tier):

### Step 1: Deploy to Render
1. Go to [render.com](https://render.com)
2. "New" → "Web Service"
3. Connect GitHub repo: `dmuchai/Rent-Management-System`
4. Configure:
   - **Name**: `rent-management-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

### Step 2: Environment Variables
Add the same Supabase variables in Render dashboard.

### Step 3: Update Frontend
Change `BACKEND_PLATFORM` to `'render'` in `client/src/lib/config.ts`

## Production Checklist

### ✅ Before Deploying Backend:
- [ ] All environment variables ready (Supabase credentials)
- [ ] Railway/Render account created
- [ ] Repository connected to platform

### ✅ After Backend Deployment:
- [ ] Backend URL obtained from Railway/Render
- [ ] Environment variables configured
- [ ] Backend health check responds (even if 404)

### ✅ Frontend Update:
- [ ] `config.ts` updated with actual backend URL
- [ ] `BACKEND_PLATFORM` set correctly
- [ ] Changes committed and pushed to GitHub
- [ ] Vercel automatically redeployed frontend

### ✅ End-to-End Testing:
- [ ] Frontend loads from Vercel
- [ ] API calls reach backend (check Network tab)
- [ ] Authentication works
- [ ] Database operations function

## Troubleshooting

### Backend Issues:
- **Build fails**: Check Railway/Render logs for error messages
- **Environment variables**: Ensure all Supabase vars are set
- **Port issues**: Railway/Render handle ports automatically

### Frontend Issues:
- **API calls fail**: Check Network tab for CORS errors
- **Wrong URL**: Verify `config.ts` has correct backend URL
- **CORS errors**: Backend CORS config allows your Vercel domain

### CORS Configuration:
Your backend already includes CORS config for:
```javascript
'https://rent-management-system-bblda265x-dmmuchai-1174s-projects.vercel.app'
```

If you get a different Vercel URL, update the CORS config in `server/routes.ts`.

## Benefits of This Setup

✅ **Separate scaling**: Scale frontend and backend independently
✅ **Better performance**: Each service optimized for its purpose  
✅ **Cost efficiency**: Pay only for actual backend usage
✅ **Easy development**: Keep familiar Express.js workflow
✅ **Better debugging**: Separate logs and metrics for each service

## Cost Estimates

- **Railway**: ~$5-10/month for basic usage
- **Render**: Free tier available, then $7/month
- **Vercel Frontend**: Free for personal projects
- **Total**: $5-10/month for full-stack deployment

This is much cheaper than most managed full-stack platforms!
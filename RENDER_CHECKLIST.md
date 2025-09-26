# 📋 Render Deployment Checklist

## Before You Start

- [ ] Supabase credentials ready (URL, keys, JWT secret)
- [ ] GitHub repository up to date
- [ ] `render.yaml` configuration reviewed

## Render Deployment Steps

### 1. Create Render Account
- [ ] Sign up at [render.com](https://render.com)
- [ ] Connect GitHub account
- [ ] Verify email address

### 2. Deploy Backend Service
- [ ] Click "New +" → "Web Service"
- [ ] Connect repository: `dmuchai/Rent-Management-System`
- [ ] Configure service settings:
  ```
  Name: rent-management-backend
  Region: Oregon (US West)
  Branch: main
  Runtime: Node
  Build Command: npm install && npm run build
  Start Command: npm start
  ```

### 3. Environment Variables
Add these in Render dashboard → Environment tab:
- [ ] `SUPABASE_URL=your_supabase_project_url`
- [ ] `SUPABASE_ANON_KEY=your_supabase_anon_key`
- [ ] `SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key`
- [ ] `SUPABASE_JWT_SECRET=your_supabase_jwt_secret`
- [ ] `NODE_ENV=production`

### 4. Deploy & Test
- [ ] Click "Create Web Service"
- [ ] Wait for deployment (2-3 minutes)
- [ ] Note your Render URL: `https://__________.onrender.com`
- [ ] Test health endpoint: `https://your-url.onrender.com/api/health`

### 5. Update Frontend
- [ ] Update `client/src/lib/config.ts`:
  ```typescript
  render: 'https://your-actual-render-url.onrender.com',
  ```
- [ ] Commit and push changes:
  ```bash
  git add .
  git commit -m "Update frontend for Render backend deployment"
  git push origin main
  ```

### 6. Verify Full-Stack Integration
- [ ] Frontend loads from Vercel: ✅ Already working
- [ ] API calls reach Render backend
- [ ] Authentication flows work
- [ ] Database operations function
- [ ] No CORS errors in browser console

## Post-Deployment

### Monitor Service
- [ ] Check Render dashboard for service status
- [ ] Review deployment logs for errors
- [ ] Monitor free tier usage (750 hours/month)

### Performance Notes
- [ ] First request after sleep (~15 min idle) takes ~30 seconds
- [ ] Subsequent requests are fast
- [ ] Consider keep-alive service if needed

### Future Upgrades
- [ ] Monitor monthly usage
- [ ] Consider Render Pro ($7/month) when ready for production
- [ ] Set up custom domain on paid plan

## Troubleshooting

### If Deployment Fails:
1. Check Render logs in dashboard
2. Verify all environment variables are set
3. Ensure `npm start` works locally
4. Check package.json for correct scripts

### If API Calls Fail:
1. Check browser Network tab for errors
2. Verify Render service is running
3. Test API endpoints directly in browser
4. Check CORS configuration

### If Service Won't Start:
1. Review Render logs for startup errors
2. Verify PORT is not hardcoded (Render sets it)
3. Check Node.js version compatibility
4. Ensure all dependencies are in package.json

## Success Criteria

✅ **Backend Health Check**: `https://your-render-url.onrender.com/api/health` returns 404 (expected)
✅ **Frontend Integration**: Vercel frontend can make API calls to Render backend  
✅ **Authentication**: Login/logout flow works end-to-end
✅ **Database Operations**: CRUD operations function properly
✅ **No Console Errors**: Browser console shows no CORS or API errors

## Cost Summary

- **Render Backend**: FREE (750 hours/month)
- **Vercel Frontend**: FREE (unlimited for personal)
- **Supabase Database**: FREE (up to limits)
- **Total Monthly Cost**: $0 🎉

Perfect for development, testing, and personal projects!
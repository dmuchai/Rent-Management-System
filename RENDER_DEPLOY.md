# 🚀 Deploy Backend to Render (Free Tier)

## Why Render Free Tier?

✅ **$0/month** - Completely free for personal projects
✅ **750 hours/month** - Plenty for development and testing
✅ **Auto-deployments** - GitHub integration included
✅ **Easy setup** - No credit card required to start
✅ **PostgreSQL** - Free 1GB database if needed (you have Supabase)

## Step-by-Step Deployment

### Step 1: Create Render Account & Deploy

1. **Sign up**: Go to [render.com](https://render.com)
2. **Connect GitHub**: Click "New +" → "Web Service"
3. **Connect Repository**: 
   - Click "Connect account" → Authorize GitHub
   - Select `dmuchai/Rent-Management-System`
4. **Configure Service**:
   ```
   Name: rent-management-backend
   Region: Oregon (US West) - fastest for most users
   Branch: main
   Root Directory: . (leave blank)
   Runtime: Node
   Build Command: npm install && npm run build
   Start Command: npm start
   ```

### Step 2: Configure Environment Variables

In Render dashboard → Environment tab, add these variables:

```bash
# Supabase Configuration (Required)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret

# Production Settings
NODE_ENV=production

# Note: Render automatically sets PORT - don't override
```

### Step 3: Deploy & Get URL

1. **Deploy**: Click "Create Web Service"
2. **Wait**: First deployment takes 2-3 minutes
3. **Get URL**: You'll get something like:
   ```
   https://rent-management-backend-abc123.onrender.com
   ```

### Step 4: Update Frontend Configuration

Update your frontend to use Render backend:

**File to edit**: `client/src/lib/config.ts`

Change this line:
```typescript
const BACKEND_PLATFORM = 'railway'; // Change to 'render'
```

And update the Render URL:
```typescript
render: 'https://your-actual-render-url.onrender.com',
```

### Step 5: Test Backend

Visit these URLs to verify:
- **Health check**: `https://your-render-url.onrender.com/api/health`
- **Login page**: `https://your-render-url.onrender.com/api/login`

### Step 6: Redeploy Frontend

```bash
# Commit the frontend changes
git add .
git commit -m "Configure frontend for Render backend deployment"
git push origin main
```

Vercel will automatically redeploy your frontend with the new backend URL!

## Render Free Tier Limitations

### ⚠️ Important to Know:
- **Sleep mode**: Service sleeps after 15 minutes of inactivity
- **Wake up time**: ~30 seconds to wake up from sleep
- **Monthly hours**: 750 hours/month (about 25 hours/day)
- **No custom domains** on free tier

### 💡 Solutions:
- **Keep-alive service**: Set up a simple ping service if needed
- **Upgrade later**: $7/month for always-on service when ready
- **Perfect for development**: Great for testing and demos

## Render Configuration Files

### render.yaml (Optional)
If you want infrastructure-as-code, create `render.yaml`:

```yaml
services:
  - type: web
    name: rent-management-backend
    env: node
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: SUPABASE_JWT_SECRET
        sync: false
```

## Monitoring & Logs

### Render Dashboard Features:
- **Real-time logs**: View application logs
- **Metrics**: CPU, memory usage
- **Deploy history**: Track deployments
- **Environment variables**: Manage secrets

### Useful Commands:
```bash
# View logs (if you have Render CLI)
render logs -s your-service-id

# Manual redeploy
render deploy -s your-service-id
```

## Cost Comparison

| Platform | Free Tier | Paid Tier | Best For |
|----------|-----------|-----------|----------|
| **Render** | ✅ 750hrs/month | $7/month always-on | **Development & Testing** |
| Railway | ❌ $5/month min | $5/month + usage | Production apps |
| Vercel Functions | ✅ 100GB-hrs/month | $20/month | Serverless preference |

## Troubleshooting

### Common Issues:

1. **Build Fails**
   - Check Render logs for specific errors
   - Verify package.json scripts are correct
   - Ensure all dependencies are in package.json

2. **Service Won't Start**
   - Check that `npm start` command works locally
   - Verify PORT is not hardcoded (Render sets it automatically)
   - Check environment variables are set

3. **CORS Errors**
   - Verify your Vercel URL is in CORS whitelist
   - Check Network tab for actual error messages

4. **Database Connection Issues**
   - Verify all Supabase environment variables
   - Test Supabase connection from Render logs

### Pro Tips:

- **Logs are your friend**: Always check Render logs first
- **Environment variables**: Use Render dashboard, not .env files
- **Sleep mode**: First request after sleep will be slower
- **Free tier monitoring**: Keep track of your 750-hour monthly limit

## Next Steps After Deployment

1. **✅ Backend deployed on Render**
2. **✅ Frontend updated to use Render URL**
3. **✅ Both services talking to each other**
4. **✅ Full-stack app live and functional**

Your total cost: **$0/month** with Render free tier + Vercel free tier! 🎉

## Upgrade Path

When you're ready for production:
- **Render Pro**: $7/month for always-on service
- **Custom domain**: Available on paid plans
- **Better performance**: No sleep mode delays
- **Priority support**: Faster issue resolution

Render's free tier is perfect for development, testing, and small personal projects!
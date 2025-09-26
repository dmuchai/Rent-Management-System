# Backend Deployment Guide

## Option 1: Frontend (Vercel) + Backend (Railway/Render/DigitalOcean)

This guide covers deploying your Express.js backend separately while keeping the frontend on Vercel.

## Architecture Overview

```
Frontend (Vercel)          Backend (Railway/Render)       Database (Supabase)
├── React App             ├── Express.js Server          ├── PostgreSQL
├── Static Assets         ├── API Routes                 ├── Row Level Security
└── CDN Delivery          └── Authentication             └── Real-time features
```

## Railway Deployment (Recommended)

### Step 1: Prepare for Railway
1. Create account at [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Railway will auto-detect Node.js project

### Step 2: Railway Configuration
Create `railway.toml` in your project root:

```toml
[build]
builder = "nixpacks"
buildCommand = "npm install && npm run build"

[deploy]
startCommand = "npm start"
restartPolicyType = "always"

[env]
NODE_ENV = "production"
```

### Step 3: Environment Variables in Railway
Set these in Railway dashboard:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `NODE_ENV=production`
- `PORT` (Railway sets this automatically)

## Render Deployment (Free Tier Available)

### Step 1: Prepare for Render
1. Create account at [render.com](https://render.com)
2. Connect GitHub repository
3. Choose "Web Service"

### Step 2: Render Configuration
In Render dashboard:
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Environment**: Node
- **Instance Type**: Free tier available

## DigitalOcean App Platform

### Step 1: Create App
1. Go to [DigitalOcean Apps](https://cloud.digitalocean.com/apps)
2. Connect GitHub repository
3. Configure as Node.js app

### Step 2: App Spec Configuration
```yaml
name: rent-management-backend
services:
- name: api
  source_dir: /
  github:
    repo: dmuchai/Rent-Management-System
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
```

## Frontend Configuration for External Backend

### Update API Base URL
In your frontend code, you'll need to update the API base URL to point to your deployed backend.

Create/update `client/src/lib/config.ts`:
```typescript
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend-app.railway.app'  // Replace with actual backend URL
  : 'http://localhost:5000';

export { API_BASE_URL };
```

### Update API Client
Modify `client/src/lib/queryClient.ts` to use the external backend:
```typescript
import { API_BASE_URL } from './config';

export async function apiRequest(method: string, path: string, data?: any) {
  const url = `${API_BASE_URL}${path}`;
  // ... rest of your existing code
}
```

## Deployment Process

### 1. Deploy Backend First
Choose your platform and deploy:
```bash
# For Railway - just connect GitHub repo
# For Render - connect repo and configure
# For DigitalOcean - use App Platform
```

### 2. Get Backend URL
Once deployed, you'll get a URL like:
- Railway: `https://rent-management-system-production.up.railway.app`
- Render: `https://rent-management-system.onrender.com`
- DigitalOcean: `https://rent-management-system-xyz.ondigitalocean.app`

### 3. Update Frontend Configuration
Update the API_BASE_URL in your frontend code with the actual backend URL.

### 4. Redeploy Frontend
```bash
git add .
git commit -m "Update API base URL for production backend"
git push origin main
```
Vercel will automatically redeploy your frontend.

## Benefits of This Architecture

✅ **Keep existing Express.js code unchanged**
✅ **Better performance** - specialized hosting for each layer
✅ **Independent scaling** - scale frontend and backend separately  
✅ **Easier development** - familiar Express.js development workflow
✅ **Cost effective** - pay only for what you use on each platform
✅ **Better debugging** - separate logs and metrics for each service

## CORS Configuration

Ensure your backend allows requests from your Vercel frontend:

```javascript
// In your Express server
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://rent-management-system-bblda265x-dmmuchai-1174s-projects.vercel.app'
  ],
  credentials: true
}));
```

## Next Steps

1. Choose your preferred backend platform
2. Deploy backend using the guides above
3. Update frontend API configuration
4. Test end-to-end functionality
5. Set up monitoring and logging

This architecture gives you the best of both worlds: Vercel's excellent frontend hosting and a robust backend hosting solution that supports your existing Express.js application.
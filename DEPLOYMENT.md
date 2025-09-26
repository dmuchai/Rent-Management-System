# Deploying Rent Management System to Vercel

This guide will walk you through deploying your full-stack Rent Management System to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Supabase Project**: Have your Supabase database ready with credentials

## Step 1: Prepare Your Repository

Ensure all the deployment files are committed:
```bash
git add .
git commit -m "feat: Add Vercel deployment configuration"
git push origin main
```

## Step 2: Set Up Vercel Project

### Option A: Deploy via Vercel Dashboard
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will detect it as a Node.js project

### Option B: Deploy via Vercel CLI
```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy from your project directory
cd /path/to/Rent-Management-System
vercel --prod
```

## Step 3: Configure Environment Variables

In your Vercel dashboard, go to Project Settings → Environment Variables and add:

### Required Variables:
```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
NODE_ENV=production
```

### Optional Variables (if using these features):
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password
PESAPAL_CONSUMER_KEY=your_pesapal_consumer_key
PESAPAL_CONSUMER_SECRET=your_pesapal_consumer_secret
PESAPAL_BASE_URL=https://cybqa.pesapal.com/pesapalv3
```

## Step 4: Domain Configuration

1. **Custom Domain** (Optional): In Vercel dashboard → Domains, add your custom domain
2. **Default URL**: Vercel provides a URL like `https://rent-management-system.vercel.app`

## Step 5: Database Setup

Ensure your Supabase database is properly configured:

1. **Row Level Security (RLS)**: Enable RLS on all tables
2. **Policies**: Set up proper security policies for your tables
3. **API Keys**: Use the Service Role key for server-side operations

## Step 6: Test Your Deployment

1. Visit your Vercel URL
2. Test the main functionality:
   - User authentication
   - Property management
   - Tenant management  
   - Payment recording

## Troubleshooting

### Common Issues:

1. **Build Errors**: Check Vercel build logs for specific error messages
2. **Environment Variables**: Ensure all required env vars are set in Vercel
3. **Database Connection**: Verify Supabase credentials and network access
4. **API Routes**: Check that serverless functions are working at `/api/*`

### Debug Steps:

1. **Check Logs**: Vercel → Functions tab shows runtime logs
2. **Test API**: Visit `https://your-app.vercel.app/api/health` for health check
3. **Build Locally**: Run `npm run build:vercel` to test build process

## Performance Optimization

### Recommendations:

1. **Code Splitting**: The build shows chunks > 500KB - consider dynamic imports
2. **Image Optimization**: Use Vercel's Image component for better performance
3. **Caching**: Implement proper caching strategies for API responses

### Example Code Splitting:
```javascript
// Instead of direct imports
import { SomeComponent } from './components/SomeComponent';

// Use dynamic imports
const SomeComponent = lazy(() => import('./components/SomeComponent'));
```

## Production Considerations

1. **Environment Variables**: Never commit `.env` files
2. **Security**: Review all API endpoints for proper authentication
3. **Monitoring**: Set up error tracking (Sentry, etc.)
4. **Backups**: Ensure regular Supabase backups are configured

## Support

If you encounter issues:
1. Check Vercel documentation: [vercel.com/docs](https://vercel.com/docs)
2. Review build logs in Vercel dashboard
3. Test locally with production environment variables

## Current Deployment Status

- ✅ Frontend build configured
- ✅ Basic serverless API setup
- ⚠️  Full API integration pending (see api/index.js for placeholder)
- ✅ Environment variables configured
- ✅ Build process optimized

**Note**: The current API setup includes a health check endpoint. For full functionality, you may need to adapt the Express server to work with Vercel's serverless architecture or consider using Vercel's API routes pattern.
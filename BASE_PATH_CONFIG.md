# Base Path Configuration Guide

## Overview
This application supports deployment to both root paths and subdirectories using the `VITE_BASE_PATH` environment variable.

## Configuration

### Root Path Deployment (Default)
When deploying to the root of a domain (e.g., `https://example.com/`):

```bash
# .env or .env.production
VITE_BASE_PATH=
```

Or simply omit the variable entirely.

### Subdirectory Deployment
When deploying to a subdirectory (e.g., `https://example.com/app/`):

```bash
# .env or .env.production
VITE_BASE_PATH=/app
```

**Important**: 
- Include the leading slash
- Do NOT include trailing slash
- Match your server/CDN configuration

## How It Works

### Client-Side (React Components)
The `buildPath()` helper function in `client/src/lib/config.ts` automatically prepends the base path:

```typescript
import { buildPath } from "@/lib/config";

// Always use buildPath for internal navigation
window.location.href = buildPath('api/login');  // → /app/api/login
window.location.href = buildPath('dashboard');  // → /app/dashboard
```

### Server-Side (API Routes)
API routes use relative URLs (without leading slash) to respect the base path:

```javascript
// Relative URL automatically respects base path
window.location.href = 'dashboard';     // → /app/dashboard
window.location.href = 'api/login';     // → /app/api/login
```

## Files Updated

### Client-Side Components
- ✅ `client/src/components/tenants/TenantForm.tsx`
- ✅ `client/src/components/properties/PropertyForm.tsx`
- ✅ `client/src/components/payments/PaymentForm.tsx`
- ✅ `client/src/components/documents/DocumentManager.tsx`
- ✅ `client/src/lib/auth.ts`
- ✅ `client/src/pages/landing.tsx`
- ✅ `client/src/pages/dashboard/landlord.tsx`

### Server-Side API Routes
- ✅ `api/login.ts`
- ✅ `api/register.ts`

### Configuration
- ✅ `client/src/lib/config.ts` - Added `BASE_PATH` and `buildPath()`

## Deployment Examples

### Vercel (Root Path)
```bash
# No configuration needed - deploys to root by default
vercel --prod
```

### Vercel (Subdirectory)
```bash
# Set environment variable in Vercel dashboard
# Project Settings → Environment Variables
# Key: VITE_BASE_PATH
# Value: /app
```

### Vite Build Configuration
If using Vite's base option, ensure it matches:

```typescript
// vite.config.ts
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  // ...
});
```

### Nginx (Subdirectory)
```nginx
location /app/ {
    alias /var/www/html/app/;
    try_files $uri $uri/ /app/index.html;
}
```

### Apache (Subdirectory)
```apache
<Directory "/var/www/html/app">
    RewriteEngine On
    RewriteBase /app/
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /app/index.html [L]
</Directory>
```

## Testing

### Test Root Path Deployment
1. Set `VITE_BASE_PATH=` (empty)
2. Build: `npm run build`
3. Serve from root: `npx serve -s dist/public`
4. Visit: `http://localhost:3000/`
5. Test navigation to `/api/login`, `/dashboard`, etc.

### Test Subdirectory Deployment
1. Set `VITE_BASE_PATH=/app`
2. Build: `npm run build`
3. Serve from subdirectory:
   ```bash
   mkdir -p dist/app
   cp -r dist/public/* dist/app/
   npx serve -s dist
   ```
4. Visit: `http://localhost:3000/app/`
5. Test navigation to `/app/api/login`, `/app/dashboard`, etc.

## Troubleshooting

### Issue: 404 on navigation
**Cause**: Base path not configured correctly
**Solution**: Ensure `VITE_BASE_PATH` matches your deployment path

### Issue: Assets not loading
**Cause**: Vite `base` option not set
**Solution**: Update `vite.config.ts`:
```typescript
base: process.env.VITE_BASE_PATH || '/',
```

### Issue: API calls failing
**Cause**: Using absolute paths (`/api/login`) instead of `buildPath()`
**Solution**: Replace with:
```typescript
window.location.href = buildPath('api/login');
```

### Issue: Redirects going to root
**Cause**: Hardcoded absolute paths
**Solution**: Use relative paths or `buildPath()` helper

## Migration from Hardcoded Paths

### Before (Hardcoded)
```typescript
// ❌ Breaks in subdirectory
window.location.href = '/api/login';
window.location.href = '/dashboard';
```

### After (Configurable)
```typescript
// ✅ Works in any path
import { buildPath } from "@/lib/config";
window.location.href = buildPath('api/login');
window.location.href = buildPath('dashboard');
```

## Environment Variable Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `VITE_BASE_PATH` | string | `''` | Base path for subdirectory deployments |
| `VITE_API_BASE_URL` | string | `''` | API base URL (empty for same-origin) |
| `VITE_SUPABASE_URL` | string | required | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | string | required | Supabase anonymous key |

## Best Practices

1. **Always use `buildPath()`** for client-side navigation
2. **Use relative URLs** in server-rendered HTML (API routes)
3. **Test both root and subdirectory** deployments before releasing
4. **Document custom base paths** in deployment guides
5. **Avoid hardcoded absolute paths** in code

## See Also

- [Vite Base Path Documentation](https://vitejs.dev/guide/build.html#public-base-path)
- [React Router Base URL](https://reactrouter.com/docs/en/v6/getting-started/concepts#basename)
- [Environment Variables Guide](.env.example)

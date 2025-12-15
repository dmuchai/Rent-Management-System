# Cookie Security Configuration

## Current Setup

### Development Environment
- **Frontend**: `http://localhost:5173` (Vite dev server)
- **Backend**: `http://localhost:5000` (Express server)
- **Relationship**: Cross-origin
- **Cookie Settings**: `SameSite=None; Secure` (requires HTTPS or localhost exception)

### Production Environment (Vercel)
- **Frontend**: `https://property-manager-ke.vercel.app`
- **Backend**: Same domain via rewrites (e.g., `https://property-manager-ke.vercel.app/api/*`)
- **Relationship**: Same-origin
- **Cookie Settings**: `SameSite=Lax; Secure`

## Cookie Strategy

The application automatically detects whether requests are cross-origin or same-origin and adjusts cookie settings accordingly:

### Same-Origin (Production - Current Default)
```
SameSite=Lax; Secure; HttpOnly; Path=/
```
- ✅ Better CSRF protection
- ✅ Cookies sent on navigation and same-origin requests
- ❌ Cookies NOT sent on cross-origin POST requests

### Cross-Origin (Development or Multi-Domain Setup)
```
SameSite=None; Secure; HttpOnly; Path=/
```
- ✅ Cookies work across different domains/subdomains
- ✅ Enables API on separate domain (e.g., `api.example.com`)
- ⚠️ Requires HTTPS (or localhost for development)
- ⚠️ Less CSRF protection (relies on CORS)

## Deployment Scenarios

### ✅ Scenario 1: Single Domain (Current - Recommended)
**Example**: `property-manager-ke.vercel.app`
- Frontend: `https://property-manager-ke.vercel.app`
- API: `https://property-manager-ke.vercel.app/api/*`
- **Cookie Strategy**: `SameSite=Lax` ✅ (automatically detected)

### ⚠️ Scenario 2: Different Subdomains
**Example**: Frontend and API on different subdomains
- Frontend: `https://app.example.com`
- API: `https://api.example.com`
- **Required Change**: The API will detect cross-origin and use `SameSite=None` automatically
- **Requirements**:
  - Both domains must use HTTPS
  - CORS headers must allow credentials
  - Cookie domain should be set to `.example.com` (requires code change)

### ⚠️ Scenario 3: Completely Different Domains
**Example**: Frontend and API on different domains
- Frontend: `https://myapp.com`
- API: `https://myapi.io`
- **Required Change**: Same as Scenario 2, but cannot share cookies easily
- **Recommendation**: Use Authorization header with JWT tokens instead of cookies

## Verifying Your Setup

### Check if you're same-origin or cross-origin:

1. Open browser DevTools → Network tab
2. Trigger authentication
3. Check the request to `/api/auth/set-session`
4. Look at the `Origin` header:
   - **Same as host**: Same-origin → `SameSite=Lax` ✅
   - **Different from host**: Cross-origin → `SameSite=None` required

### Production Checklist

Before deploying with custom domains:

- [ ] Verify frontend and API are on the same domain
- [ ] If using subdomains, test cookie behavior
- [ ] Check browser DevTools → Application → Cookies
- [ ] Confirm `SameSite` attribute matches your setup
- [ ] Test authentication flow end-to-end
- [ ] Check for "Cookie blocked" warnings in console

## Troubleshooting

### Cookies Not Being Sent

**Symptom**: 401 Unauthorized errors after successful login

**Possible Causes**:
1. **Cross-origin with SameSite=Lax**: API is on different domain/subdomain
   - **Solution**: API automatically detects this, but verify HTTPS is enabled
   
2. **Missing Secure flag**: Browser requires HTTPS for `SameSite=None`
   - **Solution**: Ensure production uses HTTPS (Vercel does this automatically)

3. **CORS misconfiguration**: Credentials not allowed
   - **Solution**: Verify CORS headers include `Access-Control-Allow-Credentials: true`

4. **Third-party cookie blocking**: Browser privacy settings
   - **Solution**: Use same-origin deployment (Scenario 1) or switch to tokens

### Cookie "Blocked" Warnings

**Symptom**: Browser console shows "Cookie has been blocked" warnings

**Cause**: Cross-origin cookies with `SameSite=Lax`

**Solution**: The application should auto-detect and use `SameSite=None`, but you can force it by ensuring the `Origin` header is present in requests.

## Environment Variables

To enable detailed cookie debugging, set:

```bash
DEBUG=true
```

Or for production debugging:
```bash
NODE_ENV=development
```

This will log:
- Request origin detection
- Cross-origin vs same-origin determination
- Cookie configuration being applied
- Whether Secure flag is set

## Security Recommendations

1. **Prefer same-origin deployment** (Scenario 1) when possible
2. **Always use HTTPS** in production
3. **Keep HttpOnly flag** on authentication cookies
4. **Enable CORS only for trusted origins**
5. **Monitor cookie behavior** after any domain changes
6. **Consider using refresh token rotation** for enhanced security

## Current Configuration Location

Cookie settings are configured in:
- `api/auth/set-session.ts` - Where cookies are initially set
- Logic automatically detects cross-origin vs same-origin
- Applies appropriate `SameSite` and `Secure` flags

## References

- [MDN: SameSite Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [Chrome SameSite Updates](https://www.chromium.org/updates/same-site/)
- [Vercel Rewrites Documentation](https://vercel.com/docs/project-configuration#project-configuration/rewrites)

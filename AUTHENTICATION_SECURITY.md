# Authentication Security Documentation

## Overview
This application uses **httpOnly, Secure cookies** for authentication instead of localStorage to prevent XSS attacks.

## Security Model

### ✅ What We Do (Secure)
- **httpOnly Cookies**: Authentication tokens are stored in httpOnly cookies that JavaScript cannot access
- **Secure Flag**: Cookies are only sent over HTTPS in production
- **SameSite=Lax**: Provides CSRF protection while allowing normal navigation
- **Token Verification**: All tokens are verified server-side before setting cookies
- **Automatic Cookie Transmission**: Browsers automatically send cookies with requests (no manual token management)

### ❌ What We Don't Do (Insecure Practices Avoided)
- ~~Store tokens in localStorage~~ (vulnerable to XSS)
- ~~Store tokens in sessionStorage~~ (vulnerable to XSS)
- ~~Pass tokens in URL parameters~~ (logged in browser history, server logs)
- ~~Use long-lived tokens without refresh~~ (we use Supabase's 1-hour default)

## Authentication Flow

### Registration Flow
1. User submits registration form at `/api/register`
2. Supabase creates account and returns tokens
3. Client calls `/api/auth/set-session` with tokens
4. Server verifies tokens with Supabase
5. Server sets httpOnly, Secure cookies
6. Client calls `/api/auth/sync-user` to create database record
7. Redirect to dashboard (cookies sent automatically)

### Login Flow
1. User submits login form at `/api/login`
2. Supabase authenticates and returns tokens
3. Client calls `/api/auth/set-session` with tokens
4. Server verifies tokens with Supabase
5. Server sets httpOnly, Secure cookies
6. Redirect to dashboard (cookies sent automatically)

### OAuth Flow (Google)
1. User clicks "Sign in with Google" at `/api/login`
2. Supabase handles OAuth redirect
3. Callback receives tokens in URL parameters
4. Auth callback page calls `/api/auth/set-session`
5. Server sets httpOnly, Secure cookies
6. Redirect to dashboard

### API Request Flow
1. Client makes request to any `/api/*` endpoint
2. Browser automatically includes httpOnly cookies
3. Server reads token from `supabase-auth-token` cookie
4. Server verifies token with Supabase
5. Server processes request if valid
6. Returns 401 if invalid/expired

## Token Lifecycle

### Token Expiration
- **Access Token**: 1 hour (Supabase default)
- **Refresh Token**: 7 days (cookie Max-Age)

### Token Refresh Strategy
Currently implemented: **Server-side token refresh** (recommended)
- When access token expires, server can use refresh token to get new access token
- Client doesn't need to handle refresh logic
- Future enhancement: Implement automatic refresh endpoint

Alternative (not implemented): Client-side refresh
- Would require exposing refresh token to JavaScript (less secure)
- Not recommended unless absolutely necessary

## XSS Mitigation Layers

### 1. httpOnly Cookies (Primary Defense)
- Tokens cannot be accessed by JavaScript
- Even if XSS vulnerability exists, attacker cannot steal tokens
- **Most important security measure**

### 2. Content Security Policy (Recommended - Not Yet Implemented)
```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' unpkg.com
```
Add to response headers to prevent inline script injection.

### 3. Subresource Integrity (Implemented)
- External scripts (Supabase) loaded with SRI hashes
- Prevents CDN compromise from injecting malicious code
- See: `api/login.ts` and `api/register.ts`

### 4. Input Validation (Implemented)
- All user inputs validated server-side
- See: `api/auth/sync-user.ts` for examples
- Prevents SQL injection, command injection

### 5. Escaped Template Literals (Implemented)
- Supabase credentials injected using JSON.stringify()
- Prevents breaking out of string context
- See: `api/login.ts` lines 176-177

## CSRF Protection

### SameSite=Lax (Implemented)
- Cookies not sent on cross-origin POST requests
- Protects against basic CSRF attacks
- Allows normal navigation (GET requests)

### Future Enhancement: CSRF Tokens
For highly sensitive operations, consider adding CSRF tokens:
1. Server generates unique token per session
2. Token stored in non-httpOnly cookie (readable by JS)
3. Client includes token in request header
4. Server validates both cookies and header match

## Session Management

### Logout
- Client calls `/api/auth/logout` (implemented in `api/auth/logout.ts`)
- Server clears cookies by setting Max-Age=0
- Client clears any cached data
- Redirect to home page

### Session Expiration
- Access token expires after 1 hour
- User must re-authenticate
- Refresh token can be used to get new access token (future enhancement)

## File-by-File Security Summary

### Server-Side
- ✅ `api/auth/set-session.ts` - Sets httpOnly cookies, verifies tokens
- ✅ `api/auth/logout.ts` - Clears cookies
- ✅ `api/_lib/auth.ts` - Reads tokens from cookies, verifies with Supabase
- ✅ `api/login.ts` - Calls set-session endpoint, no localStorage
- ✅ `api/register.ts` - Calls set-session endpoint, no localStorage

### Client-Side
- ✅ `client/src/lib/queryClient.ts` - Removed localStorage, uses credentials: 'include'
- ✅ `client/src/pages/auth-callback.tsx` - Calls set-session, no localStorage
- ✅ `client/src/lib/auth.ts` - Logout clears cookies server-side

## Migration Notes

### Breaking Changes from localStorage Implementation
1. **Old behavior**: Tokens stored in localStorage, manual Authorization header
2. **New behavior**: Tokens in httpOnly cookies, automatic transmission
3. **Impact**: More secure, but cookies must be enabled
4. **Fallback**: None - cookies are required (standard for web auth)

### Backward Compatibility
The auth library (`api/_lib/auth.ts`) still accepts Authorization headers for backward compatibility during migration. This can be removed once all clients use cookie-based auth.

## Testing Checklist

### Manual Testing
- [ ] Register new account → redirects to dashboard
- [ ] Login with existing account → redirects to dashboard
- [ ] Access protected API → returns user data
- [ ] Logout → clears cookies, redirects to home
- [ ] Try to access protected API after logout → returns 401
- [ ] Check browser DevTools → no tokens in localStorage
- [ ] Check browser DevTools → cookies have HttpOnly flag
- [ ] Try to access cookies from console → should fail

### Security Testing
- [ ] XSS attempt: Inject `<script>alert(document.cookie)</script>` → Should not show tokens
- [ ] CSRF attempt: Submit form from different origin → Should fail due to SameSite=Lax
- [ ] Token theft: Try to read cookies from JavaScript → Should fail (httpOnly)

## References

- [OWASP: Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [OWASP: XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

## Future Enhancements

1. **Implement Automatic Token Refresh**
   - Create `/api/auth/refresh` endpoint
   - Use refresh token to get new access token
   - Set new access token cookie
   - Call before access token expires

2. **Add Content Security Policy**
   - Prevent inline scripts
   - Whitelist allowed script sources
   - Report CSP violations to monitoring service

3. **Implement Rate Limiting**
   - Prevent brute force attacks on login
   - Use Redis or similar for distributed rate limiting
   - Return 429 Too Many Requests

4. **Add Session Fingerprinting**
   - Store user agent, IP address with session
   - Validate on each request
   - Detect session hijacking attempts

5. **Implement Multi-Factor Authentication**
   - Use Supabase MFA features
   - Require TOTP or SMS for sensitive operations
   - Backup codes for account recovery

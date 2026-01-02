# Security Testing Evidence

## Purpose
Verify that authentication implements security best practices and protects against common attacks.

## Evidence to Store Here

### Token Protection
- `url-clean.png` - Screenshot showing no tokens in URL (only authorization code)
- `browser-history-clean.png` - Browser history with no access tokens visible
- `localStorage-empty.png` - DevTools showing empty localStorage
- `sessionStorage-pkce-only.png` - DevTools showing only PKCE verifier (no tokens)
- `httponly-cookies.png` - DevTools Cookies panel with HttpOnly flag highlighted

### Network Traffic Analysis
- `network-tab.har` - HAR file export from DevTools Network tab
- `network-tab-oauth-flow.png` - Screenshot of Network tab during OAuth flow
- `cookies-inspection.png` - DevTools Application > Cookies panel

### Replay Attack Prevention
- `code-reuse-blocked.log` - Backend log showing 400 error on authorization code reuse
- `replay-attack-test.mp4` - Video of manual replay attack attempt
- `reset-link-reuse-blocked.png` - Screenshot of error when reusing password reset link
- `invalid-reset-link-error.png` - UI error message for invalid recovery token
- `no-session-on-reuse.png` - DevTools showing no session created on token reuse

## Security Test Scenarios

1. **Token Leakage Prevention**
   - Complete OAuth flow
   - Check browser address bar (should show only `?code=`)
   - Check browser history (no tokens visible)
   - Check DevTools > Application > Storage (no tokens in localStorage/sessionStorage)
   - Check DevTools > Application > Cookies (tokens in httpOnly cookies only)

2. **Authorization Code Replay Attack**
   - Complete OAuth flow and capture authorization code
   - Attempt to exchange same code again
   - Verify 400 error: "Authorization code has already been used"
   - Confirm no session created
   - Check backend logs for security event

3. **Recovery Token Replay Attack**
   - Request password reset
   - Use recovery link to change password
   - Attempt to use same recovery link again
   - Verify error: "Invalid Reset Link"
   - Confirm no session created
   - Check backend logs for rejected attempt

4. **XSS Token Theft**
   - Open DevTools Console
   - Run: `document.cookie` (should not show access tokens)
   - Run: `localStorage.getItem('supabase-auth-token')` (should return null)
   - Run: `sessionStorage.getItem('supabase-auth-token')` (should return null)

5. **Browser Extension Access**
   - Install browser extension with broad permissions
   - Complete OAuth flow
   - Verify extension cannot access tokens (httpOnly cookies)

## HAR File Sanitization

Before committing HAR files:
1. **Remove sensitive headers:**
   - Authorization: Bearer ...
   - Cookie: supabase-auth-token=...
   - Set-Cookie: ...

2. **Redact request bodies:**
   - Password fields
   - Email addresses (use test@example.com)
   - Personal information

3. **Sanitize URLs:**
   - Keep structure, replace actual values
   - Example: `email=test%40example.com`

## Metadata Template

```yaml
file: code-reuse-blocked.log
date: 2026-01-02
tester: Dennis Muchai
environment: Production
attack_type: Authorization Code Replay Attack
test_case: TC-SEC-003 - Code single-use enforcement
result: PASS (attack blocked)
impact: No session created, 400 error returned
notes: Backend correctly rejected reused authorization code
```

# Functional Testing Evidence

## Purpose
Verify that authentication features work as expected from a user perspective.

## Evidence to Store Here

### OAuth Login Flow
- `oauth-login-success.mp4` - Screen recording of complete Google OAuth login
- `url-with-code.png` - Screenshot showing authorization code in URL
- `session-created.json` - API response with session data
- `redirect-dashboard.mp4` - Video showing redirect to dashboard after login

### Password Reset Flow
- `password-reset-flow.mp4` - Complete flow: Email → Reset link → Password change → Login
- `password-reset-email.eml` - Email containing recovery link (sanitized)

### Account Linking
- `account-linking.png` - Screenshot of LinkedAccountsSection component
- `link-google-success.png` - Confirmation message after linking Google account

## Test Scenarios

1. **New User OAuth Registration**
   - Click "Sign in with Google"
   - Authorize app permissions
   - Verify redirect to dashboard
   - Confirm user profile created

2. **Existing User OAuth Login**
   - Click "Sign in with Google"
   - Select existing Google account
   - Verify redirect to dashboard
   - Confirm session established

3. **Password Reset**
   - Click "Forgot Password"
   - Enter email address
   - Open reset email
   - Click reset link
   - Enter new password
   - Verify redirect to login
   - Login with new password

4. **Account Linking**
   - Login with email/password
   - Navigate to profile
   - Click "Link Google Account"
   - Authorize Google OAuth
   - Verify Google identity linked
   - Logout and login with Google

## Metadata Template

For each evidence file, document:
```yaml
file: oauth-login-success.mp4
date: 2026-01-02
tester: Dennis Muchai
environment: Production (property-manager-ke.vercel.app)
browser: Chrome 121.0.6167 on Ubuntu 22.04
test_case: TC-AUTH-001 - New user OAuth registration
result: PASS
duration: 15s
notes: User redirected to dashboard in <2s after OAuth callback
```

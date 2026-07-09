# Landee Release Notes

## Android 1.1.0 (Build 16) - July 8, 2026

### Highlights

- Improved the signup flow so new users create an account first, then choose their role after email verification.
- Fixed a registration regression where new non-tenant users could be assigned the landlord role before the role-selection step.
- Improved Android Google sign-in callback handling for the mobile app.
- Added and documented Android release build support for generating production APKs with the correct API URL.
- Switched signup toward an email-first flow and Africa's Talking SMS support for phone messaging.

### Fixes

- New landlord and property manager signups no longer store a default role during registration.
- Existing invited tenant emails are still recognized and assigned the tenant role automatically.
- Initial role selection can now create or update the user profile safely after email confirmation or OAuth callback.
- Non-admin users are blocked from changing roles after their initial role has already been set.
- Registration errors are handled more clearly when an email is already registered.
- Android OAuth redirect handling now supports native app callback behavior more reliably.
- The landlord payment form now opens within the mobile viewport and submits the selected lease using the payment API contract.
- Tenant maintenance requests now use a database-compatible initial status instead of failing with an HTTP 500 response.
- Maintenance actions now use the serverless API's supported update method and no longer return HTTP 405.
- Notification items open their related dashboard section, and the notification list can be expanded.
- Recent transaction View actions now open payment details.

### Build And Deployment

- Android app version: `1.1.0`
- Android version code: `16`
- Package ID: `com.rentmanagement.app`
- Production API URL expected in APK builds: `https://landee.kejalink.co.ke`
- Recommended APK build command:

```bash
npm run apk:build
```

### Verification

- TypeScript check passed:

```bash
npm run check
```

- Registration role regression verified at code level:
  - Signup form no longer submits `role`.
  - API stores `role: null` for non-tenant signups.
  - API stores `role: "tenant"` for emails matching existing tenant records.
  - User metadata only includes `role` when a role exists.

### Commits Included

- `53bd7d1` - Fix registration role selection regression
- `4d76b83` - Fix Google OAuth callback in Android app
- `3228eb9` - Update Android release signing build steps
- `bdb369e` - Fix initial role selection guard
- `934d12b` - Fix auth sync and register error handling
- `78e7d32` - Make signup email-first and use Africa's Talking SMS

# Backend Testing Evidence

## Purpose
Verify backend enforcement of security policies, particularly single-use token consumption.

## Evidence to Store Here

### Authorization Code Validation
- `authorization-code-validation.log` - Complete log of code exchange flow
- `supabase-auth-events.json` - Supabase Auth API event stream
- `code-consumption-trace.txt` - Step-by-step trace of code consumption

### Password Reset Validation
- `password-reset-validation.log` - Complete log of password reset flow
- `recovery-token-audit.sql` - Database queries showing token lifecycle
- `token-lifecycle-trace.md` - Documentation of token states

### Database Audit
- `recovery-token-audit.sql` - SQL queries to verify token consumption
- `auth-users-table-schema.sql` - Schema showing recovery_token column

## Log Format Standards

### Authorization Code Exchange Log
```log
[TIMESTAMP] LEVEL: Event description
  field1: value1
  field2: value2
  
Example:
[2026-01-02T10:23:45.123Z] INFO: OAuth callback received
  code: "uZW-jKW7pXQR8sN..." (truncated for security)
  state: "random-state-token"
```

### Required Log Events

1. **Code Exchange Success:**
   - Timestamp
   - Authorization code (truncated)
   - User ID
   - Session created confirmation
   - Token storage method (httpOnly cookie)

2. **Code Reuse Attempt:**
   - Timestamp
   - Authorization code (same as above)
   - Error: "invalid_grant"
   - Status: 400
   - Security event logged

3. **Password Reset Success:**
   - Timestamp
   - Recovery token (truncated)
   - User ID
   - Password hash updated
   - Token consumption confirmed

4. **Recovery Token Reuse Attempt:**
   - Timestamp
   - Recovery token (same as above)
   - Error: "invalid_recovery_token"
   - Status: 400
   - Security event logged

## Database Audit Queries

### Verify Recovery Token Consumption
```sql
-- Check if recovery_token is nullified after use
SELECT 
  id,
  email,
  recovery_token,
  recovery_sent_at,
  updated_at
FROM auth.users
WHERE email = 'test@example.com';

-- Expected result after password reset:
-- recovery_token: NULL (consumed)
-- updated_at: Recent timestamp
```

### Track Token Lifecycle
```sql
-- Audit log of password reset events
SELECT 
  created_at,
  user_id,
  event_type,
  ip_address
FROM auth.audit_log_entries
WHERE user_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND event_type IN ('recovery_requested', 'password_updated')
ORDER BY created_at DESC;
```

## Supabase Auth API Events

Document these events from Supabase Dashboard > Auth > Logs:

1. `SIGNED_IN` - User authenticated (OAuth or password)
2. `TOKEN_REFRESHED` - Access token refreshed
3. `USER_UPDATED` - Password changed
4. `PASSWORD_RECOVERY` - Recovery email sent
5. `USER_SIGNEDUP` - New user registered

## Evidence Collection Steps

1. **Enable Logging:**
   ```typescript
   // In server/index.ts
   import morgan from 'morgan';
   app.use(morgan('combined'));
   ```

2. **Capture Production Logs:**
   - Vercel Dashboard > Logs > Filter by "/api/auth"
   - Download log stream for relevant time period

3. **Export Supabase Events:**
   - Supabase Dashboard > Auth > Logs
   - Filter by date range
   - Export to JSON

4. **Run Database Queries:**
   - Connect to Supabase DB via psql or Dashboard
   - Execute audit queries
   - Export results to .sql file

5. **Document Findings:**
   - Create trace document (`.md` or `.txt`)
   - Include timestamps, event sequence, and conclusions

## Metadata Template

```yaml
file: authorization-code-validation.log
date: 2026-01-02
source: Vercel Production Logs
time_range: 10:23:00 - 10:25:00 UTC
events_captured:
  - OAuth callback received
  - Code exchange success
  - Code reuse attempt (blocked)
  - Security event logged
verification: Code single-use enforcement confirmed
notes: Backend correctly consumed code atomically, rejected replay
```

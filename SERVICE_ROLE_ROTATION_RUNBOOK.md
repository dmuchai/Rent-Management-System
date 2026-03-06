# Service Role Rotation Runbook

This runbook rotates `SUPABASE_SERVICE_ROLE_KEY` safely and verifies no regression.

## Scope
- Supabase project: linked CLI project
- App surfaces: API routes, backend services, scripts, CI/CD, and local envs

## 1) Pre-rotation checklist
1. Freeze deploys for the maintenance window.
2. Confirm all server-only integrations are known:
   - API server envs
   - Background jobs
   - CI/CD secrets
   - local developer `.env` files
3. Create a DB backup snapshot before changing runtime credentials.
4. Run exposure scan:
   ```bash
   bash scripts/security/audit-secret-exposure.sh
   ```

## 2) Rotate key in Supabase Dashboard
1. Open Supabase Dashboard → Project Settings → API Keys.
2. Rotate/regenerate the `service_role` key.
3. Copy the new key securely.

## 3) Update secrets everywhere (atomic rollout)
Update **all** deployments before restarting traffic:
- Production hosting env variables (e.g. Vercel/Render/Railway)
- CI/CD secrets
- Local/ops secret stores
- Any edge functions or workers using service credentials

Suggested env name:
- `SUPABASE_SERVICE_ROLE_KEY`

## 4) Restart services
- Restart all workloads that read secrets at boot.
- Confirm no process still uses old key.

## 5) Post-rotation validation
1. Health checks for server endpoints requiring Supabase admin actions.
2. Trigger one read + one write action from each integration path.
3. Confirm security checks remain clean:
   ```bash
   supabase db lint --linked --schema public --level error --fail-on error
   ```
4. Verify audit trail writes are happening:
   ```sql
   select table_name, operation, actor_id, actor_role, db_role, changed_at
   from internal.audit_log
   order by changed_at desc
   limit 25;
   ```

## 6) Incident response (if old key was exposed)
1. Rotate immediately (do not wait for maintenance window).
2. Invalidate cached environments and restart all services.
3. Search logs for suspicious access timeframe.
4. Keep forensic snapshot of suspicious activity.

## 7) Ongoing guardrails
- Never store `SUPABASE_SERVICE_ROLE_KEY` in client bundles or frontend env vars.
- Run exposure scan in CI:
  ```bash
  bash scripts/security/audit-secret-exposure.sh
  ```
- Rotate service keys periodically (e.g., every 60–90 days).

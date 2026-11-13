-- Run only against the isolated staging database with a metadata-capable
-- staging connection. Never run this against the live project.
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relname IN (
    'properties', 'units', 'tenants', 'leases', 'payments',
    'maintenance_requests', 'documents', 'billing_accounts',
    'subscription_events', 'external_payment_events',
    'payment_audit_history', 'user_context_memberships',
    'operational_job_runs', 'email_queue', 'sms_queue'
  )
ORDER BY c.relname;

WITH expected(table_name) AS (
  VALUES
    ('properties'), ('units'), ('tenants'), ('leases'), ('payments'),
    ('maintenance_requests'), ('documents'), ('billing_accounts'),
    ('subscription_events'), ('external_payment_events'),
    ('payment_audit_history'), ('user_context_memberships'),
    ('operational_job_runs'), ('email_queue'), ('sms_queue')
)
SELECT
  'public' AS schemaname,
  expected.table_name AS tablename,
  COUNT(p.policyname)::integer AS policy_count
FROM expected
LEFT JOIN pg_policies p
  ON p.schemaname = 'public' AND p.tablename = expected.table_name
GROUP BY expected.table_name
UNION ALL
SELECT 'storage', '<all tables>', COUNT(*)::integer
FROM pg_policies
WHERE schemaname = 'storage'
ORDER BY schemaname, tablename;

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

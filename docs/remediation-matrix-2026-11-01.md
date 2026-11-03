# Implementation-review remediation matrix

| Finding | Code and migration | Regression evidence | Remaining dependency / risk |
|---|---|---|---|
| F01 STK trust | `mpesaService.queryStkPush`, `mpesaVerification`, callback event capture, migration 015 receipt/checkout uniqueness | forged/mismatched status, amount, receipt and failure tests | Production Daraja product, merchant credentials and sandbox/live journey still required; collection is not settlement |
| F02 lease scope/lifecycle | transactional lease update, scoped destination tenant/unit checks, lifecycle reset, both-unit occupancy | type/route tests plus two-portfolio staging scenario required | Active lease amendments intentionally require an explicit future workflow |
| F03 C2B durability | durable insert before acknowledgement, processing states, bounded worker retries, replay route | callback/process state tests and disposable DB tests | Safaricom production redelivery behavior must be observed during approved staging |
| F04 financial consistency | `postExternalPaymentEvent`, event-linked receipts, audit history, explicit unallocated amount, transaction outbox; bank path uses same evidence fields | allocation concurrency/rollback/reversal suite and posting tests | Historical mismatches are diagnostics-only; human review required where evidence is missing |
| F05 role authority | scoped memberships/backfill, metadata removed from authority, context selection, persisted-role compatibility | dual-role/scoped selection tests | Roll out migration before code; review users omitted by deterministic backfill |
| F06 queue workers | atomic SKIP LOCKED claim, expiring lease, bounded retries, outbox idempotency keys | focused queue SQL/staging crash drill | Provider acceptance-before-ack ambiguity can still duplicate delivery without provider idempotency |
| F07 unit limits | owner advisory lock and in-transaction portfolio recount | PostgreSQL concurrent cross-property test required in staging/CI fixture | Entitlement changes are separately serialized by subscription provider state |
| F08 public claims | evidence-based landing/password copy, qualified integrations/reconciliation, Android purchase disclosure | production frontend build and copy search | Store purchase/renewal/cancel sync still needs an approved Google Play test journey |
| Lease GET mutation | read-only list plus hourly lifecycle cron and job log | lifecycle operation test/recovery drill | Cron deployment and alerting must be enabled |
| Cron auth | method checks and missing-secret fail closed | handler tests / route checks | Configure `CRON_SECRET` in each deployed environment |
| CI/release | Ubuntu workflow, PostgreSQL 16 service, lockfile install, Vercel build | workflow definition and local commands | Branch protection/ruleset is a repository-owner decision |

## Migration and rollout

1. Back up and restore-test the database. Apply existing migrations through `014`, then `015_financial_integrity_and_scoped_authority.sql` to a disposable representative copy.
2. Run the read-only diagnostic. Resolve duplicate receipt IDs and ambiguous historical balances manually; do not invent receipts. Review `unscopedAuthorities` and add memberships only from invitation/assignment/ownership evidence.
3. Deploy code that reads the additive fields. Old code can continue operating during the schema-first window, but queue outbox idempotency and scoped memberships are inactive until the new code is live.
4. Configure secret values without logging them: `CRON_SECRET`, `MPESA_ENV`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, and `MPESA_CALLBACK_URL`. Example values belong in a local secret manager, never this repository.
5. Validate in sandbox: forged callback remains unpaid; verified success posts once; duplicate/reordered results do not double-post; persistence and worker crashes recover; wrong references enter review; excess and reversal remain visible.
6. Stage with one approved merchant/landlord and controlled amounts. Reconcile provider collection separately from bank settlement. Verify Android subscription sync.
7. Obtain separate approval for production deployment. Monitor failed/review events, control totals, queues, and lifecycle jobs before expanding the pilot.

Migration 015 is additive, but rollback after new receipts/memberships exist is not a simple column drop. Roll back application code first while retaining evidence columns/tables; restore from the verified backup only for a migration-level failure. Never drop audit/event tables as a routine rollback.

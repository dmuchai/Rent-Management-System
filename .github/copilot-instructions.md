# Rent Management System

## Build, test, and validation

Use Node.js 20+ (CI uses Node 22) and npm. Install with:

```bash
npm ci --ignore-scripts
```

Common commands:

```bash
npm run dev                         # Express compatibility server + Vite client on port 5000
npm run check                       # TypeScript type check (tsc, no emit)
npm run check:route-entrypoints     # Prevent legacy server route imports
npm run build                       # Bundle the Express production server
npm run build:frontend              # Build the Vite client
npm run build:vercel                # Build the frontend for Vercel
```

Run the focused test suites with the existing scripts:

```bash
npm run test:otp
npm run test:account-deletion
npm run test:subscription
npm run test:kcb
npm run test:invoicing
npm run test:financial-integrity
npm run test:tenant-payments
npm run test:api
```

Run one Node test file directly:

```bash
node --import tsx --test tests/invoicing/bank-allocation.test.ts
```

Run one test by name with Node's test-name filter:

```bash
node --import tsx --test --test-name-pattern="spreads money across outstanding balances" tests/invoicing/bank-allocation.test.ts
```

The invoicing and financial-integrity tests may create a private PostgreSQL 16 cluster under `/tmp`. To use a disposable local PostgreSQL instance explicitly, set `TEST_DATABASE_URL` (it must resolve to localhost); `PG_BINDIR` can override the PostgreSQL binary directory. Do not point these tests at application or production data. The release workflow in [release-checks.yml](workflows/release-checks.yml) is the authoritative CI sequence. There is no repository lint script; `npm run check` is the available static validation.

## Architecture

- The frontend is a React 18/Vite SPA in [client/src](../client/src), routed with Wouter and using TanStack Query for API data. Path aliases are `@/*` for `client/src/*` and `@shared/*` for `shared/*`.
- Production HTTP entrypoints are Vercel Functions under [api](../api). [server/routes/index.ts](../server/routes/index.ts) mirrors the API surface for the Express development/compatibility server; [server/development.ts](../server/development.ts) attaches Vite in development.
- [shared/schema.ts](../shared/schema.ts) is the Drizzle/PostgreSQL schema and the source for many Drizzle-Zod validation schemas. Database migrations live in [migrations](../migrations) and [db/migrations](../db/migrations); inspect the existing migration path and deployment docs before changing schema.
- Supabase Auth establishes identity, but database-backed `user_context_memberships` (with the persisted role fallback during migration) establishes scoped authority. The server verifies the Supabase token, resolves a trusted role/context owner, and applies subscription write policy before protected handlers run.
- Payment callbacks, statement imports, and operator reconciliation feed `external_payment_events`. The shared posting/allocation boundary locks the event and invoice, writes receipt/audit/outbox evidence, updates invoice balances, and records excess as explicit `unallocated_amount`. See [current-state-architecture.md](../docs/current-state-architecture.md), [PAYMENT_RECONCILIATION_ARCHITECTURE.md](../PAYMENT_RECONCILIATION_ARCHITECTURE.md), and [operator-payment-runbook.md](../docs/operator-payment-runbook.md).
- Scheduled routes under `api/cron` drive email/SMS outboxes, payment-event recovery, lease lifecycle, and invoice generation. Cron endpoints are GET-only and fail closed when `CRON_SECRET` is absent.
- Capacitor packages the same frontend for Android/iOS. Mobile builds use the configured production API URL; after frontend changes, use the mobile sync/build commands in [package.json](../package.json) rather than editing generated native output.

## Repository conventions

- When changing an endpoint, update the corresponding Vercel function in `api/` first and keep the Express compatibility route in `server/routes/` aligned. Register compatibility routes through `server/routes/index.ts`; do not reintroduce a legacy `./routes` entrypoint (the route check rejects it).
- Use the shared auth helpers in `api/_lib/auth.ts` and the existing authority helpers rather than trusting client-supplied roles, Supabase user metadata, or an unscoped owner ID. The client persists the selected authority context and sends `x-landee-context-role` and `x-landee-context-owner`; the server validates that selection against active memberships.
- Use `apiRequest`/the configured TanStack Query client for browser API calls so Supabase bearer tokens, cookies, authority-context headers, API base URLs, and error normalization remain consistent.
- Validate request data with the existing Zod/Drizzle-Zod schemas and preserve the established JSON error shape. Protected Vercel handlers should use the existing `requireAuth`, CORS, and error helpers instead of duplicating token or subscription checks.
- Treat provider webhooks as untrusted input. Preserve raw events and verification evidence, use provider-specific verification (including the M-Pesa status-query flow and bank signature controls), and route posting through the shared transactional payment boundary. Never delete financial evidence to correct a mistake; use reversal/correction flows that append audit history.
- Keep financial amounts in the repository's decimal/database representation and use the existing cents-based allocation helpers when comparing or splitting money. Preserve idempotency constraints for external transaction IDs and source-event/invoice receipts.
- Cron workers and queue consumers claim work atomically with bounded retries/leases. Do not turn read/list handlers into mutating lifecycle operations; scheduled lifecycle changes belong in the cron workers.
- Keep server-only secrets out of `VITE_*` variables and never commit `.env` files, provider credentials, signing keys, or generated native build artifacts. Use [.env.example](../.env.example) and the relevant setup/runbook documentation for configuration.
- For payment, authentication, subscription, database, or deployment changes, consult the focused guides linked from [README.md](../README.md) and update directly affected documentation when behavior or rollout state changes.

# Rent Management System

A comprehensive Rent Management System that streamlines interactions between landlords and tenants. The app manages properties, units, tenants, leases, statements/reconciliation and payments, and provides a unified dashboard and mobile shell for administration and tenant workflows.

## Notable Features (current)

- Property & unit management with occupancy tracking
- Tenant portal: view lease details, submit maintenance requests, pay rent
- Landlord dashboard: manage properties, view reconciliation and payment reports
- Lease management and document storage
- Payments & reconciliation:
  - M-Pesa support (paybill / till) and statement upload parsing
  - Bank paybill support (landlords can register bank paybill + account)
  - Pesapal integration for online payments (IPN/webhook flow present; see docs for partial/complete status)
- Mobile support via Capacitor (Android & iOS)

## Tech Stack

**Frontend:** React, Vite, Tailwind CSS, Radix UI, TypeScript

**Backend:** Node.js, Express, Drizzle ORM (Postgres mappings)

**Database & Services:**
- PostgreSQL (via Supabase/Neon)
- Supabase (Auth, Storage, Realtime + Row-Level Security policies)
- Upstash Redis (used for distributed rate-limiting; optional - falls back to in-memory)

**Mobile:** Capacitor

**Utilities:** Zod (validation), TanStack Query (data fetching), Recharts (visualizations)

## Prerequisites

Install these if you don't already have them:

```bash
Node.js (v20+)
npm
```

You'll also need a Supabase project (for the database and Auth) and optional credentials for payment providers (M-Pesa, Pesapal) and Upstash if you plan to enable distributed rate limiting.

## Installation

1. Clone the repository

```bash
git clone <repository-url>
cd Rent-Management-System
```

2. Install dependencies

```bash
npm install
```

3. Configure environment variables

Copy `.env.example` to `.env` and populate required keys. Important variables and examples are provided in `.env.example` (Supabase keys, MPESA/PESAPAL keys, UPSTASH_REDIS_REST_URL/TOKEN).

```bash
cp .env.example .env
```

4. Setup the database

Use Drizzle Kit to push the schema (or run SQL migrations provided under `migrations/`):

```bash
npm run db:push
# or run specific SQL files: psql $DATABASE_URL -f migrations/001_payment_reconciliation_phase1.sql
```

## Usage

### Development (API + Client)

The development server started via `npm run dev` runs the backend Express server and, in development mode, proxies/serves the frontend via Vite. Start it with:

```bash
npm run dev
```

By default the app listens on port `5000` (change via `PORT` env var).

### Mobile

Sync and open native projects:

Android:
```bash
npm run mobile:android
```

iOS:
```bash
npm run mobile:ios
```

## Payment & Reconciliation Notes

- The repo includes M-Pesa webhook handlers, statement parsers and bank paybill support for landlords who accept payments through bank-owned paybills.
- Pesapal integration exists for tenant online payments and IPN/webhook handling; consult `AUTOMATED_PAYMENT_FLOW.md` and `ARCHITECTURE_FIXES.md` for current implementation notes (some endpoints are marked as partial/in-progress).
- Statement upload and parsing utilities are available to reconcile bank/MPESA statements into invoices.

## Environment and Secrets

See `.env.example` for the full set of environment variables. Key ones include:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (optional)
- `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`
- `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`, `PESAPAL_IPN_ID`

## Scripts

- `npm run dev` — Start development server (API + client via Vite)
- `npm run build` — Build backend for production
- `npm run build:frontend` — Build frontend assets
- `npm run db:generate` — Generate DB migrations with Drizzle Kit
- `npm run db:push` — Push schema/migrations to the DB
- `npm run check` — TypeScript type check
- `npm test:api` — Run API tests

## Docs & Guides

Several focused docs live in the repo for specific workflows:

- `SUPABASE_SETUP.md` — Supabase / RLS setup
- `AUTOMATED_PAYMENT_FLOW.md` — Pesapal + payment flow details
- `BANK_PAYBILL_QUICKSTART.md` / `BANK_PAYBILL_TESTING_GUIDE.md` — Bank paybill integration
- `STATEMENT_UPLOAD_IMPLEMENTATION.md` — Statement parsing and reconciliation

If you rely on a specific payment provider or plan to enable distributed rate-limiting, consult the corresponding docs and `.env.example` entries.

## License

MIT

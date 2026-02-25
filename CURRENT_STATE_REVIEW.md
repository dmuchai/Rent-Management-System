# Rent Management System: Current State Review and Improvement Recommendations

## Executive Summary

The project has strong functional breadth (multi-role dashboards, payment integrations, reconciliation docs, mobile shell), but it is currently constrained by maintainability and operational reliability risks. The largest opportunities are:

1. **Backend modularization** (very large route surface in one file).
2. **Test and CI quality gates** (existing API test script is manual and non-failing by design).
3. **Deployment and environment consistency** (mixed Node runtime expectations and hardcoded frontend callback URL).
4. **Security hardening pass** around auth/session flow edge cases.

## What Looks Healthy

- TypeScript typecheck passes with `npm run check`.
- Production backend bundle builds successfully with `npm run build`.
- The repository includes extensive implementation notes and runbooks for auth, payments, reconciliation, and deployment.

## Key Findings

### 1) Backend routes are too centralized

- `server/routes.ts` is **4,388 lines**, indicating a high-complexity and high-change-risk module.
- The single file mixes auth HTML templates, payment operations, tenant/property operations, invitation flows, and session handling.

**Impact**

- Increased merge conflicts and regression risk.
- Harder onboarding for new contributors.
- Lower confidence when changing one domain (e.g., payments) because side effects are hard to isolate.

**Recommendation**

- Split by bounded context into route modules (e.g., `routes/auth.ts`, `routes/properties.ts`, `routes/tenants.ts`, `routes/payments.ts`).
- Add service-layer modules for non-trivial business logic and keep handlers thin.
- Add shared middleware for validation/error mapping/authorization checks.

### 2) Test tooling exists but does not enforce quality

- `test-api.js` expects an already-running local server and reports network errors as log output; it does **not** fail CI when endpoints are unreachable or behavior regresses.
- During review, `npm run test:api` printed network errors for all tested endpoints but still exited successfully.

**Impact**

- False confidence in release readiness.
- Regressions can pass through automation unnoticed.

**Recommendation**

- Introduce integration tests that boot the app in-process for CI (Jest/Vitest + Supertest).
- Make `npm test` fail on endpoint failures and assertion mismatches.
- Keep `test-api.js` only as a manual smoke script, renamed clearly (`scripts/manual-api-smoke.js`).

### 3) CI/CD currently deploy-focused, not quality-gate focused

- Current GitHub workflow (`.github/workflows/deploy-backend.yml`) installs deps, builds, and deploys, but does not run test suites or lint/type gates before deployment.
- Workflow uses Node 18 while README states Node 20+ for local prerequisites.

**Impact**

- Build-only deploys may ship broken behavior.
- Runtime version drift can create “works locally, fails in CI/prod” issues.

**Recommendation**

- Add CI jobs for: typecheck, lint, unit/integration tests, build.
- Block deploy job on passing quality jobs.
- Align Node version across README, engines field, CI workflow, and hosting runtime.

### 4) Auth flow and environment coupling need cleanup

- Login page script in server routes creates Supabase client using interpolated values from server-side HTML.
- The callback redirect URL is hardcoded to `https://property-manager-ke.vercel.app/...`.

**Impact**

- Hardcoded hostnames complicate multi-environment deployments (preview/staging/custom domains).
- Auth/session reliability becomes environment-fragile.

**Recommendation**

- Move redirect origins to environment configuration (allowlist per environment).
- Centralize auth config validation and fail fast at startup.
- Add automated tests for callback/session cookie behavior and CORS/cookie flags.

## Prioritized 30/60/90-Day Plan

### First 30 days (stabilize)

- Add `lint`, `check`, and integration tests to CI.
- Make deploy contingent on passing checks.
- Remove hardcoded frontend callback URL and replace with env-driven config.
- Define and document a single supported Node version matrix.

### 31–60 days (modularize)

- Split `server/routes.ts` into domain routers and shared middleware.
- Introduce service modules for payments and lease workflows.
- Add route-level contract tests for each domain module.

### 61–90 days (harden and scale)

- Add observability baseline (structured logs, request IDs, error taxonomy, latency metrics).
- Define SLO-like targets for critical paths (payment event ingestion, lease generation, auth callback).
- Build recovery playbooks for payment webhook backlogs and reconciliation inconsistencies.

## Suggested KPIs to Track

- Change failure rate (deploys requiring rollback/hotfix).
- Mean time to restore after incidents.
- Test pass rate and flaky test count.
- Endpoint p95 latency for `/api/payments/*`, `/api/properties`, `/api/tenants`.
- Authentication success/failure ratio per environment.

## Conclusion

The system is feature-rich and close to production maturity, but reliability and maintainability will improve most by investing in modular backend architecture, enforceable CI quality gates, and environment-safe auth/deployment configuration.

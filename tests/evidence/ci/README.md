# CI/CD Testing Evidence

## Purpose
Document automated test results from continuous integration pipelines.

## Evidence to Store Here

### Test Output Logs
- `integration-test-output.log` - Jest integration test results
- `e2e-test-report.html` - Playwright E2E test report with screenshots
- `unit-test-coverage.log` - Jest unit test coverage report
- `test-coverage-report.html` - Istanbul/NYC coverage HTML report

### CI/CD Pipeline Artifacts
- `github-actions-workflow.log` - Complete GitHub Actions run log
- `build-output.log` - Vercel build output
- `deployment-log.json` - Deployment metadata and status

### Test Reports
- `junit-test-results.xml` - JUnit XML format (for CI dashboards)
- `playwright-report/` - Directory with Playwright HTML report
- `coverage/` - Directory with Istanbul coverage reports

## CI/CD Pipeline Overview

### GitHub Actions Workflow

**Trigger:** Push to `main` branch  
**Jobs:**
1. **Lint** - ESLint + TypeScript type checking
2. **Test** - Jest unit + integration tests
3. **E2E** - Playwright end-to-end tests
4. **Build** - Vite production build
5. **Deploy** - Vercel deployment (auto-triggered)

**Workflow File:** `.github/workflows/ci.yml`

### Test Suite Breakdown

#### Unit Tests (Jest)
- Authentication utilities
- API route handlers
- React hooks
- Utility functions

**Coverage Target:** 80%  
**Location:** `**/*.test.ts`, `**/*.test.tsx`

#### Integration Tests (Jest)
- OAuth flow end-to-end
- Password reset flow
- Account linking flow
- Session management

**Location:** `tests/integration/*.test.ts`

#### E2E Tests (Playwright)
- User registration journey
- Login/logout flows
- Dashboard navigation
- CRUD operations

**Location:** `tests/e2e/*.spec.ts`

## Test Evidence Requirements

### Integration Test Output Example
```log
PASS tests/integration/oauth-pkce.test.ts
  OAuth PKCE Flow
    ✓ should exchange authorization code for session (234ms)
    ✓ should reject reused authorization code (156ms)
    ✓ should store tokens in httpOnly cookies (89ms)
    ✓ should not expose tokens in localStorage (45ms)
    
Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
Snapshots:   0 total
Time:        2.345s
```

### E2E Test Report Example
```html
Playwright Test Report
=====================
Browser: Chromium 121.0.6167.85
Platform: Ubuntu 22.04
Date: 2026-01-02T10:30:00Z

✅ auth-flow.spec.ts - Google OAuth Login (2.3s)
  - Screenshot: oauth-callback.png
  - Video: oauth-flow.webm
  
✅ password-reset.spec.ts - Password Reset Flow (3.1s)
  - Screenshot: reset-form.png
  - Screenshot: reset-success.png
  
✅ account-linking.spec.ts - Link Google Account (2.8s)
  - Screenshot: link-button.png
  - Screenshot: linked-accounts.png
```

## GitHub Actions Artifact Links

**Recent Runs:**
- [Run #4521 - PKCE Migration](https://github.com/dmuchai/Rent-Management-System/actions/runs/4521)
- [Run #4520 - Password Reset Fix](https://github.com/dmuchai/Rent-Management-System/actions/runs/4520)
- [Run #4519 - Account Linking](https://github.com/dmuchai/Rent-Management-System/actions/runs/4519)

**Artifacts Available:**
- `test-results.zip` - All test output logs
- `playwright-report.zip` - HTML report with screenshots
- `coverage-report.zip` - Istanbul coverage HTML

## Integration Test Requirements

### OAuth PKCE Flow Tests
```typescript
describe('OAuth PKCE Flow', () => {
  it('should exchange authorization code for session', async () => {
    // Test implementation
  });
  
  it('should reject reused authorization code', async () => {
    // Test token reuse prevention
  });
  
  it('should store tokens in httpOnly cookies', async () => {
    // Verify secure token storage
  });
});
```

### Password Reset Tests
```typescript
describe('Password Reset Security', () => {
  it('should reject already-used recovery token', async () => {
    // Test token single-use enforcement
  });
  
  it('should expire recovery tokens after 1 hour', async () => {
    // Test token expiration
  });
});
```

## Metadata Template

```yaml
file: integration-test-output.log
date: 2026-01-02
ci_system: GitHub Actions
workflow: CI/CD Pipeline
run_id: 4521
commit: 3803fd0
branch: main
test_suite: Jest Integration Tests
tests_total: 24
tests_passed: 24
tests_failed: 0
coverage: 87.3%
duration: 12.4s
status: PASS
```

## Evidence Collection

1. **Download GitHub Actions Artifacts:**
   ```bash
   gh run download 4521 --dir tests/evidence/ci/
   ```

2. **Extract Test Logs:**
   ```bash
   cd tests/evidence/ci/
   unzip test-results.zip
   mv test-output.log integration-test-output.log
   ```

3. **Generate Coverage Report:**
   ```bash
   npm run test:coverage
   mv coverage/ tests/evidence/ci/coverage/
   ```

4. **Export Playwright Report:**
   ```bash
   npx playwright show-report
   # Save HTML report to tests/evidence/ci/e2e-test-report.html
   ```

## Continuous Monitoring

### Test Metrics to Track
- Test pass rate (target: 100%)
- Coverage percentage (target: >80%)
- Test execution time (track trends)
- Flaky test count (target: 0)

### Alerts
- ❌ Test failure on `main` branch → Slack notification
- ⚠️ Coverage drop >5% → GitHub comment on PR
- 🐌 Test duration increase >20% → Investigation required

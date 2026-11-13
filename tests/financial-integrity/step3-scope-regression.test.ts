import assert from 'node:assert/strict';
import test from 'node:test';
import { hasScopedUnitAccess } from '../../api/_lib/leasePolicy.js';
import {parseStoredStkCallback, parseStkCallback} from '../../api/_lib/mpesaVerification.js';
import { readFile } from 'node:fs/promises';
import {
  AUTHORITY_CONTEXT_INVALID_CODE,
  isAuthorityContextInvalidResponse,
} from '../../shared/authority-context.js';
import { featureRemainsAvailableWhenReadOnly } from '../../shared/subscription/plans.js';

test('only the explicit authority-context error is eligible for context recovery', () => {
  assert.equal(isAuthorityContextInvalidResponse(401, { code: AUTHORITY_CONTEXT_INVALID_CODE }), true);
  assert.equal(isAuthorityContextInvalidResponse(401, { error: 'Unauthorized' }), false);
  assert.equal(isAuthorityContextInvalidResponse(403, { code: AUTHORITY_CONTEXT_INVALID_CODE }), false);
});

test('a unit-specific caretaker assignment does not grant another unit in the same property', () => {
  const actor = { userId: 'caretaker-test', role: 'caretaker', contextOwnerId: 'owner-test' };
  const assignments = [{ unit_id: 'unit-a', property_id: 'property-test' }];
  assert.equal(hasScopedUnitAccess(actor, 'owner-test', 'unit-a', 'property-test', assignments), true);
  assert.equal(hasScopedUnitAccess(actor, 'owner-test', 'unit-b', 'property-test', assignments), false);
});

test('property-level caretaker assignment covers units only in its authorised portfolio', () => {
  const actor = {userId:'caretaker',role:'caretaker',contextOwnerId:'owner'};
  const assignments = [{unit_id:null,property_id:'property'}];
  assert.equal(hasScopedUnitAccess(actor,'owner','unit','property',assignments),true);
  assert.equal(hasScopedUnitAccess(actor,'owner','unit','other',assignments),false);
  assert.equal(hasScopedUnitAccess(actor,'another-owner','unit','property',assignments),false);
});

test('stored callbacks accept object and legacy string while rejecting malformed data', () => {
  const body={Body:{stkCallback:{MerchantRequestID:'m',CheckoutRequestID:'c',ResultCode:1032,ResultDesc:'Cancelled'}}};
  assert.deepEqual(parseStoredStkCallback(body),parseStkCallback(body));
  assert.deepEqual(parseStoredStkCallback(JSON.stringify(body)),parseStkCallback(body));
  for(const bad of ['invalid','null','[]','{}',JSON.stringify(JSON.stringify(body))]) {
    assert.throws(()=>parseStoredStkCallback(bad));
  }
  assert.throws(()=>parseStkCallback(JSON.stringify(body)));
});

test('both unit restore entrypoints enforce assignment scope and serialize the active-unit limit', async () => {
  const vercelRestore = await readFile('api/units/[id].ts', 'utf8');
  const expressRestore = await readFile('server/routes/units.ts', 'utf8');
  for (const source of [vercelRestore, expressRestore]) {
    assert.match(source, /hasScopedUnitAccess/);
    assert.match(source, /lockAndCountActiveUnits/);
    assert.match(source, /FOR UPDATE OF u, p/);
    assert.match(source, /caretaker_assignments/);
  }
});

test('unit listings use selected-owner scope and caretaker assignment filtering', async () => {
  const vercelUnits = await readFile('api/units/index.ts', 'utf8');
  const expressUnits = await readFile('server/routes/units.ts', 'utf8');
  for (const source of [vercelUnits, expressUnits]) {
    assert.match(source, /contextOwnerId/);
    assert.match(source, /hasScopedUnitAccess/);
    assert.match(source, /caretaker_assignments/);
  }
});

test('caretaker invitation acceptance can resume an orphaned Auth-user attempt', async () => {
  const vercelInvitation = await readFile('api/caretaker-invitations/index.ts', 'utf8');
  const expressInvitation = await readFile('server/routes/caretakers.ts', 'utf8');
  assert.match(vercelInvitation, /existingAuthUser/);
  assert.match(vercelInvitation, /requestProvesExistingAccount/);
  assert.doesNotMatch(vercelInvitation, /updateUserById/);
  assert.match(vercelInvitation, /ON CONFLICT DO NOTHING/);
  assert.match(vercelInvitation, /FOR UPDATE/);
  assert.match(expressInvitation, /findAuthUserByEmail/);
  assert.match(expressInvitation, /requestProvesExistingAccount/);
  assert.doesNotMatch(expressInvitation, /updateUserById/);
  assert.match(expressInvitation, /sql\.begin/);
  assert.match(expressInvitation, /FOR UPDATE/);
});

test('unit-scoped caretakers cannot create a different unit while property-scoped caretakers can', async () => {
  const vercelUnits = await readFile('api/units/index.ts', 'utf8');
  const expressUnits = await readFile('server/routes/units.ts', 'utf8');
  assert.match(vercelUnits, /AND property_id = \$\{property\.id\} AND status = 'active'/);
  assert.match(expressUnits, /!assignment\.unit_id && assignment\.property_id === unitData\.propertyId/);
});

test('stale authority responses cannot clear a newer selection', async () => {
  const queryClient = await readFile('client/src/lib/queryClient.ts', 'utf8');
  assert.match(queryClient, /clearAuthorityContextIfMatches/);
  assert.match(queryClient, /current\?\.role !== expected\.role/);
  assert.match(queryClient, /current\.contextOwnerId !== expected\.contextOwnerId/);
  assert.match(queryClient, /synchronizeAuthorityFallback/);
  assert.match(queryClient, /queryClient\.clear\(\)/);
  assert.match(queryClient, /window\.location\.reload\(\)/);
  assert.doesNotMatch(queryClient, /delete headers\['x-landee-context-role'\]/);
  assert.doesNotMatch(queryClient, /function clearAuthorityContext\(\)/);
});

test('selected-owner managers list leases and tenants in both API entrypoints', async () => {
  const sources = await Promise.all([
    readFile('api/leases/index.ts', 'utf8'),
    readFile('server/routes/leases.ts', 'utf8'),
    readFile('api/tenants/index.ts', 'utf8'),
    readFile('server/routes/tenants.ts', 'utf8'),
  ]);
  for (const source of sources) assert.match(source, /contextOwnerId/);
  assert.match(sources[0], /isPropertyManager/);
  assert.match(sources[2], /isPropertyManager/);
  const hostedHarness = await readFile('scripts/validate-staging-hosted.mjs', 'utf8');
  assert.match(hostedHarness, /MANAGER_A[^\n]*tenants: \['step3-tenant-record-a'\][^\n]*leases: \['step3-lease-a'\]/);
  assert.match(hostedHarness, /request\('\/api\/tenants'/);
  assert.match(hostedHarness, /request\('\/api\/leases'/);
});

test('staging validation asserts fixture scope and the intended authorization guard', async () => {
  const harness = await readFile('scripts/validate-staging-api.ts', 'utf8');
  assert.match(harness, /STAGING_FIXTURE_IDENTITY/);
  assert.match(harness, /assertFixtureScope/);
  assert.match(harness, /forbiddenUnits/);
  assert.match(harness, /forbiddenTenants/);
  assert.match(harness, /SUBSCRIPTION_REQUIRED/);
});

test('staging bootstrap preserves invoice payment state and storage guards inspect every policy', async () => {
  const bootstrap = await readFile('scripts/bootstrap-staging-validation.ts', 'utf8');
  assert.match(bootstrap, /'step3-invoice-a'[\s\S]*ON CONFLICT \(id\) DO NOTHING/);
  assert.doesNotMatch(bootstrap, /ON CONFLICT \(id\) DO UPDATE SET amount = 1000, amount_paid = 0/);
  for (const path of ['docs/reviews/staging-storage-apply.sql', 'docs/reviews/staging-storage-deploy.sql']) {
    const storageSql = await readFile(path, 'utf8');
    assert.match(storageSql, /storage\.objects has existing policies/);
    assert.doesNotMatch(storageSql, /COALESCE\(qual, ''\) ILIKE '%property-images%'/);
  }
});

test('read-only subscription feature rules are shared', () => {
  assert.equal(featureRemainsAvailableWhenReadOnly('data_export'), true);
  assert.equal(featureRemainsAvailableWhenReadOnly('payment_reconciliation'), true);
  assert.equal(featureRemainsAvailableWhenReadOnly('recurring_charges'), false);
  assert.equal(featureRemainsAvailableWhenReadOnly('scheduled_reminders'), false);
});

test('cron routes share authorization and diagnostics enforce a read-only session', async () => {
  for (const path of [
    'api/cron/generate-invoices.ts',
    'api/cron/process-emails.ts',
    'api/cron/process-sms.ts',
    'api/cron/lease-lifecycle.ts',
    'api/cron/process-payment-events.ts',
  ]) {
    assert.match(await readFile(path, 'utf8'), /cronAuthorizationStatus/);
  }
  const diagnostic = await readFile('scripts/diagnose-financial-integrity.ts', 'utf8');
  assert.match(diagnostic, /SET default_transaction_read_only = on/);
});

test('the user profile endpoint preserves role selection for authenticated users without authority', async () => {
  const authRoute = await readFile('api/auth.ts', 'utf8');
  assert.match(authRoute, /role: authority\?\.role \?\? null/);
  assert.match(authRoute, /contextOwnerId: authority\?\.contextOwnerId \?\? null/);
  assert.doesNotMatch(authRoute, /const authority = await verifyAuth\(req\);\s+if \(!authority\) return res\.status\(401\)/);
});

test('manual payment replay claims only failed or review events', async () => {
  const replayRoute = await readFile('api/landlord/reconciliation/replay.ts', 'utf8');
  assert.match(replayRoute, /processing_status IN \('failed', 'review'\)/);
  assert.doesNotMatch(replayRoute, /processing_status IN \([^)]*'retry'/);
  assert.match(replayRoute, /sql\.begin/);
  assert.match(replayRoute, /payment_audit_history/);
});

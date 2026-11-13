import assert from 'node:assert/strict';
import test from 'node:test';
import { hasScopedUnitAccess } from '../../api/_lib/leasePolicy.js';
import {parseStoredStkCallback, parseStkCallback} from '../../api/_lib/mpesaVerification.js';
import { readFile } from 'node:fs/promises';
import {
  AUTHORITY_CONTEXT_INVALID_CODE,
  isAuthorityContextInvalidResponse,
} from '../../shared/authority-context.js';

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
  assert.match(vercelInvitation, /ON CONFLICT DO NOTHING/);
  assert.ok(
    vercelInvitation.indexOf('updateUserById') < vercelInvitation.indexOf('await sql.begin'),
    'existing Auth credentials must be updated before the database acceptance transaction',
  );
  assert.match(expressInvitation, /findAuthUserByEmail/);
  assert.match(expressInvitation, /existingAssignment/);
  assert.match(expressInvitation, /onConflict: 'id'/);
});

test('manual payment replay claims only failed or review events', async () => {
  const replayRoute = await readFile('api/landlord/reconciliation/replay.ts', 'utf8');
  assert.match(replayRoute, /processing_status IN \('failed', 'review'\)/);
  assert.doesNotMatch(replayRoute, /processing_status IN \([^)]*'retry'/);
  assert.match(replayRoute, /sql\.begin/);
  assert.match(replayRoute, /payment_audit_history/);
});

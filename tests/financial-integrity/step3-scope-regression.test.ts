import assert from 'node:assert/strict';
import test from 'node:test';
import { hasScopedUnitAccess } from '../../api/_lib/leasePolicy.js';
import {parseStoredStkCallback, parseStkCallback} from '../../api/_lib/mpesaVerification.js';

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

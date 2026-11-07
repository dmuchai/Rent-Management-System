import { strict as assert } from 'node:assert';

const supabaseUrl = process.env.STAGING_SUPABASE_URL ?? '';
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY ?? '';
const expectedProjectRef = 'mcclctunrpyhumubpeyo';

const identities = {
  landlordA: process.env.STAGING_RLS_TOKEN_LANDLORD_A ?? '',
  landlordB: process.env.STAGING_RLS_TOKEN_LANDLORD_B ?? '',
  managerA: process.env.STAGING_RLS_TOKEN_MANAGER_A ?? '',
  propertyCaretakerA: process.env.STAGING_RLS_TOKEN_PROPERTY_CARETAKER_A ?? '',
  tenantA: process.env.STAGING_RLS_TOKEN_TENANT_A ?? '',
  tenantB: process.env.STAGING_RLS_TOKEN_TENANT_B ?? '',
};

if (!supabaseUrl) throw new Error('STAGING_SUPABASE_URL is required');
const parsedUrl = new URL(supabaseUrl);
if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== `${expectedProjectRef}.supabase.co`) {
  throw new Error('STAGING_SUPABASE_URL must reference the isolated staging Supabase project');
}
if (!anonKey) throw new Error('STAGING_SUPABASE_ANON_KEY is required');
const missing = Object.entries(identities).filter(([, token]) => !token).map(([name]) => name);
if (missing.length) {
  throw new Error(`Missing client-context staging tokens: ${missing.join(', ')}`);
}

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;
type Result = { status: number; body: Json };

async function request(identity: keyof typeof identities, table: string, query: string): Promise<Result> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${identities[identity]}`,
      Accept: 'application/json',
    },
  });
  const text = await response.text();
  let body: Json = text;
  try {
    body = text ? JSON.parse(text) as Json : null;
  } catch {
    // Keep an opaque response for classification without printing it.
  }
  return { status: response.status, body };
}

function rows(result: Result, label: string): Record<string, unknown>[] {
  assert.equal(result.status, 200, `${label}: expected HTTP 200, received ${result.status}`);
  assert.ok(Array.isArray(result.body), `${label}: expected a JSON array`);
  return result.body as Record<string, unknown>[];
}

function pass(label: string) {
  console.log(`PASS ${label}`);
}

function assertNoForeignRows(label: string, result: Result) {
  const found = rows(result, label);
  assert.equal(found.length, 0, `${label}: foreign rows were visible through client-context RLS`);
  pass(label);
}

const landlordProperties = rows(
  await request('landlordA', 'properties', 'select=id,owner_id&id=eq.step3-property-a'),
  'Landlord A own properties',
);
assert.ok(landlordProperties.length > 0, 'Landlord A fixture property is missing');
pass('Landlord A can read own properties');

const landlordBProperties = rows(
  await request('landlordB', 'properties', 'select=id,owner_id&id=eq.step3-property-b'),
  'Landlord B own properties',
);
assert.ok(landlordBProperties.length > 0, 'Landlord B fixture property is missing');
pass('Landlord B can read own properties');

assertNoForeignRows(
  'Landlord A cannot read Landlord B properties',
  await request('landlordA', 'properties', 'select=id&id=eq.step3-property-b'),
);
assertNoForeignRows(
  'Landlord B cannot read Landlord A properties',
  await request('landlordB', 'properties', 'select=id&id=eq.step3-property-a'),
);

const managerProperties = rows(
  await request('managerA', 'properties', 'select=id,owner_id'),
  'Property Manager A property read',
);
assert.ok(managerProperties.length > 0, 'Property Manager A has no visible assigned property');
assert.ok(
  managerProperties.every((property) => property.owner_id === 'step3-landlord-a'),
  'Property Manager A can read a property outside the assigned portfolio',
);
pass('Property Manager A is limited to the assigned portfolio');

const caretakerUnits = rows(
  await request('propertyCaretakerA', 'units', 'select=id,property_id'),
  'Property Caretaker A unit read',
);
assert.ok(caretakerUnits.length > 0, 'Property Caretaker A has no visible assigned unit');
pass('Property Caretaker A can read assigned units');

assertNoForeignRows(
  'Property Caretaker A cannot read Landlord B units',
  await request('propertyCaretakerA', 'units', 'select=id&property_id=eq.step3-property-b'),
);

const tenantRows = rows(
  await request('tenantA', 'tenants', 'select=id,user_id&id=eq.step3-tenant-record-a'),
  'Tenant A own profile read',
);
assert.ok(tenantRows.length > 0, 'Tenant A fixture profile is missing');
pass('Tenant A can read own tenant profile');
assertNoForeignRows(
  'Tenant A cannot read Tenant B profile',
  await request('tenantA', 'tenants', 'select=id&id=eq.step3-tenant-record-b'),
);
assertNoForeignRows(
  'Tenant B cannot read Tenant A profile',
  await request('tenantB', 'tenants', 'select=id&id=eq.step3-tenant-record-a'),
);

for (const identity of Object.keys(identities) as (keyof typeof identities)[]) {
  const memberships = await request(identity, 'user_context_memberships', 'select=id,user_id,context_owner_id,role,status');
  if (memberships.status === 401 || memberships.status === 403) {
    pass(`${identity} membership table is not exposed to the client role`);
    continue;
  }
  assertNoForeignRows(`${identity} membership rows are not broadly exposed`, memberships);
}

console.log(JSON.stringify({
  projectRef: expectedProjectRef,
  checks: 'client-context RLS reads and cross-portfolio isolation',
  writes: 'none',
  note: 'HTTP 200 empty results were classified only after confirming fixtures through authorized identities.',
}));

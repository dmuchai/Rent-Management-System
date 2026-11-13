import { strict as assert } from 'node:assert';

const baseUrl = process.env.STAGING_BASE_URL ?? '';
const accessToken = process.env.STAGING_API_TOKEN ?? '';
const vercelCookie = process.env.STAGING_VERCEL_COOKIE ?? '';
const siblingUnitId = process.env.STAGING_SIBLING_UNIT_ID ?? '';
const expectedRole = process.env.STAGING_EXPECTED_ROLE ?? '';
const createPropertyId = process.env.STAGING_CREATE_PROPERTY_ID ?? '';
const fixtureIdentity = process.env.STAGING_FIXTURE_IDENTITY ?? '';
const validRoles = new Set(['landlord', 'property_manager', 'caretaker', 'tenant']);
const fixtureScopes = {
  landlord_a: {
    role: 'landlord', units: ['step3-unit-a1', 'step3-unit-a2'], forbiddenUnits: ['step3-unit-b1'],
    tenants: ['step3-tenant-record-a'], forbiddenTenants: ['step3-tenant-record-b'],
    createDenial: ['Access denied'],
  },
  landlord_b: {
    role: 'landlord', units: ['step3-unit-b1'], forbiddenUnits: ['step3-unit-a1', 'step3-unit-a2'],
    tenants: ['step3-tenant-record-b'], forbiddenTenants: ['step3-tenant-record-a'],
    createDenial: ['Access denied'],
  },
  manager_a: {
    role: 'property_manager', units: ['step3-unit-a1', 'step3-unit-a2'], forbiddenUnits: ['step3-unit-b1'],
    tenants: ['step3-tenant-record-a'], forbiddenTenants: ['step3-tenant-record-b'],
    createDenial: ['Access denied'],
  },
  property_caretaker_a: {
    role: 'caretaker', units: ['step3-unit-a1', 'step3-unit-a2'], forbiddenUnits: ['step3-unit-b1'],
    tenants: ['step3-tenant-record-a'], forbiddenTenants: ['step3-tenant-record-b'],
    createDenial: ['Access denied'],
  },
  unit_caretaker_a: {
    role: 'caretaker', units: ['step3-unit-a1'], forbiddenUnits: ['step3-unit-a2', 'step3-unit-b1'],
    tenants: ['step3-tenant-record-a'], forbiddenTenants: ['step3-tenant-record-b'],
    createDenial: ['Access denied'],
  },
  tenant_a: {
    role: 'tenant', units: [], forbiddenUnits: ['step3-unit-a1', 'step3-unit-a2', 'step3-unit-b1'],
    tenants: [], forbiddenTenants: ['step3-tenant-record-a', 'step3-tenant-record-b'],
    createDenial: ['Only landlords, property managers, and caretakers can create units'],
  },
  tenant_b: {
    role: 'tenant', units: [], forbiddenUnits: ['step3-unit-a1', 'step3-unit-a2', 'step3-unit-b1'],
    tenants: [], forbiddenTenants: ['step3-tenant-record-a', 'step3-tenant-record-b'],
    createDenial: ['Only landlords, property managers, and caretakers can create units'],
  },
} as const;
type FixtureIdentity = keyof typeof fixtureScopes;

if (!baseUrl || !/^https:\/\/[a-z0-9-]+\.vercel\.app\/?$/.test(baseUrl)) {
  throw new Error('STAGING_BASE_URL must be an isolated https://*.vercel.app URL');
}
if (!accessToken) {
  throw new Error('STAGING_API_TOKEN is required; do not place it in source control');
}
if (!validRoles.has(expectedRole)) {
  throw new Error('STAGING_EXPECTED_ROLE is required and must be landlord, property_manager, caretaker, or tenant');
}
if (!(fixtureIdentity in fixtureScopes)) {
  throw new Error(`STAGING_FIXTURE_IDENTITY must be one of: ${Object.keys(fixtureScopes).join(', ')}`);
}
const fixtureScope = fixtureScopes[fixtureIdentity as FixtureIdentity];
if (fixtureScope.role !== expectedRole) {
  throw new Error(`STAGING_EXPECTED_ROLE must be ${fixtureScope.role} for ${fixtureIdentity}`);
}

const headers: Record<string, string> = { Accept: 'application/json' };
headers.Authorization = ['Bearer', accessToken].join(' ');
if (vercelCookie) headers.Cookie = vercelCookie;

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(new URL(path, `${baseUrl.replace(/\/$/, '')}/`), {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Keep deployment-protection responses available in the failure summary.
  }
  return { status: response.status, body };
}

function expectStatus(label: string, actual: number, expected: number[]) {
  assert.ok(expected.includes(actual), `${label}: expected ${expected.join('/')} but received ${actual}`);
  console.log(`PASS ${label}: HTTP ${actual}`);
}

function responseError(response: { body: unknown }): { code?: string; message?: string } {
  if (!response.body || typeof response.body !== 'object') return {};
  const payload = response.body as { code?: unknown; error?: unknown; message?: unknown };
  return {
    code: typeof payload.code === 'string' ? payload.code : undefined,
    message: typeof payload.message === 'string' ? payload.message
      : typeof payload.error === 'string' ? payload.error : undefined,
  };
}

function expectAuthorizationDenied(
  label: string,
  response: { status: number; body: unknown },
  expectedMessages: readonly string[],
) {
  assert.equal(response.status, 403, `${label}: expected explicit HTTP 403 authorization denial, received ${response.status}`);
  const error = responseError(response);
  assert.notEqual(error.code, 'SUBSCRIPTION_REQUIRED', `${label}: subscription policy intercepted the intended authorization probe`);
  assert.ok(error.message && expectedMessages.includes(error.message),
    `${label}: unexpected authorization response ${error.code || error.message || 'without an error marker'}`);
  console.log(`PASS ${label}: HTTP 403 authorization denial`);
}

function assertFixtureScope(
  label: string,
  body: unknown,
  requiredIds: readonly string[],
  forbiddenIds: readonly string[],
) {
  assert.ok(Array.isArray(body), `${label} must return an array`);
  const ids = new Set(body.map((row) => row && typeof row === 'object' && 'id' in row
    ? String((row as { id: unknown }).id) : ''));
  for (const id of requiredIds) assert.ok(ids.has(id), `${label} is missing permitted fixture ${id}`);
  for (const id of forbiddenIds) assert.ok(!ids.has(id), `${label} exposed forbidden fixture ${id}`);
  console.log(`PASS ${label}: fixture scope`);
}

const profile = await request('/api/auth?action=user');
expectStatus('authenticated role profile', profile.status, [200]);
const role = profile.body && typeof profile.body === 'object' && 'role' in profile.body
  ? (profile.body as { role?: unknown }).role
  : undefined;
assert.equal(role, expectedRole, `expected role ${expectedRole} but received ${String(role)}`);
console.log(`PASS authenticated role profile: ${String(role)}`);

const units = await request('/api/units');
const expectedUnitListStatus = expectedRole === 'tenant' ? 403 : 200;
expectStatus('unit list', units.status, [expectedUnitListStatus]);
if (units.status === 200) {
  assertFixtureScope('unit list', units.body, fixtureScope.units, fixtureScope.forbiddenUnits);
} else {
  expectAuthorizationDenied('unit list role guard', units, ['Access denied']);
}

const tenantList = await request('/api/tenants');
const expectedTenantListStatus = expectedRole === 'tenant' ? 403 : 200;
expectStatus('tenant list', tenantList.status, [expectedTenantListStatus]);
if (tenantList.status === 200) {
  assertFixtureScope('tenant list', tenantList.body, fixtureScope.tenants, fixtureScope.forbiddenTenants);
} else {
  expectAuthorizationDenied('tenant list role guard', tenantList, ['Access denied', 'Tenants cannot list all tenants']);
}

const tenantProfile = await request('/api/tenants/me');
if (expectedRole === 'tenant') {
  expectStatus('tenant profile', tenantProfile.status, [200]);
} else if (tenantProfile.status === 404) {
  console.log('INFO tenant profile: HTTP 404 means no tenant profile exists for this identity; it is not authorization evidence');
} else {
  expectStatus('tenant profile for non-tenant identity', tenantProfile.status, [200]);
}

// Use a valid schema payload and a cross-portfolio property so any denial is
// attributable to authorization, not request parsing. No row can be inserted.
if (!createPropertyId) {
  throw new Error('STAGING_CREATE_PROPERTY_ID is required for the valid unit authorization probe');
}
const tenantCreate = await request('/api/units', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    propertyId: createPropertyId,
    unitNumber: 'STEP3-AUTH-PROBE',
    bedrooms: 1,
    bathrooms: 1,
    size: '1',
    rentAmount: '1',
    isOccupied: false,
  }),
});
expectAuthorizationDenied('unit creation authorization guard', tenantCreate, fixtureScope.createDenial);

if (siblingUnitId) {
  // PATCH is used only as a denial probe. The route checks ownership before
  // restore-state validation, so an existing foreign/sibling fixture must
  // produce an explicit 403 rather than a malformed-request 400.
  const siblingRestore = await request(`/api/units/${encodeURIComponent(siblingUnitId)}`, {
    method: 'PATCH',
  });
  expectAuthorizationDenied('sibling unit denial', siblingRestore, ['Access denied']);
}

console.log(JSON.stringify({
  baseUrl,
  fixtureIdentity,
  checks: [
    'unit list',
    'tenant list',
    'tenant profile (or explicit no-profile info)',
    ...(expectedRole ? ['authenticated role profile'] : []),
    'valid unit creation authorization guard',
    ...(siblingUnitId ? ['sibling unit denial'] : []),
  ],
  note: 'This harness validates the active identity only. Run once per synthetic staging identity and retain sanitized output.',
}));

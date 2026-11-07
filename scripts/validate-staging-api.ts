import { strict as assert } from 'node:assert';

const baseUrl = process.env.STAGING_BASE_URL ?? '';
const accessToken = process.env.STAGING_API_TOKEN ?? '';
const vercelCookie = process.env.STAGING_VERCEL_COOKIE ?? '';
const siblingUnitId = process.env.STAGING_SIBLING_UNIT_ID ?? '';
const expectedRole = process.env.STAGING_EXPECTED_ROLE ?? '';
const createPropertyId = process.env.STAGING_CREATE_PROPERTY_ID ?? '';

if (!baseUrl || !/^https:\/\/[a-z0-9-]+\.vercel\.app\/?$/.test(baseUrl)) {
  throw new Error('STAGING_BASE_URL must be an isolated https://*.vercel.app URL');
}
if (!accessToken) {
  throw new Error('STAGING_API_TOKEN is required; do not place it in source control');
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

function expectAuthorizationDenied(label: string, response: { status: number; body: unknown }) {
  assert.equal(response.status, 403, `${label}: expected explicit HTTP 403 authorization denial, received ${response.status}`);
  console.log(`PASS ${label}: HTTP 403 authorization denial`);
}

const units = await request('/api/units');
expectStatus('unit list', units.status, [200]);
assert.ok(Array.isArray(units.body), 'unit list must return an array');

const tenantList = await request('/api/tenants');
expectStatus('tenant list', tenantList.status, [200, 403]);
if (tenantList.status === 200) assert.ok(Array.isArray(tenantList.body), 'tenant list must return an array');

const tenantProfile = await request('/api/tenants/me');
if (expectedRole === 'tenant') {
  expectStatus('tenant profile', tenantProfile.status, [200]);
} else if (tenantProfile.status === 404) {
  console.log('INFO tenant profile: HTTP 404 means no tenant profile exists for this identity; it is not authorization evidence');
} else {
  expectStatus('tenant profile for non-tenant identity', tenantProfile.status, [200]);
}

if (expectedRole) {
  const profile = await request('/api/auth?action=user');
  expectStatus('authenticated role profile', profile.status, [200]);
  const role = profile.body && typeof profile.body === 'object' && 'role' in profile.body
    ? (profile.body as { role?: unknown }).role
    : undefined;
  assert.equal(role, expectedRole, `expected role ${expectedRole} but received ${String(role)}`);
  console.log(`PASS authenticated role profile: ${String(role)}`);
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
expectAuthorizationDenied('unit creation authorization guard', tenantCreate);

if (siblingUnitId) {
  // PATCH is used only as a denial probe. The route checks ownership before
  // restore-state validation, so an existing foreign/sibling fixture must
  // produce an explicit 403 rather than a malformed-request 400.
  const siblingRestore = await request(`/api/units/${encodeURIComponent(siblingUnitId)}`, {
    method: 'PATCH',
  });
  expectAuthorizationDenied('sibling unit denial', siblingRestore);
}

console.log(JSON.stringify({
  baseUrl,
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

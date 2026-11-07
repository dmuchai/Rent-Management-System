import { strict as assert } from 'node:assert';

const baseUrl = process.env.STAGING_BASE_URL ?? '';
const accessToken = process.env.STAGING_API_TOKEN ?? '';
const vercelCookie = process.env.STAGING_VERCEL_COOKIE ?? '';

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

const units = await request('/api/units');
expectStatus('unit list', units.status, [200]);
assert.ok(Array.isArray(units.body), 'unit list must return an array');

const tenantList = await request('/api/tenants');
expectStatus('tenant list', tenantList.status, [200, 403]);
if (tenantList.status === 200) assert.ok(Array.isArray(tenantList.body), 'tenant list must return an array');

const tenantProfile = await request('/api/tenants/me');
expectStatus('tenant profile or role denial', tenantProfile.status, [200, 403, 404]);

// This request must not create data: tenant authority is rejected before body parsing.
const tenantCreate = await request('/api/units', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});
expectStatus('unit creation role guard', tenantCreate.status, [400, 403, 409]);
if (tenantCreate.status === 201) {
  throw new Error('Safety failure: validation request unexpectedly created a unit');
}

console.log(JSON.stringify({
  baseUrl,
  checks: [
    'unit list',
    'tenant list',
    'tenant profile or role denial',
    'non-mutating unit creation role guard',
  ],
  note: 'This harness validates the active identity only. Run once per synthetic staging identity and retain sanitized output.',
}));

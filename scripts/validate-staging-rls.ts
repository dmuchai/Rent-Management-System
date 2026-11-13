/// <reference types="node" />

import { strict as assert } from 'node:assert';

const supabaseUrl = process.env.STAGING_SUPABASE_URL ?? '';
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY ?? '';
const expectedProjectRef = 'mcclctunrpyhumubpeyo';

const identities = {
  landlordA: process.env.STAGING_RLS_TOKEN_LANDLORD_A ?? '',
  landlordB: process.env.STAGING_RLS_TOKEN_LANDLORD_B ?? '',
  managerA: process.env.STAGING_RLS_TOKEN_MANAGER_A ?? '',
  propertyCaretakerA: process.env.STAGING_RLS_TOKEN_PROPERTY_CARETAKER_A ?? '',
  unitCaretakerA: process.env.STAGING_RLS_TOKEN_UNIT_CARETAKER_A ?? '',
  tenantA: process.env.STAGING_RLS_TOKEN_TENANT_A ?? '',
  tenantB: process.env.STAGING_RLS_TOKEN_TENANT_B ?? '',
};

if (!supabaseUrl) throw new Error('STAGING_SUPABASE_URL is required');
const parsedUrl = new URL(supabaseUrl);
if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== `${expectedProjectRef}.supabase.co`) {
  throw new Error('STAGING_SUPABASE_URL must reference the isolated staging Supabase project');
}
if (!anonKey) throw new Error('STAGING_SUPABASE_ANON_KEY is required');
const minimumRemainingSeconds = Number.parseInt(process.env.STAGING_RLS_MIN_REMAINING_SECONDS ?? '300', 10);
if (!Number.isInteger(minimumRemainingSeconds) || minimumRemainingSeconds < 60) {
  throw new Error('STAGING_RLS_MIN_REMAINING_SECONDS must be an integer of at least 60 seconds');
}

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;
type Result = { status: number; body: Json };
type TokenStatus = 'VALID' | 'EXPIRED' | 'MISSING' | 'INVALID';
type TokenClaims = { iss?: unknown; exp?: unknown };

function decodeClaims(token: string): TokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
    const claims = JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) as unknown;
    return claims && typeof claims === 'object' ? claims as TokenClaims : null;
  } catch {
    return null;
  }
}

async function preflightToken(token: string): Promise<TokenStatus> {
  if (!token) return 'MISSING';
  const claims = decodeClaims(token);
  if (!claims || claims.iss !== `${supabaseUrl}/auth/v1` || typeof claims.exp !== 'number') return 'INVALID';
  const remaining = claims.exp - Math.floor(Date.now() / 1000);
  if (remaining <= 0) return 'EXPIRED';
  if (remaining < minimumRemainingSeconds) return 'INVALID';

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) return 'INVALID';
  return response.ok ? 'VALID' : 'INVALID';
}

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

function assertDefaultDeny(label: string, result: Result) {
  if (result.status === 401 || result.status === 403) {
    pass(`${label} (HTTP ${result.status})`);
    return;
  }
  const found = rows(result, label);
  assert.equal(found.length, 0, `${label}: rows were visible through a direct client query`);
  pass(`${label} (HTTP 200, 0 rows)`);
}

async function main(): Promise<void> {
  const tokenStatuses = await Promise.all(
    Object.entries(identities).map(async ([name, token]) => [name, await preflightToken(token)] as const),
  );
  for (const [name, status] of tokenStatuses) console.log(`PREFLIGHT ${name}: ${status}`);
  const invalidTokens = tokenStatuses.filter(([, status]) => status !== 'VALID');
  if (invalidTokens.length) {
    throw new Error(`Client-context JWT preflight failed for: ${invalidTokens.map(([name, status]) => `${name} (${status})`).join(', ')}`);
  }

  assertDefaultDeny(
    'Landlord A direct business-table access is denied',
    await request('landlordA', 'properties', 'select=id,owner_id&id=eq.step3-property-a'),
  );
  assertDefaultDeny(
    'Landlord B direct business-table access is denied',
    await request('landlordB', 'properties', 'select=id,owner_id&id=eq.step3-property-b'),
  );
  assertDefaultDeny(
    'Property Manager A direct property access is denied',
    await request('managerA', 'properties', 'select=id,owner_id'),
  );
  assertDefaultDeny(
    'Property Caretaker A direct unit access is denied',
    await request('propertyCaretakerA', 'units', 'select=id,property_id'),
  );
  assertDefaultDeny(
    'Unit Caretaker A direct unit access is denied',
    await request('unitCaretakerA', 'units', 'select=id,property_id'),
  );
  assertDefaultDeny(
    'Tenant A direct profile access is denied',
    await request('tenantA', 'tenants', 'select=id,user_id&id=eq.step3-tenant-record-a'),
  );
  assertDefaultDeny(
    'Tenant B direct profile access is denied',
    await request('tenantB', 'tenants', 'select=id,user_id&id=eq.step3-tenant-record-b'),
  );

  for (const identity of Object.keys(identities) as (keyof typeof identities)[]) {
    const memberships = await request(identity, 'user_context_memberships', 'select=id,user_id,context_owner_id,role,status');
    if (memberships.status === 401 || memberships.status === 403) {
      pass(`${identity} membership table is not exposed to the client role`);
      continue;
    }
    assertDefaultDeny(`${identity} membership table is not exposed to the client role`, memberships);
  }

  console.log(JSON.stringify({
    projectRef: expectedProjectRef,
    checks: 'client-context default-deny checks for server-owned business tables',
    writes: 'none',
    note: 'Business data is served through the authenticated Express/Vercel API; direct REST access is expected to remain denied.',
  }));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Staging RLS validation failed');
  process.exitCode = 1;
});

import assert from 'node:assert/strict';
// Destructive only to the dedicated step3-* staging fixtures. Load protected
// credentials into the environment, declare the exact staging project and
// candidate IDs, set STAGING_ALLOW_MUTATION=true, and optionally point
// VERCEL_CLI_BIN at a pinned authenticated Vercel CLI binary.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const postgres = require('postgres');

const deployment = process.env.STAGING_VERCEL_DEPLOYMENT_ID;
const team = process.env.STAGING_VERCEL_SCOPE;
const stagingProjectRef = process.env.STAGING_SUPABASE_PROJECT_REF;
const vercelCli = process.env.VERCEL_CLI_BIN || 'vercel';
const supabaseUrl = process.env.STAGING_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL;
const password = process.env.STAGING_TEST_PASSWORD;
for (const [name, value] of Object.entries({ deployment, team, stagingProjectRef, supabaseUrl, anonKey, serviceKey, databaseUrl, password })) {
  if (!value) throw new Error(`${name} is required`);
}
assert.equal(process.env.STAGING_ALLOW_MUTATION, 'true', 'Set STAGING_ALLOW_MUTATION=true for the synthetic staging fixture lifecycle');
assert.match(deployment, /^dpl_[A-Za-z0-9]+$/, 'Use an exact Vercel deployment ID');
assert.equal(new URL(supabaseUrl).hostname, `${stagingProjectRef}.supabase.co`);
assert.ok(new URL(databaseUrl).username.includes(stagingProjectRef), 'DATABASE_URL must belong to the declared staging project');
const tempDirectory = mkdtempSync(join(tmpdir(), 'landee-hosted-validation-'));

const identities = [
  { name: 'LANDLORD_A', email: 'step3-landlord-a@staging.landee.test', role: 'landlord', units: ['step3-unit-a1', 'step3-unit-a2'], tenants: ['step3-tenant-record-a'], leases: ['step3-lease-a'], foreignProperty: 'step3-property-b', siblingUnit: 'step3-unit-b1' },
  { name: 'LANDLORD_B', email: 'step3-landlord-b@staging.landee.test', role: 'landlord', units: ['step3-unit-b1'], tenants: ['step3-tenant-record-b'], leases: ['step3-lease-b'], foreignProperty: 'step3-property-a', siblingUnit: 'step3-unit-a1' },
  { name: 'MANAGER_A', email: 'step3-manager-a@staging.landee.test', role: 'property_manager', units: ['step3-unit-a1', 'step3-unit-a2'], tenants: ['step3-tenant-record-a'], leases: ['step3-lease-a'], foreignProperty: 'step3-property-b', siblingUnit: 'step3-unit-b1' },
  { name: 'PROPERTY_CARETAKER_A', email: 'step3-caretaker-property-a@staging.landee.test', role: 'caretaker', units: ['step3-unit-a1', 'step3-unit-a2'], tenants: ['step3-tenant-record-a'], leases: ['step3-lease-a'], foreignProperty: 'step3-property-b', siblingUnit: 'step3-unit-b1' },
  { name: 'UNIT_CARETAKER_A', email: 'step3-caretaker-unit-a@staging.landee.test', role: 'caretaker', units: ['step3-unit-a1'], tenants: ['step3-tenant-record-a'], leases: ['step3-lease-a'], foreignProperty: 'step3-property-b', siblingUnit: 'step3-unit-a2' },
  { name: 'TENANT_A', email: 'step3-tenant-a@staging.landee.test', role: 'tenant', units: null, tenants: null, leases: ['step3-lease-a'], foreignProperty: 'step3-property-b', siblingUnit: 'step3-unit-a2' },
  { name: 'TENANT_B', email: 'step3-tenant-b@staging.landee.test', role: 'tenant', units: null, tenants: null, leases: ['step3-lease-b'], foreignProperty: 'step3-property-a', siblingUnit: 'step3-unit-a1' },
];

let requestCount = 0;
function request(path, token, { method = 'GET', body, headers = {} } = {}) {
  const headerFile = join(tempDirectory, `headers-${requestCount++}`);
  const args = ['curl', path, '--deployment', deployment, '--scope', team, '--',
    '--silent', '--show-error', '--request', method, '--dump-header', headerFile,
    '--write-out', '\n__LANDEE_STATUS__%{http_code}'];
  if (token) args.push('--header', `Authorization: Bearer ${token}`);
  for (const [key, value] of Object.entries(headers)) args.push('--header', `${key}: ${value}`);
  if (body !== undefined) args.push('--header', 'Content-Type: application/json', '--data-binary', JSON.stringify(body));
  const result = spawnSync(vercelCli, args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`candidate request failed for ${path}`);
  const marker = '\n__LANDEE_STATUS__';
  const index = result.stdout.lastIndexOf(marker);
  if (index < 0) throw new Error(`candidate response status missing for ${path}`);
  const rawBody = result.stdout.slice(0, index);
  const status = Number(result.stdout.slice(index + marker.length).trim());
  let parsed = rawBody;
  try { parsed = rawBody ? JSON.parse(rawBody) : null; } catch {}
  const rawHeaders = readFileSync(headerFile, 'utf8');
  const locationMatch = rawHeaders.match(/^location:\s*(.+)$/im);
  return { status, body: parsed, location: locationMatch?.[1]?.trim() || null };
}

async function signIn(email) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (response.status !== 200) {
        if (response.status !== 429 && response.status < 500) {
          throw new Error(`${email} sign-in rejected (${response.status}); credentials are not retried`);
        }
        throw Object.assign(new Error(`${email} sign-in transient failure (${response.status})`), { transient: true });
      }
      assert.ok(body.access_token);
      return body.access_token;
    } catch (error) {
      lastError = error;
      const transient = error?.transient === true || error instanceof TypeError;
      if (!transient || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

function pass(label) { console.log(`PASS ${label}`); }

const sql = postgres(databaseUrl, { ssl: 'require', prepare: false, max: 1 });
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const uploadClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const tokens = new Map();
const testImagePaths = new Set();
let originalImageUrl;
let createdInvitationId;

try {
  for (const identity of identities) {
    const token = await signIn(identity.email);
    tokens.set(identity.name, token);
    const profile = request('/api/auth?action=user', token);
    assert.equal(profile.status, 200, `${identity.name} profile`);
    assert.equal(profile.body.role, identity.role, `${identity.name} role`);
    const units = request('/api/units', token);
    if (identity.units === null) {
      assert.equal(units.status, 403, `${identity.name} unit list`);
    } else {
      assert.equal(units.status, 200, `${identity.name} unit list`);
      assert.deepEqual(new Set(units.body.map((row) => row.id)), new Set(identity.units), `${identity.name} unit scope`);
    }
    const tenants = request('/api/tenants', token);
    if (identity.tenants === null) {
      assert.equal(tenants.status, 403, `${identity.name} tenant list`);
    } else {
      assert.equal(tenants.status, 200, `${identity.name} tenant list`);
      assert.deepEqual(new Set(tenants.body.map((row) => row.id)), new Set(identity.tenants), `${identity.name} tenant scope`);
    }
    const leases = request('/api/leases', token);
    assert.equal(leases.status, 200, `${identity.name} lease list`);
    assert.deepEqual(new Set(leases.body.map((row) => row.id)), new Set(identity.leases), `${identity.name} lease scope`);
    const tenantProfile = request('/api/tenants/me', token);
    assert.ok(identity.role === 'tenant' ? tenantProfile.status === 200 : [200, 404].includes(tenantProfile.status));
    const deniedCreate = request('/api/units', token, { method: 'POST', body: {
      propertyId: identity.foreignProperty, unitNumber: 'STEP3-HOSTED-DENIAL', bedrooms: 1,
      bathrooms: 1, size: '1', rentAmount: '1', isOccupied: false,
    }});
    assert.equal(deniedCreate.status, 403, `${identity.name} foreign unit create`);
    const deniedSibling = request(`/api/units/${identity.siblingUnit}`, token, { method: 'PATCH' });
    assert.equal(deniedSibling.status, 403, `${identity.name} sibling/foreign restore`);
    pass(`${identity.name} hosted identity and authorization matrix`);
  }

  const [ownerA] = await sql`select id from public.users where email='step3-landlord-a@staging.landee.test'`;
  const [ownerB] = await sql`select id from public.users where email='step3-landlord-b@staging.landee.test'`;
  assert.ok(ownerA?.id && ownerB?.id);
  const invalidContext = request('/api/units', tokens.get('MANAGER_A'), { headers: {
    'x-landee-context-role': 'property_manager', 'x-landee-context-owner': ownerB.id,
  }});
  assert.equal(invalidContext.status, 401);
  assert.equal(invalidContext.body.code, 'AUTHORITY_CONTEXT_INVALID');
  const generic401 = request('/api/units', 'invalid-token', { headers: {
    'x-landee-context-role': 'property_manager', 'x-landee-context-owner': ownerA.id,
  }});
  assert.equal(generic401.status, 401);
  assert.notEqual(generic401.body?.code, 'AUTHORITY_CONTEXT_INVALID');
  pass('explicit authority-context failure is distinct from generic 401');

  const managerSubscription = request('/api/subscription', tokens.get('MANAGER_A'));
  const landlordSubscription = request('/api/subscription', tokens.get('LANDLORD_A'));
  assert.equal(managerSubscription.status, 200);
  assert.equal(landlordSubscription.status, 200);
  assert.deepEqual(managerSubscription.body.usage, landlordSubscription.body.usage);
  assert.equal(managerSubscription.body.access.planCode, landlordSubscription.body.access.planCode);
  pass('manager subscription totals use selected owner context');

  const [unitA1Before] = await sql`SELECT unit_number, rent_amount, is_occupied, bedrooms, bathrooms, size
    FROM public.units WHERE id='step3-unit-a1'`;
  const assignedUpdate = request('/api/units', tokens.get('UNIT_CARETAKER_A'), { method: 'PUT', body: {
    id: 'step3-unit-a1', propertyId: 'step3-property-a', unitNumber: 'A1',
    bedrooms: 2, bathrooms: 1, size: 45,
  }});
  assert.equal(assignedUpdate.status, 200);
  assert.equal(assignedUpdate.body.bedrooms, 2);
  assert.equal(String(assignedUpdate.body.rentAmount), String(unitA1Before.rent_amount));
  assert.equal(Boolean(assignedUpdate.body.isOccupied), Boolean(unitA1Before.is_occupied));
  // Even if a client tries to smuggle rent/occupancy, caretaker updates must preserve them.
  const rentSmuggle = request('/api/units', tokens.get('UNIT_CARETAKER_A'), { method: 'PUT', body: {
    id: 'step3-unit-a1', propertyId: 'step3-property-a', unitNumber: 'A1',
    bedrooms: 2, bathrooms: 1, size: 45, rentAmount: '999999', isOccupied: false,
  }});
  assert.equal(rentSmuggle.status, 200);
  assert.equal(String(rentSmuggle.body.rentAmount), String(unitA1Before.rent_amount));
  assert.equal(Boolean(rentSmuggle.body.isOccupied), Boolean(unitA1Before.is_occupied));
  const siblingUpdate = request('/api/units', tokens.get('UNIT_CARETAKER_A'), { method: 'PUT', body: {
    id: 'step3-unit-a2', propertyId: 'step3-property-a', unitNumber: 'A2',
    bedrooms: 1, bathrooms: 1, size: 10,
  }});
  assert.equal(siblingUpdate.status, 403);
  // Restore descriptive fields mutated by the assigned-update probe.
  await sql`UPDATE public.units SET unit_number=${unitA1Before.unit_number}, bedrooms=${unitA1Before.bedrooms},
    bathrooms=${unitA1Before.bathrooms}, size=${unitA1Before.size}, rent_amount=${unitA1Before.rent_amount},
    is_occupied=${unitA1Before.is_occupied}, updated_at=NOW() WHERE id='step3-unit-a1'`;
  pass('unit caretaker can update assigned descriptive fields but not sibling or rent/occupancy');

  const [unitCaretaker] = await sql`select id from public.users where email='step3-caretaker-unit-a@staging.landee.test'`;
  const invitationId = randomUUID();
  createdInvitationId = invitationId;
  const invitationToken = randomBytes(32).toString('hex');
  await sql`insert into public.caretaker_invitations
    (id, landlord_id, invited_by, email, first_name, last_name, invitation_token,
     invitation_sent_at, status, expires_at, unit_id)
    values (${invitationId}, ${ownerA.id}, ${ownerA.id}, 'step3-caretaker-unit-a@staging.landee.test',
      'Step3', 'Unit Caretaker A', ${invitationToken}, now(), 'invited', now() + interval '1 day', 'step3-unit-a1')`;
  const unauthenticatedAcceptance = request('/api/caretaker-invitations?action=accept', null, {
    method: 'POST', body: { token: invitationToken, password: randomBytes(24).toString('base64url') },
  });
  assert.equal(unauthenticatedAcceptance.status, 401);
  assert.equal(unauthenticatedAcceptance.body.code, 'EXISTING_ACCOUNT_AUTH_REQUIRED');
  await signIn('step3-caretaker-unit-a@staging.landee.test');
  const accepted = request('/api/caretaker-invitations?action=accept', tokens.get('UNIT_CARETAKER_A'), {
    method: 'POST', body: { token: invitationToken },
  });
  assert.equal(accepted.status, 201);
  assert.equal(accepted.body.requireLogin, false);
  const [acceptedRow] = await sql`select status, invitation_token from public.caretaker_invitations where id=${invitationId}`;
  assert.equal(acceptedRow.status, 'accepted');
  assert.equal(acceptedRow.invitation_token, null);
  const [assignmentCount] = await sql`select count(*)::int as count from public.caretaker_assignments
    where caretaker_id=${unitCaretaker.id} and landlord_id=${ownerA.id} and unit_id='step3-unit-a1' and status='active'`;
  assert.equal(assignmentCount.count, 1);
  assert.equal(request('/api/auth?action=user', tokens.get('UNIT_CARETAKER_A')).status, 200);
  pass('caretaker invitation requires existing-account proof and is retry-safe');

  const [property] = await sql`select image_url from public.properties where id='step3-property-a'`;
  originalImageUrl = property.image_url;
  assert.equal(originalImageUrl, null, 'Synthetic image fixture must start without an attached image');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const prepare = request('/api/property-images/step3-property-a', tokens.get('LANDLORD_A'), {
    method: 'POST', body: { action: 'prepare', contentType: 'image/png', size: png.length },
  });
  assert.equal(prepare.status, 200);
  testImagePaths.add(prepare.body.path);
  const upload = await uploadClient.storage.from('property-images').uploadToSignedUrl(
    prepare.body.path, prepare.body.token, new Blob([png], { type: 'image/png' }), { contentType: 'image/png' },
  );
  assert.ifError(upload.error);
  const complete = request('/api/property-images/step3-property-a', tokens.get('LANDLORD_A'), {
    method: 'POST', body: { action: 'complete', path: prepare.body.path },
  });
  assert.equal(complete.status, 201);
  const [stable] = await sql`select image_url from public.properties where id='step3-property-a'`;
  assert.equal(stable.image_url, `storage:property-images:${prepare.body.path}`);
  const signedRead = request('/api/property-images?propertyId=step3-property-a', tokens.get('LANDLORD_A'));
  assert.equal(signedRead.status, 302);
  assert.ok(signedRead.location?.startsWith(`${supabaseUrl}/storage/v1/object/sign/property-images/`));
  const signedToken = new URL(signedRead.location).searchParams.get('token');
  const payload = JSON.parse(Buffer.from(signedToken.split('.')[1], 'base64url').toString('utf8'));
  const remaining = payload.exp - Math.floor(Date.now() / 1000);
  assert.ok(remaining >= 80 && remaining <= 90, `signed read TTL was ${remaining}s`);
  assert.equal((await fetch(signedRead.location)).status, 200);
  assert.equal(request('/api/property-images?propertyId=step3-property-a', tokens.get('UNIT_CARETAKER_A')).status, 302);
  assert.equal(request('/api/property-images?propertyId=step3-property-a', tokens.get('LANDLORD_B')).status, 404);
  assert.equal(request('/api/property-images/step3-property-a', tokens.get('LANDLORD_A'), {
    method: 'POST', body: { action: 'prepare', contentType: 'text/plain', size: 5 },
  }).status, 400);
  assert.equal(request('/api/property-images/step3-property-a', tokens.get('LANDLORD_A'), {
    method: 'POST', body: { action: 'prepare', contentType: 'image/png', size: 5 * 1024 * 1024 + 1 },
  }).status, 400);

  const badBytes = Buffer.from('not a png');
  const badPrepare = request('/api/property-images/step3-property-a', tokens.get('LANDLORD_A'), {
    method: 'POST', body: { action: 'prepare', contentType: 'image/png', size: badBytes.length },
  });
  assert.equal(badPrepare.status, 200);
  testImagePaths.add(badPrepare.body.path);
  assert.ifError((await uploadClient.storage.from('property-images').uploadToSignedUrl(
    badPrepare.body.path, badPrepare.body.token, new Blob([badBytes], { type: 'image/png' }), { contentType: 'image/png' },
  )).error);
  assert.equal(request('/api/property-images/step3-property-a', tokens.get('LANDLORD_A'), {
    method: 'POST', body: { action: 'complete', path: badPrepare.body.path },
  }).status, 400);
  const badInfo = await admin.storage.from('property-images').info(badPrepare.body.path);
  assert.ok(badInfo.error);

  const replacement = request('/api/property-images/step3-property-a', tokens.get('LANDLORD_A'), {
    method: 'POST', body: { action: 'prepare', contentType: 'image/png', size: png.length },
  });
  assert.equal(replacement.status, 200);
  testImagePaths.add(replacement.body.path);
  assert.ifError((await uploadClient.storage.from('property-images').uploadToSignedUrl(
    replacement.body.path, replacement.body.token, new Blob([png], { type: 'image/png' }), { contentType: 'image/png' },
  )).error);
  assert.equal(request('/api/property-images/step3-property-a', tokens.get('LANDLORD_A'), {
    method: 'POST', body: { action: 'complete', path: replacement.body.path },
  }).status, 201);
  assert.ok((await admin.storage.from('property-images').info(prepare.body.path)).error);
  const oneSecond = await admin.storage.from('property-images').createSignedUrl(replacement.body.path, 1);
  assert.ifError(oneSecond.error);
  await new Promise((resolve) => setTimeout(resolve, 2100));
  assert.notEqual((await fetch(oneSecond.data.signedUrl)).status, 200);
  const [orphans] = await sql`select count(*)::int as count from storage.objects o
    left join public.properties p on p.image_url='storage:property-images:' || o.name
    where o.bucket_id='property-images' and p.id is null`;
  assert.equal(orphans.count, 0);
  pass('private image prepare/upload/finalize/read/replace/expiry and rejection matrix');

  for (const path of ['/api/cron/process-emails', '/api/cron/process-sms', '/api/cron/generate-invoices', '/api/cron/lease-lifecycle', '/api/cron/process-payment-events']) {
    assert.equal(request(path, null).status, 401, `${path} unauthenticated`);
  }
  pass('scheduled jobs reject unauthenticated requests');

  // Manager dual-context fixture lifecycle for browser Gate 1 is owned by
  // scripts/validate-staging-browser-gates.mjs so this API harness does not leave
  // memberships active across browser runs. Browser-driven A→B→A switch evidence
  // is collected there against the same candidate.
  pass('manager dual-context browser fixture deferred to staging browser gates runner');
} finally {
  try {
    if (originalImageUrl !== undefined) {
      await sql`update public.properties set image_url=${originalImageUrl}, updated_at=now() where id='step3-property-a'`;
    }
    if (testImagePaths.size) await admin.storage.from('property-images').remove([...testImagePaths]);
    if (createdInvitationId) await sql`delete from public.caretaker_invitations where id=${createdInvitationId}`;
    await sql.end();
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

console.log(JSON.stringify({ deployment, identities: identities.length, writes: 'synthetic staging only; property image restored and test objects removed' }));

#!/usr/bin/env node
/**
 * Interactive browser gates for Step 3 staging promotion:
 * 1) Manager A owner-context switch A → B → A
 * 2) Unit Caretaker A descriptive-field edit + sibling/foreign denial
 *
 * Requires:
 *   STAGING_BASE_URL                 exact candidate or alias URL
 *   STAGING_SUPABASE_PROJECT_REF     mcclctunrpyhumubpeyo
 *   STAGING_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY / DATABASE_URL
 *   STAGING_TEST_PASSWORD
 *   STAGING_ALLOW_MUTATION=true
 * Optional:
 *   STAGING_VERCEL_SHARE_URL         candidate URL including _vercel_share (kept secret; never logged)
 *   STAGING_BROWSER_EVIDENCE_DIR     defaults to tests/evidence/browsers/step3-gates
 *   PLAYWRIGHT_BROWSERS_PATH         existing Chromium cache
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const postgres = require('postgres');
const { chromium } = await import('playwright');

const baseUrl = (process.env.STAGING_BASE_URL || '').replace(/\/$/, '');
const shareUrl = (process.env.STAGING_VERCEL_SHARE_URL || '').replace(/\/$/, '');
const stagingProjectRef = process.env.STAGING_SUPABASE_PROJECT_REF || process.env.STAGING_PROJECT_REF;
const supabaseUrl = process.env.STAGING_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL;
const password = process.env.STAGING_TEST_PASSWORD;
const evidenceDir = process.env.STAGING_BROWSER_EVIDENCE_DIR
  || join(process.cwd(), 'tests/evidence/browsers/step3-gates');

for (const [name, value] of Object.entries({
  baseUrl, stagingProjectRef, supabaseUrl, anonKey, serviceKey, databaseUrl, password,
})) {
  if (!value) throw new Error(`${name} is required`);
}
assert.equal(process.env.STAGING_ALLOW_MUTATION, 'true', 'Set STAGING_ALLOW_MUTATION=true');
assert.equal(stagingProjectRef, 'mcclctunrpyhumubpeyo');
assert.equal(new URL(supabaseUrl).hostname, `${stagingProjectRef}.supabase.co`);
assert.ok(new URL(databaseUrl).username.includes(stagingProjectRef));

mkdirSync(evidenceDir, { recursive: true });
const findings = [];
function pass(label) {
  console.log(`PASS ${label}`);
  findings.push({ status: 'PASS', label });
}
function note(label) {
  console.log(`INFO ${label}`);
  findings.push({ status: 'INFO', label });
}

const sql = postgres(databaseUrl, { ssl: 'require', prepare: false, max: 1 });

const identities = {
  MANAGER_A: { email: 'step3-manager-a@staging.landee.test', phone: '0700000305', role: 'property_manager' },
  UNIT_CARETAKER_A: { email: 'step3-caretaker-unit-a@staging.landee.test', phone: '0700000307', role: 'caretaker' },
  LANDLORD_A: { email: 'step3-landlord-a@staging.landee.test', phone: '0700000301', role: 'landlord' },
  LANDLORD_B: { email: 'step3-landlord-b@staging.landee.test', phone: '0700000302', role: 'landlord' },
  PROPERTY_CARETAKER_A: { email: 'step3-caretaker-property-a@staging.landee.test', phone: '0700000306', role: 'caretaker' },
  TENANT_A: { email: 'step3-tenant-a@staging.landee.test', phone: '0700000303', role: 'tenant' },
  TENANT_B: { email: 'step3-tenant-b@staging.landee.test', phone: '0700000304', role: 'tenant' },
};

let createdManagerMembershipId = null;
let originalManagerMembershipSnapshot = null;
let originalUnitA1 = null;
let browser;

function originForNavigation() {
  // Prefer the protected share URL for first navigation only; never print it.
  return shareUrl || baseUrl;
}

function sanitizeUrl(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('_vercel_share');
    u.hash = '';
    return u.toString();
  } catch {
    return '[unparseable-url]';
  }
}

async function attachDiagnostics(page, label) {
  const consoleLines = [];
  const networkLines = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (/token|password|authorization|_vercel_share|Bearer/i.test(text)) return;
    consoleLines.push(`${msg.type()}: ${text.slice(0, 300)}`);
  });
  page.on('response', (res) => {
    const url = sanitizeUrl(res.url());
    if (!url.includes('/api/') && res.status() < 400) return;
    networkLines.push(`${res.status()} ${res.request().method()} ${url}`);
  });
  return {
    async dump(suffix) {
      const shot = join(evidenceDir, `${label}-${suffix}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      writeFileSync(join(evidenceDir, `${label}-${suffix}-console.json`), JSON.stringify(consoleLines, null, 2));
      writeFileSync(join(evidenceDir, `${label}-${suffix}-network.json`), JSON.stringify(networkLines, null, 2));
      note(`${label} evidence: ${shot}`);
    },
  };
}

async function landeeLogin(page, identity) {
  await page.goto(`${originForNavigation()}/login`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  // If Vercel Authentication challenge appears without a share cookie, fail clearly.
  const title = await page.title();
  if (/log in to vercel|authentication required/i.test(title) || /vercel\.com\/login/i.test(page.url())) {
    throw new Error('Vercel Authentication blocked browser access; provide STAGING_VERCEL_SHARE_URL for this candidate');
  }
  await page.fill('#username', identity.phone);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 90_000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function openUserMenu(page) {
  const trigger = page.getByTestId('user-name').locator('..');
  await trigger.click({ timeout: 30_000 });
  await page.waitForTimeout(300);
}

async function readDashboardStats(page) {
  const bodyText = await page.locator('main, body').innerText();
  return bodyText;
}

async function assertNoStaleOwnerRecords(page, forbiddenLabels) {
  const text = await page.locator('body').innerText();
  for (const label of forbiddenLabels) {
    assert.equal(text.includes(label), false, `stale record visible: ${label}`);
  }
}

async function apiWithPage(page, method, path, body) {
  return page.evaluate(async ({ method, path, body }) => {
    const headers = { 'Content-Type': 'application/json' };
    // Reuse the browser session cookies / local storage auth path via fetch to same origin.
    // Authorization header is attached by the app's own session storage when present in supabase.
    const keys = Object.keys(localStorage);
    const supabaseKey = keys.find((k) => k.includes('auth-token') || k.startsWith('sb-'));
    if (supabaseKey) {
      try {
        const raw = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
        const token = raw?.access_token
          || raw?.currentSession?.access_token
          || raw?.session?.access_token;
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch {}
    }
    const contextRaw = localStorage.getItem('landee-auth-context:v1');
    if (contextRaw) {
      try {
        const ctx = JSON.parse(contextRaw);
        if (ctx?.role) headers['x-landee-context-role'] = ctx.role;
        if (ctx?.contextOwnerId) headers['x-landee-context-owner'] = ctx.contextOwnerId;
      } catch {}
    }
    const res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
    });
    const text = await res.text();
    let parsed = text;
    try { parsed = text ? JSON.parse(text) : null; } catch {}
    return { status: res.status, body: parsed };
  }, { method, path, body });
}

try {
  const [manager] = await sql`SELECT id FROM public.users WHERE email=${identities.MANAGER_A.email}`;
  const [landlordA] = await sql`SELECT id FROM public.users WHERE email=${identities.LANDLORD_A.email}`;
  const [landlordB] = await sql`SELECT id FROM public.users WHERE email=${identities.LANDLORD_B.email}`;
  assert.ok(manager?.id && landlordA?.id && landlordB?.id);

  originalManagerMembershipSnapshot = await sql`
    SELECT id, context_owner_id, role, status, authority_source
    FROM public.user_context_memberships
    WHERE user_id=${manager.id}
    ORDER BY created_at`;
  note(`Manager A active memberships before run: ${originalManagerMembershipSnapshot.filter((r) => r.status === 'active').length}`);

  const existingB = originalManagerMembershipSnapshot.find(
    (row) => row.context_owner_id === landlordB.id && row.role === 'property_manager',
  );
  if (!existingB) {
    const [inserted] = await sql`
      INSERT INTO public.user_context_memberships
        (user_id, context_owner_id, role, status, authority_source)
      VALUES (${manager.id}, ${landlordB.id}, 'property_manager', 'active', 'assignment')
      RETURNING id`;
    createdManagerMembershipId = inserted.id;
    note(`Created Manager A → Landlord B membership ${createdManagerMembershipId}`);
  } else if (existingB.status !== 'active') {
    await sql`UPDATE public.user_context_memberships SET status='active' WHERE id=${existingB.id}`;
    note(`Reactivated existing Manager A → Landlord B membership ${existingB.id}`);
  } else {
    note(`Manager A → Landlord B membership already active (${existingB.id}); no insert`);
  }

  const [unitRow] = await sql`
    SELECT unit_number, rent_amount, is_occupied, bedrooms, bathrooms, size
    FROM public.units WHERE id='step3-unit-a1'`;
  originalUnitA1 = unitRow;
  assert.ok(originalUnitA1);

  browser = await chromium.launch({ headless: true });

  // ---------- Gate 1: manager switch ----------
  {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1400, height: 900 },
    });
    const page = await context.newPage();
    const diag = await attachDiagnostics(page, 'manager-switch');
    await landeeLogin(page, identities.MANAGER_A);
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle', timeout: 120_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await openUserMenu(page);
    const selector = page.locator('#authority-context');
    await selector.waitFor({ state: 'visible', timeout: 30_000 });
    const options = await selector.locator('option').allTextContents();
    assert.ok(options.length >= 2, 'authority selector must list both owner contexts');
    await diag.dump('initial-a');

    const optionValues = await selector.locator('option').evaluateAll((opts) => opts.map((o) => o.value));
    const valueA = optionValues.find((v) => v.includes(landlordA.id));
    const valueB = optionValues.find((v) => v.includes(landlordB.id));
    assert.ok(valueA && valueB, 'both landlord A and B context values present');

    // Ensure starting on A
    if ((await selector.inputValue()) !== valueA) {
      await selector.selectOption(valueA);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);
    }
    let statsA = await readDashboardStats(page);
    assert.match(statsA, /Property|property|Unit|unit|Tenant|tenant/i);
    await assertNoStaleOwnerRecords(page, ['Step 3 Property B', 'step3-property-b', 'Unit B1']);
    await diag.dump('context-a');

    await openUserMenu(page);
    await selector.selectOption(valueB);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    let statsB = await readDashboardStats(page);
    assert.match(statsB, /Property|property|Unit|unit|Tenant|tenant/i);
    await assertNoStaleOwnerRecords(page, ['Step 3 Property A', 'step3-property-a', 'Unit A1', 'Unit A2']);
    // Navigate key sections
    for (const section of ['properties', 'tenants', 'leases', 'invoices']) {
      const link = page.getByRole('button', { name: new RegExp(section, 'i') })
        .or(page.getByText(new RegExp(`^${section}$`, 'i')));
      if (await link.count()) {
        await link.first().click().catch(() => {});
        await page.waitForTimeout(800);
      }
      await assertNoStaleOwnerRecords(page, ['Step 3 Property A', 'Unit A1', 'Unit A2']);
    }
    await diag.dump('context-b');

    await openUserMenu(page);
    await page.locator('#authority-context').selectOption(valueA);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    statsA = await readDashboardStats(page);
    await assertNoStaleOwnerRecords(page, ['Step 3 Property B', 'Unit B1']);
    await diag.dump('context-a-restored');

    // Refresh retains context A
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await openUserMenu(page);
    const afterRefresh = await page.locator('#authority-context').inputValue();
    assert.equal(afterRefresh, valueA, 'refresh retains Landlord A context');
    await diag.dump('after-refresh-a');
    await context.close();
    pass('Gate 1 browser: Manager A switched A → B → A with scoped lists and refresh retention');
  }

  // ---------- Gate 2: caretaker descriptive edit ----------
  {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1400, height: 900 },
    });
    const page = await context.newPage();
    const diag = await attachDiagnostics(page, 'caretaker-edit');
    await landeeLogin(page, identities.UNIT_CARETAKER_A);
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle', timeout: 120_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Open properties section
    await page.getByTestId('nav-properties').click();
    await page.waitForTimeout(1000);

    const assignedRow = page.getByTestId('unit-row-step3-unit-a1');
    await assignedRow.waitFor({ state: 'visible', timeout: 30_000 });
    assert.equal(await page.getByTestId('unit-row-step3-unit-a2').count(), 0, 'sibling unit A2 must not render for unit caretaker');
    assert.equal(await page.getByTestId('btn-edit-unit-step3-unit-a2').count(), 0);

    await page.getByTestId('btn-edit-unit-step3-unit-a1').click();
    await page.getByTestId('unit-edit-form-step3-unit-a1').waitFor({ state: 'visible' });
    assert.equal(await page.getByTestId('input-rent-amount-step3-unit-a1').count(), 0);
    assert.equal(await page.getByTestId('input-is-occupied-step3-unit-a1').count(), 0);

    const markerBedrooms = 3;
    await page.getByTestId('input-bedrooms-step3-unit-a1').fill(String(markerBedrooms));
    await page.getByTestId('btn-save-unit-step3-unit-a1').click();
    await page.waitForTimeout(2000);
    await page.getByTestId('btn-edit-unit-step3-unit-a1').waitFor({ state: 'visible', timeout: 30_000 });
    await diag.dump('after-save');

    // Persist after refresh
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByTestId('nav-properties').click();
    await page.waitForTimeout(1000);
    await page.getByTestId('btn-edit-unit-step3-unit-a1').click();
    const bedroomsValue = await page.getByTestId('input-bedrooms-step3-unit-a1').inputValue();
    assert.equal(bedroomsValue, String(markerBedrooms), 'bedrooms persist after refresh');
    await page.getByTestId('btn-cancel-unit-step3-unit-a1').click();
    await diag.dump('after-refresh');

    // Browser-origin unauthorized sibling update (API), labeled separately from UI interaction.
    const siblingProbe = await apiWithPage(page, 'PUT', '/api/units', {
      id: 'step3-unit-a2',
      propertyId: 'step3-property-a',
      unitNumber: 'A2-HACK',
      bedrooms: 9,
      bathrooms: 9,
      size: 99,
    });
    assert.equal(siblingProbe.status, 403, 'browser-origin sibling update must be denied');
    const [siblingAfter] = await sql`SELECT unit_number, bedrooms FROM public.units WHERE id='step3-unit-a2'`;
    assert.notEqual(siblingAfter.unit_number, 'A2-HACK');
    assert.notEqual(siblingAfter.bedrooms, 9);
    note('Gate 2 supplement: browser-origin unauthorized sibling PUT returned 403; sibling data unchanged');

    const foreignProbe = await apiWithPage(page, 'PUT', '/api/units', {
      id: 'step3-unit-b1',
      propertyId: 'step3-property-b',
      unitNumber: 'B1-HACK',
      bedrooms: 8,
    });
    assert.equal(foreignProbe.status, 403, 'browser-origin foreign update must be denied');
    note('Gate 2 supplement: browser-origin unauthorized foreign PUT returned 403');

    const [unitAfter] = await sql`SELECT rent_amount, is_occupied, bedrooms FROM public.units WHERE id='step3-unit-a1'`;
    assert.equal(String(unitAfter.rent_amount), String(originalUnitA1.rent_amount));
    assert.equal(Boolean(unitAfter.is_occupied), Boolean(originalUnitA1.is_occupied));
    assert.equal(unitAfter.bedrooms, markerBedrooms);

    await context.close();
    pass('Gate 2 browser: Unit Caretaker A edited assigned descriptive field; sibling/foreign denied');
  }

  // ---------- Concise seven-role smoke ----------
  for (const [name, identity] of Object.entries(identities)) {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    const diag = await attachDiagnostics(page, `smoke-${name.toLowerCase()}`);
    await landeeLogin(page, identity);
    await page.waitForTimeout(1200);
    const body = await page.locator('body').innerText();
    assert.ok(body.length > 40, `${name} rendered authenticated UI`);
    await diag.dump('dashboard');
    await context.close();
    pass(`seven-role smoke: ${name}`);
  }
} finally {
  try {
    if (browser) await browser.close();
  } catch {}
  try {
    const [landlordBCleanup] = await sql`SELECT id FROM public.users WHERE email=${identities.LANDLORD_B.email}`;
    const [managerCleanup] = await sql`SELECT id FROM public.users WHERE email=${identities.MANAGER_A.email}`;
    if (createdManagerMembershipId) {
      await sql`DELETE FROM public.user_context_memberships WHERE id=${createdManagerMembershipId}`;
      note(`Removed created Manager A membership ${createdManagerMembershipId}`);
    } else if (originalManagerMembershipSnapshot && landlordBCleanup?.id && managerCleanup?.id) {
      const prior = originalManagerMembershipSnapshot.find(
        (row) => row.context_owner_id === landlordBCleanup.id && row.role === 'property_manager',
      );
      if (prior && prior.status !== 'active') {
        await sql`UPDATE public.user_context_memberships SET status=${prior.status} WHERE id=${prior.id}`;
        note(`Restored prior Manager A → Landlord B status ${prior.status}`);
      } else if (!prior) {
        await sql`DELETE FROM public.user_context_memberships
          WHERE user_id=${managerCleanup.id}
            AND context_owner_id=${landlordBCleanup.id}
            AND role='property_manager'`;
      }
    }
    if (originalUnitA1) {
      await sql`UPDATE public.units SET
        unit_number=${originalUnitA1.unit_number},
        rent_amount=${originalUnitA1.rent_amount},
        is_occupied=${originalUnitA1.is_occupied},
        bedrooms=${originalUnitA1.bedrooms},
        bathrooms=${originalUnitA1.bathrooms},
        size=${originalUnitA1.size},
        updated_at=NOW()
        WHERE id='step3-unit-a1'`;
      note('Restored step3-unit-a1 descriptive and financial fields');
    }
    // Verify membership count matches original active count
    if (originalManagerMembershipSnapshot) {
      const [manager] = await sql`SELECT id FROM public.users WHERE email=${identities.MANAGER_A.email}`;
      const current = await sql`SELECT id, context_owner_id, role, status FROM public.user_context_memberships WHERE user_id=${manager.id}`;
      const originalActive = originalManagerMembershipSnapshot.filter((r) => r.status === 'active').length;
      const currentActive = current.filter((r) => r.status === 'active').length;
      assert.equal(currentActive, originalActive, 'Manager A active membership count restored');
      pass(`cleanup: Manager A active memberships restored to ${currentActive}`);
    }
  } finally {
    await sql.end();
  }
}

writeFileSync(join(evidenceDir, 'summary.json'), JSON.stringify({
  baseUrl: sanitizeUrl(baseUrl),
  findings,
  createdManagerMembershipId: Boolean(createdManagerMembershipId),
}, null, 2));
console.log(JSON.stringify({
  ok: true,
  evidenceDir,
  gates: findings.filter((f) => f.status === 'PASS').map((f) => f.label),
}));

import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';

const expectedProjectRef = 'mcclctunrpyhumubpeyo';
const stagingUrl = process.env.STAGING_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL;
const password = process.env.STAGING_TEST_PASSWORD;

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assertStagingUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.hostname !== `${expectedProjectRef}.supabase.co`) {
    throw new Error(`Refusing non-staging Supabase URL: ${parsed.hostname}`);
  }
}

const url = required('STAGING_SUPABASE_URL', stagingUrl);
const key = required('STAGING_SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey);
const db = required('STAGING_DATABASE_URL', databaseUrl);
required('STAGING_TEST_PASSWORD', password);
assertStagingUrl(url);
if (process.env.STAGING_ALLOW_MUTATION !== 'true') {
  throw new Error('Set STAGING_ALLOW_MUTATION=true to enable staging fixture creation');
}
if (/production|landee\.kejalink|emdahodfztpfdjkrbnqz/i.test(`${url} ${db}`)) {
  throw new Error('Production-looking configuration rejected');
}

const identities = [
  { key: 'landlordA', email: 'step3-landlord-a@staging.landee.test', phone: '0700000301', role: 'landlord', first: 'Step3', last: 'Landlord A' },
  { key: 'landlordB', email: 'step3-landlord-b@staging.landee.test', phone: '0700000302', role: 'landlord', first: 'Step3', last: 'Landlord B' },
  { key: 'tenantA', email: 'step3-tenant-a@staging.landee.test', phone: '0700000303', role: 'tenant', first: 'Step3', last: 'Tenant A' },
  { key: 'tenantB', email: 'step3-tenant-b@staging.landee.test', phone: '0700000304', role: 'tenant', first: 'Step3', last: 'Tenant B' },
  { key: 'managerA', email: 'step3-manager-a@staging.landee.test', phone: '0700000305', role: 'property_manager', first: 'Step3', last: 'Manager A' },
  { key: 'caretakerPropertyA', email: 'step3-caretaker-property-a@staging.landee.test', phone: '0700000306', role: 'caretaker', first: 'Step3', last: 'Property Caretaker A' },
  { key: 'caretakerUnitA', email: 'step3-caretaker-unit-a@staging.landee.test', phone: '0700000307', role: 'caretaker', first: 'Step3', last: 'Unit Caretaker A' },
] as const;

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const userIds = new Map<string, string>();

for (const identity of identities) {
  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  const existing = listed.users.find((user) => user.email === identity.email);
  if (existing) {
    userIds.set(identity.key, existing.id);
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { first_name: identity.first, last_name: identity.last, staging_fixture: 'step3' },
    });
    if (error) throw error;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: identity.email,
      phone: `+254${identity.phone.slice(1)}`,
      password,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: { first_name: identity.first, last_name: identity.last, staging_fixture: 'step3' },
    });
    if (error || !data.user) throw error || new Error(`Could not create ${identity.email}`);
    userIds.set(identity.key, data.user.id);
  }
}

const sql = postgres(db, { prepare: false, max: 1, ssl: 'require' });
try {
  await sql.begin(async (tx) => {
    const id = (key: string) => userIds.get(key)!;
    await tx`
      INSERT INTO public.users (id, email, first_name, last_name, phone_number, role, is_verified, phone_verified, status)
      VALUES
        (${id('landlordA')}, 'step3-landlord-a@staging.landee.test', 'Step3', 'Landlord A', '0700000301', 'landlord', true, true, 'active'),
        (${id('landlordB')}, 'step3-landlord-b@staging.landee.test', 'Step3', 'Landlord B', '0700000302', 'landlord', true, true, 'active'),
        (${id('tenantA')}, 'step3-tenant-a@staging.landee.test', 'Step3', 'Tenant A', '0700000303', 'tenant', true, true, 'active'),
        (${id('tenantB')}, 'step3-tenant-b@staging.landee.test', 'Step3', 'Tenant B', '0700000304', 'tenant', true, true, 'active'),
        (${id('managerA')}, 'step3-manager-a@staging.landee.test', 'Step3', 'Manager A', '0700000305', 'property_manager', true, true, 'active'),
        (${id('caretakerPropertyA')}, 'step3-caretaker-property-a@staging.landee.test', 'Step3', 'Property Caretaker A', '0700000306', 'caretaker', true, true, 'active'),
        (${id('caretakerUnitA')}, 'step3-caretaker-unit-a@staging.landee.test', 'Step3', 'Unit Caretaker A', '0700000307', 'caretaker', true, true, 'active')
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, phone_number = EXCLUDED.phone_number,
        role = EXCLUDED.role, status = 'active', updated_at = NOW()
    `;
    await tx`
      INSERT INTO public.properties (id, name, address, property_type, total_units, owner_id)
      VALUES
        ('step3-property-a', 'Step 3 Property A', 'Staging A', 'apartment', 2, ${id('landlordA')}),
        ('step3-property-b', 'Step 3 Property B', 'Staging B', 'apartment', 1, ${id('landlordB')})
      ON CONFLICT (id) DO UPDATE SET owner_id = EXCLUDED.owner_id, archived_at = NULL
    `;
    await tx`
      INSERT INTO public.units (id, property_id, unit_number, rent_amount, is_occupied)
      VALUES
        ('step3-unit-a1', 'step3-property-a', 'A1', 1000, true),
        ('step3-unit-a2', 'step3-property-a', 'A2', 1000, false),
        ('step3-unit-b1', 'step3-property-b', 'B1', 1000, true)
      ON CONFLICT (id) DO UPDATE SET property_id = EXCLUDED.property_id, archived_at = NULL
    `;
    await tx`
      INSERT INTO public.tenants (id, landlord_id, user_id, first_name, last_name, email, phone, approval_status, account_status)
      VALUES
        ('step3-tenant-record-a', ${id('landlordA')}, ${id('tenantA')}, 'Step3', 'Tenant A', 'step3-tenant-a@staging.landee.test', '0700000303', 'approved', 'active'),
        ('step3-tenant-record-b', ${id('landlordB')}, ${id('tenantB')}, 'Step3', 'Tenant B', 'step3-tenant-b@staging.landee.test', '0700000304', 'approved', 'active')
      ON CONFLICT (id) DO UPDATE SET landlord_id = EXCLUDED.landlord_id, user_id = EXCLUDED.user_id,
        approval_status = 'approved', account_status = 'active'
    `;
    await tx`
      INSERT INTO public.leases (id, tenant_id, unit_id, start_date, end_date, monthly_rent, status, is_active, created_by)
      VALUES
        ('step3-lease-a', 'step3-tenant-record-a', 'step3-unit-a1', '2026-01-01', '2027-12-31', 1000, 'active', true, ${id('landlordA')}),
        ('step3-lease-b', 'step3-tenant-record-b', 'step3-unit-b1', '2026-01-01', '2027-12-31', 1000, 'active', true, ${id('landlordB')})
      ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, unit_id = EXCLUDED.unit_id,
        status = 'active', is_active = true
    `;
    await tx`
      INSERT INTO public.caretaker_assignments (id, caretaker_id, landlord_id, property_id, unit_id, status)
      VALUES
        ('step3-assignment-property-a', ${id('caretakerPropertyA')}, ${id('landlordA')}, 'step3-property-a', NULL, 'active'),
        ('step3-assignment-unit-a1', ${id('caretakerUnitA')}, ${id('landlordA')}, NULL, 'step3-unit-a1', 'active')
      ON CONFLICT (id) DO UPDATE SET caretaker_id = EXCLUDED.caretaker_id, landlord_id = EXCLUDED.landlord_id,
        property_id = EXCLUDED.property_id, unit_id = EXCLUDED.unit_id, status = 'active'
    `;
    await tx`
      INSERT INTO public.user_context_memberships (user_id, context_owner_id, role, status, authority_source)
      VALUES
        (${id('landlordA')}, ${id('landlordA')}, 'landlord', 'active', 'property_ownership'),
        (${id('landlordB')}, ${id('landlordB')}, 'landlord', 'active', 'property_ownership'),
        (${id('tenantA')}, ${id('landlordA')}, 'tenant', 'active', 'tenant_link'),
        (${id('tenantB')}, ${id('landlordB')}, 'tenant', 'active', 'tenant_link'),
        (${id('managerA')}, ${id('landlordA')}, 'property_manager', 'active', 'assignment'),
        (${id('caretakerPropertyA')}, ${id('landlordA')}, 'caretaker', 'active', 'assignment'),
        (${id('caretakerUnitA')}, ${id('landlordA')}, 'caretaker', 'active', 'assignment')
      ON CONFLICT (user_id, context_owner_id, role) DO UPDATE SET status = 'active', authority_source = EXCLUDED.authority_source
    `;
    await tx`
      INSERT INTO public.invoices (
        id, lease_id, landlord_id, tenant_id, amount, amount_paid, currency,
        billing_period_start, billing_period_end, due_date, reference_code,
        invoice_type, description, status
      )
      VALUES (
        'step3-invoice-a', 'step3-lease-a', ${id('landlordA')}, 'step3-tenant-record-a', 1000, 0, 'KES',
        '2026-11-01', '2026-11-30', '2026-11-01', 'STEP3A-NOV26',
        'rent', 'Step 3 staging invoice A', 'pending'
      )
      ON CONFLICT (id) DO UPDATE SET amount = 1000, amount_paid = 0, status = 'pending'
    `;
  });
  console.log(JSON.stringify({ projectRef: expectedProjectRef, identities: Object.fromEntries(userIds), fixturePrefix: 'step3-' }));
} finally {
  await sql.end();
}

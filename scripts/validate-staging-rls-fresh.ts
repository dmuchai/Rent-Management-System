import { createClient } from '@supabase/supabase-js';

const expectedProjectRef = 'mcclctunrpyhumubpeyo';
const supabaseUrl = process.env.STAGING_SUPABASE_URL ?? '';
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY ?? '';

const identities = {
  LANDLORD_A: { email: 'step3-landlord-a@staging.landee.test', token: 'STAGING_RLS_TOKEN_LANDLORD_A', password: 'STAGING_RLS_PASSWORD_LANDLORD_A', userId: 'STAGING_RLS_USER_ID_LANDLORD_A' },
  LANDLORD_B: { email: 'step3-landlord-b@staging.landee.test', token: 'STAGING_RLS_TOKEN_LANDLORD_B', password: 'STAGING_RLS_PASSWORD_LANDLORD_B', userId: 'STAGING_RLS_USER_ID_LANDLORD_B' },
  MANAGER_A: { email: 'step3-manager-a@staging.landee.test', token: 'STAGING_RLS_TOKEN_MANAGER_A', password: 'STAGING_RLS_PASSWORD_MANAGER_A', userId: 'STAGING_RLS_USER_ID_MANAGER_A' },
  PROPERTY_CARETAKER_A: { email: 'step3-caretaker-property-a@staging.landee.test', token: 'STAGING_RLS_TOKEN_PROPERTY_CARETAKER_A', password: 'STAGING_RLS_PASSWORD_PROPERTY_CARETAKER_A', userId: 'STAGING_RLS_USER_ID_PROPERTY_CARETAKER_A' },
  UNIT_CARETAKER_A: { email: 'step3-caretaker-unit-a@staging.landee.test', token: 'STAGING_RLS_TOKEN_UNIT_CARETAKER_A', password: 'STAGING_RLS_PASSWORD_UNIT_CARETAKER_A', userId: 'STAGING_RLS_USER_ID_UNIT_CARETAKER_A' },
  TENANT_A: { email: 'step3-tenant-a@staging.landee.test', token: 'STAGING_RLS_TOKEN_TENANT_A', password: 'STAGING_RLS_PASSWORD_TENANT_A', userId: 'STAGING_RLS_USER_ID_TENANT_A' },
  TENANT_B: { email: 'step3-tenant-b@staging.landee.test', token: 'STAGING_RLS_TOKEN_TENANT_B', password: 'STAGING_RLS_PASSWORD_TENANT_B', userId: 'STAGING_RLS_USER_ID_TENANT_B' },
} as const;

function required(name: string, value: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const url = required('STAGING_SUPABASE_URL', supabaseUrl);
const parsedUrl = new URL(url);
if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== `${expectedProjectRef}.supabase.co`) {
  throw new Error('STAGING_SUPABASE_URL must reference the isolated staging Supabase project');
}
const key = required('STAGING_SUPABASE_ANON_KEY', anonKey);
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

for (const [name, identity] of Object.entries(identities)) {
  const individualPassword = process.env[identity.password];
  const password = individualPassword || process.env.STAGING_TEST_PASSWORD;
  const manualToken = process.env[identity.token];

  if (individualPassword && manualToken) {
    throw new Error(`${name} must use either ${identity.password} or ${identity.token}, not both`);
  }
  if (!password && !manualToken) {
    throw new Error(`${name} requires ${identity.password} (or STAGING_TEST_PASSWORD) or ${identity.token}`);
  }

  let accessToken = manualToken;
  let signInStatus = manualToken ? 'SKIPPED_MANUAL_TOKEN' : 'PENDING';
  if (!manualToken && password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: identity.email,
      password,
    });
    if (error || !data.session || !data.user) {
      console.log(`AUTH ${name}: signIn=FAIL getUser=NOT_RUN identity=NOT_VERIFIED`);
      throw new Error(`${name} password sign-in failed; check the staging fixture credentials`);
    }
    accessToken = data.session.access_token;
    signInStatus = 'OK';
  }

  if (!accessToken) throw new Error(`${name} did not produce an access token`);
  const { data: authenticatedUser, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !authenticatedUser.user) {
    console.log(`AUTH ${name}: signIn=${signInStatus} getUser=FAIL identity=NOT_VERIFIED`);
    throw new Error(`${name} token verification failed through Supabase Auth`);
  }
  const expectedEmail = identity.email.trim().toLowerCase();
  const actualEmail = (authenticatedUser.user.email ?? '').trim().toLowerCase();
  const identityMatches = actualEmail === expectedEmail;
  const expectedUserId = process.env[identity.userId]?.trim();
  const userIdMatches = !expectedUserId || authenticatedUser.user.id === expectedUserId;
  console.log(`AUTH ${name}: signIn=${signInStatus} getUser=OK identity=${identityMatches && userIdMatches ? 'MATCH' : 'MISMATCH'}`);
  if (!identityMatches) {
    throw new Error(`${name} authentication email did not match the configured synthetic identity`);
  }
  if (!userIdMatches) {
    throw new Error(`${name} authentication UUID did not match the configured staging identity`);
  }
  process.env[identity.token] = accessToken;
  console.log(`AUTH ${name}: acquired and identity-checked`);
}

await import('./validate-staging-rls.ts');

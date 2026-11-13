import type { SupabaseClient, User } from '@supabase/supabase-js';

type InvitationRequest = {
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
};

export async function findAuthUserByEmail(
  adminClient: SupabaseClient,
  email: string,
): Promise<User | null> {
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const match = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match || users.length < perPage) return match || null;
  }
}

function getRequestAccessToken(req: InvitationRequest): string | null {
  const authorization = req.headers?.authorization;
  const header = Array.isArray(authorization) ? authorization[0] : authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  return req.cookies?.['supabase-auth-token'] || null;
}

export async function requestProvesExistingAccount(
  adminClient: SupabaseClient,
  req: InvitationRequest,
  expectedUser: Pick<User, 'id' | 'email'>,
): Promise<boolean> {
  const token = getRequestAccessToken(req);
  if (!token) return false;
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user) return false;
  return data.user.id === expectedUser.id
    && data.user.email?.toLowerCase() === expectedUser.email?.toLowerCase();
}

export const existingAccountAuthRequired = {
  error: 'Existing account authentication required',
  code: 'EXISTING_ACCOUNT_AUTH_REQUIRED',
  message: 'Sign in to the invited account before accepting this invitation. Your existing password will not be changed.',
  shouldLogin: true,
} as const;

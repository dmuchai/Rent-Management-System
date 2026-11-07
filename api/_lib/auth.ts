// Shared authentication utilities for Vercel serverless functions
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type User } from '@supabase/supabase-js';
import { getEffectiveSubscriptionAccess, isSubscriptionsEnabled } from './subscription.js';
import { requiresManagementSubscription, READ_ONLY_SUBSCRIPTION_ERROR } from '../../shared/subscription/write-policy.js';
import { selectTrustedAuthority } from './authority.js';
export { selectTrustedAuthority } from './authority.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export type TrustedAuth = { userId: string; user: User; role: string; contextOwnerId: string };

export async function verifyAuth(req: VercelRequest): Promise<TrustedAuth | null> {
  // Get token from httpOnly cookie set by auth-callback
  let authToken = req.cookies['supabase-auth-token'];

  // Fallback: allow Authorization: Bearer <token> header for serverless
  // functions called from the browser when the client holds the session
  if (!authToken) {
    const authHeader = req.headers.authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      authToken = authHeader.replace('Bearer ', '');
    }
  }

  // Debug logging
  const isDebugMode = process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production';

  if (!authToken) {
    if (isDebugMode) console.error('❌ Auth verification failed: No auth token found');
    return null;
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(authToken);

    if (error || !user) {
      if (isDebugMode) console.error('❌ Auth verification failed: Invalid or expired token');
      return null;
    }

    // Identity metadata is profile data only. It must never assign authority.
    const ALLOWED_ROLES = ['landlord', 'tenant', 'property_manager', 'caretaker'] as const;
    type AllowedRole = typeof ALLOWED_ROLES[number];

    let role: AllowedRole | null = null;
    let contextOwnerId: string | null = null;

    try {
      const { data: userData, error: upsertError } = await supabaseAdmin
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          first_name: user.user_metadata?.first_name || user.user_metadata?.firstName || user.user_metadata?.full_name?.split(' ')[0] || '',
          last_name: user.user_metadata?.last_name || user.user_metadata?.lastName || user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
          profile_image_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        }, {
          onConflict: 'id'
        })
        .select('role, created_by, status')
        .single();

      if (upsertError) {
        console.error('❌ Failed to sync user in database:', upsertError.message);
      } else if (userData) {
        if (userData.status === 'inactive' || userData.status === 'suspended') {
          return null;
        }
        const requestedRole = req.headers['x-landee-context-role']?.toString();
        const requestedOwner = req.headers['x-landee-context-owner']?.toString();
        const { data: memberships, error: membershipsError } = await supabaseAdmin
          .from('user_context_memberships')
          .select('role, context_owner_id, status')
          .eq('user_id', user.id)
          .order('role', { ascending: true })
          .order('context_owner_id', { ascending: true });
        if (!membershipsError && memberships?.length) {
          const authority = selectTrustedAuthority(
            memberships.filter((membership) => membership.status === 'active'),
            requestedRole,
            requestedOwner,
          );
          if (authority && ALLOWED_ROLES.includes(authority.role as AllowedRole)) {
            role = authority.role as AllowedRole;
            contextOwnerId = authority.context_owner_id;
          }
        } else if (!membershipsError && !memberships?.length
          && ALLOWED_ROLES.includes(userData.role as AllowedRole)) {
          // Compatibility during the additive migration rollout. This is a
          // persisted server-side role, never user-editable auth metadata.
          role = userData.role as AllowedRole;
          if (role === 'tenant') {
            const { data: tenantContext } = await supabaseAdmin.from('tenants')
              .select('landlord_id').eq('user_id', user.id).not('landlord_id', 'is', null)
              .limit(1).maybeSingle();
            contextOwnerId = tenantContext?.landlord_id || null;
          } else {
            contextOwnerId = (role === 'caretaker' || role === 'property_manager')
              ? userData.created_by : user.id;
          }
        }
      }
    } catch (error) {
      console.error('❌ Exception while syncing user role:', error);
    }

    if (!role || !contextOwnerId) {
      console.error('❌ No trusted active authority could be established for user', user.id);
      return null;
    }
    if (isDebugMode) {
      console.log('✅ Auth verification successful. User:', user.id, 'Role:', role);
    }

    return { userId: user.id, user, role, contextOwnerId };
  } catch (error) {
    if (isDebugMode) console.error('❌ Auth verification exception:', error);
    return null;
  }
}

export function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || '';
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Landee-Context-Role, X-Landee-Context-Owner');
  }
}

export function requireAuth(
  handler: (
    req: VercelRequest,
    res: VercelResponse,
    auth: TrustedAuth
  ) => Promise<void | VercelResponse>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const auth = await verifyAuth(req);

    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (isSubscriptionsEnabled() && requiresManagementSubscription(req.method, req.url, auth.role)) {
      try {
        const ownerId = auth.contextOwnerId;
        if (!ownerId || (await getEffectiveSubscriptionAccess(ownerId)).readOnly) {
          return res.status(403).json(READ_ONLY_SUBSCRIPTION_ERROR);
        }
      } catch (error) {
        console.error('Subscription access lookup failed', error);
        return res.status(503).json({ error: 'Could not verify subscription access. Please try again.' });
      }
    }
    return handler(req, res, auth);
  };
}

export function handleError(res: VercelResponse, error: any, message: string = 'Internal server error') {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(message, errorMessage);

  if (process.env.NODE_ENV !== 'production' && error instanceof Error && error.stack) {
    console.error('Stack trace:', error.stack);
  }

  const response: { error: string; details?: string } = { error: message };

  if (process.env.NODE_ENV === 'development') {
    response.details = errorMessage;
  }

  return res.status(500).json(response);
}

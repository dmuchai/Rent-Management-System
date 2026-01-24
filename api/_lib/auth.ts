// Shared authentication utilities for Vercel serverless functions
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type User } from '@supabase/supabase-js';

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

export async function verifyAuth(req: VercelRequest): Promise<{ userId: string; user: User; role: string } | null> {
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

    // Securely sync user data to public.users table using UPSERT to avoid race conditions
    const ALLOWED_ROLES = ['landlord', 'tenant', 'property_manager'] as const;
    type AllowedRole = typeof ALLOWED_ROLES[number];

    // Determine the role: metadata > default
    const metadataRole = user.user_metadata?.role;
    const defaultRole: AllowedRole = (metadataRole && ALLOWED_ROLES.includes(metadataRole as AllowedRole))
      ? metadataRole as AllowedRole
      : 'landlord';

    let role: AllowedRole = defaultRole;

    try {
      const { data: userData, error: upsertError } = await supabaseAdmin
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          first_name: user.user_metadata?.first_name || user.user_metadata?.firstName || user.user_metadata?.full_name?.split(' ')[0] || '',
          last_name: user.user_metadata?.last_name || user.user_metadata?.lastName || user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
          profile_image_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
          role: defaultRole,
        }, {
          onConflict: 'id'
        })
        .select('role')
        .single();

      if (upsertError) {
        console.error('❌ Failed to sync user in database:', upsertError.message);
        // If upsert fails (e.g. unique constraint on email but different ID), 
        // we fallback to metadata to let the user in, but logs will help us debug.
      } else if (userData) {
        role = userData.role as AllowedRole;
      }
    } catch (error) {
      console.error('❌ Exception while syncing user role:', error);
    }

    if (isDebugMode) {
      console.log('✅ Auth verification successful. User:', user.id, 'Role:', role);
    }

    return { userId: user.id, user, role };
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
}

export function requireAuth(
  handler: (
    req: VercelRequest,
    res: VercelResponse,
    auth: { userId: string; user: User; role: string }
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

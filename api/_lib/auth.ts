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
  const authToken = req.cookies['supabase-auth-token'];
  
  // Debug logging (only in non-production or when DEBUG flag is set)
  const isDebugMode = process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production';
  
  if (isDebugMode) {
    console.log('=== Auth Verification Debug ===');
    console.log('Request path:', req.url?.split('?')[0]); // Only log path, not query params
    console.log('Cookie header present:', !!req.headers.cookie);
    console.log('Parsed cookie keys:', Object.keys(req.cookies || {}));
    console.log('Has supabase-auth-token:', !!authToken);
    console.log('Token length:', authToken ? authToken.length : 0);
    console.log('===============================');
  }
  
  if (!authToken) {
    console.error('❌ Auth verification failed: No auth token cookie found');
    if (isDebugMode) {
      console.error('Available cookie keys:', Object.keys(req.cookies || {}));
    }
    return null;
  }
  
  try {
    if (isDebugMode) {
      console.log('Verifying token with Supabase...');
    }
    
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(authToken);
    
    if (error || !user) {
      console.error('❌ Auth verification failed: Invalid or expired token');
      if (isDebugMode) {
        console.error('Supabase error:', error?.message);
      }
      return null;
    }

    if (isDebugMode) {
      console.log('✅ Auth verification successful for user:', user.id);
      console.log('User email:', user.email);
    }
    
    // Securely load role from server-only database table (not user-controlled metadata)
    const ALLOWED_ROLES = ['landlord', 'tenant', 'property_manager'] as const;
    type AllowedRole = typeof ALLOWED_ROLES[number];
    
    let role: AllowedRole | null = null;
    
    try {
      const { data: userData, error: roleError } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
      
      // If user doesn't exist in database yet (first login), create them with a default role
      if (roleError?.code === 'PGRST116') {
        console.log('📝 User not found in database, creating new user record for:', user.id);
        
        // Try to get role from user metadata (for OAuth users who selected a role)
        const metadataRole = user.user_metadata?.role;
        const defaultRole: AllowedRole = (metadataRole && ALLOWED_ROLES.includes(metadataRole as AllowedRole)) 
          ? metadataRole as AllowedRole 
          : 'landlord';
        
        const { data: newUser, error: insertError } = await supabaseAdmin
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            first_name: user.user_metadata?.first_name || user.user_metadata?.full_name?.split(' ')[0] || '',
            last_name: user.user_metadata?.last_name || user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
            profile_image_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
            role: defaultRole,
          })
          .select('role')
          .single();
        
        if (insertError) {
          console.error('❌ Failed to create user in database:', insertError.message);
          return null;
        }
        
        role = newUser.role as AllowedRole;
        console.log('✅ Created new user with role:', role);
      } else if (roleError) {
        console.error('❌ Failed to fetch user role from database:', roleError.message);
        return null;
      } else {
        // Validate role against whitelist
        if (userData?.role && ALLOWED_ROLES.includes(userData.role as AllowedRole)) {
          role = userData.role as AllowedRole;
        } else {
          console.error('❌ Invalid or missing role for user:', user.id, 'Role:', userData?.role);
          return null;
        }
      }
    } catch (error) {
      console.error('❌ Exception while fetching user role:', error);
      return null;
    }
    
    if (isDebugMode) {
      console.log('✅ User role verified:', role);
    }
    
    return { userId: user.id, user, role };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Auth verification exception:', errorMessage);
    if (isDebugMode && error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
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
    // Set CORS headers for all requests
    setCorsHeaders(req, res);

    // Handle preflight requests
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
  // Log full error details for debugging
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(message, errorMessage);
  
  // Log stack trace in non-production environments
  if (process.env.NODE_ENV !== 'production' && error instanceof Error && error.stack) {
    console.error('Stack trace:', error.stack);
  }
  
  // Build response object
  const response: { error: string; details?: string } = { error: message };
  
  // Only include error details in development mode
  if (process.env.NODE_ENV === 'development') {
    response.details = errorMessage;
  }
  
  return res.status(500).json(response);
}

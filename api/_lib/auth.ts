// Shared authentication utilities for Vercel serverless functions
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type User } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function verifyAuth(req: VercelRequest): Promise<{ userId: string; user: User } | null> {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      console.error('Auth verification failed: Invalid or expired token');
      return null;
    }

    return { userId: user.id, user };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Auth verification error:', errorMessage);
    if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    return null;
  }
}

export function requireAuth(handler: (req: VercelRequest, res: VercelResponse, auth: { userId: string; user: User }) => Promise<void>) {
  return async (req: VercelRequest, res: VercelResponse) => {
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

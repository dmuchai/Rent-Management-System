// Shared authentication utilities for Vercel serverless functions
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function verifyAuth(req: VercelRequest): Promise<{ userId: string; user: any } | null> {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      console.error('Auth verification failed:', error);
      return null;
    }

    return { userId: user.id, user };
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

export function requireAuth(handler: (req: VercelRequest, res: VercelResponse, auth: { userId: string; user: any }) => Promise<void>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const auth = await verifyAuth(req);
    
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return handler(req, res, auth);
  };
}

export function handleError(res: VercelResponse, error: any, message: string = 'Internal server error') {
  console.error(message, error);
  return res.status(500).json({ 
    error: message,
    details: error instanceof Error ? error.message : String(error)
  });
}

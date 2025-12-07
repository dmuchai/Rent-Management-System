// GET /api/auth/user endpoint
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get token from cookie
    let token: string | undefined;
    
    if (req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      
      token = cookies['supabase-auth-token'];
    }

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token found' });
    }

    // Verify token
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      console.error('Token verification failed:', error);
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }

    // Return user data
    return res.status(200).json({
      id: user.id,
      email: user.email,
      firstName: user.user_metadata?.first_name || user.user_metadata?.name?.split(' ')[0] || 'User',
      lastName: user.user_metadata?.last_name || user.user_metadata?.name?.split(' ').slice(1).join(' ') || null,
      role: user.user_metadata?.role || 'landlord',
      createdAt: user.created_at
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in /api/auth/user:', errorMessage);
    return res.status(500).json({ error: 'Internal server error', details: errorMessage });
  }
}

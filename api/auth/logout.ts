// POST /api/auth/logout endpoint
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
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
      // Already logged out
      return res.status(200).json({ 
        success: true,
        message: 'Already logged out'
      });
    }

    // Verify and sign out
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: verifyError } = await supabaseAdmin.auth.getUser(token);
    
    if (verifyError || !user) {
      console.warn('Logout attempted with invalid token');
      // Clear cookies anyway
      res.setHeader('Set-Cookie', [
        'supabase-auth-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
        'supabase-refresh-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax'
      ]);
      return res.status(200).json({ 
        success: true,
        message: 'Logged out'
      });
    }

    // Sign out from Supabase
    await supabaseAdmin.auth.admin.signOut(token);
    
    // Clear cookies
    res.setHeader('Set-Cookie', [
      'supabase-auth-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
      'supabase-refresh-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax'
    ]);

    return res.status(200).json({ 
      success: true,
      message: 'Successfully logged out'
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Logout error:', errorMessage);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again.'
    });
  }
}

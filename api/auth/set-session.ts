import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { access_token, refresh_token } = req.body;

  if (!access_token) {
    console.error('Set session: No access token provided');
    return res.status(400).json({ error: 'Access token required' });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Set session: Missing Supabase configuration');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Use admin client to verify the token
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(access_token);
    
    if (error) {
      console.error('Set session: Token verification failed:', error.message);
      return res.status(401).json({ error: 'Invalid token', details: error.message });
    }
    
    if (!user) {
      console.error('Set session: No user found for token');
      return res.status(401).json({ error: 'Invalid token - no user' });
    }

    // Set httpOnly cookies for security
    const cookies = [
      `supabase-auth-token=${access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`
    ];
    
    if (refresh_token) {
      cookies.push(`supabase-refresh-token=${refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`);
    }
    
    res.setHeader('Set-Cookie', cookies);

    console.log('Set session: Success for user', user.id);
    return res.status(200).json({ 
      success: true,
      message: 'Session established',
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Set session error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'Failed to set session', details: errorMsg });
  }
}

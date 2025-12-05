// POST /api/auth/set-session - Set authentication cookies from client-provided tokens
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { access_token, refresh_token } = req.body;

  if (!access_token) {
    return res.status(400).json({ error: 'Access token required' });
  }

  try {
    // Verify the token is valid by checking with Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify the token
    const { data: { user }, error } = await supabase.auth.getUser(access_token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Set httpOnly, Secure cookies
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Access token cookie (expires in 1 hour, matching Supabase default)
    res.setHeader('Set-Cookie', [
      `supabase-auth-token=${access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`,
      refresh_token 
        ? `supabase-refresh-token=${refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`
        : ''
    ].filter(Boolean));

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
    return res.status(500).json({ error: 'Failed to set session' });
  }
}

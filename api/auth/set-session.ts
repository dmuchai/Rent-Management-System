import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { access_token, refresh_token } = req.body;

  if (!access_token) {
    return res.status(400).json({ error: 'Missing access_token' });
  }

  try {
    // Verify the token with Supabase
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(access_token);

    if (error || !user) {
      console.error('Token verification failed:', error);
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Set httpOnly cookies for the tokens
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Set access token cookie
    res.setHeader('Set-Cookie', [
      `supabase-auth-token=${access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600${isProduction ? '; Secure' : ''}`,
      refresh_token 
        ? `supabase-refresh-token=${refresh_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${isProduction ? '; Secure' : ''}`
        : ''
    ].filter(Boolean));

    return res.status(200).json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
      }
    });
  } catch (error) {
    console.error('Set session error:', error);
    return res.status(500).json({ error: 'Failed to set session' });
  }
}

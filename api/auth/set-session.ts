import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== Set Session Debug ===');
  console.log('SUPABASE_URL configured:', !!supabaseUrl);
  console.log('SUPABASE_SERVICE_ROLE_KEY configured:', !!supabaseServiceKey);
  console.log('Request origin:', req.headers.origin);
  console.log('Request referer:', req.headers.referer);
  console.log('========================');

  // Set CORS headers to allow credentials
  const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || '';
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { access_token, refresh_token } = req.body;

  if (!access_token) {
    console.error('❌ Missing access_token in request body');
    return res.status(400).json({ error: 'Missing access_token' });
  }

  console.log('Access token received, length:', access_token.length);
  console.log('Refresh token received:', !!refresh_token);

  try {
    // Verify the token with Supabase
    console.log('Creating Supabase client...');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    console.log('Verifying token with Supabase...');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(access_token);

    if (error || !user) {
      console.error('❌ Token verification failed:', error);
      return res.status(401).json({ error: 'Invalid token', details: error?.message });
    }

    console.log('✅ Token verified successfully for user:', user.id, user.email);

    // Set httpOnly cookies for the tokens
    // Vercel deployments are always HTTPS in production
    const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
    
    // Build cookie strings
    // Since frontend and API are on the same domain in Vercel (same-origin), use SameSite=Lax
    const cookies = [];
    
    // Access token cookie (1 hour)
    // Use SameSite=Lax for same-origin requests (frontend and API on same domain)
    cookies.push(
      `supabase-auth-token=${access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600${isProduction ? '; Secure' : ''}`
    );
    
    // Refresh token cookie (30 days)
    if (refresh_token) {
      cookies.push(
        `supabase-refresh-token=${refresh_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${isProduction ? '; Secure' : ''}`
      );
    }
    
    // Set cookies - must use array for multiple Set-Cookie headers
    res.setHeader('Set-Cookie', cookies);

    console.log('Session cookies set successfully for user:', user.id);
    console.log('Cookies:', cookies.map(c => c.split(';')[0]).join(', '));

    console.log('✅ Session setup complete');
    return res.status(200).json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
      }
    });
  } catch (error) {
    console.error('❌ Set session error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    return res.status(500).json({ 
      error: 'Failed to set session',
      details: errorMessage 
    });
  }
}

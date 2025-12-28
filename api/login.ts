// POST /api/login - Email/Password login
// GET /api/login?provider=google - Redirect to Supabase Google OAuth
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Handle Google OAuth (GET request)
  if (req.method === 'GET') {
    const { provider } = req.query;

    if (provider !== 'google') {
      return res.status(400).json({ error: 'Invalid provider. Use ?provider=google for OAuth' });
    }

    try {
      // Get the origin to build the redirect URL
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const origin = `${protocol}://${host}`;
      
      console.log('Login redirect - origin:', origin);

      // Initiate OAuth flow with Google (using implicit flow for hash-based tokens)
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth-callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          skipBrowserRedirect: false,
          // Use implicit flow to get tokens in URL hash instead of PKCE code
          flowType: 'implicit'
        }
      });

      if (error) {
        console.error('OAuth initiation error:', error);
        return res.status(500).json({ error: 'Failed to initiate OAuth' });
      }

      if (!data.url) {
        console.error('No OAuth URL returned');
        return res.status(500).json({ error: 'No OAuth URL' });
      }

      // Redirect to Google OAuth
      return res.redirect(302, data.url);
    } catch (error) {
      console.error('OAuth error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Handle Email/Password login (POST request)
  if (req.method === 'POST') {
    try {
      const loginData = loginSchema.parse(req.body);

      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (error) {
        console.error('Login error:', error);
        return res.status(401).json({ 
          error: 'Invalid credentials',
          message: error.message 
        });
      }

      if (!data.session) {
        return res.status(401).json({ error: 'No session created' });
      }

      // Set session cookie
      const cookieOptions = [
        `supabase-auth-token=${data.session.access_token}`,
        'HttpOnly',
        'Path=/',
        'Max-Age=604800', // 7 days
        process.env.NODE_ENV === 'production' ? 'Secure' : '',
        'SameSite=Lax'
      ].filter(Boolean).join('; ');

      res.setHeader('Set-Cookie', cookieOptions);

      return res.status(200).json({
        message: 'Login successful',
        user: {
          id: data.user.id,
          email: data.user.email,
          role: data.user.user_metadata?.role || 'landlord',
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid input',
          details: error.errors 
        });
      }
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

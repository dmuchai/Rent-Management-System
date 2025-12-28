// Consolidated auth endpoint
// POST /api/auth?action=login - Email/Password login
// POST /api/auth?action=register - Register new user
// POST /api/auth?action=forgot-password - Send password reset email
// POST /api/auth?action=logout - Logout user
// POST /api/auth?action=set-session - Set session from OAuth tokens
// POST /api/auth?action=sync-user - Sync user to public.users table
// GET  /api/auth?action=user - Get current user
// GET  /api/auth?action=google - Initiate Google OAuth

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['landlord', 'tenant']).default('landlord'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const setSessionSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    // GET /api/auth?action=google - Google OAuth
    if (action === 'google' && req.method === 'GET') {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const origin = `${protocol}://${host}`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth-callback`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
          flowType: 'implicit'
        }
      });

      if (error || !data.url) {
        return res.status(500).json({ error: 'OAuth initiation failed' });
      }

      return res.redirect(302, data.url);
    }

    // POST /api/auth?action=login - Email/Password login
    if (action === 'login' && req.method === 'POST') {
      const { email, password } = loginSchema.parse(req.body);

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error || !data.session) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      res.setHeader('Set-Cookie', [
        `supabase-auth-token=${data.session.access_token}; HttpOnly; Path=/; Max-Age=604800; ${process.env.NODE_ENV === 'production' ? 'Secure;' : ''} SameSite=Lax`
      ]);

      return res.status(200).json({
        message: 'Login successful',
        user: {
          id: data.user.id,
          email: data.user.email,
          role: data.user.user_metadata?.role || 'landlord',
        }
      });
    }

    // POST /api/auth?action=register - Register
    if (action === 'register' && req.method === 'POST') {
      const userData = registerSchema.parse(req.body);
      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data, error } = await adminSupabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
        }
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      await adminSupabase.from('users').insert({
        id: data.user.id,
        email: userData.email,
        first_name: userData.firstName,
        last_name: userData.lastName,
        role: userData.role,
      });

      return res.status(201).json({ message: 'Registration successful' });
    }

    // POST /api/auth?action=forgot-password - Password reset
    if (action === 'forgot-password' && req.method === 'POST') {
      const { email } = forgotPasswordSchema.parse(req.body);
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const origin = `${protocol}://${host}`;

      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`,
      });

      return res.status(200).json({
        message: 'If that email exists in our system, a password reset link has been sent'
      });
    }

    // POST /api/auth?action=logout - Logout
    if (action === 'logout' && req.method === 'POST') {
      res.setHeader('Set-Cookie', 'supabase-auth-token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
      return res.status(200).json({ message: 'Logged out successfully' });
    }

    // POST /api/auth?action=set-session - Set session from OAuth
    if (action === 'set-session' && req.method === 'POST') {
      const { access_token, refresh_token } = setSessionSchema.parse(req.body);

      const { data, error } = await supabase.auth.setSession({
        access_token,
        refresh_token: refresh_token || '',
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      res.setHeader('Set-Cookie', [
        `supabase-auth-token=${access_token}; HttpOnly; Path=/; Max-Age=604800; ${process.env.NODE_ENV === 'production' ? 'Secure;' : ''} SameSite=Lax`
      ]);

      return res.status(200).json({ message: 'Session set successfully' });
    }

    // POST /api/auth?action=sync-user - Sync user to public.users
    if (action === 'sync-user' && req.method === 'POST') {
      const token = req.cookies['supabase-auth-token'];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: existingUser } = await adminSupabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!existingUser) {
        await adminSupabase.from('users').insert({
          id: user.id,
          email: user.email!,
          first_name: user.user_metadata?.firstName || user.user_metadata?.full_name?.split(' ')[0] || '',
          last_name: user.user_metadata?.lastName || user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
          role: user.user_metadata?.role || 'landlord',
        });
      }

      return res.status(200).json({ message: 'User synced successfully' });
    }

    // GET /api/auth?action=user - Get current user
    if (action === 'user' && req.method === 'GET') {
      const token = req.cookies['supabase-auth-token'];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: userData } = await adminSupabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      return res.status(200).json({
        id: user.id,
        email: user.email,
        firstName: userData?.first_name || '',
        lastName: userData?.last_name || '',
        role: userData?.role || 'landlord',
      });
    }

    return res.status(400).json({ error: 'Invalid action or method' });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

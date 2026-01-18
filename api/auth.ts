// Consolidated auth endpoint (CLEANED)
// POST /api/auth?action=login
// POST /api/auth?action=register
// POST /api/auth?action=forgot-password
// POST /api/auth?action=logout
// POST /api/auth?action=sync-user
// POST /api/auth?action=change-password
// GET  /api/auth?action=user
// GET  /api/auth?action=google

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { rateLimit, getClientIp, RATE_LIMITS } from './_lib/rate-limit.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// --------------------
// Validation schemas
// --------------------
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;

  // Supabase client (PKCE only matters for OAuth redirect)
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { flowType: 'pkce' },
  });

  try {
    // --------------------
    // Google OAuth
    // --------------------
    if (action === 'google' && req.method === 'GET') {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const origin = `${protocol}://${host}`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth-callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error || !data.url) {
        console.error('[Auth] OAuth initiation failed:', error);
        return res.status(500).json({ error: 'OAuth initiation failed' });
      }

      return res.redirect(302, data.url);
    }

    // --------------------
    // Login (email/password)
    // --------------------
    if (action === 'login' && req.method === 'POST') {
      const clientIp = getClientIp(req);
      const rate = await rateLimit({
        action: 'login',
        ip: clientIp,
        limit: RATE_LIMITS.login.limit,
        windowMs: RATE_LIMITS.login.window * 1000,
      });

      if (!rate.allowed) {
        return res.status(429).json({
          error: 'Too many login attempts. Please try again later.',
          retryAfter: rate.retryAfter,
        });
      }

      const { email, password } = loginSchema.parse(req.body);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.session) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      res.setHeader(
        'Set-Cookie',
        `supabase-auth-token=${data.session.access_token}; HttpOnly; Path=/; Max-Age=604800; ${
          process.env.NODE_ENV === 'production' ? 'Secure;' : ''
        } SameSite=Lax`
      );

      return res.status(200).json({
        message: 'Login successful',
        user: {
          id: data.user.id,
          email: data.user.email,
          role: data.user.user_metadata?.role || 'landlord',
        },
      });
    }

    // --------------------
    // Register
    // --------------------
    if (action === 'register' && req.method === 'POST') {
      const clientIp = getClientIp(req);
      const rate = await rateLimit({
        action: 'register',
        ip: clientIp,
        limit: RATE_LIMITS.register.limit,
        windowMs: RATE_LIMITS.register.window * 1000,
      });

      if (!rate.allowed) {
        return res.status(429).json({
          error: 'Too many registration attempts. Please try again later.',
          retryAfter: rate.retryAfter,
        });
      }

      const userData = registerSchema.parse(req.body);
      const admin = createClient(supabaseUrl, supabaseServiceKey);

      const { data, error } = await admin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
        },
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      await admin.from('users').insert({
        id: data.user.id,
        email: userData.email,
        first_name: userData.firstName,
        last_name: userData.lastName,
        role: userData.role,
      });

      return res.status(201).json({ message: 'Registration successful' });
    }

    // --------------------
    // Forgot password (Supabase-native recovery)
    // --------------------
    if (action === 'forgot-password' && req.method === 'POST') {
      const clientIp = getClientIp(req);
      const rate = await rateLimit({
        action: 'forgot-password',
        ip: clientIp,
        limit: RATE_LIMITS['forgot-password'].limit,
        windowMs: RATE_LIMITS['forgot-password'].window * 1000,
      });

      if (!rate.allowed) {
        return res.status(429).json({
          error: 'Too many password reset attempts. Please try again later.',
          retryAfter: rate.retryAfter,
        });
      }

      const { email } = forgotPasswordSchema.parse(req.body);

      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const origin = `${protocol}://${host}`;

      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`,
      });

      return res.status(200).json({
        message:
          'If that email exists in our system, a password reset link has been sent.',
      });
    }

    // --------------------
    // Logout
    // --------------------
    if (action === 'logout' && req.method === 'POST') {
      res.setHeader(
        'Set-Cookie',
        'supabase-auth-token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
      );
      return res.status(200).json({ message: 'Logged out successfully' });
    }

    // --------------------
    // Get current user
    // --------------------
    if (action === 'user' && req.method === 'GET') {
      const token = req.cookies['supabase-auth-token'];
      if (!token) return res.status(401).json({ error: 'Unauthorized' });

      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: 'Unauthorized' });

      const admin = createClient(supabaseUrl, supabaseServiceKey);
      const { data: userData } = await admin
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

    // --------------------
    // Sync user to public.users
    // --------------------
    if (action === 'sync-user' && req.method === 'POST') {
      const token = req.cookies['supabase-auth-token'];
      if (!token) return res.status(401).json({ error: 'Unauthorized' });

      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: 'Unauthorized' });

      const admin = createClient(supabaseUrl, supabaseServiceKey);
      const { data: existing } = await admin
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!existing) {
        await admin.from('users').insert({
          id: user.id,
          email: user.email!,
          first_name:
            user.user_metadata?.firstName ||
            user.user_metadata?.full_name?.split(' ')[0] ||
            '',
          last_name:
            user.user_metadata?.lastName ||
            user.user_metadata?.full_name?.split(' ').slice(1).join(' ') ||
            '',
          role: user.user_metadata?.role || 'landlord',
        });
      }

      return res.status(200).json({ message: 'User synced successfully' });
    }

    // --------------------
    // Change password (logged-in user)
    // --------------------
    if (action === 'change-password' && req.method === 'POST') {
      const token = req.cookies['supabase-auth-token'];
      if (!token) return res.status(401).json({ error: 'Unauthorized' });

      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: 'Unauthorized' });

      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Missing password fields' });
      }

      const verify = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      });

      if (verify.error) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        return res.status(500).json({ error: 'Failed to update password' });
      }

      return res.status(200).json({ message: 'Password changed successfully' });
    }

    return res.status(400).json({ error: 'Invalid action or method' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('[Auth] Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

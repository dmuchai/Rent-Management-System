// Consolidated auth endpoint
// POST /api/auth?action=login - Email/Password login
// POST /api/auth?action=register - Register new user
// POST /api/auth?action=verify-email - Verify email with token
// POST /api/auth?action=forgot-password - Send password reset email
// POST /api/auth?action=exchange-code - Exchange PKCE code for session
// POST /api/auth?action=set-session - Set session from OAuth tokens
// POST /api/auth?action=sync-user - Sync user to public.users table
// POST /api/auth?action=set-role - Set user role (for new OAuth users)
// GET  /api/auth?action=user - Get current user
// GET  /api/auth?action=google - Initiate Google OAuth

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { rateLimit, getClientIp, RATE_LIMITS } from './_lib/rate-limit.js';
import { emailService } from './_lib/emailService.js';
import crypto from 'crypto';

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
  role: z.enum(['landlord', 'property_manager']).default('landlord'),
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

  // Create Supabase client with PKCE flow for OAuth
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: 'pkce', // PKCE flow must be set at client level, not per-request
    }
  });

  try {
    // GET /api/auth?action=google - Google OAuth
    if (action === 'google' && req.method === 'GET') {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const origin = `${protocol}://${host}`;

      // PKCE flow (RFC 7636) - configured at client level above
      // Returns authorization code (?code=) instead of access token (#access_token=)
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth-callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          },
          skipBrowserRedirect: false,
        }
      });

      if (error || !data.url) {
        console.error('[Auth] OAuth initiation failed:', error);
        return res.status(500).json({ error: 'OAuth initiation failed' });
      }

      console.log('[Auth] Redirecting to:', data.url);
      return res.redirect(302, data.url);
    }

    // POST /api/auth?action=login - Email/Password login
    if (action === 'login' && req.method === 'POST') {
      // Rate limiting: 5 attempts per minute
      const clientIp = getClientIp(req);
      const rateLimitResult = await rateLimit({
        action: 'login',
        ip: clientIp,
        limit: RATE_LIMITS.login.limit,
        windowMs: RATE_LIMITS.login.window * 1000,
      });

      if (!rateLimitResult.allowed) {
        console.warn(`Rate limit exceeded for login from IP: ${clientIp}`);
        return res.status(429).json({
          error: 'Too many login attempts. Please try again later.',
          retryAfter: rateLimitResult.retryAfter,
        });
      }

      const { email, password } = loginSchema.parse(req.body);

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error || !data.session) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if user is verified
      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: userData } = await adminSupabase
        .from('users')
        .select('is_verified')
        .eq('id', data.user.id)
        .single();

      if (userData && !userData.is_verified) {
        return res.status(403).json({
          error: 'Email not verified. Please check your email for the verification link.',
          code: 'EMAIL_NOT_VERIFIED'
        });
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
      // Rate limiting: 2 registrations per minute
      const clientIp = getClientIp(req);
      const rateLimitResult = await rateLimit({
        action: 'register',
        ip: clientIp,
        limit: RATE_LIMITS.register.limit,
        windowMs: RATE_LIMITS.register.window * 1000,
      });

      if (!rateLimitResult.allowed) {
        console.warn(`Rate limit exceeded for registration from IP: ${clientIp}`);
        return res.status(429).json({
          error: 'Too many registration attempts. Please try again later.',
          retryAfter: rateLimitResult.retryAfter,
        });
      }

      const userData = registerSchema.parse(req.body);
      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const { data, error } = await adminSupabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: false, // Don't auto-confirm, require verification
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
        is_verified: false,
        verification_token: verificationToken,
        verification_token_expires_at: verificationTokenExpiresAt.toISOString(),
      });

      // Send verification email
      try {
        await emailService.sendVerificationEmail(
          userData.email,
          userData.firstName,
          verificationToken
        );
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail registration if email fails, user can request resend
      }

      return res.status(201).json({
        message: 'Registration successful. Please check your email to verify your account.',
        requiresVerification: true
      });
    }

    // POST /api/auth?action=verify-email - Verify email
    if (action === 'verify-email' && req.method === 'POST') {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: 'Verification token is required' });
      }

      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

      // Find user by verification token
      const { data: user, error: userError } = await adminSupabase
        .from('users')
        .select('*')
        .eq('verification_token', token)
        .single();

      if (userError || !user) {
        return res.status(400).json({ error: 'Invalid or expired verification token' });
      }

      // Check if token is expired
      if (user.verification_token_expires_at && new Date(user.verification_token_expires_at) < new Date()) {
        return res.status(400).json({ error: 'Verification token has expired. Please request a new one.' });
      }

      // Check if already verified
      if (user.is_verified) {
        return res.status(200).json({ message: 'Email already verified. You can now log in.' });
      }

      // Update user as verified
      const { error: updateError } = await adminSupabase
        .from('users')
        .update({
          is_verified: true,
          verification_token: null,
          verification_token_expires_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Verification update error:', updateError);
        return res.status(500).json({ error: 'Failed to verify email' });
      }

      // Also confirm email in Supabase Auth
      await adminSupabase.auth.admin.updateUserById(user.id, {
        email_confirm: true
      });

      return res.status(200).json({ message: 'Email verified successfully! You can now log in.' });
    }

    // POST /api/auth?action=forgot-password - Forgot password
    if (action === 'forgot-password' && req.method === 'POST') {
      // Rate limiting: 3 requests per minute
      const clientIp = getClientIp(req);
      const rateLimitResult = await rateLimit({
        action: 'forgot-password',
        ip: clientIp,
        limit: RATE_LIMITS['forgot-password'].limit,
        windowMs: RATE_LIMITS['forgot-password'].window * 1000,
      });

      if (!rateLimitResult.allowed) {
        console.warn(`Rate limit exceeded for password reset from IP: ${clientIp}`);
        return res.status(429).json({
          error: 'Too many password reset attempts. Please try again later.',
          retryAfter: rateLimitResult.retryAfter,
        });
      }

      const { email } = forgotPasswordSchema.parse(req.body);

      // Use Supabase built-in password recovery email (requires SMTP configured in Supabase)
      // We call the client-level supabase (anon key) which triggers Supabase to send the email.
      try {
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const origin = `${protocol}://${host}`;

        // Supabase will send the recovery email; include redirectTo so the link returns to our frontend
        // Note: this method intentionally doesn't reveal whether the email exists (prevents enumeration)
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/reset-password`
        });

        if (resetError) {
          // Log the error for debugging but don't reveal to client
          console.error('[Auth] Supabase resetPasswordForEmail error:', resetError);
        }
      } catch (e) {
        console.error('[Auth] forgot-password handler error:', e);
      }

      // Always return success message regardless of outcome to avoid email enumeration
      return res.status(200).json({
        message: 'If that email exists in our system, a password reset link has been sent'
      });
    }

    // POST /api/auth?action=exchange-code - Exchange PKCE code for session
    if (action === 'exchange-code' && req.method === 'POST') {
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ error: 'Authorization code required' });
      }

      console.log('[Auth] Exchanging PKCE code for tokens');

      // Exchange code for session using Supabase
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error || !data.session) {
        console.error('[Auth] Code exchange failed:', error);
        return res.status(400).json({ error: error?.message || 'Code exchange failed' });
      }

      console.log('[Auth] ✅ Code exchanged successfully');

      // Set httpOnly cookie with access token
      res.setHeader('Set-Cookie', [
        `supabase-auth-token=${data.session.access_token}; HttpOnly; Path=/; Max-Age=604800; ${process.env.NODE_ENV === 'production' ? 'Secure;' : ''} SameSite=Lax`
      ]);

      return res.status(200).json({
        message: 'Session created successfully',
        user: {
          id: data.user.id,
          email: data.user.email,
        }
      });
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
        // New user - check if they have a role in metadata (email/password registration)
        // or if they need to select a role (OAuth sign-in)
        const hasRoleInMetadata = user.user_metadata?.role;
        const role = hasRoleInMetadata ? user.user_metadata.role : null;

        await adminSupabase.from('users').insert({
          id: user.id,
          email: user.email!,
          first_name: user.user_metadata?.firstName || user.user_metadata?.full_name?.split(' ')[0] || '',
          last_name: user.user_metadata?.lastName || user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
          role: role,
          is_verified: true, // OAuth users are auto-verified
        });

        // If no role, user needs to select one
        if (!role) {
          return res.status(200).json({
            message: 'User synced successfully',
            needsRoleSelection: true
          });
        }
      }

      // Check if existing user has no role (incomplete OAuth registration)
      if (existingUser && !existingUser.role) {
        return res.status(200).json({
          message: 'User synced successfully',
          needsRoleSelection: true
        });
      }

      return res.status(200).json({
        message: 'User synced successfully',
        needsRoleSelection: false
      });
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

    // GET /api/auth?action=identities - Get user's linked identities
    if (action === 'identities' && req.method === 'GET') {
      const token = req.cookies['supabase-auth-token'];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Return user's identities (email, google, etc.)
      const identities = user.identities || [];
      const linkedProviders = identities.map(identity => ({
        provider: identity.provider,
        created_at: identity.created_at,
      }));

      return res.status(200).json({
        identities: linkedProviders,
        hasEmailProvider: linkedProviders.some(p => p.provider === 'email'),
        hasGoogleProvider: linkedProviders.some(p => p.provider === 'google'),
      });
    }

    // POST /api/auth?action=link-google - Initiate Google linking for logged-in user
    if (action === 'link-google' && req.method === 'POST') {
      const token = req.cookies['supabase-auth-token'];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized - must be logged in to link account' });
      }

      // Verify user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const origin = `${protocol}://${host}`;

      // Store user's current session info for linking after OAuth
      // We'll use the linking callback to complete the process
      const linkingUrl = `${origin}/auth/link-callback`;

      // Note: The actual linking happens on the client side using supabase.auth.linkIdentity()
      // This endpoint just returns the necessary configuration
      return res.status(200).json({
        message: 'Use client-side linkIdentity() method',
        redirectUrl: linkingUrl,
        provider: 'google',
      });
    }

    // POST /api/auth?action=set-role - Set user role (for new OAuth users)
    if (action === 'set-role' && req.method === 'POST') {
      const token = req.cookies['supabase-auth-token'];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized - please log in' });
      }

      // Verify user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ error: 'Role is required' });
      }

      const validRoles = ['landlord', 'property_manager'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be landlord or property_manager. Tenants must be invited by a landlord.' });
      }

      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

      // Check if user exists
      const { data: existingUser } = await adminSupabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Only allow setting role if it's currently null (prevent role changes after initial setup)
      if (existingUser.role !== null) {
        return res.status(400).json({ error: 'Role has already been set. Please contact support to change your role.' });
      }

      // Update user role
      const { error: updateError } = await adminSupabase
        .from('users')
        .update({
          role: role,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Role update error:', updateError);
        return res.status(500).json({ error: 'Failed to update role' });
      }

      return res.status(200).json({ message: 'Role set successfully' });
    }

    // POST /api/auth?action=change-password - Change user password
    if (action === 'change-password' && req.method === 'POST') {
      const token = req.cookies['supabase-auth-token'];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized - please log in' });
      }

      // Verify user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Rate limiting: 10 password change attempts per minute per user
      // Use user ID as the rate limit key to prevent brute force attacks on specific accounts
      const clientIp = getClientIp(req);
      const rateLimitKey = user.id || clientIp; // Fallback to IP if no user ID
      const rateLimitResult = await rateLimit({
        action: 'change-password',
        ip: rateLimitKey,
        limit: RATE_LIMITS['change-password'].limit,
        windowMs: RATE_LIMITS['change-password'].window * 1000,
      });

      if (!rateLimitResult.allowed) {
        console.warn(`Rate limit exceeded for password change from user: ${user.id} (IP: ${clientIp})`);
        return res.status(429).json({
          error: 'Too many password change attempts. Please try again later.',
          retryAfter: rateLimitResult.retryAfter,
        });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
      }

      // Verify current password by attempting to sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      });

      if (verifyError) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.error('Password update error:', updateError);
        return res.status(500).json({ error: 'Failed to update password' });
      }

      return res.status(200).json({ message: 'Password changed successfully' });
    }

    // POST /api/auth?action=reset-password - Reset password using Supabase session
    // New flow (Supabase built-in recovery):
    // 1) Frontend receives the magic link and either a code or fragment from Supabase.
    // 2) Frontend calls `supabase.auth.exchangeCodeForSession(code)` (if using PKCE/code)
    //    or `supabase.auth.setSession({ access_token, refresh_token })` when receiving a hash.
    // 3) Frontend should then either call `/api/auth?action=set-session` to set an httpOnly cookie
    //    or include `access_token` in the POST body below. This handler will accept either a cookie
    //    `supabase-auth-token` or a body `access_token` and will verify the session before updating the password.
    if (action === 'reset-password' && req.method === 'POST') {
      const { newPassword, access_token } = req.body;

      if (!newPassword) {
        return res.status(400).json({ error: 'New password is required' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      // Prefer token from secure cookie; fall back to access_token in body
      const token = req.cookies['supabase-auth-token'] || access_token;
      if (!token) {
        return res.status(401).json({
          error: 'Unauthorized. Please exchange the recovery code for a session and provide an access token or set a session cookie before calling this endpoint.'
        });
      }

      // Verify session and get user
      const { data: { user }, error: getUserError } = await supabase.auth.getUser(token);
      if (getUserError || !user) {
        console.error('[Auth] reset-password - session validation failed:', getUserError);
        return res.status(401).json({ error: 'Invalid or expired session. Please request a new password reset.' });
      }

      // Use the service role key to update the user's password securely
      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
      const { error: updateError } = await adminSupabase.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

      if (updateError) {
        console.error('[Auth] reset-password - updateUser error:', updateError);
        return res.status(500).json({ error: 'Failed to update password' });
      }

      // Clear any legacy custom reset tokens for this user (best-effort)
      try {
        await adminSupabase
          .from('users')
          .update({
            password_reset_token: null,
            password_reset_token_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
      } catch (e) {
        // Non-fatal; just log
        console.warn('[Auth] reset-password - failed to clear legacy tokens:', e);
      }

      return res.status(200).json({ message: 'Password reset successfully!' });
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

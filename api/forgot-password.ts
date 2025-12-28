// POST /api/forgot-password - Send password reset email
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const origin = `${protocol}://${host}`;

    console.log('Password reset request for:', email);
    console.log('Redirect URL will be:', `${origin}/reset-password`);

    // Send password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });

    if (error) {
      console.error('Password reset error:', error);
    }

    // Always return success message (don't reveal if email exists)
    // This is a security best practice to prevent email enumeration
    return res.status(200).json({ 
      message: 'If that email exists in our system, a password reset link has been sent' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid email address', 
        details: error.errors 
      });
    }
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

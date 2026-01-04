// POST /api/invitations/accept - Accept invitation and create account
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createDbConnection } from '../_lib/db.js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sql = createDbConnection();
  const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { token, password } = acceptInvitationSchema.parse(req.body);

    // Find tenant with this invitation token
    const tenants = await sql`
      SELECT 
        id,
        first_name,
        last_name,
        email,
        invitation_sent_at,
        account_status,
        user_id
      FROM public.tenants
      WHERE invitation_token = ${token}
      AND account_status IN ('invited', 'pending_invitation')
    `;

    if (tenants.length === 0) {
      return res.status(404).json({ 
        error: 'Invalid invitation',
        message: 'This invitation link is invalid or has already been used.'
      });
    }

    const tenant = tenants[0];

    // Check if invitation_sent_at exists
    if (!tenant.invitation_sent_at) {
      return res.status(410).json({ 
        error: 'Invalid invitation',
        message: 'This invitation is invalid. Please request a new invitation from your landlord.'
      });
    }

    // Check if invitation is expired (7 days)
    const invitationDate = new Date(tenant.invitation_sent_at);
    const expirationDate = new Date(invitationDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    if (now > expirationDate) {
      return res.status(410).json({ 
        error: 'Invitation expired',
        message: 'This invitation link has expired. Please request a new invitation from your landlord.'
      });
    }

    // Create user account in Supabase Auth
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: tenant.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        firstName: tenant.first_name,
        lastName: tenant.last_name,
        role: 'tenant',
      }
    });

    if (authError || !authData.user) {
      console.error('Failed to create auth user:', authError);
      return res.status(500).json({ 
        error: 'Account creation failed',
        message: authError?.message || 'Failed to create user account'
      });
    }

    // Use transaction for database operations
    await sql.begin(async (sql) => {
      // Create user record in public.users table
      await sql`
        INSERT INTO public.users (id, email, first_name, last_name, role)
        VALUES (
          ${authData.user.id},
          ${tenant.email},
          ${tenant.first_name},
          ${tenant.last_name},
          'tenant'
        )
        ON CONFLICT (id) DO NOTHING
      `;

      // Update tenant record - link to user account and mark as active
      await sql`
        UPDATE public.tenants
        SET 
          user_id = ${authData.user.id},
          invitation_accepted_at = NOW(),
          account_status = 'active',
          invitation_token = NULL
        WHERE id = ${tenant.id}
      `;
    });

    // Return success - user needs to login with their new credentials
    return res.status(201).json({
      message: 'Account created successfully',
      requireLogin: true,
      email: authData.user.email
    });

  } catch (error) {
    console.error('Error accepting invitation:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid input',
        errors: error.errors
      });
    }
    return res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to accept invitation'
    });
  } finally {
    await sql.end();
  }
}

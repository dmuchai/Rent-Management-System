// Combined invitations endpoint
// GET /api/invitations/verify?token=xyz - Verify invitation token
// POST /api/invitations/accept - Accept invitation and create account
// POST /api/invitations/resend - Resend invitation email
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import crypto from 'crypto';
import { emailService } from '../_lib/emailService.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string | undefined;
  
  // Handle GET /api/invitations/verify?token=xyz
  if (req.method === 'GET' || (req.method === 'POST' && action === 'verify')) {
    const sql = createDbConnection();
    
    try {
      const querySchema = z.object({
        token: z.string().min(1, 'Token is required'),
      });
      
      const { token } = querySchema.parse(req.query);

      const tenants = await sql`
        SELECT 
          id,
          first_name,
          last_name,
          email,
          invitation_sent_at,
          account_status
        FROM public.tenants
        WHERE invitation_token = ${token}
        AND account_status IN ('invited', 'pending_invitation')
      `;

      if (tenants.length === 0) {
        return res.status(404).json({ 
          error: 'Invalid or expired invitation token',
          message: 'This invitation link is invalid or has already been used.'
        });
      }

      const tenant = tenants[0];

      if (!tenant.invitation_sent_at) {
        return res.status(400).json({ 
          error: 'Invitation not sent',
          message: 'This invitation has not been sent yet.'
        });
      }

      const invitationDate = new Date(tenant.invitation_sent_at);
      const expirationDate = new Date(invitationDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      const now = new Date();

      if (now > expirationDate) {
        return res.status(410).json({ 
          error: 'Invitation expired',
          message: 'This invitation link has expired. Please request a new invitation from your landlord.',
          expired: true
        });
      }

      return res.status(200).json({
        firstName: tenant.first_name,
        lastName: tenant.last_name,
        email: tenant.email,
        valid: true
      });

    } catch (error) {
      console.error('Error verifying invitation:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid request',
          message: 'Token parameter is required'
        });
      }
      return res.status(500).json({ 
        error: 'Server error',
        message: 'Failed to verify invitation'
      });
    } finally {
      await sql.end();
    }
  }
  
  // Handle POST /api/invitations/accept
  if (req.method === 'POST' && action === 'accept') {
    const sql = createDbConnection();
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
      const acceptInvitationSchema = z.object({
        token: z.string().min(1, 'Token is required'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
      });
      
      const { token, password } = acceptInvitationSchema.parse(req.body);

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

      if (!tenant.invitation_sent_at) {
        return res.status(410).json({ 
          error: 'Invalid invitation',
          message: 'This invitation is invalid. Please request a new invitation from your landlord.'
        });
      }

      const invitationDate = new Date(tenant.invitation_sent_at);
      const expirationDate = new Date(invitationDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      const now = new Date();

      if (now > expirationDate) {
        return res.status(410).json({ 
          error: 'Invitation expired',
          message: 'This invitation link has expired. Please request a new invitation from your landlord.'
        });
      }

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

      // Wrap DB transaction to ensure auth user cleanup on failure
      try {
        await sql.begin(async (sql) => {
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
      } catch (dbError) {
        // Database transaction failed - cleanup orphaned auth user
        console.error('Database transaction failed, cleaning up auth user:', dbError);
        try {
          await adminSupabase.auth.admin.deleteUser(authData.user.id);
          console.log(`Deleted orphaned auth user: ${authData.user.id}`);
        } catch (deleteError) {
          console.error('Failed to delete orphaned auth user:', deleteError);
          // Log but continue to throw original error
        }
        
        return res.status(500).json({ 
          error: 'Account creation failed',
          message: 'Failed to complete account setup. Please try again.'
        });
      }

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
  
  // Handle POST /api/invitations/resend (requires auth)
  if (req.method === 'POST' && action === 'resend') {
    // Extract auth from request manually since we can't use requireAuth wrapper here
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sql = createDbConnection();

    try {
      const resendSchema = z.object({
        tenantId: z.string().min(1, 'Tenant ID is required'),
      });
      
      const { tenantId } = resendSchema.parse(req.body);
      
      // Get user ID from session (simplified - in production verify JWT)
      const token = authHeader.substring(7);
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const tenants = await sql`
        SELECT t.*
        FROM public.tenants t
        WHERE t.id = ${tenantId}
        AND t.user_id = ${user.id}
        AND t.account_status IN ('pending_invitation', 'invited')
      `;

      if (tenants.length === 0) {
        return res.status(404).json({ 
          error: 'Tenant not found',
          message: 'Tenant not found or invitation already accepted'
        });
      }

      const tenant = tenants[0];
      const invitationToken = crypto.randomBytes(32).toString('hex');

      await sql`
        UPDATE public.tenants
        SET 
          invitation_token = ${invitationToken},
          invitation_sent_at = NOW(),
          account_status = 'invited'
        WHERE id = ${tenantId}
        AND user_id = ${user.id}
      `;

      const [landlord] = await sql`
        SELECT first_name, last_name FROM public.users WHERE id = ${user.id}
      `;

      try {
        await emailService.sendTenantInvitation(
          tenant.email,
          `${tenant.first_name} ${tenant.last_name}`,
          invitationToken,
          undefined,
          undefined,
          landlord ? `${landlord.first_name} ${landlord.last_name}` : undefined
        );
        console.log(`✅ Invitation email resent to ${tenant.email}`);
      } catch (emailError) {
        console.error('Failed to resend invitation email:', emailError);
        return res.status(500).json({ 
          error: 'Failed to send email',
          message: 'Invitation updated but email failed to send'
        });
      }

      return res.status(200).json({ 
        message: 'Invitation resent successfully',
        email: tenant.email
      });

    } catch (error) {
      console.error('Error resending invitation:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid input',
          errors: error.errors
        });
      }
      return res.status(500).json({ 
        error: 'Server error',
        message: 'Failed to resend invitation'
      });
    } finally {
      await sql.end();
    }
  }
  
  return res.status(400).json({ error: 'Invalid action parameter. Use ?action=verify, ?action=accept, or ?action=resend' });
}

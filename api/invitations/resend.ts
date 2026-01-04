// POST /api/invitations/resend - Resend invitation email
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';
import { z } from 'zod';
import crypto from 'crypto';
import { emailService } from '../_lib/emailService.js';

const resendSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
});

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sql = createDbConnection();

  try {
    const { tenantId } = resendSchema.parse(req.body);

    // Get tenant and verify ownership
    const tenants = await sql`
      SELECT t.*
      FROM public.tenants t
      WHERE t.id = ${tenantId}
      AND t.user_id = ${auth.userId}
      AND t.account_status IN ('pending_invitation', 'invited')
    `;

    if (tenants.length === 0) {
      return res.status(404).json({ 
        error: 'Tenant not found',
        message: 'Tenant not found or invitation already accepted'
      });
    }

    const tenant = tenants[0];

    // Generate new invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');

    // Update tenant with new token
    await sql`
      UPDATE public.tenants
      SET 
        invitation_token = ${invitationToken},
        invitation_sent_at = NOW(),
        account_status = 'invited'
      WHERE id = ${tenantId}
      AND user_id = ${auth.userId}
    `;

    // Get landlord info for email
    const [landlord] = await sql`
      SELECT first_name, last_name FROM public.users WHERE id = ${auth.userId}
    `;

    // Send invitation email
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
});

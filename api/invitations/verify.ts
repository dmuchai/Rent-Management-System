// GET /api/invitations/verify?token=xyz - Verify invitation token
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createDbConnection } from '../_lib/db.js';
import { z } from 'zod';

const querySchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sql = createDbConnection();

  try {
    const { token } = querySchema.parse(req.query);

    // Find tenant with this invitation token
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

    // Check if invitation is expired (7 days)
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

    // Return tenant info for the invitation acceptance form
    return res.status(200).json({
      firstName: tenant.first_name,
      lastName: tenant.last_name,
      email: tenant.email,
      valid: true
    });

  } catch (error) {
    console.error('Error verifying invitation:', {
      errorType: error instanceof z.ZodError ? 'ValidationError' : 'ServerError',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
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

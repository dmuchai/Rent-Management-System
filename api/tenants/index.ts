// GET/POST /api/tenants - List all tenants or create new tenant
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';
import { insertTenantSchema } from '../../shared/schema.js';
import { z } from 'zod';
import crypto from 'crypto';
import { emailService } from '../../server/services/emailService.js';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const sql = createDbConnection();

  try {
    if (req.method === 'GET') {
      // Get all tenants owned by this landlord
      const tenants = await sql`
        SELECT t.*
        FROM public.tenants t
        WHERE t.user_id = ${auth.userId}
        ORDER BY t.created_at DESC
      `;
      
      return res.status(200).json(tenants);
    } else if (req.method === 'POST') {
      const tenantData = insertTenantSchema.parse(req.body);

      // Generate secure invitation token
      const invitationToken = crypto.randomBytes(32).toString('hex');

      const [tenant] = await sql`
        INSERT INTO public.tenants (
          user_id, 
          first_name, 
          last_name, 
          email, 
          phone, 
          emergency_contact,
          invitation_token,
          invitation_sent_at,
          account_status
        )
        VALUES (
          ${auth.userId},
          ${tenantData.firstName}, 
          ${tenantData.lastName}, 
          ${tenantData.email}, 
          ${tenantData.phone},
          ${tenantData.emergencyContact || null},
          ${invitationToken},
          NOW(),
          'invited'
        )
        RETURNING *
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
          undefined, // propertyName - will add later when creating lease
          undefined, // unitNumber - will add later when creating lease
          landlord ? `${landlord.first_name} ${landlord.last_name}` : undefined
        );
        console.log(`✅ Invitation email sent to ${tenant.email}`);
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
        // Don't fail the request if email fails, tenant is already created
      }

      return res.status(201).json(tenant);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in tenants endpoint:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    } else {
      return res.status(500).json({ message: 'Failed to process request' });
    }
  } finally {
    await sql.end();
  }
});

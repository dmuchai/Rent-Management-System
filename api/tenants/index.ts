// GET/POST /api/tenants - List all tenants or create new tenant
// DELETE /api/tenants/[id] - Delete a tenant
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';
import { insertTenantSchema } from '../../shared/schema.js';
import { z } from 'zod';
import crypto from 'crypto';
import { emailService } from '../_lib/emailService.js';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const sql = createDbConnection();

  // Handle DELETE /api/tenants/[id]
  if (req.method === 'DELETE') {
    const tenantIdParam = req.query.id;

    // Validate tenantId parameter
    if (!tenantIdParam || Array.isArray(tenantIdParam)) {
      await sql.end();
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const tenantId: string = tenantIdParam;

    try {
      // Use a transaction to prevent TOCTOU race conditions
      await sql.begin(async (tx) => {
        // Verify the tenant belongs to this landlord and lock the row
        const [tenant] = await tx`
          SELECT id FROM public.tenants
          WHERE id = ${tenantId} AND user_id = ${auth.userId}
          FOR UPDATE
        `;

        if (!tenant) {
          throw new Error('TENANT_NOT_FOUND');
        }

        // Re-check for active leases inside the transaction
        const [activeLease] = await tx`
          SELECT id FROM public.leases
          WHERE tenant_id = ${tenantId} AND is_active = true
          LIMIT 1
        `;

        if (activeLease) {
          throw new Error('ACTIVE_LEASE_EXISTS');
        }

        // Delete the tenant
        await tx`
          DELETE FROM public.tenants
          WHERE id = ${tenantId} AND user_id = ${auth.userId}
        `;
      });

      return res.status(200).json({ 
        message: 'Tenant deleted successfully',
        id: tenantId
      });
    } catch (error: any) {
      console.error('Error deleting tenant:', error);
      
      if (error.message === 'TENANT_NOT_FOUND') {
        return res.status(404).json({ error: 'Tenant not found or unauthorized' });
      }
      
      if (error.message === 'ACTIVE_LEASE_EXISTS') {
        return res.status(400).json({ 
          error: 'Cannot delete tenant with active leases',
          message: 'Please deactivate or delete associated leases first'
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to delete tenant'
      });
    } finally {
      await sql.end();
    }
  }

  try {
    if (req.method === 'GET') {
      // Get all tenants owned by this landlord
      // Note: invitationToken is excluded for security (sensitive credential)
      const tenants = await sql`
        SELECT 
          t.id,
          t.user_id as "userId",
          t.first_name as "firstName",
          t.last_name as "lastName",
          t.email,
          t.phone,
          t.emergency_contact as "emergencyContact",
          t.invitation_sent_at as "invitationSentAt",
          t.invitation_accepted_at as "invitationAcceptedAt",
          t.account_status as "accountStatus",
          t.created_at as "createdAt",
          t.updated_at as "updatedAt"
        FROM public.tenants t
        WHERE t.user_id = ${auth.userId}
        ORDER BY t.created_at DESC
      `;
      
      return res.status(200).json(tenants);
    } else if (req.method === 'POST') {
      const tenantData = insertTenantSchema.parse(req.body);

      // Generate secure invitation token
      const invitationToken = crypto.randomBytes(32).toString('hex');

      // Create tenant without invitation_sent_at (will be set after successful email)
      const [tenant] = await sql`
        INSERT INTO public.tenants (
          user_id, 
          first_name, 
          last_name, 
          email, 
          phone, 
          emergency_contact,
          invitation_token,
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
          'pending_invitation'
        )
        RETURNING *
      `;

      // Get landlord info for email
      const [landlord] = await sql`
        SELECT first_name, last_name FROM public.users WHERE id = ${auth.userId}
      `;

      // Send invitation email and update tenant only on success
      try {
        await emailService.sendTenantInvitation(
          tenant.email,
          `${tenant.first_name} ${tenant.last_name}`,
          invitationToken,
          undefined, // propertyName - will add later when creating lease
          undefined, // unitNumber - will add later when creating lease
          landlord ? `${landlord.first_name} ${landlord.last_name}` : undefined
        );
        
        // Email sent successfully - update tenant record
        // Note: invitationToken excluded from response for security
        const [updatedTenant] = await sql`
          UPDATE public.tenants
          SET 
            invitation_sent_at = NOW(),
            account_status = 'invited'
          WHERE id = ${tenant.id}
          RETURNING 
            id,
            user_id as "userId",
            first_name as "firstName",
            last_name as "lastName",
            email,
            phone,
            emergency_contact as "emergencyContact",
            invitation_sent_at as "invitationSentAt",
            invitation_accepted_at as "invitationAcceptedAt",
            account_status as "accountStatus",
            created_at as "createdAt",
            updated_at as "updatedAt"
        `;
        
        console.log(`✅ Invitation email sent to ${tenant.email}`);
        return res.status(201).json(updatedTenant);
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
        // Email failed - return tenant with pending_invitation status
        // Note: invitationToken excluded from response for security
        const sanitizedTenant = {
          id: tenant.id,
          userId: auth.userId,
          firstName: tenant.first_name,
          lastName: tenant.last_name,
          email: tenant.email,
          phone: tenant.phone,
          emergencyContact: tenant.emergency_contact,
          invitationSentAt: tenant.invitation_sent_at,
          invitationAcceptedAt: tenant.invitation_accepted_at,
          accountStatus: tenant.account_status,
          createdAt: tenant.created_at,
          updatedAt: tenant.updated_at
        };
        // Frontend can show this status and allow retry via resend
        return res.status(201).json(sanitizedTenant);
      }
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

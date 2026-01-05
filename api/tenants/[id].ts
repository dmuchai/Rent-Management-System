// DELETE /api/tenants/[id] - Delete a tenant
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const sql = createDbConnection();

  try {
    if (req.method === 'DELETE') {
      const tenantIdParam = req.query.id;

      // Validate tenantId parameter
      if (!tenantIdParam) {
        return res.status(400).json({ error: 'Tenant ID is required' });
      }

      // Handle array case - reject multiple IDs
      if (Array.isArray(tenantIdParam)) {
        return res.status(400).json({ error: 'Multiple tenant IDs not supported' });
      }

      const tenantId: string = tenantIdParam;

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

        // Delete the tenant (this will cascade delete related records based on DB constraints)
        await tx`
          DELETE FROM public.tenants
          WHERE id = ${tenantId} AND user_id = ${auth.userId}
        `;
      });

      return res.status(200).json({ 
        message: 'Tenant deleted successfully',
        id: tenantId
      });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Error deleting tenant:', error);
    
    // Handle specific transaction errors
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
  }
});

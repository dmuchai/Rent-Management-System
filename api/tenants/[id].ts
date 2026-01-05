// DELETE /api/tenants/[id] - Delete a tenant
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const sql = createDbConnection();

  try {
    if (req.method === 'DELETE') {
      const tenantId = req.query.id as string;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID is required' });
      }

      // Verify the tenant belongs to this landlord
      const [tenant] = await sql`
        SELECT id FROM public.tenants
        WHERE id = ${tenantId} AND user_id = ${auth.userId}
      `;

      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found or unauthorized' });
      }

      // Check if tenant has active leases
      const [activeLease] = await sql`
        SELECT id FROM public.leases
        WHERE tenant_id = ${tenantId} AND is_active = true
        LIMIT 1
      `;

      if (activeLease) {
        return res.status(400).json({ 
          error: 'Cannot delete tenant with active leases',
          message: 'Please deactivate or delete associated leases first'
        });
      }

      // Delete the tenant (this will cascade delete related records based on DB constraints)
      await sql`
        DELETE FROM public.tenants
        WHERE id = ${tenantId} AND user_id = ${auth.userId}
      `;

      return res.status(200).json({ 
        message: 'Tenant deleted successfully',
        id: tenantId
      });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Error deleting tenant:', error);
    return res.status(500).json({ 
      error: 'Failed to delete tenant'
    });
  }
});

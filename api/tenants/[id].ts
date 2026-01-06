// DELETE /api/tenants/[id] - Delete a tenant
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  // Validate method before creating DB connection
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed', details: null });
  }

  const sql = createDbConnection();

  try {
    const tenantIdParam = req.query.id;

    // Validate tenantId parameter
    if (!tenantIdParam || Array.isArray(tenantIdParam)) {
      return res.status(400).json({ error: 'Tenant ID is required', details: null });
    }

    const tenantId: string = tenantIdParam;

    // Use a transaction to prevent TOCTOU race conditions
    await sql.begin(async (tx) => {
      // Verify tenant belongs to this landlord through authoritative property ownership
      // Uses property ownership as source of truth, with landlord_id as fallback for tenants without leases
      const [tenant] = await tx`
        SELECT DISTINCT t.id
        FROM public.tenants t
        LEFT JOIN public.leases l ON t.id = l.tenant_id
        LEFT JOIN public.units u ON l.unit_id = u.id
        LEFT JOIN public.properties p ON u.property_id = p.id
        WHERE t.id = ${tenantId}
        AND (
          p.owner_id = ${auth.userId}
          OR t.landlord_id = ${auth.userId}
        )
      `;

      if (!tenant) {
        throw new Error('TENANT_NOT_FOUND');
      }

      // Lock the tenant row for update
      await tx`
        SELECT id FROM public.tenants
        WHERE id = ${tenantId}
        FOR UPDATE
      `;

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
        WHERE id = ${tenantId} AND landlord_id = ${auth.userId}
      `;
    });

    return res.status(200).json({ 
      message: 'Tenant deleted successfully',
      id: tenantId
    });
  } catch (error: any) {
    console.error('Error deleting tenant:', error);
    
    if (error.message === 'TENANT_NOT_FOUND') {
      return res.status(404).json({ error: 'Tenant not found or unauthorized', details: null });
    }
    
    if (error.message === 'ACTIVE_LEASE_EXISTS') {
      return res.status(400).json({ 
        error: 'Cannot delete tenant with active leases',
        details: 'Please deactivate or delete associated leases first'
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to delete tenant',
      details: null
    });
  } finally {
    await sql.end();
  }
});

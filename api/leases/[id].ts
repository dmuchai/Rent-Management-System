// DELETE /api/leases/[id] - Delete a lease
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method === 'DELETE') {
    const sql = createDbConnection();
    const leaseIdParam = req.query.id;

    // Validate leaseId parameter
    if (!leaseIdParam || Array.isArray(leaseIdParam)) {
      await sql.end();
      return res.status(400).json({ error: 'Lease ID is required', details: null });
    }

    const leaseId: string = leaseIdParam;

    try {
      // Use a transaction to prevent race conditions
      await sql.begin(async (tx) => {
        // Verify the lease belongs to a unit owned by this landlord and lock the row
        const [lease] = await tx`
          SELECT l.id 
          FROM public.leases l
          INNER JOIN public.units u ON l.unit_id = u.id
          INNER JOIN public.properties p ON u.property_id = p.id
          WHERE l.id = ${leaseId} AND p.owner_id = ${auth.userId}
          FOR UPDATE
        `;

        if (!lease) {
          throw new Error('LEASE_NOT_FOUND');
        }

        // Check if there are any payments associated with this lease
        const [payment] = await tx`
          SELECT id FROM public.payments
          WHERE lease_id = ${leaseId}
          LIMIT 1
        `;

        if (payment) {
          throw new Error('LEASE_HAS_PAYMENTS');
        }

        // Delete the lease
        await tx`
          DELETE FROM public.leases
          WHERE id = ${leaseId}
        `;
      });

      return res.status(200).json({ 
        message: 'Lease deleted successfully',
        id: leaseId
      });
    } catch (error: any) {
      console.error('Error deleting lease:', error);
      
      if (error.message === 'LEASE_NOT_FOUND') {
        return res.status(404).json({ error: 'Lease not found or unauthorized', details: null });
      }
      
      if (error.message === 'LEASE_HAS_PAYMENTS') {
        return res.status(400).json({ 
          error: 'Cannot delete lease with payment history',
          details: 'This lease has associated payments and cannot be deleted'
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to delete lease',
        details: null
      });
    } finally {
      await sql.end();
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed', details: null });
});

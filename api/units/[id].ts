// DELETE /api/units/[id] - Delete a unit
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
    const unitIdParam = req.query.id;

    // Validate unitId parameter
    if (!unitIdParam || Array.isArray(unitIdParam)) {
      return res.status(400).json({ error: 'Unit ID is required', details: null });
    }

    const unitId: string = unitIdParam;

    // Use a transaction to ensure consistency
    const result = await sql.begin(async (tx) => {
      // Verify the unit belongs to this landlord's property and lock the row
      const [unit] = await tx`
        SELECT u.id, u.property_id, p.owner_id
        FROM public.units u
        INNER JOIN public.properties p ON u.property_id = p.id
        WHERE u.id = ${unitId}
        FOR UPDATE
      `;

      if (!unit) {
        throw new Error('UNIT_NOT_FOUND');
      }
      
      if (unit.owner_id !== auth.userId) {
        throw new Error('UNAUTHORIZED');
      }
      
      const propertyId = unit.property_id;

      // Check for active leases
      const [activeLease] = await tx`
        SELECT id FROM public.leases
        WHERE unit_id = ${unitId} AND is_active = true
        LIMIT 1
      `;

      if (activeLease) {
        throw new Error('ACTIVE_LEASE_EXISTS');
      }

      // Delete the unit
      await tx`
        DELETE FROM public.units
        WHERE id = ${unitId}
      `;
      
      // Auto-sync property totalUnits
      await tx`
        UPDATE public.properties 
        SET total_units = (SELECT COUNT(*)::int FROM public.units WHERE property_id = ${propertyId})
        WHERE id = ${propertyId}
      `;
      
      return { propertyId };
    });

    return res.status(200).json({ 
      message: 'Unit deleted successfully',
      id: unitId,
      propertyId: result.propertyId
    });
  } catch (error: any) {
    console.error('Error deleting unit:', error);
    
    if (error.message === 'UNIT_NOT_FOUND') {
      return res.status(404).json({ error: 'Unit not found', details: null });
    }
    
    if (error.message === 'UNAUTHORIZED') {
      return res.status(403).json({ error: 'Access denied', details: null });
    }
    
    if (error.message === 'ACTIVE_LEASE_EXISTS') {
      return res.status(400).json({ 
        error: 'Cannot delete unit with active leases',
        details: 'Please deactivate or delete associated leases first'
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to delete unit',
      details: null
    });
  } finally {
    await sql.end();
  }
});

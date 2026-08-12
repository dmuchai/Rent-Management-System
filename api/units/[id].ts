// DELETE /api/units/[id] - Delete a unit
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';
import { getEffectiveSubscriptionAccess, createPlanLimitError } from '../_lib/subscription.js';
import { canAddUnit, type PlanCode } from '../../shared/subscription/index.js';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  // Validate method before creating DB connection
  if (req.method !== 'DELETE' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed', details: null });
  }

  const sql = createDbConnection();
  let planCode: PlanCode = 'free';
  let activeUnitCount = 0;

  try {
    const unitIdParam = req.query.id;

    // Validate unitId parameter
    if (!unitIdParam || Array.isArray(unitIdParam)) {
      return res.status(400).json({ error: 'Unit ID is required', details: null });
    }

    const unitId: string = unitIdParam;

    planCode = (await getEffectiveSubscriptionAccess(auth.userId)).planCode;

    // Use a transaction to ensure consistency
    const result = await sql.begin(async (tx) => {
      // Verify the unit belongs to this landlord's property
      // Lock BOTH the unit row and the property row to prevent concurrent deletions
      const [unit] = await tx`
        SELECT u.id, u.property_id, p.owner_id
        FROM public.units u
        INNER JOIN public.properties p ON u.property_id = p.id
        WHERE u.id = ${unitId}
        FOR UPDATE OF u, p
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

      if (req.method === 'DELETE') {
        // Archive the unit instead of deleting it so downgrade recovery keeps data intact.
        await tx`
          UPDATE public.units
          SET archived_at = NOW(), updated_at = NOW()
          WHERE id = ${unitId}
        `;
      } else {
        const [archivedUnit] = await tx`
          SELECT u.id, u.archived_at, u.property_id
          FROM public.units u
          WHERE u.id = ${unitId}
        `;

        if (!archivedUnit) {
          throw new Error('UNIT_NOT_FOUND');
        }

        if (archivedUnit.archived_at === null) {
          throw new Error('UNIT_NOT_ARCHIVED');
        }

        const [activeUnits] = await tx`
          SELECT COUNT(*)::int AS count
          FROM public.units u
          INNER JOIN public.properties p ON p.id = u.property_id
          WHERE p.owner_id = ${auth.userId}
            AND p.archived_at IS NULL
            AND u.archived_at IS NULL
        `;

        activeUnitCount = Number(activeUnits?.count || 0);
        if (!canAddUnit(planCode, activeUnitCount)) {
          throw new Error('PLAN_LIMIT_REACHED');
        }

        await tx`
          UPDATE public.units
          SET archived_at = NULL, updated_at = NOW()
          WHERE id = ${unitId}
        `;
      }
      
      // Auto-sync property totalUnits (property row is already locked)
      await tx`
        UPDATE public.properties 
        SET total_units = (
          SELECT COUNT(*)::int FROM public.units
          WHERE property_id = ${propertyId} AND archived_at IS NULL
        )
        WHERE id = ${propertyId}
      `;
      
      return { propertyId };
    });

    return res.status(200).json({ 
      message: req.method === 'DELETE' ? 'Unit archived successfully' : 'Unit restored successfully',
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

    if (error.message === 'UNIT_NOT_ARCHIVED') {
      return res.status(400).json({ error: 'Unit is already active', details: null });
    }

    if (error.message === 'PLAN_LIMIT_REACHED') {
      return res.status(409).json(createPlanLimitError(planCode, 'active_units', activeUnitCount));
    }
    
    return res.status(500).json({ 
      error: 'Failed to update unit',
      details: null
    });
  } finally {
    await sql.end();
  }
});

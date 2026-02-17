import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../../_lib/auth.js';
import { createDbConnection } from '../../_lib/db.js';
import { z } from 'zod';

function mapAssignmentRow(row: any, caretaker?: any) {
  const caretakerName = caretaker
    ? `${caretaker.first_name || ''} ${caretaker.last_name || ''}`.trim()
    : undefined;

  return {
    id: row.id,
    caretakerId: row.caretaker_id,
    caretakerName: caretakerName || undefined,
    caretakerEmail: caretaker?.email || undefined,
    landlordId: row.landlord_id,
    propertyId: row.property_id,
    unitId: row.unit_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const assignmentIdParam = req.query.id;

  if (!assignmentIdParam || Array.isArray(assignmentIdParam)) {
    return res.status(400).json({ message: 'Assignment ID is required' });
  }

  if (req.method !== 'PUT' && req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const sql = createDbConnection();

  try {
    if (auth.role !== 'landlord' && auth.role !== 'property_manager') {
      return res.status(403).json({ message: 'Only landlords can update caretaker assignments' });
    }

    const assignmentId = assignmentIdParam;

    const [assignment] = await sql`
      SELECT id, landlord_id, caretaker_id
      FROM public.caretaker_assignments
      WHERE id = ${assignmentId}
    `;

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (assignment.landlord_id !== auth.userId) {
      return res.status(403).json({ message: 'Unauthorized: Assignment does not belong to you' });
    }

    if (req.method === 'DELETE') {
      await sql`
        DELETE FROM public.caretaker_assignments
        WHERE id = ${assignmentId}
      `;

      return res.status(200).json({ message: 'Caretaker assignment deleted', id: assignmentId });
    }

    const updateSchema = z.object({
      status: z.enum(['active', 'inactive']).optional(),
      propertyId: z.string().nullable().optional(),
      unitId: z.string().nullable().optional(),
    }).refine((data) => data.propertyId !== undefined || data.unitId !== undefined || data.status !== undefined, {
      message: 'At least one field must be provided',
      path: ['status'],
    });

    const updateData = updateSchema.parse(req.body);

    if (updateData.propertyId) {
      const [property] = await sql`
        SELECT id FROM public.properties
        WHERE id = ${updateData.propertyId}
        AND owner_id = ${auth.userId}
      `;

      if (!property) {
        return res.status(403).json({ message: 'Property not found or does not belong to you' });
      }
    }

    if (updateData.unitId) {
      const [unit] = await sql`
        SELECT id, property_id FROM public.units
        WHERE id = ${updateData.unitId}
      `;

      if (!unit) {
        return res.status(403).json({ message: 'Unit not found or does not belong to you' });
      }

      const [property] = await sql`
        SELECT id FROM public.properties
        WHERE id = ${unit.property_id}
        AND owner_id = ${auth.userId}
      `;

      if (!property) {
        return res.status(403).json({ message: 'Unit not found or does not belong to you' });
      }
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updateData.status !== undefined) updates.status = updateData.status;
    if (updateData.propertyId !== undefined) updates.property_id = updateData.propertyId;
    if (updateData.unitId !== undefined) updates.unit_id = updateData.unitId;

    const [updatedAssignment] = await sql`
      UPDATE public.caretaker_assignments
      SET ${sql(updates)}
      WHERE id = ${assignmentId}
      RETURNING *
    `;

    const [caretaker] = await sql`
      SELECT id, first_name, last_name, email
      FROM public.users
      WHERE id = ${updatedAssignment.caretaker_id}
    `;

    return res.status(200).json(mapAssignmentRow(updatedAssignment, caretaker));
  } catch (error: any) {
    console.error('Error updating caretaker assignment:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    return res.status(500).json({ message: 'Failed to update caretaker assignment' });
  } finally {
    await sql.end();
  }
});

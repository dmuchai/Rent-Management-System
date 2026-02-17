import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';
import { z } from 'zod';

function mapAssignmentRow(row: any, caretaker?: any) {
  const caretakerName = caretaker
    ? `${caretaker.first_name || ''} ${caretaker.last_name || ''}`.trim()
    : `${row.first_name || ''} ${row.last_name || ''}`.trim();

  return {
    id: row.id,
    caretakerId: row.caretaker_id,
    caretakerName: caretakerName || undefined,
    caretakerEmail: caretaker?.email || row.email || undefined,
    landlordId: row.landlord_id,
    propertyId: row.property_id,
    unitId: row.unit_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const sql = createDbConnection();

  try {
    if (auth.role !== 'landlord' && auth.role !== 'property_manager') {
      return res.status(403).json({ message: 'Only landlords can assign caretakers' });
    }

    const assignmentSchema = z.object({
      caretakerId: z.string().min(1),
      propertyId: z.string().min(1, 'Property is required'),
    });

    const assignmentData = assignmentSchema.parse(req.body);

    const [caretaker] = await sql`
      SELECT id, role, first_name, last_name, email
      FROM public.users
      WHERE id = ${assignmentData.caretakerId}
    `;

    if (!caretaker) {
      return res.status(404).json({ message: 'Caretaker not found' });
    }

    if (caretaker.role !== 'caretaker') {
      return res.status(400).json({ message: 'User is not a caretaker' });
    }

    const [property] = await sql`
      SELECT id FROM public.properties
      WHERE id = ${assignmentData.propertyId}
      AND owner_id = ${auth.userId}
    `;

    if (!property) {
      return res.status(403).json({ message: 'You do not own the specified property/unit' });
    }

    const [existingAssignment] = await sql`
      SELECT a.*, u.first_name, u.last_name, u.email
      FROM public.caretaker_assignments a
      LEFT JOIN public.users u ON u.id = a.caretaker_id
      WHERE a.caretaker_id = ${assignmentData.caretakerId}
        AND a.landlord_id = ${auth.userId}
        AND a.status = 'active'
        AND a.property_id = ${assignmentData.propertyId}
      LIMIT 1
    `;

    if (existingAssignment) {
      return res.status(200).json(mapAssignmentRow(existingAssignment));
    }

    const [createdAssignment] = await sql`
      INSERT INTO public.caretaker_assignments (
        caretaker_id,
        landlord_id,
        property_id,
        unit_id,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${assignmentData.caretakerId},
        ${auth.userId},
        ${assignmentData.propertyId},
        NULL,
        'active',
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    return res.status(201).json(mapAssignmentRow(createdAssignment, caretaker));
  } catch (error: any) {
    console.error('Error assigning caretaker:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    return res.status(500).json({ message: 'Failed to assign caretaker' });
  } finally {
    await sql.end();
  }
});

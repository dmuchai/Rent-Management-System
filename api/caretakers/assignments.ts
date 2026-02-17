import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';

function mapAssignmentRow(row: any) {
  const caretakerName = `${row.first_name || ''} ${row.last_name || ''}`.trim();

  return {
    id: row.id,
    caretakerId: row.caretaker_id,
    caretakerName: caretakerName || undefined,
    caretakerEmail: row.email || undefined,
    landlordId: row.landlord_id,
    propertyId: row.property_id,
    unitId: row.unit_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const sql = createDbConnection();

  try {
    if (auth.role !== 'landlord' && auth.role !== 'property_manager' && auth.role !== 'caretaker') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const assignments = auth.role === 'caretaker'
      ? await sql`
        SELECT a.*, u.first_name, u.last_name, u.email
        FROM public.caretaker_assignments a
        LEFT JOIN public.users u ON u.id = a.caretaker_id
        WHERE a.caretaker_id = ${auth.userId}
        ORDER BY a.created_at DESC
      `
      : await sql`
        SELECT a.*, u.first_name, u.last_name, u.email
        FROM public.caretaker_assignments a
        LEFT JOIN public.users u ON u.id = a.caretaker_id
        WHERE a.landlord_id = ${auth.userId}
        ORDER BY a.created_at DESC
      `;

    return res.status(200).json(assignments.map(mapAssignmentRow));
  } catch (error: any) {
    console.error('Error fetching caretaker assignments:', error);
    return res.status(500).json({ message: 'Failed to fetch caretaker assignments' });
  } finally {
    await sql.end();
  }
});

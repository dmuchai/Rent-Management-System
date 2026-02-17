import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const sql = createDbConnection();

  try {
    if (auth.role !== 'caretaker') {
      return res.status(403).json({ message: 'Only caretakers can view assigned properties' });
    }

    const assignments = await sql`
      SELECT property_id, unit_id
      FROM public.caretaker_assignments
      WHERE caretaker_id = ${auth.userId}
        AND status = 'active'
    `;

    const propertyIds = new Set<string>();
    const unitIds = (assignments || [])
      .map((assignment: any) => assignment.unit_id)
      .filter((unitId: string | null) => Boolean(unitId)) as string[];

    (assignments || []).forEach((assignment: any) => {
      if (assignment.property_id) {
        propertyIds.add(assignment.property_id);
      }
    });

    if (unitIds.length > 0) {
      const units = await sql`
        SELECT id, property_id
        FROM public.units
        WHERE id IN ${sql(unitIds)}
      `;

      (units || []).forEach((unit: any) => {
        if (unit.property_id) {
          propertyIds.add(unit.property_id);
        }
      });
    }

    const propertyIdList = Array.from(propertyIds);
    if (propertyIdList.length === 0) {
      return res.status(200).json([]);
    }

    const properties = await sql`
      SELECT id, name, address
      FROM public.properties
      WHERE id IN ${sql(propertyIdList)}
      ORDER BY name ASC
    `;

    return res.status(200).json(properties || []);
  } catch (error: any) {
    console.error('Error fetching caretaker properties:', error);
    return res.status(500).json({ message: 'Failed to fetch assigned properties' });
  } finally {
    await sql.end();
  }
});

// GET/POST /api/units - List units or create new unit
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';
import { insertUnitSchema } from '../../shared/schema.js';
import { z } from 'zod';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const sql = createDbConnection();

  try {
    const { propertyId } = req.query;

    if (req.method === 'GET' && propertyId && typeof propertyId === 'string') {
      // Get units for a specific property
      const properties = await sql`
        SELECT * FROM public.properties WHERE id = ${propertyId}
      `;

      if (properties.length === 0) {
        return res.status(404).json({ message: 'Property not found' });
      } else if (properties[0].owner_id !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
      } else {
        const propertyUnits = await sql`
          SELECT * FROM public.units WHERE property_id = ${propertyId}
        `;
        return res.status(200).json(propertyUnits);
      }
    } else if (req.method === 'GET') {
      // Get all units for all user's properties
      const allUnits = await sql`
        SELECT u.*
        FROM public.units u
        INNER JOIN public.properties p ON u.property_id = p.id
        WHERE p.owner_id = ${auth.userId}
        ORDER BY u.created_at DESC
      `;
      return res.status(200).json(allUnits);
    } else if (req.method === 'POST') {
      const unitData = insertUnitSchema.parse(req.body);

      // Verify property ownership
      const properties = await sql`
        SELECT * FROM public.properties WHERE id = ${unitData.propertyId}
      `;

      if (properties.length === 0) {
        return res.status(404).json({ message: 'Property not found' });
      } else if (properties[0].owner_id !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
      } else {
        const [unit] = await sql`
          INSERT INTO public.units (property_id, unit_number, bedrooms, bathrooms, rent_amount, is_occupied)
          VALUES (
            ${unitData.propertyId},
            ${unitData.unitNumber},
            ${unitData.bedrooms ?? null},
            ${unitData.bathrooms ?? null},
            ${unitData.rentAmount},
            ${unitData.isOccupied ?? false}
          )
          RETURNING *
        `;
        return res.status(201).json(unit);
      }
    } else {
      return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in units endpoint:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    } else {
      return res.status(500).json({ message: 'Failed to process request' });
    }
  } finally {
    await sql.end();
  }
});

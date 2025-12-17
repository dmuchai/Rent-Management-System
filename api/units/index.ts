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
        // Transform to camelCase for frontend
        const transformedUnits = propertyUnits.map(unit => ({
          id: unit.id,
          propertyId: unit.property_id,
          unitNumber: unit.unit_number,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          size: unit.size,
          rentAmount: unit.rent_amount,
          isOccupied: unit.is_occupied,
          createdAt: unit.created_at,
          updatedAt: unit.updated_at
        }));
        return res.status(200).json(transformedUnits);
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
      // Transform to camelCase for frontend
      const transformedUnits = allUnits.map(unit => ({
        id: unit.id,
        propertyId: unit.property_id,
        unitNumber: unit.unit_number,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        size: unit.size,
        rentAmount: unit.rent_amount,
        isOccupied: unit.is_occupied,
        createdAt: unit.created_at,
        updatedAt: unit.updated_at
      }));
      return res.status(200).json(transformedUnits);
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
          INSERT INTO public.units (property_id, unit_number, bedrooms, bathrooms, size, rent_amount, is_occupied)
          VALUES (
            ${unitData.propertyId},
            ${unitData.unitNumber},
            ${unitData.bedrooms ?? null},
            ${unitData.bathrooms ?? null},
            ${unitData.size ?? null},
            ${unitData.rentAmount},
            ${unitData.isOccupied ?? false}
          )
          RETURNING *
        `;
        // Transform to camelCase for frontend
        const transformedUnit = {
          id: unit.id,
          propertyId: unit.property_id,
          unitNumber: unit.unit_number,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          size: unit.size,
          rentAmount: unit.rent_amount,
          isOccupied: unit.is_occupied,
          createdAt: unit.created_at,
          updatedAt: unit.updated_at
        };
        return res.status(201).json(transformedUnit);
      }
    } else if (req.method === 'PUT') {
      const unitUpdateSchema = z.object({
        id: z.string().min(1, 'Unit ID is required'),
        propertyId: z.string().min(1, 'Property is required'),
        unitNumber: z.string().min(1, 'Unit number is required'),
        bedrooms: z.coerce.number().int().nonnegative().optional().nullable(),
        bathrooms: z.coerce.number().int().nonnegative().optional().nullable(),
        size: z.coerce.number().positive().optional().nullable(),
        rentAmount: z.coerce.number().positive('Rent amount must be positive'),
        isOccupied: z.boolean().optional().default(false),
      });

      const unitData = unitUpdateSchema.parse(req.body);

      // Verify the unit exists and belongs to the landlord's property
      const existingUnits = await sql`
        SELECT u.*, p.owner_id
        FROM public.units u
        INNER JOIN public.properties p ON u.property_id = p.id
        WHERE u.id = ${unitData.id}
      `;

      if (existingUnits.length === 0) {
        return res.status(404).json({ message: 'Unit not found' });
      }

      if (existingUnits[0].owner_id !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Verify property ownership
      const properties = await sql`
        SELECT * FROM public.properties WHERE id = ${unitData.propertyId}
      `;

      if (properties.length === 0) {
        return res.status(404).json({ message: 'Property not found' });
      } else if (properties[0].owner_id !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const [updatedUnit] = await sql`
        UPDATE public.units
        SET 
          property_id = ${unitData.propertyId},
          unit_number = ${unitData.unitNumber},
          bedrooms = ${unitData.bedrooms ?? null},
          bathrooms = ${unitData.bathrooms ?? null},
          size = ${unitData.size ?? null},
          rent_amount = ${unitData.rentAmount},
          is_occupied = ${unitData.isOccupied ?? false},
          updated_at = NOW()
        WHERE id = ${unitData.id}
        RETURNING *
      `;

      // Transform to camelCase for frontend
      const transformedUnit = {
        id: updatedUnit.id,
        propertyId: updatedUnit.property_id,
        unitNumber: updatedUnit.unit_number,
        bedrooms: updatedUnit.bedrooms,
        bathrooms: updatedUnit.bathrooms,
        size: updatedUnit.size,
        rentAmount: updatedUnit.rent_amount,
        isOccupied: updatedUnit.is_occupied,
        createdAt: updatedUnit.created_at,
        updatedAt: updatedUnit.updated_at
      };

      return res.status(200).json(transformedUnit);
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

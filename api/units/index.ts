// GET/POST /api/units - List units or create new unit
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from './_lib/auth';
import { db } from './_lib/db';
import { units, properties, insertUnitSchema } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method === 'GET') {
    try {
      const { propertyId } = req.query;

      if (propertyId && typeof propertyId === 'string') {
        // Get units for a specific property
        const property = await db.query.properties.findFirst({
          where: eq(properties.id, propertyId)
        });

        if (!property) {
          return res.status(404).json({ message: 'Property not found' });
        }

        if (property.ownerId !== auth.userId) {
          return res.status(403).json({ message: 'Access denied' });
        }

        const propertyUnits = await db.query.units.findMany({
          where: eq(units.propertyId, propertyId)
        });

        return res.status(200).json(propertyUnits);
      }

      // Get all units for all user's properties
      const userProperties = await db.query.properties.findMany({
        where: eq(properties.ownerId, auth.userId),
        with: {
          units: true
        }
      });

      const allUnits = userProperties.flatMap(p => p.units);
      return res.status(200).json(allUnits);
    } catch (error) {
      console.error('Error fetching units:', error);
      return res.status(500).json({ message: 'Failed to fetch units' });
    }
  }

  if (req.method === 'POST') {
    try {
      const unitData = insertUnitSchema.parse(req.body);

      // Verify property ownership
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, unitData.propertyId)
      });

      if (!property) {
        return res.status(404).json({ message: 'Property not found' });
      }

      if (property.ownerId !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const [unit] = await db.insert(units)
        .values(unitData)
        .returning();

      return res.status(201).json(unit);
    } catch (error) {
      console.error('Error creating unit:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      return res.status(500).json({ message: 'Failed to create unit' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
});

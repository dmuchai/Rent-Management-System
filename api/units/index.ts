// Consolidated handler for /api/units and /api/units/[id]
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from './_lib/auth';
import { db } from './_lib/db';
import { units, properties, insertUnitSchema } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const { id, propertyId } = req.query;

  // Handle /api/units/[id] - specific unit operations
  if (id && typeof id === 'string') {
    if (req.method === 'GET') {
      try {
        const unit = await db.query.units.findFirst({
          where: eq(units.id, id),
          with: {
            property: true,
          }
        });

        if (!unit) {
          return res.status(404).json({ message: 'Unit not found' });
        }

        if (!unit.property) {
          console.error('Unit property relation missing for unit:', id);
          return res.status(500).json({ message: 'Unit data integrity error' });
        }

        if (unit.property.ownerId !== auth.userId) {
          return res.status(403).json({ message: 'Access denied' });
        }

        return res.status(200).json(unit);
      } catch (error) {
        console.error('Error fetching unit:', error);
        return res.status(500).json({ message: 'Failed to fetch unit' });
      }
    }

    if (req.method === 'PUT') {
      try {
        const existingUnit = await db.query.units.findFirst({
          where: eq(units.id, id),
          with: {
            property: true,
          }
        });

        if (!existingUnit) {
          return res.status(404).json({ message: 'Unit not found' });
        }

        if (!existingUnit.property) {
          console.error('Unit has no associated property:', id);
          return res.status(500).json({ message: 'Data integrity error' });
        }

        if (existingUnit.property.ownerId !== auth.userId) {
          return res.status(403).json({ message: 'Access denied' });
        }

        const unitData = insertUnitSchema.partial().omit({ propertyId: true }).parse(req.body);

        const [updatedUnit] = await db.update(units)
          .set(unitData)
          .where(eq(units.id, id))
          .returning();

        return res.status(200).json(updatedUnit);
      } catch (error) {
        console.error('Error updating unit:', error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: 'Invalid input', errors: error.errors });
        }
        return res.status(500).json({ message: 'Failed to update unit' });
      }
    }

    if (req.method === 'DELETE') {
      try {
        const existingUnit = await db.query.units.findFirst({
          where: eq(units.id, id),
          with: {
            property: true,
          }
        });

        if (!existingUnit) {
          return res.status(404).json({ message: 'Unit not found' });
        }

        if (!existingUnit.property) {
          console.error('Unit property relation missing for unit:', id);
          return res.status(500).json({ message: 'Unit data integrity error' });
        }

        if (existingUnit.property.ownerId !== auth.userId) {
          return res.status(403).json({ message: 'Access denied' });
        }

        await db.delete(units).where(eq(units.id, id));

        return res.status(204).send('');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error deleting unit:', errorMessage);
        return res.status(500).json({ message: 'Failed to delete unit' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Handle /api/units - list all or create new
  if (req.method === 'GET') {
    try {
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

  return res.status(405).json({ message: 'Method not allowed' });
});

// GET/PUT/DELETE /api/units/[id] - Get, update or delete a specific unit
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth';
import { db } from '../_lib/db';
import { units, properties, insertUnitSchema } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid unit ID' });
  }

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

      // Verify property ownership
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

      if (existingUnit.property.ownerId !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const unitData = insertUnitSchema.partial().parse(req.body);

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

      if (existingUnit.property.ownerId !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await db.delete(units).where(eq(units.id, id));

      return res.status(204).send();
    } catch (error) {
      console.error('Error deleting unit:', error);
      return res.status(500).json({ message: 'Failed to delete unit' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
});

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

      // Ensure property relation is loaded
      if (!unit.property) {
        console.error('Unit property relation missing for unit:', id);
        return res.status(500).json({ message: 'Unit data integrity error' });
      }

      // Verify property ownership
      if (unit.property.ownerId !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      return res.status(200).json(unit);
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
      const unitData = insertUnitSchema.partial().omit({ propertyId: true }).parse(req.body);

      const [updatedUnit] = await db.update(units)
        .set(unitData)
        .where(eq(units.id, id))
        .returning();

      if (!existingUnit) {
        return res.status(404).json({ message: 'Unit not found' });
      }

      // Ensure property relation is loaded
      if (!existingUnit.property) {
        console.error('Unit property relation missing for unit:', id);
        return res.status(500).json({ message: 'Unit data integrity error' });
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
        console.error('Unit has no associated property:', id);
        return res.status(500).json({ message: 'Data integrity error' });
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

      // Ensure property relation is loaded
      if (!existingUnit.property) {
        console.error('Unit property relation missing for unit:', id);
        return res.status(500).json({ message: 'Unit data integrity error' });
      }

      if (existingUnit.property.ownerId !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await db.delete(units).where(eq(units.id, id));

      return res.status(204).end();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error deleting unit:', errorMessage);
      if (process.env.NODE_ENV !== 'production') {
        console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
      }
      return res.status(500).json({ message: 'Failed to delete unit' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
});

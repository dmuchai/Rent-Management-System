// GET/PUT/DELETE /api/properties/[id] - Get, update or delete a specific property
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth';
import { db } from '../_lib/db';
import { properties, insertPropertySchema } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid property ID' });
  }

  if (req.method === 'GET') {
    try {
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, id),
        with: {
          units: true,
        }
      });

      if (!property) {
        return res.status(404).json({ message: 'Property not found' });
      }

      // Verify ownership
      if (property.ownerId !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      return res.status(200).json(property);
    } catch (error) {
      console.error('Error fetching property:', error);
      return res.status(500).json({ message: 'Failed to fetch property' });
    }
  }

  if (req.method === 'PUT') {
    try {
      // First verify ownership
      const existingProperty = await db.query.properties.findFirst({
        where: eq(properties.id, id)
      });

      if (!existingProperty) {
        return res.status(404).json({ message: 'Property not found' });
      }

      if (existingProperty.ownerId !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const propertyData = insertPropertySchema.partial().parse(req.body);
      
      const [updatedProperty] = await db.update(properties)
        .set(propertyData)
        .where(eq(properties.id, id))
        .returning();

      return res.status(200).json(updatedProperty);
    } catch (error) {
      console.error('Error updating property:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      return res.status(500).json({ message: 'Failed to update property' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      // First verify ownership
      const existingProperty = await db.query.properties.findFirst({
        where: eq(properties.id, id)
      });

      if (!existingProperty) {
        return res.status(404).json({ message: 'Property not found' });
      }

      if (existingProperty.ownerId !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await db.delete(properties).where(eq(properties.id, id));

      return res.status(204).send();
    } catch (error) {
      console.error('Error deleting property:', error);
      return res.status(500).json({ message: 'Failed to delete property' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
});

// Consolidated handler for /api/properties and /api/properties/[id]
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuthToken } from '../_lib/verify-auth';
import { db } from '../_lib/db';
import { properties, insertPropertySchema } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await verifyAuthToken(req);
  
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  // Handle /api/properties/[id] - specific property operations
  if (id && typeof id === 'string') {
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

        return res.status(204).send('');
      } catch (error) {
        console.error('Error deleting property:', error);
        return res.status(500).json({ message: 'Failed to delete property' });
      }
    }

    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Handle /api/properties - list all or create new
  if (req.method === 'GET') {
    try {
      const userProperties = await db.query.properties.findMany({
        where: eq(properties.ownerId, auth.userId),
        with: {
          units: true,
        }
      });

      return res.status(200).json(userProperties);
    } catch (error) {
      console.error('Error fetching properties:', error);
      return res.status(500).json({ message: 'Failed to fetch properties' });
    }
  }

  if (req.method === 'POST') {
    try {
      const propertyData = insertPropertySchema.parse({ 
        ...req.body, 
        ownerId: auth.userId 
      });
      
      const [property] = await db.insert(properties)
        .values(propertyData)
        .returning();

      return res.status(201).json(property);
    } catch (error) {
      console.error('Error creating property:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      return res.status(500).json({ message: 'Failed to create property' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

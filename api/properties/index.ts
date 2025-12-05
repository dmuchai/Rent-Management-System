// GET/POST /api/properties - List all properties or create new property
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from './_lib/auth';
import { db } from './_lib/db';
import { properties, insertPropertySchema } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
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
});

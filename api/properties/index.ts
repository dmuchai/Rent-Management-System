// Consolidated handler for /api/properties and /api/properties/[id]
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { properties, insertPropertySchema } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

async function verifyAuth(req: VercelRequest) {
  let token: string | undefined;
  
  if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    
    token = cookies['supabase-auth-token'];
  }

  if (!token) return null;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) return null;

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) return null;

  return { userId: user.id, user };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await verifyAuth(req);
  
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Create database connection
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const sql = postgres(databaseUrl, { 
    prepare: false,
    max: 1,
  });
  const db = drizzle(sql);

  try {
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
      // Use raw SQL to get properties
      const userProperties = await sql`
        SELECT * FROM public.properties 
        WHERE owner_id = ${auth.userId}
        ORDER BY created_at DESC
      `;

      return res.status(200).json(userProperties);
    } catch (error) {
      console.error('Error fetching properties:', error);
      return res.status(500).json({ message: 'Failed to fetch properties' });
    }
  }

  if (req.method === 'POST') {
    try {
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      console.log('Auth userId:', auth.userId);
      
      const { name, address, propertyType, totalUnits, description, imageUrl } = req.body;
      
      // Validate required fields
      if (!name || !address || !propertyType || !totalUnits) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      console.log('Creating property with raw SQL');
      
      // Use raw SQL to insert property
      const newProperties = await sql`
        INSERT INTO public.properties (
          name, address, property_type, total_units, description, image_url, owner_id, created_at, updated_at
        )
        VALUES (
          ${name},
          ${address},
          ${propertyType},
          ${parseInt(totalUnits)},
          ${description || null},
          ${imageUrl || null},
          ${auth.userId},
          NOW(),
          NOW()
        )
        RETURNING *
      `;

      return res.status(201).json(newProperties[0]);
    } catch (error) {
      console.error('Error creating property:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      
      return res.status(500).json({ 
        message: 'Failed to create property',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
  } finally {
    await sql.end();
  }
}

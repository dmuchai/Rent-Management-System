// Consolidated handler for /api/properties and /api/properties/[id]
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { insertPropertySchema } from '../../shared/schema.js';
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
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: 'require',
  });

  try {
    const { id } = req.query;

    // Handle /api/properties/[id] - specific property operations
    if (id && typeof id === 'string') {
      if (req.method === 'GET') {
        // Get property with units using raw SQL
        const propertyResult = await sql`
          SELECT p.*, 
            json_agg(
              json_build_object(
                'id', u.id,
                'unitNumber', u.unit_number,
                'bedrooms', u.bedrooms,
                'bathrooms', u.bathrooms,
                'rentAmount', u.rent_amount,
                'isOccupied', u.is_occupied
              )
            ) FILTER (WHERE u.id IS NOT NULL) as units
          FROM public.properties p
          LEFT JOIN public.units u ON u.property_id = p.id
          WHERE p.id = ${id}
          GROUP BY p.id
        `;

        if (propertyResult.length === 0) {
          res.status(404).json({ message: 'Property not found' });
        } else if (propertyResult[0].owner_id !== auth.userId) {
          res.status(403).json({ message: 'Access denied' });
        } else {
          res.status(200).json({
            id: propertyResult[0].id,
            name: propertyResult[0].name,
            address: propertyResult[0].address,
            propertyType: propertyResult[0].property_type,
            totalUnits: propertyResult[0].total_units,
            description: propertyResult[0].description,
            imageUrl: propertyResult[0].image_url,
            ownerId: propertyResult[0].owner_id,
            createdAt: propertyResult[0].created_at,
            updatedAt: propertyResult[0].updated_at,
            units: propertyResult[0].units || []
          });
        }
      } else if (req.method === 'PUT') {
        // First verify ownership
        const existingProperty = await sql`
          SELECT * FROM public.properties WHERE id = ${id}
        `;

        if (existingProperty.length === 0) {
          res.status(404).json({ message: 'Property not found' });
        } else if (existingProperty[0].owner_id !== auth.userId) {
          res.status(403).json({ message: 'Access denied' });
        } else {
          const propertyData = insertPropertySchema.partial().parse(req.body);
          
          // Update all fields at once (simpler approach)
          const [updatedProperty] = await sql`
            UPDATE public.properties 
            SET 
              name = COALESCE(${propertyData.name || null}, name),
              address = COALESCE(${propertyData.address || null}, address),
              property_type = COALESCE(${propertyData.propertyType || null}, property_type),
              total_units = COALESCE(${propertyData.totalUnits || null}, total_units),
              description = COALESCE(${propertyData.description !== undefined ? propertyData.description : null}, description),
              image_url = COALESCE(${propertyData.imageUrl !== undefined ? propertyData.imageUrl : null}, image_url),
              updated_at = NOW()
            WHERE id = ${id}
            RETURNING *
          `;

          res.status(200).json(updatedProperty);
        }
      } else if (req.method === 'DELETE') {
        // First verify ownership
        const existingProperty = await sql`
          SELECT * FROM public.properties WHERE id = ${id}
        `;

        if (existingProperty.length === 0) {
          res.status(404).json({ message: 'Property not found' });
        } else if (existingProperty[0].owner_id !== auth.userId) {
          res.status(403).json({ message: 'Access denied' });
        } else {
          await sql`DELETE FROM public.properties WHERE id = ${id}`;
          res.status(204).send('');
        }
      } else {
        res.status(405).json({ message: 'Method not allowed' });
      }
    } else {
      // Handle /api/properties - list all or create new
      if (req.method === 'GET') {
        // Use raw SQL to get properties
        const userProperties = await sql`
          SELECT * FROM public.properties 
          WHERE owner_id = ${auth.userId}
          ORDER BY created_at DESC
        `;

        res.status(200).json(userProperties);
      } else if (req.method === 'POST') {
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('Auth userId:', auth.userId);
        
        const { name, address, propertyType, totalUnits, description, imageUrl } = req.body;
        
        // Validate required fields
        if (!name || !address || !propertyType || !totalUnits) {
          res.status(400).json({ message: 'Missing required fields' });
        } else {
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

          res.status(201).json(newProperties[0]);
        }
      } else {
        res.status(405).json({ error: 'Method not allowed' });
      }
    }
  } catch (error) {
    console.error('Error in properties handler:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Invalid input', errors: error.errors });
    } else {
      res.status(500).json({ 
        message: 'Failed to process request',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  } finally {
    await sql.end();
  }
}

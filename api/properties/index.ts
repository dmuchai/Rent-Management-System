// Consolidated handler for /api/properties and /api/properties/[id]
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';
import { insertPropertySchema } from '../../shared/schema.js';
import { z } from 'zod';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const sql = createDbConnection();

  try {
    const { id } = req.query;

    // Handle specific property by ID
    if (id && typeof id === 'string') {
      if (req.method === 'GET') {
        // Get property with units
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
          return res.status(404).json({ message: 'Property not found' });
        }
        
        if (propertyResult[0].owner_id !== auth.userId) {
          return res.status(403).json({ message: 'Access denied' });
        }

        return res.status(200).json({
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
      } else if (req.method === 'PUT') {
        // Update property
        const existingProperty = await sql`
          SELECT * FROM public.properties WHERE id = ${id}
        `;

        if (existingProperty.length === 0) {
          return res.status(404).json({ message: 'Property not found' });
        }
        
        if (existingProperty[0].owner_id !== auth.userId) {
          return res.status(403).json({ message: 'Access denied' });
        }

        const propertyData = insertPropertySchema.partial().parse(req.body);
        
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

        return res.status(200).json(updatedProperty);
      } else if (req.method === 'DELETE') {
        // Delete property
        const existingProperty = await sql`
          SELECT * FROM public.properties WHERE id = ${id}
        `;

        if (existingProperty.length === 0) {
          return res.status(404).json({ message: 'Property not found' });
        }
        
        if (existingProperty[0].owner_id !== auth.userId) {
          return res.status(403).json({ message: 'Access denied' });
        }

        await sql`DELETE FROM public.properties WHERE id = ${id}`;
        return res.status(204).send('');
      } else {
        return res.status(405).json({ message: 'Method not allowed' });
      }
    }

    // Handle /api/properties - list all or create new
    if (req.method === 'GET') {
        // Use raw SQL to get properties
        const userProperties = await sql`
          SELECT * FROM public.properties 
          WHERE owner_id = ${auth.userId}
          ORDER BY created_at DESC
        `;

        return res.status(200).json(userProperties);
      } else if (req.method === 'POST') {
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

        const createdProperty = newProperties[0];
        console.log('Property created successfully. Units can be added via property details.');
        
        // Don't auto-create units - let users add them with proper details (rent, bedrooms, etc.)
        // This ensures quality data and prevents confusion with placeholder units
        
        return res.status(201).json(createdProperty);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in properties handler:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    } else {
      return res.status(500).json({ 
        message: 'Failed to process request',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  } finally {
    await sql.end();
  }
});

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
        
        // Auto-calculate totalUnits from actual units count
        const unitsCountResult = await sql`
          SELECT COUNT(*)::int as count FROM public.units WHERE property_id = ${id}
        `;
        const totalUnits = unitsCountResult[0]?.count || 0;
        
        const [updatedProperty] = await sql`
          UPDATE public.properties 
          SET 
            name = COALESCE(NULLIF(${propertyData.name || null}, ''), name),
            address = COALESCE(NULLIF(${propertyData.address || null}, ''), address),
            property_type = COALESCE(NULLIF(${propertyData.propertyType || null}, ''), property_type),
            total_units = ${totalUnits},
            description = COALESCE(NULLIF(${propertyData.description || null}, ''), description),
            image_url = COALESCE(NULLIF(${propertyData.imageUrl || null}, ''), image_url),
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;

        // Transform to camelCase for frontend consistency
        return res.status(200).json({
          id: updatedProperty.id,
          name: updatedProperty.name,
          address: updatedProperty.address,
          propertyType: updatedProperty.property_type,
          totalUnits: updatedProperty.total_units,
          description: updatedProperty.description,
          imageUrl: updatedProperty.image_url,
          ownerId: updatedProperty.owner_id,
          createdAt: updatedProperty.created_at,
          updatedAt: updatedProperty.updated_at
        });
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

        // Transform to camelCase for frontend consistency
        const transformedProperties = userProperties.map(prop => ({
          id: prop.id,
          name: prop.name,
          address: prop.address,
          propertyType: prop.property_type,
          totalUnits: prop.total_units,
          description: prop.description,
          imageUrl: prop.image_url,
          ownerId: prop.owner_id,
          createdAt: prop.created_at,
          updatedAt: prop.updated_at
        }));

        return res.status(200).json(transformedProperties);
      } else if (req.method === 'POST') {
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('Auth userId:', auth.userId);
        
        const { name, address, propertyType, description, imageUrl } = req.body;
        
        // Validate required fields (totalUnits removed - will default to 0)
        if (!name || !address || !propertyType) {
          return res.status(400).json({ message: 'Missing required fields' });
        }
        
        console.log('Creating property with raw SQL');
        
        // Use raw SQL to insert property with totalUnits = 0 (will update when units are added)
        const newProperties = await sql`
          INSERT INTO public.properties (
            name, address, property_type, total_units, description, image_url, owner_id, created_at, updated_at
          )
          VALUES (
            ${name},
            ${address},
            ${propertyType},
            0,
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
        
        // Transform to camelCase for frontend consistency
        return res.status(201).json({
          id: createdProperty.id,
          name: createdProperty.name,
          address: createdProperty.address,
          propertyType: createdProperty.property_type,
          totalUnits: createdProperty.total_units,
          description: createdProperty.description,
          imageUrl: createdProperty.image_url,
          ownerId: createdProperty.owner_id,
          createdAt: createdProperty.created_at,
          updatedAt: createdProperty.updated_at
        });
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

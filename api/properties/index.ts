// Consolidated handler for /api/properties and /api/properties/[id]
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';
import { insertPropertySchema } from '../../shared/schema.js';
import { z } from 'zod';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const sql = createDbConnection();

  try {
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
        console.log('Property created, now creating units...');

        // Create default units for the property
        const unitsToCreate = parseInt(totalUnits);
        for (let i = 1; i <= unitsToCreate; i++) {
          await sql`
            INSERT INTO public.units (
              property_id, unit_number, rent_amount, is_occupied
            )
            VALUES (
              ${createdProperty.id},
              ${`Unit ${i}`},
              ${0},
              ${false}
            )
          `;
        }

        console.log(`Created ${unitsToCreate} units for property`);
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

// GET/POST /api/tenants - List all tenants or create new tenant
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth';
import { createDbConnection } from '../_lib/db';
import { insertTenantSchema } from '../../shared/schema';
import { z } from 'zod';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const sql = createDbConnection();

  try {
    if (req.method === 'GET') {
      // Get all unique tenants connected to landlord's properties through leases
      const tenants = await sql`
        SELECT DISTINCT t.*
        FROM public.tenants t
        INNER JOIN public.leases l ON t.id = l.tenant_id
        INNER JOIN public.units u ON l.unit_id = u.id
        INNER JOIN public.properties p ON u.property_id = p.id
        WHERE p.owner_id = ${auth.userId}
        ORDER BY t.created_at DESC
      `;
      
      res.status(200).json(tenants);
    } else if (req.method === 'POST') {
      const tenantData = insertTenantSchema.parse(req.body);

      const [tenant] = await sql`
        INSERT INTO public.tenants (first_name, last_name, email, phone)
        VALUES (
          ${tenantData.firstName}, 
          ${tenantData.lastName}, 
          ${tenantData.email}, 
          ${tenantData.phone}
        )
        RETURNING *
      `;

      res.status(201).json(tenant);
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in tenants endpoint:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Invalid input', errors: error.errors });
    } else {
      res.status(500).json({ message: 'Failed to process request' });
    }
  } finally {
    await sql.end();
  }
});

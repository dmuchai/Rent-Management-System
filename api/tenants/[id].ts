// PUT /api/tenants/[id] - Update a specific tenant
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth';
import { db } from '../_lib/db';
import { tenants, insertTenantSchema } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid tenant ID' });
  }

  if (req.method === 'PUT') {
    try {
      const existingTenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, id)
      });

      if (!existingTenant) {
        return res.status(404).json({ message: 'Tenant not found' });
      }

      const tenantData = insertTenantSchema.partial().parse(req.body);

      const [updatedTenant] = await db.update(tenants)
        .set(tenantData)
        .where(eq(tenants.id, id))
        .returning();

      return res.status(200).json(updatedTenant);
    } catch (error) {
      console.error('Error updating tenant:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      return res.status(500).json({ message: 'Failed to update tenant' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
});

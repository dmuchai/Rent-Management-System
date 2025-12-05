// PUT /api/tenants/[id] - Update a specific tenant
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth';
import { db } from '../_lib/db';
import { tenants, leases, units, properties, updateTenantSchema } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid tenant ID' });
  }

  // Verify tenant exists and user has access
  try {
    const existingTenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, id)
    });

    if (!existingTenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    // Verify authorization: Check if tenant belongs to landlord's property
    // Get all leases for this tenant
    const tenantLeases = await db.query.leases.findMany({
      where: eq(leases.tenantId, id),
      with: {
        unit: {
          with: {
            property: true,
          }
        }
      }
    });

    // Check if any lease belongs to the authenticated landlord
    const hasAccess = tenantLeases.some(lease => 
      lease.unit?.property?.ownerId === auth.userId
    );

    if (!hasAccess && tenantLeases.length > 0) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // If tenant has no leases yet, allow access (they might be creating a new lease)
    // This handles the case where a landlord creates a tenant before assigning them to a unit
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error verifying tenant access:', errorMessage);
    if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    return res.status(500).json({ message: 'Failed to verify tenant access' });
  }

  if (req.method === 'PUT') {
    try {
      const tenantData = updateTenantSchema.parse(req.body);

      const [updatedTenant] = await db.update(tenants)
        .set(tenantData)
        .where(eq(tenants.id, id))
        .returning();

      return res.status(200).json(updatedTenant);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error updating tenant:', errorMessage);
      if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
        console.error('Stack trace:', error.stack);
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      return res.status(500).json({ message: 'Failed to update tenant' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
});

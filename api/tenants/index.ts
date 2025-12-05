// GET/POST /api/tenants - List all tenants or create new tenant
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from './_lib/auth';
import { db } from './_lib/db';
import { tenants, leases, units, properties, insertTenantSchema } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method === 'GET') {
    try {
      // Get all tenants connected to landlord's properties through leases
      const userProperties = await db.query.properties.findMany({
        where: eq(properties.ownerId, auth.userId),
        with: {
          units: {
            with: {
              leases: {
                with: {
                  tenant: true,
                }
              }
            }
          }
        }
      });

      // Extract unique tenants
      const tenantsMap = new Map();
      userProperties.forEach(property => {
        property.units.forEach(unit => {
          unit.leases.forEach(lease => {
            if (lease.tenant) {
              tenantsMap.set(lease.tenant.id, lease.tenant);
            }
          });
        });
      });

      const allTenants = Array.from(tenantsMap.values());
      return res.status(200).json(allTenants);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      return res.status(500).json({ message: 'Failed to fetch tenants' });
    }
  }

  if (req.method === 'POST') {
    try {
      const tenantData = insertTenantSchema.parse(req.body);

      const [tenant] = await db.insert(tenants)
        .values(tenantData)
        .returning();

      return res.status(201).json(tenant);
    } catch (error) {
      console.error('Error creating tenant:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      return res.status(500).json({ message: 'Failed to create tenant' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
});

// Consolidated handler for /api/tenants and /api/tenants/[id]
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { db } from '../_lib/db';
import { tenants, leases, units, properties, insertTenantSchema, updateTenantSchema } from '../../shared/schema';
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

  const { id } = req.query;

  // Handle /api/tenants/[id] - specific tenant operations
  if (id && typeof id === 'string') {
    // Verify tenant exists and user has access
    try {
      const existingTenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, id)
      });

      if (!existingTenant) {
        return res.status(404).json({ message: 'Tenant not found' });
      }

      // Verify authorization: Check if tenant belongs to landlord's property
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

      const hasAccess = tenantLeases.some(lease => 
        lease.unit?.property?.ownerId === auth.userId
      );

      if (!hasAccess && tenantLeases.length > 0) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error verifying tenant access:', errorMessage);
      return res.status(500).json({ message: 'Failed to verify tenant access' });
    }

    if (req.method === 'GET') {
      try {
        const tenant = await db.query.tenants.findFirst({
          where: eq(tenants.id, id)
        });

        if (!tenant) {
          return res.status(404).json({ message: 'Tenant not found' });
        }

        return res.status(200).json(tenant);
      } catch (error) {
        console.error('Error fetching tenant:', error);
        return res.status(500).json({ message: 'Failed to fetch tenant' });
      }
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
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: 'Invalid input', errors: error.errors });
        }
        return res.status(500).json({ message: 'Failed to update tenant' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Handle /api/tenants - list all or create new
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
}

// GET/POST /api/leases - List all leases or create new lease
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from './_lib/auth';
import { db } from './_lib/db';
import { leases, units, properties, tenants } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method === 'GET') {
    try {
      // Get all leases for landlord's properties
      const userProperties = await db.query.properties.findMany({
        where: eq(properties.ownerId, auth.userId),
        with: {
          units: {
            with: {
              leases: {
                with: {
                  tenant: true,
                  unit: true,
                }
              }
            }
          }
        }
      });

      // Flatten leases
      const allLeases: any[] = [];
      userProperties.forEach(property => {
        property.units.forEach(unit => {
          unit.leases.forEach(lease => {
            allLeases.push({
              ...lease,
              property: { id: property.id, name: property.name }
            });
          });
        });
      });

      return res.status(200).json(allLeases);
    } catch (error) {
      console.error('Error fetching leases:', error);
      return res.status(500).json({ message: 'Failed to fetch leases' });
    }
  }

  if (req.method === 'POST') {
    try {
      const leaseCreateSchema = z.object({
        tenantId: z.string().min(1, 'Tenant is required'),
        unitId: z.string().min(1, 'Unit is required'),
        startDate: z.string().or(z.date()),
        endDate: z.string().or(z.date()),
        rentAmount: z.string().min(1, 'Rent amount is required'),
        depositAmount: z.string().optional(),
        isActive: z.boolean().default(true),
      });

      const leaseData = leaseCreateSchema.parse(req.body);

      // Verify unit belongs to landlord
      const unit = await db.query.units.findFirst({
        where: eq(units.id, leaseData.unitId),
        with: {
          property: true,
        }
      });

      if (!unit) {
        return res.status(404).json({ message: 'Unit not found' });
      }

      if (unit.property.ownerId !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Verify tenant exists
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, leaseData.tenantId)
      });

      if (!tenant) {
        return res.status(404).json({ message: 'Tenant not found' });
      }

      const [lease] = await db.insert(leases)
        .values({
          ...leaseData,
          startDate: new Date(leaseData.startDate),
          endDate: new Date(leaseData.endDate),
        })
        .returning();

      return res.status(201).json(lease);
    } catch (error) {
      console.error('Error creating lease:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      return res.status(500).json({ message: 'Failed to create lease' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
});

// GET/POST /api/leases - List all leases or create new lease
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { db } from '../_lib/db';
import { leases, units, properties, tenants } from '../../shared/schema';
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
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        rentAmount: z.coerce.number().positive('Rent amount must be positive'),
        depositAmount: z.coerce.number().positive().optional(),
        isActive: z.boolean().default(true),
      }).refine((data) => data.startDate < data.endDate, {
        message: 'Start date must be before end date',
        path: ['endDate'],
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

      // Check for date conflicts with existing leases on the same unit
      const existingLeases = await db.query.leases.findMany({
        where: eq(leases.unitId, leaseData.unitId)
      });

      const newStartDate = new Date(leaseData.startDate);
      const newEndDate = new Date(leaseData.endDate);

      // Check for overlapping lease periods
      const hasConflict = existingLeases.some(existingLease => {
        const existingStart = new Date(existingLease.startDate);
        const existingEnd = new Date(existingLease.endDate);
        
        // Overlap occurs if: newStart <= existingEnd AND newEnd >= existingStart
        return newStartDate <= existingEnd && newEndDate >= existingStart;
      });

      if (hasConflict) {
        return res.status(409).json({ 
          message: 'Lease dates conflict with an existing lease for this unit',
          error: 'LEASE_DATE_CONFLICT'
        });
      }

      const [lease] = await db.insert(leases)
        .values({
          ...leaseData,
          startDate: newStartDate,
          endDate: newEndDate,
        })
        .returning();

      return res.status(201).json(lease);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error creating lease:', errorMessage);
      if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
        console.error('Stack trace:', error.stack);
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      return res.status(500).json({ message: 'Failed to create lease' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

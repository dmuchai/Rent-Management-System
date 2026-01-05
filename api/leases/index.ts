// GET/POST/PUT /api/leases - List all leases, create new lease, or update lease
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';
import { z } from 'zod';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const sql = createDbConnection();
  try {
    if (req.method === 'GET') {
      // Get all leases for landlord's properties with tenant and unit details
      const leases = await sql`
        SELECT 
          l.*,
          t.id as tenant_id, t.first_name, t.last_name, t.email as tenant_email, t.phone as tenant_phone,
          u.id as unit_id, u.unit_number, u.bedrooms, u.bathrooms, u.rent_amount as unit_rent,
          p.id as property_id, p.name as property_name
        FROM public.leases l
        INNER JOIN public.tenants t ON l.tenant_id = t.id
        INNER JOIN public.units u ON l.unit_id = u.id
        INNER JOIN public.properties p ON u.property_id = p.id
        WHERE p.owner_id = ${auth.userId}
        ORDER BY l.created_at DESC
      `;

      // Format the response to match expected structure
      const formattedLeases = leases.map((lease: any) => ({
        id: lease.id,
        tenantId: lease.tenant_id,
        unitId: lease.unit_id,
        startDate: lease.start_date,
        endDate: lease.end_date,
        monthlyRent: lease.monthly_rent,
        securityDeposit: lease.security_deposit,
        isActive: lease.is_active,
        createdAt: lease.created_at,
        tenant: {
          id: lease.tenant_id,
          firstName: lease.first_name,
          lastName: lease.last_name,
          email: lease.tenant_email,
          phone: lease.tenant_phone,
        },
        unit: {
          id: lease.unit_id,
          unitNumber: lease.unit_number,
          bedrooms: lease.bedrooms,
          bathrooms: lease.bathrooms,
          rentAmount: lease.unit_rent,
        },
        property: {
          id: lease.property_id,
          name: lease.property_name,
        }
      }));

      return res.status(200).json(formattedLeases);
    }

    if (req.method === 'POST') {
      const leaseCreateSchema = z.object({
        tenantId: z.string().min(1, 'Tenant is required'),
        unitId: z.string().min(1, 'Unit is required'),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        monthlyRent: z.coerce.number().positive('Monthly rent must be positive'),
        securityDeposit: z.coerce.number().positive().optional(),
        isActive: z.boolean().default(true),
      }).refine((data) => data.startDate < data.endDate, {
        message: 'Start date must be before end date',
        path: ['endDate'],
      });

      const leaseData = leaseCreateSchema.parse(req.body);

      // Verify unit belongs to landlord
      const units = await sql`
        SELECT u.*, p.owner_id
        FROM public.units u
        INNER JOIN public.properties p ON u.property_id = p.id
        WHERE u.id = ${leaseData.unitId}
      `;
      
      if (units.length === 0) {
        return res.status(404).json({ message: 'Unit not found' });
      }
      
      if (units[0].owner_id !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Verify tenant exists
      const tenants = await sql`
        SELECT * FROM public.tenants WHERE id = ${leaseData.tenantId}
      `;

      if (tenants.length === 0) {
        return res.status(404).json({ message: 'Tenant not found' });
      }
      
      // Check for date conflicts with existing leases on the same unit
      const existingLeases = await sql`
        SELECT * FROM public.leases 
        WHERE unit_id = ${leaseData.unitId}
        AND (start_date, end_date) OVERLAPS (${leaseData.startDate}, ${leaseData.endDate})
      `;
      
      if (existingLeases.length > 0) {
        return res.status(409).json({ 
          message: 'Lease dates conflict with an existing lease for this unit',
          error: 'LEASE_DATE_CONFLICT'
        });
      }
      
      const [lease] = await sql`
        INSERT INTO public.leases (tenant_id, unit_id, start_date, end_date, monthly_rent, security_deposit, is_active)
        VALUES (
          ${leaseData.tenantId},
          ${leaseData.unitId},
          ${leaseData.startDate},
          ${leaseData.endDate},
          ${leaseData.monthlyRent},
          ${leaseData.securityDeposit || null},
          ${leaseData.isActive}
        )
        RETURNING *
      `;

      return res.status(201).json(lease);
    }

    if (req.method === 'PUT') {
      const leaseUpdateSchema = z.object({
        id: z.string().min(1, 'Lease ID is required'),
        tenantId: z.string().min(1, 'Tenant is required'),
        unitId: z.string().min(1, 'Unit is required'),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        monthlyRent: z.coerce.number().positive('Monthly rent must be positive'),
        securityDeposit: z.coerce.number().positive().optional(),
        isActive: z.boolean().default(true),
      }).refine((data) => data.startDate < data.endDate, {
        message: 'Start date must be before end date',
        path: ['endDate'],
      });

      const leaseData = leaseUpdateSchema.parse(req.body);

      // Verify the lease exists and belongs to the landlord
      const existingLeases = await sql`
        SELECT l.*, u.property_id, p.owner_id
        FROM public.leases l
        INNER JOIN public.units u ON l.unit_id = u.id
        INNER JOIN public.properties p ON u.property_id = p.id
        WHERE l.id = ${leaseData.id}
      `;

      if (existingLeases.length === 0) {
        return res.status(404).json({ message: 'Lease not found' });
      }

      if (existingLeases[0].owner_id !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Verify unit belongs to landlord
      const units = await sql`
        SELECT u.*, p.owner_id
        FROM public.units u
        INNER JOIN public.properties p ON u.property_id = p.id
        WHERE u.id = ${leaseData.unitId}
      `;
      
      if (units.length === 0) {
        return res.status(404).json({ message: 'Unit not found' });
      }
      
      if (units[0].owner_id !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Verify tenant exists
      const tenants = await sql`
        SELECT * FROM public.tenants WHERE id = ${leaseData.tenantId}
      `;

      if (tenants.length === 0) {
        return res.status(404).json({ message: 'Tenant not found' });
      }
      
      // Check for date conflicts with other leases on the same unit (excluding current lease)
      const conflictingLeases = await sql`
        SELECT * FROM public.leases 
        WHERE unit_id = ${leaseData.unitId}
        AND id != ${leaseData.id}
        AND (start_date, end_date) OVERLAPS (${leaseData.startDate}, ${leaseData.endDate})
      `;
      
      if (conflictingLeases.length > 0) {
        return res.status(409).json({ 
          message: 'Lease dates conflict with an existing lease for this unit',
          error: 'LEASE_DATE_CONFLICT'
        });
      }
      
      const [updatedLease] = await sql`
        UPDATE public.leases
        SET 
          tenant_id = ${leaseData.tenantId},
          unit_id = ${leaseData.unitId},
          start_date = ${leaseData.startDate},
          end_date = ${leaseData.endDate},
          monthly_rent = ${leaseData.monthlyRent},
          security_deposit = ${leaseData.securityDeposit || null},
          is_active = ${leaseData.isActive},
          updated_at = NOW()
        WHERE id = ${leaseData.id}
        RETURNING *
      `;

      // Transform response to camelCase
      const transformedLease = {
        id: updatedLease.id,
        tenantId: updatedLease.tenant_id,
        unitId: updatedLease.unit_id,
        startDate: updatedLease.start_date,
        endDate: updatedLease.end_date,
        monthlyRent: updatedLease.monthly_rent,
        securityDeposit: updatedLease.security_deposit,
        isActive: updatedLease.is_active,
        createdAt: updatedLease.created_at,
        updatedAt: updatedLease.updated_at
      };

      return res.status(200).json(transformedLease);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Invalid input', errors: error.errors });
    } else {
      res.status(500).json({ message: 'Failed to process request' });
    }
  } finally {
    await sql.end();
  }
});

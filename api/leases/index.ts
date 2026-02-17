import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';
import { z } from 'zod';

// Consolidated handler for Leases
// Route: /api/leases/[[...route]]
// Matches: /api/leases, /api/leases/123

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
    const routeParam = (req.query.id ?? req.query.route) as string | string[] | undefined;
    const routeParts = Array.isArray(routeParam) ? routeParam : (routeParam ? [routeParam] : []);
    const leaseId = routeParts[0] || null;
    const action = routeParts[1] || (typeof req.query.action === 'string' ? req.query.action : null);

    const sql = createDbConnection();

    try {
        // --- LIST / CREATE (No ID) ---
        if (!leaseId) {
            if (req.method === 'GET') {
                return await handleListLeases(req, res, auth, sql);
            }
            if (req.method === 'POST') {
                return await handleCreateLease(req, res, auth, sql);
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // --- GET / UPDATE / DELETE (With ID) ---
        if (req.method === 'POST' && action) {
            if (action === 'landlord-sign') {
                return await handleLandlordSign(req, res, auth, sql, leaseId);
            }
            if (action === 'tenant-sign') {
                return await handleTenantSign(req, res, auth, sql, leaseId);
            }
            return res.status(400).json({ message: 'Invalid lease action' });
        }
        if (req.method === 'DELETE') {
            return await handleDeleteLease(req, res, auth, sql, leaseId);
        }
        if (req.method === 'PUT') {
            return await handleUpdateLease(req, res, auth, sql, leaseId);
        }
        if (req.method === 'GET') {
            return await handleGetLease(req, res, auth, sql, leaseId);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error: any) {
        console.error('Leases API Error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        return res.status(500).json({ message: "Internal server error", error: error.message || String(error) });
    } finally {
        await sql.end();
    }
});

// --- Implementation Functions ---

async function handleListLeases(req: VercelRequest, res: VercelResponse, auth: any, sql: any) {
    // Auto-expire leases
    await sql`
    UPDATE public.leases l
    SET is_active = false, status = 'expired', updated_at = NOW()
    FROM public.units u
    INNER JOIN public.properties p ON u.property_id = p.id
    WHERE l.unit_id = u.id
    AND (p.owner_id = ${auth.userId} OR l.tenant_id IN (
      SELECT id FROM public.tenants WHERE user_id = ${auth.userId}
    ))
    AND l.is_active = true
    AND l.end_date < NOW()
  `;

        const isCaretaker = auth.role === 'caretaker';

        const leases = await sql`
    SELECT 
      l.*,
      t.id as tenant_id, t.first_name, t.last_name, t.email as tenant_email, t.phone as tenant_phone,
      u.id as unit_id, u.unit_number, u.bedrooms, u.bathrooms, u.rent_amount as unit_rent,
      p.id as property_id, p.name as property_name, p.address as property_address, p.property_type, p.image_url as property_image, p.owner_id
    FROM public.leases l
    INNER JOIN public.tenants t ON l.tenant_id = t.id
    INNER JOIN public.units u ON l.unit_id = u.id
    INNER JOIN public.properties p ON u.property_id = p.id
        WHERE (
            p.owner_id = ${auth.userId}
            OR t.user_id = ${auth.userId}
            OR (${isCaretaker} AND EXISTS (
                SELECT 1
                FROM public.caretaker_assignments ca
                WHERE ca.property_id = p.id
                AND ca.caretaker_id = ${auth.userId}
                AND ca.status = 'active'
            ))
        )
    ORDER BY l.created_at DESC
  `;

    // Format response (simplified for brevity, matching previous logic)
    const formattedLeases = leases.map((lease: any) => ({
        id: lease.id,
        tenantId: lease.tenant_id,
        unitId: lease.unit_id,
        ownerId: lease.owner_id,
        startDate: lease.start_date,
        endDate: lease.end_date,
        monthlyRent: lease.monthly_rent,
        securityDeposit: lease.security_deposit,
        status: lease.status,
        landlordSignedAt: lease.landlord_signed_at,
        tenantSignedAt: lease.tenant_signed_at,
        landlordSignedBy: lease.landlord_signed_by,
        tenantSignedBy: lease.tenant_signed_by,
        createdBy: lease.created_by,
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
            property: {
                id: lease.property_id,
                name: lease.property_name,
                address: lease.property_address,
                propertyType: lease.property_type,
                imageUrl: lease.property_image,
            }
        },
        property: {
            id: lease.property_id,
            name: lease.property_name,
            address: lease.property_address,
            propertyType: lease.property_type,
            imageUrl: lease.property_image,
        }
    }));

    return res.json(formattedLeases);
}

async function handleCreateLease(req: VercelRequest, res: VercelResponse, auth: any, sql: any) {
    const leaseCreateSchema = z.object({
        tenantId: z.string().min(1, 'Tenant is required'),
        unitId: z.string().min(1, 'Unit is required'),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        monthlyRent: z.coerce.number().positive('Monthly rent must be positive'),
        securityDeposit: z.coerce.number().positive().optional(),
    }).refine((data) => data.startDate < data.endDate, {
        message: 'Start date must be before end date',
        path: ['endDate'],
    });

    const leaseData = leaseCreateSchema.parse(req.body);

    if (auth.role === 'tenant') {
        return res.status(403).json({ message: 'Tenants cannot create leases' });
    }

    // Verify unit
    const units = await sql`SELECT u.*, p.owner_id FROM public.units u JOIN public.properties p ON u.property_id = p.id WHERE u.id = ${leaseData.unitId}`;
    if (!units.length) return res.status(404).json({ message: 'Unit not found' });
    if (auth.role !== 'caretaker' && units[0].owner_id !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
    }

    if (auth.role === 'caretaker') {
        const assignment = await sql`
          SELECT id FROM public.caretaker_assignments
          WHERE caretaker_id = ${auth.userId}
          AND property_id = ${units[0].property_id}
          AND status = 'active'
          LIMIT 1
        `;

        if (!assignment.length) {
            return res.status(403).json({ message: 'Caretaker not assigned to this property' });
        }
    }

    // Verify tenant
    const tenants = await sql`SELECT * FROM public.tenants WHERE id = ${leaseData.tenantId}`;
    if (!tenants.length) return res.status(404).json({ message: 'Tenant not found' });
    if (tenants[0].landlord_id && tenants[0].landlord_id !== units[0].owner_id) {
        return res.status(403).json({ message: 'Tenant does not belong to this landlord' });
    }

    // Check conflicts
    const conflict = await sql`
        SELECT * FROM public.leases 
        WHERE unit_id = ${leaseData.unitId}
        AND (start_date, end_date) OVERLAPS (${leaseData.startDate}, ${leaseData.endDate})
    `;
    if (conflict.length > 0) return res.status(409).json({ message: 'Lease dates conflict', error: 'LEASE_DATE_CONFLICT' });

    const isCaretaker = auth.role === 'caretaker';
    const status = isCaretaker ? 'pending_landlord_signature' : 'pending_tenant_signature';
    const landlordSignedAt = isCaretaker ? null : new Date();
    const landlordSignedBy = isCaretaker ? null : auth.userId;

    const [lease] = await sql`
        INSERT INTO public.leases (
            tenant_id, unit_id, start_date, end_date, monthly_rent, security_deposit,
            status, landlord_signed_at, landlord_signed_by, created_by, is_active
        ) VALUES (
            ${leaseData.tenantId}, ${leaseData.unitId}, ${leaseData.startDate}, ${leaseData.endDate},
            ${leaseData.monthlyRent}, ${leaseData.securityDeposit || null},
            ${status}, ${landlordSignedAt}, ${landlordSignedBy}, ${auth.userId}, false
        ) RETURNING *
    `;

    return res.status(201).json(lease);
}

async function handleDeleteLease(req: VercelRequest, res: VercelResponse, auth: any, sql: any, leaseId: string) {
    // Transaction for delete safely
    await sql.begin(async (tx: any) => {
        const [lease] = await tx`
            SELECT l.id FROM public.leases l
            JOIN public.units u ON l.unit_id = u.id
            JOIN public.properties p ON u.property_id = p.id
            WHERE l.id = ${leaseId} AND p.owner_id = ${auth.userId}
            FOR UPDATE
        `;
        if (!lease) throw new Error('LEASE_NOT_FOUND');

        const [payment] = await tx`SELECT id FROM public.payments WHERE lease_id = ${leaseId} LIMIT 1`;
        if (payment) throw new Error('LEASE_HAS_PAYMENTS');

        await tx`DELETE FROM public.leases WHERE id = ${leaseId}`;
    });

    return res.status(200).json({ message: 'Lease deleted successfully', id: leaseId });
}

async function handleUpdateLease(req: VercelRequest, res: VercelResponse, auth: any, sql: any, leaseId: string) {
    const leaseUpdateSchema = z.object({
        tenantId: z.string().min(1, 'Tenant is required'),
        unitId: z.string().min(1, 'Unit is required'),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        monthlyRent: z.coerce.number().positive(),
        securityDeposit: z.coerce.number().positive().optional(),
        isActive: z.boolean().default(true),
    });

    const leaseData = leaseUpdateSchema.parse(req.body);

    const existing = await sql`
        SELECT l.*, p.owner_id FROM public.leases l
        JOIN public.units u ON l.unit_id = u.id
        JOIN public.properties p ON u.property_id = p.id
        WHERE l.id = ${leaseId}
    `;
    if (!existing.length) return res.status(404).json({ message: 'Lease not found' });
    if (existing[0].owner_id !== auth.userId) return res.status(403).json({ message: 'Access denied' });

    // Check conflicts excluding self
    const conflict = await sql`
        SELECT * FROM public.leases 
        WHERE unit_id = ${leaseData.unitId} AND id != ${leaseId}
        AND (start_date, end_date) OVERLAPS (${leaseData.startDate}, ${leaseData.endDate})
    `;
    if (conflict.length > 0) return res.status(409).json({ message: 'Lease dates conflict', error: 'LEASE_DATE_CONFLICT' });

    const [updated] = await sql`
        UPDATE public.leases SET 
            tenant_id = ${leaseData.tenantId}, unit_id = ${leaseData.unitId},
            start_date = ${leaseData.startDate}, end_date = ${leaseData.endDate},
            monthly_rent = ${leaseData.monthlyRent}, security_deposit = ${leaseData.securityDeposit || null},
            is_active = ${leaseData.isActive}, updated_at = NOW()
        WHERE id = ${leaseId}
        RETURNING *
    `;

    // Update unit occupancy (simplified logic: check if any active lease exists now)
    await sql`
        UPDATE public.units u SET is_occupied = EXISTS(
            SELECT 1 FROM public.leases l WHERE l.unit_id = u.id AND l.is_active = true
        ) WHERE u.id = ${leaseData.unitId}
    `;

    // Return camelCase logic ... (simplified for brevity)
    return res.json(updated);
}

async function handleGetLease(req: VercelRequest, res: VercelResponse, auth: any, sql: any, leaseId: string) {
    const [lease] = await sql`
        SELECT l.*, p.owner_id 
        FROM public.leases l
        JOIN public.units u ON l.unit_id = u.id
        JOIN public.properties p ON u.property_id = p.id
        WHERE l.id = ${leaseId}
    `;

    if (!lease) return res.status(404).json({ message: 'Lease not found' });

    // Check ownership or tenant ownership
    if (lease.owner_id !== auth.userId) {
        // Check if it's the tenant's lease
        const [tenantRef] = await sql`SELECT user_id FROM public.tenants WHERE id = ${lease.tenant_id}`;
        if (!tenantRef || tenantRef.user_id !== auth.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }
    }

    return res.json(lease);
}

async function handleLandlordSign(req: VercelRequest, res: VercelResponse, auth: any, sql: any, leaseId: string) {
    if (auth.role !== 'landlord') {
        return res.status(403).json({ message: 'Only landlords can sign leases' });
    }

    const [lease] = await sql`
        SELECT l.id, l.status, l.unit_id, p.owner_id
        FROM public.leases l
        JOIN public.units u ON l.unit_id = u.id
        JOIN public.properties p ON u.property_id = p.id
        WHERE l.id = ${leaseId}
    `;

    if (!lease) {
        return res.status(404).json({ message: 'Lease not found' });
    }

    if (lease.owner_id !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
    }

    if (lease.status !== 'pending_landlord_signature') {
        return res.status(400).json({ message: 'Lease is not awaiting landlord signature' });
    }

    const [updated] = await sql`
        UPDATE public.leases
        SET status = 'pending_tenant_signature',
            landlord_signed_at = NOW(),
            landlord_signed_by = ${auth.userId},
            updated_at = NOW()
        WHERE id = ${leaseId}
        RETURNING *
    `;

    return res.json(updated);
}

async function handleTenantSign(req: VercelRequest, res: VercelResponse, auth: any, sql: any, leaseId: string) {
    if (auth.role !== 'tenant') {
        return res.status(403).json({ message: 'Only tenants can sign leases' });
    }

    const [tenant] = await sql`SELECT id FROM public.tenants WHERE user_id = ${auth.userId}`;
    if (!tenant) {
        return res.status(404).json({ message: 'Tenant profile not found' });
    }

    const [lease] = await sql`
        SELECT id, status, unit_id, tenant_id FROM public.leases WHERE id = ${leaseId}
    `;

    if (!lease) {
        return res.status(404).json({ message: 'Lease not found' });
    }

    if (lease.tenant_id !== tenant.id) {
        return res.status(403).json({ message: 'Access denied' });
    }

    if (lease.status !== 'pending_tenant_signature') {
        return res.status(400).json({ message: 'Lease is not awaiting tenant signature' });
    }

    const [updated] = await sql`
        UPDATE public.leases
        SET status = 'active',
            tenant_signed_at = NOW(),
            tenant_signed_by = ${auth.userId},
            is_active = true,
            updated_at = NOW()
        WHERE id = ${leaseId}
        RETURNING *
    `;

    await sql`
        UPDATE public.units
        SET is_occupied = true, updated_at = NOW()
        WHERE id = ${lease.unit_id}
    `;

    return res.json(updated);
}

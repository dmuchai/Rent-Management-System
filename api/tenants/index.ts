import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';
import { insertTenantSchema } from '../../shared/schema.js';
import { z } from 'zod';
import crypto from 'crypto';
import { emailService } from '../_lib/emailService.js';

// Consolidated handler for Tenants
// Route: /api/tenants/[[...route]]

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
    const routeParam = (req.query.id ?? req.query.route) as string | string[] | undefined;
    const routeParts = Array.isArray(routeParam) ? routeParam : (routeParam ? [routeParam] : []);
    const tenantId = routeParts[0] || null;
    const action = routeParts[1] || (typeof req.query.action === 'string' ? req.query.action : null);

    const sql = createDbConnection();

    try {
        // --- LIST / CREATE (No ID) ---
        if (!tenantId) {
            if (req.method === 'GET') {
                return await handleListTenants(req, res, auth, sql);
            }
            if (req.method === 'POST') {
                return await handleCreateTenant(req, res, auth, sql);
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // --- ACTIONS / DELETE / GET / UPDATE (With ID) ---
        if (action && (req.method === 'POST' || req.method === 'PUT')) {
            if (action === 'approve') {
                return await handleApproveTenant(req, res, auth, sql, tenantId);
            }
            if (action === 'reject') {
                return await handleRejectTenant(req, res, auth, sql, tenantId);
            }
            if (action === 'assign') {
                return await handleAssignTenant(req, res, auth, sql, tenantId);
            }
            return res.status(400).json({ message: 'Invalid tenant action' });
        }

        // --- DELETE / GET / UPDATE (With ID) ---
        if (req.method === 'DELETE') {
            return await handleDeleteTenant(req, res, auth, sql, tenantId);
        }
        // Implement GET single tenant if needed
        if (req.method === 'GET') {
            return await handleGetTenant(req, res, auth, sql, tenantId);
        }
        // Implement PUT if needed (not in original files but good practice)
        if (req.method === 'PUT') {
            return await handleUpdateTenant(req, res, auth, sql, tenantId);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error: any) {
        console.error('Tenants API Error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: 'Invalid input', errors: error.errors });
        }
        return res.status(500).json({ message: "Internal server error", error: error.message || String(error) });
    } finally {
        await sql.end();
    }
});

// --- Implementation Functions ---

async function handleListTenants(req: VercelRequest, res: VercelResponse, auth: any, sql: any) {
        const isCaretaker = auth.role === 'caretaker';

        const tenants = await sql`
        SELECT DISTINCT
            t.id,
            t.landlord_id as "landlordId",
            t.user_id as "userId",
            t.first_name as "firstName",
            t.last_name as "lastName",
            t.email,
            t.phone,
            t.emergency_contact as "emergencyContact",
            t.invitation_sent_at as "invitationSentAt",
            t.invitation_accepted_at as "invitationAcceptedAt",
            t.account_status as "accountStatus",
            t.approval_status as "approvalStatus",
            t.approved_by as "approvedBy",
            t.approved_at as "approvedAt",
            t.assigned_unit_id as "assignedUnitId",
            t.assigned_start_date as "assignedStartDate",
            t.assigned_end_date as "assignedEndDate",
            t.assigned_monthly_rent as "assignedMonthlyRent",
            t.assigned_security_deposit as "assignedSecurityDeposit",
            t.assigned_at as "assignedAt",
            t.assigned_by as "assignedBy",
            t.created_at as "createdAt",
            t.updated_at as "updatedAt"
        FROM public.tenants t
        LEFT JOIN public.leases l ON t.id = l.tenant_id
        LEFT JOIN public.units u ON l.unit_id = u.id
        LEFT JOIN public.properties p ON u.property_id = p.id
        LEFT JOIN public.units u_assigned ON t.assigned_unit_id = u_assigned.id
        LEFT JOIN public.properties p_assigned ON u_assigned.property_id = p_assigned.id
        WHERE (
            t.landlord_id = ${auth.userId}
            OR p.owner_id = ${auth.userId}
            OR (
                ${isCaretaker} AND EXISTS (
                    SELECT 1
                    FROM public.caretaker_assignments ca
                    WHERE ca.caretaker_id = ${auth.userId}
                        AND ca.status = 'active'
                        AND (
                            (ca.property_id IS NOT NULL AND (ca.property_id = p.id OR ca.property_id = p_assigned.id))
                            OR (ca.unit_id IS NOT NULL AND (ca.unit_id = u.id OR ca.unit_id = t.assigned_unit_id))
                        )
                )
            )
        )
        ORDER BY t.created_at DESC
    `;

    return res.status(200).json(tenants);
}

async function handleCreateTenant(req: VercelRequest, res: VercelResponse, auth: any, sql: any) {
        const isCaretaker = auth.role === 'caretaker';

        const caretakerTenantSchema = insertTenantSchema.extend({
            propertyId: z.string().min(1, 'Property is required'),
        });

        const tenantData = isCaretaker
            ? caretakerTenantSchema.parse(req.body)
            : insertTenantSchema.parse(req.body);

    // Check if a user with this email already exists with a different role
    // We handle this via raw SQL since we already have the connection
    const [existingUser] = await sql`
      SELECT id, role FROM public.users WHERE email = ${tenantData.email}
    `;

    if (existingUser && existingUser.role !== 'tenant') {
        return res.status(400).json({
            message: `The user with email ${tenantData.email} is already registered as a ${existingUser.role}. A single account cannot have multiple roles.`
        });
    }

        const invitationToken = crypto.randomBytes(32).toString('hex');

        let landlordId = auth.userId;
        let propertyName: string | undefined;

        if (isCaretaker) {
                const [property] = await sql`
                    SELECT id, owner_id, name
                    FROM public.properties
                    WHERE id = ${tenantData.propertyId}
                `;

                if (!property) {
                        return res.status(404).json({ message: 'Property not found' });
                }

                const [assignment] = await sql`
                    SELECT id FROM public.caretaker_assignments
                    WHERE caretaker_id = ${auth.userId}
                        AND property_id = ${property.id}
                        AND status = 'active'
                `;

                if (!assignment) {
                        return res.status(403).json({ message: 'Caretaker not assigned to this property' });
                }

                landlordId = property.owner_id;
                propertyName = property.name;
        }

        const [tenant] = await sql`
      INSERT INTO public.tenants (
        landlord_id, user_id, first_name, last_name, email, phone, 
        emergency_contact, invitation_token, account_status
      ) VALUES (
                ${landlordId}, NULL, ${tenantData.firstName}, ${tenantData.lastName}, 
        ${tenantData.email}, ${tenantData.phone}, ${tenantData.emergencyContact || null},
        ${invitationToken}, 'pending_invitation'
      ) RETURNING *
    `;

    const [landlord] = await sql`SELECT first_name, last_name FROM public.users WHERE id = ${landlordId}`;

    try {
        await emailService.sendTenantInvitation(
            tenant.email,
            `${tenant.first_name} ${tenant.last_name}`,
            invitationToken,
            propertyName,
            undefined,
            landlord ? `${landlord.first_name} ${landlord.last_name}` : undefined
        );

        const [updatedTenant] = await sql`
          UPDATE public.tenants
          SET invitation_sent_at = NOW(), account_status = 'invited'
          WHERE id = ${tenant.id}
          RETURNING 
            id, landlord_id as "landlordId", user_id as "userId", 
            first_name as "firstName", last_name as "lastName", email, phone, 
            emergency_contact as "emergencyContact", invitation_sent_at as "invitationSentAt", 
            invitation_accepted_at as "invitationAcceptedAt", account_status as "accountStatus", 
            approval_status as "approvalStatus", approved_by as "approvedBy", approved_at as "approvedAt",
            assigned_unit_id as "assignedUnitId", assigned_start_date as "assignedStartDate",
            assigned_end_date as "assignedEndDate", assigned_monthly_rent as "assignedMonthlyRent",
            assigned_security_deposit as "assignedSecurityDeposit", assigned_at as "assignedAt",
            assigned_by as "assignedBy", created_at as "createdAt", updated_at as "updatedAt"
        `;
        return res.status(201).json(updatedTenant);
    } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
        const sanitizedTenant = {
            id: tenant.id, landlordId: auth.userId, userId: null,
            firstName: tenant.first_name, lastName: tenant.last_name, email: tenant.email,
            phone: tenant.phone, emergencyContact: tenant.emergency_contact,
            invitationSentAt: tenant.invitation_sent_at, invitationAcceptedAt: tenant.invitation_accepted_at,
            accountStatus: tenant.account_status, approvalStatus: tenant.approval_status, approvedBy: tenant.approved_by,
            approvedAt: tenant.approved_at, assignedUnitId: tenant.assigned_unit_id,
            assignedStartDate: tenant.assigned_start_date, assignedEndDate: tenant.assigned_end_date,
            assignedMonthlyRent: tenant.assigned_monthly_rent, assignedSecurityDeposit: tenant.assigned_security_deposit,
            assignedAt: tenant.assigned_at, assignedBy: tenant.assigned_by,
            createdAt: tenant.created_at, updatedAt: tenant.updated_at
        };
        return res.status(201).json(sanitizedTenant);
    }
}

async function handleDeleteTenant(req: VercelRequest, res: VercelResponse, auth: any, sql: any, tenantId: string) {
    await sql.begin(async (tx: any) => {
        const [tenant] = await tx`
            SELECT DISTINCT t.id FROM public.tenants t
            LEFT JOIN public.leases l ON t.id = l.tenant_id
            LEFT JOIN public.units u ON l.unit_id = u.id
            LEFT JOIN public.properties p ON u.property_id = p.id
            WHERE t.id = ${tenantId} AND (p.owner_id = ${auth.userId} OR t.landlord_id = ${auth.userId})
        `;
        if (!tenant) throw new Error('TENANT_NOT_FOUND');

        // Lock
        await tx`SELECT id FROM public.tenants WHERE id = ${tenantId} FOR UPDATE`;

        const [activeLease] = await tx`SELECT id FROM public.leases WHERE tenant_id = ${tenantId} AND is_active = true LIMIT 1`;
        if (activeLease) throw new Error('ACTIVE_LEASE_EXISTS');

        await tx`DELETE FROM public.tenants WHERE id = ${tenantId} AND landlord_id = ${auth.userId}`;
    });

    return res.status(200).json({ message: 'Tenant deleted successfully', id: tenantId });
}

async function handleGetTenant(req: VercelRequest, res: VercelResponse, auth: any, sql: any, tenantId: string) {
    const [tenant] = await sql`
        SELECT 
           t.id, t.landlord_id as "landlordId", t.user_id as "userId",
           t.first_name as "firstName", t.last_name as "lastName",
           t.email, t.phone, t.emergency_contact as "emergencyContact",
           t.account_status as "accountStatus",
           t.approval_status as "approvalStatus",
           t.approved_by as "approvedBy",
           t.approved_at as "approvedAt",
           t.assigned_unit_id as "assignedUnitId",
           t.assigned_start_date as "assignedStartDate",
           t.assigned_end_date as "assignedEndDate",
           t.assigned_monthly_rent as "assignedMonthlyRent",
           t.assigned_security_deposit as "assignedSecurityDeposit",
           t.assigned_at as "assignedAt",
           t.assigned_by as "assignedBy"
        FROM public.tenants t
        WHERE t.id = ${tenantId} AND (t.landlord_id = ${auth.userId} OR t.user_id = ${auth.userId})
     `;
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
    return res.json(tenant);
}

async function handleUpdateTenant(req: VercelRequest, res: VercelResponse, auth: any, sql: any, tenantId: string) {
    const tenantUpdateSchema = insertTenantSchema.partial();
    const tenantData = tenantUpdateSchema.parse(req.body);

    const [updated] = await sql`
        UPDATE public.tenants
        SET 
           first_name = ${tenantData.firstName}, last_name = ${tenantData.lastName},
           email = ${tenantData.email}, phone = ${tenantData.phone},
           emergency_contact = ${tenantData.emergencyContact || null},
           updated_at = NOW()
        WHERE id = ${tenantId} AND landlord_id = ${auth.userId}
        RETURNING 
            id, landlord_id as "landlordId", user_id as "userId",
            first_name as "firstName", last_name as "lastName",
            email, phone, emergency_contact as "emergencyContact",
                account_status as "accountStatus", approval_status as "approvalStatus", approved_by as "approvedBy",
                approved_at as "approvedAt", assigned_unit_id as "assignedUnitId",
                assigned_start_date as "assignedStartDate", assigned_end_date as "assignedEndDate",
                assigned_monthly_rent as "assignedMonthlyRent", assigned_security_deposit as "assignedSecurityDeposit",
                assigned_at as "assignedAt", assigned_by as "assignedBy", created_at as "createdAt", updated_at as "updatedAt"
    `;

    if (!updated) return res.status(404).json({ message: 'Tenant not found' });
    return res.json(updated);
}

async function handleApproveTenant(req: VercelRequest, res: VercelResponse, auth: any, sql: any, tenantId: string) {
    if (auth.role !== 'landlord' && auth.role !== 'property_manager') {
        return res.status(403).json({ message: 'Only landlords can approve tenants' });
    }

    const [tenant] = await sql`
        SELECT id, landlord_id FROM public.tenants WHERE id = ${tenantId}
    `;

    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
    if (tenant.landlord_id !== auth.userId) return res.status(403).json({ message: 'Unauthorized' });

    const [updated] = await sql`
        UPDATE public.tenants
        SET approval_status = 'approved',
            approved_by = ${auth.userId},
            approved_at = NOW(),
            updated_at = NOW()
        WHERE id = ${tenantId}
        RETURNING
          id, landlord_id as "landlordId", user_id as "userId",
          first_name as "firstName", last_name as "lastName",
          email, phone, emergency_contact as "emergencyContact",
          account_status as "accountStatus", approval_status as "approvalStatus",
          approved_by as "approvedBy", approved_at as "approvedAt",
          assigned_unit_id as "assignedUnitId", assigned_start_date as "assignedStartDate",
          assigned_end_date as "assignedEndDate", assigned_monthly_rent as "assignedMonthlyRent",
          assigned_security_deposit as "assignedSecurityDeposit", assigned_at as "assignedAt",
          assigned_by as "assignedBy", created_at as "createdAt", updated_at as "updatedAt"
    `;

    const autoLease = await tryAutoCreateLeaseForTenant(sql, tenantId, auth.userId, auth.userId);

    return res.json({
        tenant: updated,
        leaseCreated: !!autoLease.lease,
        lease: autoLease.lease,
        leaseReason: autoLease.reason,
    });
}

async function handleRejectTenant(req: VercelRequest, res: VercelResponse, auth: any, sql: any, tenantId: string) {
    if (auth.role !== 'landlord' && auth.role !== 'property_manager') {
        return res.status(403).json({ message: 'Only landlords can reject tenants' });
    }

    const [tenant] = await sql`
        SELECT id, landlord_id FROM public.tenants WHERE id = ${tenantId}
    `;

    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
    if (tenant.landlord_id !== auth.userId) return res.status(403).json({ message: 'Unauthorized' });

    const [updated] = await sql`
        UPDATE public.tenants
        SET approval_status = 'rejected',
            approved_by = ${auth.userId},
            approved_at = NOW(),
            updated_at = NOW()
        WHERE id = ${tenantId}
        RETURNING
          id, landlord_id as "landlordId", user_id as "userId",
          first_name as "firstName", last_name as "lastName",
          email, phone, emergency_contact as "emergencyContact",
          account_status as "accountStatus", approval_status as "approvalStatus",
          approved_by as "approvedBy", approved_at as "approvedAt",
          assigned_unit_id as "assignedUnitId", assigned_start_date as "assignedStartDate",
          assigned_end_date as "assignedEndDate", assigned_monthly_rent as "assignedMonthlyRent",
          assigned_security_deposit as "assignedSecurityDeposit", assigned_at as "assignedAt",
          assigned_by as "assignedBy", created_at as "createdAt", updated_at as "updatedAt"
    `;

    return res.json({ tenant: updated });
}

async function handleAssignTenant(req: VercelRequest, res: VercelResponse, auth: any, sql: any, tenantId: string) {
    if (auth.role !== 'landlord' && auth.role !== 'property_manager') {
        return res.status(403).json({ message: 'Only landlords can assign units' });
    }

    const assignSchema = z.object({
        unitId: z.string().min(1, 'Unit is required'),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        monthlyRent: z.coerce.number().positive().optional(),
        securityDeposit: z.coerce.number().positive().optional(),
    }).refine((data) => data.startDate < data.endDate, {
        message: 'Start date must be before end date',
        path: ['endDate'],
    });

    const assignment = assignSchema.parse(req.body);

    const [tenant] = await sql`SELECT id, landlord_id FROM public.tenants WHERE id = ${tenantId}`;
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
    if (tenant.landlord_id !== auth.userId) return res.status(403).json({ message: 'Unauthorized' });

    const [unit] = await sql`
        SELECT u.id, u.rent_amount, p.owner_id
        FROM public.units u
        JOIN public.properties p ON u.property_id = p.id
        WHERE u.id = ${assignment.unitId}
    `;

    if (!unit) return res.status(404).json({ message: 'Unit not found' });
    if (unit.owner_id !== auth.userId) return res.status(403).json({ message: 'Unauthorized' });

    const conflicts = await sql`
        SELECT id FROM public.leases
        WHERE unit_id = ${assignment.unitId}
          AND status IN ('pending_landlord_signature', 'pending_tenant_signature', 'active')
          AND (start_date, end_date) OVERLAPS (${assignment.startDate}, ${assignment.endDate})
        LIMIT 1
    `;

    if (conflicts.length > 0) {
        return res.status(409).json({ message: 'Unit has a conflicting lease' });
    }

    const monthlyRent = assignment.monthlyRent ?? unit.rent_amount ?? 0;

    const [updated] = await sql`
        UPDATE public.tenants
        SET assigned_unit_id = ${assignment.unitId},
            assigned_start_date = ${assignment.startDate},
            assigned_end_date = ${assignment.endDate},
            assigned_monthly_rent = ${monthlyRent},
            assigned_security_deposit = ${assignment.securityDeposit || null},
            assigned_at = NOW(),
            assigned_by = ${auth.userId},
            updated_at = NOW()
        WHERE id = ${tenantId}
        RETURNING
          id, landlord_id as "landlordId", user_id as "userId",
          first_name as "firstName", last_name as "lastName",
          email, phone, emergency_contact as "emergencyContact",
          account_status as "accountStatus", approval_status as "approvalStatus",
          approved_by as "approvedBy", approved_at as "approvedAt",
          assigned_unit_id as "assignedUnitId", assigned_start_date as "assignedStartDate",
          assigned_end_date as "assignedEndDate", assigned_monthly_rent as "assignedMonthlyRent",
          assigned_security_deposit as "assignedSecurityDeposit", assigned_at as "assignedAt",
          assigned_by as "assignedBy", created_at as "createdAt", updated_at as "updatedAt"
    `;

    const autoLease = await tryAutoCreateLeaseForTenant(sql, tenantId, auth.userId, auth.userId);

    return res.json({
        tenant: updated,
        leaseCreated: !!autoLease.lease,
        lease: autoLease.lease,
        leaseReason: autoLease.reason,
    });
}

async function tryAutoCreateLeaseForTenant(sql: any, tenantId: string, landlordId: string, actorId: string) {
    const [tenant] = await sql`
        SELECT id, landlord_id, approval_status, assigned_unit_id,
               assigned_start_date, assigned_end_date, assigned_monthly_rent, assigned_security_deposit
        FROM public.tenants
        WHERE id = ${tenantId}
    `;

    if (!tenant) return { lease: null, reason: 'tenant_not_found' };
    if (tenant.landlord_id !== landlordId) return { lease: null, reason: 'unauthorized' };
    if (tenant.approval_status !== 'approved') return { lease: null, reason: 'not_approved' };
    if (!tenant.assigned_unit_id || !tenant.assigned_start_date || !tenant.assigned_end_date || !tenant.assigned_monthly_rent) {
        return { lease: null, reason: 'missing_assignment' };
    }

    const existingTenantLease = await sql`
        SELECT id FROM public.leases
        WHERE tenant_id = ${tenantId}
          AND status IN ('pending_landlord_signature', 'pending_tenant_signature', 'active')
        LIMIT 1
    `;

    if (existingTenantLease.length > 0) return { lease: null, reason: 'tenant_has_lease' };

    const existingUnitLease = await sql`
        SELECT id FROM public.leases
        WHERE unit_id = ${tenant.assigned_unit_id}
          AND status IN ('pending_landlord_signature', 'pending_tenant_signature', 'active')
        LIMIT 1
    `;

    if (existingUnitLease.length > 0) return { lease: null, reason: 'unit_occupied' };

    const [lease] = await sql`
        INSERT INTO public.leases (
            tenant_id, unit_id, start_date, end_date, monthly_rent, security_deposit,
            status, landlord_signed_at, landlord_signed_by, created_by, is_active
        ) VALUES (
            ${tenantId}, ${tenant.assigned_unit_id}, ${tenant.assigned_start_date}, ${tenant.assigned_end_date},
            ${tenant.assigned_monthly_rent}, ${tenant.assigned_security_deposit || null},
            'pending_tenant_signature', NOW(), ${landlordId}, ${actorId}, false
        ) RETURNING *
    `;

    return { lease, reason: null };
}

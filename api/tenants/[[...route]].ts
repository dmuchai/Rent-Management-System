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
    const { route } = req.query;
    const id = Array.isArray(route) && route.length > 0 ? route[0] : null;

    console.log(`Tenants Handler: Method=${req.method}, ID=${id}`);

    const sql = createDbConnection();

    try {
        // --- LIST / CREATE (No ID) ---
        if (!id) {
            if (req.method === 'GET') {
                return await handleListTenants(req, res, auth, sql);
            }
            if (req.method === 'POST') {
                return await handleCreateTenant(req, res, auth, sql);
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // --- DELETE / GET / UPDATE (With ID) ---
        if (req.method === 'DELETE') {
            return await handleDeleteTenant(req, res, auth, sql, id);
        }
        // Implement GET single tenant if needed
        if (req.method === 'GET') {
            return await handleGetTenant(req, res, auth, sql, id);
        }
        // Implement PUT if needed (not in original files but good practice)
        if (req.method === 'PUT') {
            return await handleUpdateTenant(req, res, auth, sql, id);
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
    // Get all tenants owned by this landlord
    const tenants = await sql`
    SELECT 
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
      t.created_at as "createdAt",
      t.updated_at as "updatedAt"
    FROM public.tenants t
    WHERE t.landlord_id = ${auth.userId}
    ORDER BY t.created_at DESC
  `;

    return res.status(200).json(tenants);
}

async function handleCreateTenant(req: VercelRequest, res: VercelResponse, auth: any, sql: any) {
    const tenantData = insertTenantSchema.parse(req.body);
    const invitationToken = crypto.randomBytes(32).toString('hex');

    const [tenant] = await sql`
      INSERT INTO public.tenants (
        landlord_id, user_id, first_name, last_name, email, phone, 
        emergency_contact, invitation_token, account_status
      ) VALUES (
        ${auth.userId}, NULL, ${tenantData.firstName}, ${tenantData.lastName}, 
        ${tenantData.email}, ${tenantData.phone}, ${tenantData.emergencyContact || null},
        ${invitationToken}, 'pending_invitation'
      ) RETURNING *
    `;

    const [landlord] = await sql`SELECT first_name, last_name FROM public.users WHERE id = ${auth.userId}`;

    try {
        await emailService.sendTenantInvitation(
            tenant.email,
            `${tenant.first_name} ${tenant.last_name}`,
            invitationToken,
            undefined, undefined,
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
            created_at as "createdAt", updated_at as "updatedAt"
        `;
        return res.status(201).json(updatedTenant);
    } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
        const sanitizedTenant = {
            id: tenant.id, landlordId: auth.userId, userId: null,
            firstName: tenant.first_name, lastName: tenant.last_name, email: tenant.email,
            phone: tenant.phone, emergencyContact: tenant.emergency_contact,
            invitationSentAt: tenant.invitation_sent_at, invitationAcceptedAt: tenant.invitation_accepted_at,
            accountStatus: tenant.account_status, createdAt: tenant.created_at, updatedAt: tenant.updated_at
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
           t.account_status as "accountStatus"
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
            account_status as "accountStatus", created_at as "createdAt", updated_at as "updatedAt"
    `;

    if (!updated) return res.status(404).json({ message: 'Tenant not found' });
    return res.json(updated);
}

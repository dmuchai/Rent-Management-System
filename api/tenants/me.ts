import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';

export default async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    return requireAuth(async (req, res, auth) => {
        const sql = createDbConnection();
        try {
            const [tenant] = await sql`
        SELECT * FROM public.tenants 
        WHERE user_id = ${auth.userId}
      `;

            if (!tenant) {
                return res.status(404).json({ message: "Tenant profile not found" });
            }

            // Map snake_case to camelCase
            res.json({
                id: tenant.id,
                userId: tenant.user_id,
                firstName: tenant.first_name,
                lastName: tenant.last_name,
                email: tenant.email,
                phone: tenant.phone,
                emergencyContact: tenant.emergency_contact,
                createdAt: tenant.created_at,
                updatedAt: tenant.updated_at
            });

        } catch (error: any) {
            console.error('Error fetching tenant profile:', error);
            return res.status(500).json({ message: "Failed to fetch tenant profile" });
        } finally {
            await sql.end();
        }
    })(req, res);
};

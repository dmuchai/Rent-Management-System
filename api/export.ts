import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from './_lib/auth.js';
import { createDbConnection } from './_lib/db.js';

// Essential portability export. It is intentionally available on every plan
// and returns only records owned by the authenticated billing owner.
export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const sql = createDbConnection();
  try {
    const properties = await sql`SELECT * FROM public.properties WHERE owner_id = ${auth.userId} ORDER BY created_at`;
    const units = await sql`SELECT u.* FROM public.units u JOIN public.properties p ON p.id = u.property_id WHERE p.owner_id = ${auth.userId} ORDER BY u.created_at`;
    const tenants = await sql`SELECT * FROM public.tenants WHERE landlord_id = ${auth.userId} ORDER BY created_at`;
    const leases = await sql`SELECT l.* FROM public.leases l JOIN public.units u ON u.id = l.unit_id JOIN public.properties p ON p.id = u.property_id WHERE p.owner_id = ${auth.userId} ORDER BY l.created_at`;
    const payments = await sql`SELECT pay.* FROM public.payments pay JOIN public.leases l ON l.id = pay.lease_id JOIN public.units u ON u.id = l.unit_id JOIN public.properties p ON p.id = u.property_id WHERE p.owner_id = ${auth.userId} ORDER BY pay.created_at`;
    const maintenanceRequests = await sql`SELECT m.* FROM public.maintenance_requests m JOIN public.units u ON u.id = m.unit_id JOIN public.properties p ON p.id = u.property_id WHERE p.owner_id = ${auth.userId} ORDER BY m.created_at`;
    return res.status(200).json({ exportedAt: new Date().toISOString(), properties, units, tenants, leases, payments, maintenanceRequests });
  } finally {
    await sql.end();
  }
});

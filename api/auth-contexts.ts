import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from './_lib/auth.js';
import { createDbConnection } from './_lib/db.js';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const sql = createDbConnection();
  try {
    const contexts = await sql`
      SELECT m.role, m.context_owner_id AS "contextOwnerId",
        COALESCE(NULLIF(TRIM(CONCAT(owner.first_name, ' ', owner.last_name)), ''), owner.email, 'Portfolio') AS label
      FROM public.user_context_memberships m
      JOIN public.users owner ON owner.id = m.context_owner_id
      WHERE m.user_id = ${auth.userId} AND m.status = 'active'
      ORDER BY CASE m.role WHEN 'landlord' THEN 1 WHEN 'property_manager' THEN 2
        WHEN 'caretaker' THEN 3 ELSE 4 END, m.created_at
    `;
    return res.status(200).json({ contexts, active: { role: auth.role, contextOwnerId: auth.contextOwnerId } });
  } catch (error) {
    console.error('[Auth contexts] Lookup failed', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ error: 'Could not load account contexts' });
  } finally { await sql.end(); }
});

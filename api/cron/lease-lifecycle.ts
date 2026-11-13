import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cronAuthorizationStatus } from '../_lib/cronAuth.js';
import { createDbConnection } from '../_lib/db.js';
import { runLeaseLifecycle } from '../_lib/leaseLifecycle.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authStatus = cronAuthorizationStatus(req.method, req.headers.authorization, process.env.CRON_SECRET);
  if (authStatus === 500) return res.status(500).json({ error: 'Cron authentication is not configured' });
  if (authStatus === 405) return res.status(405).json({ error: 'Method not allowed' });
  if (authStatus === 401) return res.status(401).json({ error: 'Unauthorized' });
  const sql = createDbConnection();
  try {
    return res.status(200).json(await runLeaseLifecycle(sql));
  } catch (error) {
    console.error('[Cron] Lease lifecycle failed', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ error: 'Lease lifecycle failed; see server logs' });
  } finally {
    await sql.end();
  }
}

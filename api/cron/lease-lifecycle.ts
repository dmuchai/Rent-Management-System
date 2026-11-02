import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createDbConnection } from '../_lib/db.js';
import { runLeaseLifecycle } from '../_lib/leaseLifecycle.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(500).json({ error: 'Cron authentication is not configured' });
  if (req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
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

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processPaymentEvents } from '../_lib/paymentEventWorker.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(500).json({ error: 'Cron authentication is not configured' });
  if (req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
  try {
    return res.status(200).json(await processPaymentEvents(20));
  } catch (error) {
    console.error('[Cron] Payment event processing failed', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ error: 'Payment event processing failed; see server logs' });
  }
}

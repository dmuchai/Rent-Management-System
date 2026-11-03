import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processEmailQueue } from '../_lib/emailWorker.js';

/**
 * Vercel Cron handler to process the email queue.
 * This should be secured via a secret key in the request header or restricted to Vercel IP.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    // 1. Authorization check (simple secret for now, can be improved)
    const authHeader = req.headers.authorization;
    const CRON_SECRET = process.env.CRON_SECRET;

    if (!CRON_SECRET) {
        console.error('[Cron] Email worker authentication is not configured');
        return res.status(500).json({ error: 'Cron authentication is not configured' });
    }
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        console.log('[Cron] Starting email queue processing...');
        const result = await processEmailQueue(20); // Process 20 at a time

        return res.status(200).json({
            message: 'Email queue processed successfully',
            ...result
        });
    } catch (error: any) {
        console.error('[Cron] Email processing failed:', error);
        return res.status(500).json({
            error: 'Failed to process email queue',
            details: 'See server logs for the job error identifier'
        });
    }
}

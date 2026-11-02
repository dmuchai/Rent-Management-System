import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processSmsQueue } from '../_lib/smsWorker.js';

/**
 * Vercel Cron handler to process the SMS queue.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    // 1. Authorization check
    const authHeader = req.headers.authorization;
    const CRON_SECRET = process.env.CRON_SECRET;

    if (!CRON_SECRET) {
        console.error('[Cron] SMS worker authentication is not configured');
        return res.status(500).json({ error: 'Cron authentication is not configured' });
    }
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        console.log('[Cron] Starting SMS queue processing...');
        const result = await processSmsQueue(20); // Process 20 at a time

        return res.status(200).json({
            message: 'SMS queue processed successfully',
            ...result
        });
    } catch (error: any) {
        console.error('[Cron] SMS processing failed:', error);
        return res.status(500).json({
            error: 'Failed to process SMS queue',
            details: 'See server logs for the job error identifier'
        });
    }
}

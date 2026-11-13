import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cronAuthorizationStatus } from '../_lib/cronAuth.js';
import { runAutomatedInvoicing } from '../_lib/invoicingWorker.js';

/**
 * Vercel Cron handler to generate monthly invoices.
 * Recommended schedule: 0 0 1 * * (Midnight on the 1st of every month)
 * or daily to catch any missing invoices.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const authStatus = cronAuthorizationStatus(req.method, req.headers.authorization, process.env.CRON_SECRET);
    if (authStatus === 500) {
        console.error('[Cron] CRON_SECRET is not configured');
        return res.status(500).json({ error: 'Cron authentication is not configured' });
    }
    if (authStatus === 405) return res.status(405).json({ error: 'Method not allowed' });
    if (authStatus === 401) return res.status(401).json({ error: 'Unauthorized' });

    try {
        console.log('[Cron] Starting automated monthly invoicing...');
        const result = await runAutomatedInvoicing();

        return res.status(200).json({
            message: 'Invoicing process completed',
            ...result
        });
    } catch (error: any) {
        console.error('[Cron] Invoicing failed:', error);
        return res.status(500).json({
            error: 'Failed to run automated invoicing',
            details: 'See server logs for the job error'
        });
    }
}

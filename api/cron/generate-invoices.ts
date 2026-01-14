import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runAutomatedInvoicing } from '../../server/workers/invoicingWorker';

/**
 * Vercel Cron handler to generate monthly invoices.
 * Recommended schedule: 0 0 1 * * (Midnight on the 1st of every month)
 * or daily to catch any missing invoices.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const authHeader = req.headers.authorization;
    const CRON_SECRET = process.env.CRON_SECRET;

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

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
            details: error.message
        });
    }
}

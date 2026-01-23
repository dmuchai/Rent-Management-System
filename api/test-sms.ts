
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { smsService } from './_lib/smsService.js';

/**
 * TEMPORARY TEST ROUTE: /api/test-sms?phone=+254XXXXXXXXX
 * This route allows you to test SMS sending directly on Vercel.
 * DELETE THIS FILE AFTER TESTING.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { phone } = req.query;

    if (!phone || typeof phone !== 'string') {
        return res.status(400).json({ error: 'Please provide a ?phone=+254... query parameter' });
    }

    try {
        console.log(`[Test] Attempting to send test SMS to ${phone}`);
        const result = await smsService.sendSms({
            to: phone,
            message: 'Hello! This is a direct test from your Vercel deployment. If you received this, your credentials are correct!'
        });

        return res.status(200).json({
            message: 'Test request completed',
            phone,
            result
        });
    } catch (error: any) {
        console.error('[Test] SMS test failed:', error);
        return res.status(500).json({
            error: 'SMS test failed',
            details: error.message
        });
    }
}

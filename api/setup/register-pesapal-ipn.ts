import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { pesapalService } from '../_lib/pesapalService.js';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Only allow admins/landlords? For now, allowing any authenticated user to setup (or refine later)
        // Ideally check auth.role or similar if available in custom token payload

        if (!pesapalService.isConfigured()) {
            return res.status(503).json({
                message: "Pesapal Consumer Key/Secret not configured in environment variables"
            });
        }

        console.log('Registering Pesapal IPN...');

        // In production, use the production domain. In dev, this won't work for IPN callbacks unless proxied.
        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://property-manager-ke.vercel.app';
        const ipnUrl = `${baseUrl}/api/payments/pesapal/ipn`;

        const response = await pesapalService.registerIPN(ipnUrl);

        console.log('IPN Registration successful:', response);

        return res.status(200).json({
            message: "IPN Registered Successfully",
            ipn_id: response.ipn_id,
            registered_url: ipnUrl,
            instruction: "Please copy this ipn_id and add it to your Vercel Environment Variables as PESAPAL_IPN_ID"
        });
    } catch (error: any) {
        console.error('IPN Registration error:', error);
        return res.status(500).json({
            message: "Failed to register IPN",
            error: error.message || String(error)
        });
    }
});

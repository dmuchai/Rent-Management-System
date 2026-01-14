import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../../_lib/auth.js';
import { createDbConnection } from '../../_lib/db.js';
import { mpesaService } from '../../_lib/mpesaService.js';
import { z } from 'zod';

const mpesaInitiateSchema = z.object({
    leaseId: z.string().min(1, 'Lease ID is required'),
    amount: z.number().positive('Amount must be positive'),
    phoneNumber: z.string().min(10, 'Valid phone number is required'),
    description: z.string().optional(),
});

export default async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    return requireAuth(async (req, res, auth) => {
        const sql = createDbConnection();
        try {
            const { leaseId, amount, phoneNumber, description } = mpesaInitiateSchema.parse(req.body);

            if (!mpesaService.isConfigured()) {
                return res.status(503).json({ message: "M-PESA service not configured" });
            }

            // 1. Create a pending payment record
            const [payment] = await sql`
        INSERT INTO public.payments (
          lease_id, amount, description, payment_method, 
          status, due_date, payment_type
        )
        VALUES (
          ${leaseId}, ${amount.toString()}, ${description || "Rent Payment via M-PESA"}, 'mpesa',
          'pending', NOW(), 'rent'
        )
        RETURNING id
      `;

            // 2. Initiate STK Push
            const response = await mpesaService.initiateStkPush(
                phoneNumber,
                amount,
                `LEASE-${leaseId.slice(0, 8)}`, // Account Reference
                description || "Rent Payment"
            );

            // 3. Update payment with CheckoutRequestID for tracking
            await sql`
        UPDATE public.payments
        SET pesapal_order_tracking_id = ${response.CheckoutRequestID} 
        WHERE id = ${payment.id}
      `;
            // Note: Reusing pesapal_order_tracking_id for simplicity or we could add a dedicated field.
            // Given the schema, this is the most logical place to store the external tracking ID.

            return res.json({
                message: 'STK Push initiated successfully',
                checkoutRequestId: response.CheckoutRequestID,
                customerMessage: response.CustomerMessage
            });

        } catch (error: any) {
            console.error('M-PESA initiation error:', error);
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: 'Invalid input', details: error.errors });
            }
            return res.status(500).json({ message: "Failed to initiate M-PESA payment", error: error.message || String(error) });
        } finally {
            await sql.end();
        }
    })(req, res);
};

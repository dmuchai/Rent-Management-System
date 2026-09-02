import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../../_lib/auth.js';
import { createDbConnection } from '../../_lib/db.js';
import { mpesaService } from '../../_lib/mpesaService.js';
import {
    createPaymentRecord,
    InvoicePaymentError,
    invoicePaymentHttpStatus,
    transitionPaymentStatus,
} from '../../_lib/invoicePayments.js';
import { z } from 'zod';

const mpesaInitiateSchema = z.object({
    leaseId: z.string().min(1, 'Lease ID is required'),
    invoiceId: z.string().min(1, 'Invoice ID is required').optional(),
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
        let paymentId: string | null = null;
        try {
            const { leaseId, invoiceId, amount, phoneNumber, description } = mpesaInitiateSchema.parse(req.body);

            if (!mpesaService.isConfigured()) {
                return res.status(503).json({ message: "M-PESA service not configured" });
            }

            // A payment row now records this actual STK attempt and points at
            // the canonical invoice it intends to settle.
            const payment = await createPaymentRecord(sql, {
                leaseId,
                invoiceId,
                amount,
                paymentMethod: 'mpesa',
                paymentType: 'rent',
                paymentSource: 'mpesa_stk',
                status: 'pending',
                description: description || 'Rent Payment via M-PESA',
                actor: { userId: auth.userId, role: auth.role },
            });
            paymentId = payment.id;

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
                paymentId: payment.id,
                invoiceId: payment.invoice_id,
                customerMessage: response.CustomerMessage
            });

        } catch (error: any) {
            console.error('M-PESA initiation error:', error);
            if (paymentId) {
                await transitionPaymentStatus(sql, { paymentId }, 'failed', {
                    description: `M-PESA initiation failed: ${error.message || String(error)}`,
                }).catch((transitionError) => console.error('Failed to mark M-PESA attempt as failed:', transitionError));
            }
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: 'Invalid input', details: error.errors });
            }
            if (error instanceof InvoicePaymentError) {
                return res.status(invoicePaymentHttpStatus(error)).json({ error: error.message, code: error.code });
            }
            return res.status(500).json({ message: "Failed to initiate M-PESA payment", error: error.message || String(error) });
        } finally {
            await sql.end();
        }
    })(req, res);
};

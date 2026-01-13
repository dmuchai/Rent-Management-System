import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../../_lib/auth.js';
import { createDbConnection } from '../../_lib/db.js';
import { pesapalService } from '../../_lib/pesapalService.js';
import { z } from 'zod';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const sql = createDbConnection();

    try {
        const paymentInitiateSchema = z.object({
            leaseId: z.string().min(1, 'Lease ID is required'),
            amount: z.number().positive('Amount must be positive'),
            description: z.string().optional(),
            paymentMethod: z.string().default('mpesa'),
        });

        const { leaseId, amount, description, paymentMethod } = paymentInitiateSchema.parse(req.body);

        if (!pesapalService.isConfigured()) {
            return res.status(503).json({ message: "Payment service not configured" });
        }

        // Get user details for billing
        const [user] = await sql`
      SELECT id, email, first_name, last_name 
      FROM public.users 
      WHERE id = ${auth.userId}
    `;

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Get tenant details if available (often better phone numbers)
        // Assuming auth.userId maps to a tenant record via user_id
        const [tenant] = await sql`
      SELECT phone, first_name, last_name
      FROM public.tenants
      WHERE user_id = ${auth.userId}
    `;

        const billingUser = {
            email: user.email || "c4c@example.com",
            phone: tenant?.phone || "",
            firstName: tenant?.first_name || user.first_name || "Tenant",
            lastName: tenant?.last_name || user.last_name || "User",
        };

        // Create a pending payment record
        const [payment] = await sql`
      INSERT INTO public.payments (
        lease_id, 
        amount, 
        description, 
        payment_method, 
        status, 
        due_date, 
        payment_type
      )
      VALUES (
        ${leaseId},
        ${amount.toString()},
        ${description || "Rent Payment"},
        ${paymentMethod},
        'pending',
        NOW(),
        'rent'
      )
      RETURNING id
    `;

        // Construct callback URL
        // Use VERCEL_URL if available, else localhost
        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173';
        // The callback URL is where Pesapal redirects the USER after payment
        // This should be the frontend dashboard
        const callbackUrl = `${baseUrl}/dashboard?payment=success`;

        // Initiate request to Pesapal
        const paymentRequest = {
            amount: amount,
            description: description || "Rent Payment",
            callbackUrl: callbackUrl,
            merchantReference: payment.id, // Use our payment ID as reference
            email: billingUser.email,
            phone: billingUser.phone,
            firstName: billingUser.firstName,
            lastName: billingUser.lastName,
        };

        const response = await pesapalService.submitOrderRequest(paymentRequest);

        // Update payment with tracking ID
        await sql`
      UPDATE public.payments
      SET pesapal_order_tracking_id = ${response.order_tracking_id}
      WHERE id = ${payment.id}
    `;

        return res.json({
            redirectUrl: response.redirect_url,
            trackingId: response.order_tracking_id
        });

    } catch (error: any) {
        console.error('Pesapal initiation error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        return res.status(500).json({
            message: "Failed to initiate payment",
            error: error.message || String(error)
        });
    } finally {
        await sql.end();
    }
});

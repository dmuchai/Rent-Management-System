import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../../_lib/auth.js';
import { createDbConnection } from '../../_lib/db.js';
import { pesapalService } from '../../_lib/pesapalService.js';
import { z } from 'zod';

// This handler combines Initiate (POST), IPN (GET/POST), and Register (GET)
// Route pattern: /api/payments/pesapal/[action]
// action: initiate | ipn | register

export default async (req: VercelRequest, res: VercelResponse) => {
    const { action } = req.query;
    const method = req.method;

    console.log(`Pesapal Action: ${action}, Method: ${method}`);

    if (action === 'ipn') {
        return handleIPN(req, res);
    }

    // Authentication required for initiate and register
    return requireAuth(async (req, res, auth) => {
        if (action === 'initiate' && method === 'POST') {
            return handleInitiate(req, res, auth);
        }

        if (action === 'register' && method === 'GET') {
            return handleRegister(req, res, auth);
        }

        return res.status(404).json({ error: 'Endpoint not found' });
    })(req, res);
};

// --- Handlers ---

async function handleInitiate(req: VercelRequest, res: VercelResponse, auth: any) {
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

        // Get tenant details if available
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
        lease_id, amount, description, payment_method, 
        status, due_date, payment_type
      )
      VALUES (
        ${leaseId}, ${amount.toString()}, ${description || "Rent Payment"}, ${paymentMethod},
        'pending', NOW(), 'rent'
      )
      RETURNING id
    `;

        // Construct callback URL
        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173';
        const callbackUrl = `${baseUrl}/dashboard?payment=success`;

        // Initiate request to Pesapal
        console.log(`[Pesapal] Submitting order for payment ID: ${payment.id}`);
        const paymentRequest = {
            amount: amount,
            description: description || "Rent Payment",
            callbackUrl: callbackUrl,
            merchantReference: payment.id,
            email: billingUser.email,
            phone: billingUser.phone,
            firstName: billingUser.firstName,
            lastName: billingUser.lastName,
        };

        const response = await pesapalService.submitOrderRequest(paymentRequest);
        console.log(`[Pesapal] Order submission response:`, JSON.stringify(response));

        if (!response || !response.order_tracking_id) {
            console.error('[Pesapal] order_tracking_id missing from response');
            throw new Error(`Pesapal order tracking ID missing. Response: ${JSON.stringify(response)}`);
        }

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
        return res.status(500).json({ message: "Failed to initiate payment", error: error.message || String(error) });
    } finally {
        await sql.end();
    }
}

async function handleIPN(req: VercelRequest, res: VercelResponse) {
    const sql = createDbConnection();
    try {
        const { OrderTrackingId, OrderNotificationType, OrderMerchantReference } = req.query;
        console.log('Pesapal IPN received:', { OrderTrackingId, OrderNotificationType, OrderMerchantReference });

        if (!OrderTrackingId) {
            return res.status(400).json({ message: "Missing tracking ID" });
        }

        const trackingIdStr = Array.isArray(OrderTrackingId) ? OrderTrackingId[0] : OrderTrackingId;
        const statusResponse = await pesapalService.getTransactionStatus(trackingIdStr);

        let dbStatus = "pending";
        if (statusResponse.payment_status_description === "Completed") dbStatus = "completed";
        else if (statusResponse.payment_status_description === "Failed") dbStatus = "failed";

        if (OrderMerchantReference) {
            const merchantRefStr = Array.isArray(OrderMerchantReference) ? OrderMerchantReference[0] : OrderMerchantReference;

            await sql`
        UPDATE public.payments
        SET 
          status = ${dbStatus},
          pesapal_transaction_id = ${statusResponse.confirmation_code},
          payment_method = ${statusResponse.payment_method || "mpesa"},
          paid_date = ${dbStatus === "completed" ? new Date() : null}
        WHERE id = ${merchantRefStr}
      `;
        }

        return res.json({
            orderNotificationType: OrderNotificationType,
            orderTrackingId: OrderTrackingId,
            orderMerchantReference: OrderMerchantReference,
            status: statusResponse.status_code
        });

    } catch (error: any) {
        console.error('Pesapal IPN error:', error);
        return res.status(500).json({ message: "Failed to process IPN", error: error.message || String(error) });
    } finally {
        await sql.end();
    }
}

async function handleRegister(req: VercelRequest, res: VercelResponse, auth: any) {
    try {
        if (!pesapalService.isConfigured()) {
            return res.status(503).json({ message: "Pesapal credentials not configured" });
        }

        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://property-manager-ke.vercel.app';
        const ipnUrl = `${baseUrl}/api/payments/pesapal/ipn`;

        const response = await pesapalService.registerIPN(ipnUrl);

        return res.status(200).json({
            message: "IPN Registered Successfully",
            ipn_id: response.ipn_id,
            registered_url: ipnUrl,
            instruction: "Please copy this ipn_id and add it to your Vercel Environment Variables as PESAPAL_IPN_ID"
        });
    } catch (error: any) {
        return res.status(500).json({ message: "Failed to register IPN", error: error.message || String(error) });
    }
}

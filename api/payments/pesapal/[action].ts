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

    if (action === 'ipn') {
        return await handleIPN(req, res);
    }

    if (action === 'sync') {
        return await handleIPN(req, res);
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
            email: user.email || "tenant@example.com",
            phone: tenant?.phone || "0700000000", // Default phone for testing if missing
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
        ${leaseId}, ${amount.toString()}, ${description || "Rent Payment"}, ${paymentMethod || 'mpesa'},
        'pending', NOW(), 'rent'
      )
      RETURNING id
    `;

        // Construct callback URL
        // Dynamically detect host to stay on the same domain (maintains session)
        const host = req.headers.host || 'property-manager-ke.vercel.app';
        const protocol = (req.headers['x-forwarded-proto'] as string) || (host.includes('localhost') ? 'http' : 'https');
        const baseUrl = `${protocol}://${host}`;

        const callbackUrl = `${baseUrl}/dashboard?payment=success`;
        console.log(`[Pesapal] Generated callbackUrl: ${callbackUrl}`);

        // Initiate request to Pesapal
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

        if (!response || !response.order_tracking_id) {
            console.error('[Pesapal] order_tracking_id missing from response');
            throw new Error(`Pesapal order tracking ID missing. Response: ${JSON.stringify(response)}`);
        }

        if (!payment || !payment.id) {
            console.error('[Pesapal] Payment record creation failed or ID missing');
            throw new Error('Failed to create internal payment record');
        }

        // Update payment with tracking ID
        await sql`
      UPDATE public.payments
      SET pesapal_order_tracking_id = ${response.order_tracking_id || null}
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
        // Pesapal V3 can send IPN as GET or POST
        const data = req.method === 'POST' ? req.body : req.query;
        const OrderTrackingId = data.OrderTrackingId || data.orderTrackingId;
        const OrderNotificationType = data.OrderNotificationType || data.orderNotificationType;
        const OrderMerchantReference = data.OrderMerchantReference || data.orderMerchantReference;

        console.log(`[Pesapal IPN] Received (${req.method}):`, JSON.stringify({
            OrderTrackingId,
            OrderNotificationType,
            OrderMerchantReference,
            allData: data
        }));

        if (!OrderTrackingId) {
            console.error('[Pesapal IPN] Error: Missing OrderTrackingId');
            return res.status(400).json({ message: "Missing tracking ID" });
        }

        const trackingIdStr = Array.isArray(OrderTrackingId) ? OrderTrackingId[0] : OrderTrackingId;
        console.log(`[Pesapal IPN] Fetching status for: ${trackingIdStr}`);

        const statusResponse = await pesapalService.getTransactionStatus(trackingIdStr);
        console.log(`[Pesapal IPN] Transaction status response:`, JSON.stringify(statusResponse));

        // Map Pesapal status to our DB status
        // Use status_code as primary indicator if available
        // V3 codes: 1=Completed, 0=Pending, 2=Failed, 3=Reversed
        const statusCode = statusResponse.payment_status_code || statusResponse.status_code;
        const psd = (statusResponse.payment_status_description || "").toLowerCase();

        let dbStatus = "pending";
        if (statusCode === 1 || statusCode === "1" || psd === "completed") {
            dbStatus = "completed";
        } else if (statusCode === 2 || statusCode === "2" || psd === "failed") {
            dbStatus = "failed";
        } else if (statusCode === 3 || statusCode === "3" || psd === "reversed") {
            dbStatus = "failed";
        }

        const merchantRefStr = Array.isArray(OrderMerchantReference) ? OrderMerchantReference[0] : OrderMerchantReference;

        console.log(`[Pesapal IPN] Updating record. DB Status: ${dbStatus}, MerchantRef: ${merchantRefStr || 'N/A'}, TrackingID: ${trackingIdStr}`);

        // Update payment record
        // We try to match by merchant_reference (our internal ID) 
        // OR by the tracking ID we saved during initiation as a backup
        const updateResult = await sql`
      UPDATE public.payments
      SET 
        status = ${dbStatus},
        pesapal_transaction_id = ${statusResponse.confirmation_code || null},
        payment_method = ${statusResponse.payment_method || "mpesa"},
        paid_date = ${dbStatus === "completed" ? new Date() : null},
        updated_at = NOW()
      WHERE id = ${merchantRefStr || ''} 
         OR pesapal_order_tracking_id = ${trackingIdStr}
      RETURNING id
    `;

        console.log(`[Pesapal IPN] Database update result: ${updateResult.length} rows affected. IDs: ${JSON.stringify(updateResult.map(r => r.id))}`);

        if (updateResult.length === 0) {
            console.error(`[Pesapal IPN] CRITICAL: No payment record found to update for MerchantRef: ${merchantRefStr} or TrackingID: ${trackingIdStr}`);
        }

        return res.json({
            orderNotificationType: OrderNotificationType,
            orderTrackingId: OrderTrackingId,
            orderMerchantReference: OrderMerchantReference,
            status: statusResponse.status_code
        });

    } catch (error: any) {
        console.error('[Pesapal IPN] Error processing notification:', error);
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

        // Consistent baseUrl logic
        let baseUrl = 'https://property-manager-ke.vercel.app';
        if (process.env.APP_URL) {
            baseUrl = process.env.APP_URL;
        } else if (process.env.VERCEL_URL && !process.env.VERCEL_URL.includes('projects.vercel.app')) {
            baseUrl = `https://${process.env.VERCEL_URL}`;
        }

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

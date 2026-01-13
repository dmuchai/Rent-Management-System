import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createDbConnection } from '../../_lib/db.js';
import { pesapalService } from '../../_lib/pesapalService.js';

export default async (req: VercelRequest, res: VercelResponse) => {
    const sql = createDbConnection();

    try {
        const { OrderTrackingId, OrderNotificationType, OrderMerchantReference } = req.query;
        console.log('Pesapal IPN received:', { OrderTrackingId, OrderNotificationType, OrderMerchantReference });

        if (!OrderTrackingId) {
            return res.status(400).json({ message: "Missing tracking ID" });
        }

        // Get status from Pesapal
        const trackingIdStr = Array.isArray(OrderTrackingId) ? OrderTrackingId[0] : OrderTrackingId;
        const statusResponse = await pesapalService.getTransactionStatus(trackingIdStr);

        console.log('Pesapal transaction status:', statusResponse);

        // Map status to our status
        let dbStatus = "pending";
        if (statusResponse.payment_status_description === "Completed") {
            dbStatus = "completed";
        } else if (statusResponse.payment_status_description === "Failed") {
            dbStatus = "failed";
        }

        // Update payment in DB
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

        // Return response to Pesapal
        return res.json({
            orderNotificationType: OrderNotificationType,
            orderTrackingId: OrderTrackingId,
            orderMerchantReference: OrderMerchantReference,
            status: statusResponse.status_code
        });

    } catch (error: any) {
        console.error('Pesapal IPN error:', error);
        return res.status(500).json({
            message: "Failed to process IPN",
            error: error.message || String(error)
        });
    } finally {
        // Clean up connection
        await sql.end();
    }
};

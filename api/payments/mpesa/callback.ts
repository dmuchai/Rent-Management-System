import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createDbConnection } from '../../_lib/db.js';
import { emailService } from '../../_lib/emailService.js';

export default async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const sql = createDbConnection();
    try {
        const callbackData = req.body.Body.stkCallback;
        console.log('[M-PESA Callback] Received data:', JSON.stringify(callbackData));

        const checkoutRequestId = callbackData.CheckoutRequestID;
        const resultCode = callbackData.ResultCode;
        const resultDesc = callbackData.ResultDesc;

        // Find the payment record
        const [payment] = await sql`
      SELECT * FROM public.payments 
      WHERE pesapal_order_tracking_id = ${checkoutRequestId}
    `;

        if (!payment) {
            console.error(`[M-PESA Callback] Payment not found for CheckoutRequestID: ${checkoutRequestId}`);
            return res.status(404).json({ message: 'Payment not found' });
        }

        if (resultCode === 0) {
            // Success
            console.log(`[M-PESA Callback] Success for Payment ID: ${payment.id}`);

            // Extract transaction metadata
            const items = callbackData.CallbackMetadata.Item;
            const mpesaReceiptNumber = items.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value;

            await sql`
        UPDATE public.payments
        SET status = 'completed', 
            pesapal_transaction_id = ${mpesaReceiptNumber},
            paid_date = NOW(),
            updated_at = NOW()
        WHERE id = ${payment.id}
      `;

            // Trigger standard notifications (reusing Pesapal notification logic if possible)
            // Since this is a standalone API, we'll manually trigger the enqueuing logic here.
            try {
                const [details] = await sql`
          SELECT 
            p.*, 
            l.tenant_id, 
            t.email as tenant_email, t.first_name as tenant_name,
            u.unit_number,
            prop.name as property_name,
            prop.owner_id as landlord_id,
            landlord.email as landlord_email, landlord.first_name as landlord_name
          FROM public.payments p
          JOIN public.leases l ON p.lease_id = l.id
          JOIN public.tenants t ON l.tenant_id = t.id
          JOIN public.units u ON l.unit_id = u.id
          JOIN public.properties prop ON u.property_id = prop.id
          JOIN public.users landlord ON prop.owner_id = landlord.id
          WHERE p.id = ${payment.id}
        `;

                if (details) {
                    const tenantEmailOptions = emailService.composePaymentConfirmation(
                        details.tenant_email,
                        details.tenant_name,
                        details.amount,
                        new Date(),
                        details.property_name,
                        details.unit_number,
                        mpesaReceiptNumber
                    );

                    const landlordEmailOptions = emailService.composeLandlordPaymentNotification(
                        details.landlord_email,
                        details.landlord_name,
                        details.tenant_name,
                        details.amount,
                        new Date(),
                        details.property_name,
                        details.unit_number,
                        mpesaReceiptNumber
                    );

                    await sql`
            INSERT INTO public.email_queue ("to", subject, html_content, text_content, metadata)
            VALUES 
              (${tenantEmailOptions.to}, ${tenantEmailOptions.subject}, ${tenantEmailOptions.html}, ${tenantEmailOptions.text ?? null}, ${JSON.stringify({ type: 'payment_confirmation', paymentId: payment.id, recipient: 'tenant' })}),
              (${landlordEmailOptions.to}, ${landlordEmailOptions.subject}, ${landlordEmailOptions.html}, ${landlordEmailOptions.text ?? null}, ${JSON.stringify({ type: 'payment_confirmation', paymentId: payment.id, recipient: 'landlord' })})
          `;
                }
            } catch (notifyErr) {
                console.error('[M-PESA Callback] Notification error:', notifyErr);
            }

        } else {
            // Failure
            console.warn(`[M-PESA Callback] Failed. Code: ${resultCode}, Desc: ${resultDesc}`);
            await sql`
        UPDATE public.payments
        SET status = 'failed', 
            description = ${`M-PESA Failed: ${resultDesc}`},
            updated_at = NOW()
        WHERE id = ${payment.id}
      `;
        }

        return res.status(200).json({ ResultCode: 0, ResultDesc: "Success" });

    } catch (error: any) {
        console.error('M-PESA Callback error:', error);
        return res.status(500).json({ ResultCode: 1, ResultDesc: "Internal Server Error" });
    } finally {
        await sql.end();
    }
};

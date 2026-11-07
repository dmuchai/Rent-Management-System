import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { createDbConnection } from '../../_lib/db.js';
import { InvoicePaymentError, transitionPaymentStatus } from '../../_lib/invoicePayments.js';
import { mpesaService } from '../../_lib/mpesaService.js';
import { parseStkCallback, receiptConflicts, verifyStkResult } from '../../_lib/mpesaVerification.js';

function providerResponse(res: VercelResponse, status: number, code: number, description: string) {
  return res.status(status).json({ ResultCode: code, ResultDesc: description });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const sql = createDbConnection();
  try {
    const callback = parseStkCallback(req.body);
    const externalId = `stk:${callback.checkoutRequestId}:${callback.fingerprint}`;
    const [event] = await sql`
      INSERT INTO public.external_payment_events (
        event_type, provider, external_transaction_id, amount, transaction_time,
        raw_payload, reconciliation_status, processing_status, is_verified
      ) VALUES (
        'mpesa_stk_result', 'safaricom', ${externalId}, ${callback.amount ?? 0}, NOW(),
        ${sql.json(req.body)}, 'unmatched', 'received', false
      )
      ON CONFLICT ON CONSTRAINT uq_external_payment_events_provider_txn
      DO UPDATE SET raw_payload = EXCLUDED.raw_payload
      RETURNING id, processing_status
    `;

    if (event.processing_status === 'processed') {
      return providerResponse(res, 200, 0, 'Already processed');
    }

    const [payment] = await sql`
      SELECT pay.id, pay.amount, pay.status, pay.payment_source,
             COALESCE(provider_checkout_id, pesapal_order_tracking_id) AS checkout_request_id,
             pay.provider_merchant_request_id, pay.expected_merchant_id, pay.provider_receipt_id,
             pay.invoice_id, p.owner_id AS landlord_id
      FROM public.payments pay
      LEFT JOIN public.leases l ON l.id = pay.lease_id
      LEFT JOIN public.units u ON u.id = l.unit_id
      LEFT JOIN public.properties p ON p.id = u.property_id
      WHERE COALESCE(pay.provider_checkout_id, pay.pesapal_order_tracking_id) = ${callback.checkoutRequestId}
      LIMIT 1
    `;
    if (!payment || payment.payment_source !== 'mpesa_stk') {
      await sql`UPDATE public.external_payment_events SET processing_status = 'review',
        operator_review_required = true, last_processing_error = 'Payment attempt not found',
        processing_attempts = processing_attempts + 1 WHERE id = ${event.id}`;
      return providerResponse(res, 404, 1, 'Payment not found');
    }
    if (payment.landlord_id) {
      await sql`UPDATE public.external_payment_events
        SET landlord_id = ${payment.landlord_id}
        WHERE id = ${event.id}`;
    }

    let query;
    try {
      query = await mpesaService.queryStkPush(callback.checkoutRequestId);
    } catch (error: any) {
      await sql`UPDATE public.external_payment_events SET processing_status = 'retry',
        next_attempt_at = NOW() + INTERVAL '5 minutes', processing_attempts = processing_attempts + 1,
        last_processing_error = ${String(error?.message || error).slice(0, 500)} WHERE id = ${event.id}`;
      return providerResponse(res, 200, 0, 'Result captured; verification pending');
    }

    const verification = verifyStkResult(callback, query, {
      amount: Number(payment.amount),
      checkoutRequestId: payment.checkout_request_id,
      merchantRequestId: payment.provider_merchant_request_id,
      merchantId: payment.expected_merchant_id || mpesaService.getMerchantId(),
    });
    if (!verification.verified) {
      await sql`UPDATE public.external_payment_events SET processing_status = 'review',
        operator_review_required = true, processing_attempts = processing_attempts + 1,
        last_processing_error = ${verification.reason || 'Provider verification failed'},
        reconciliation_status = 'pending_review' WHERE id = ${event.id}`;
      return providerResponse(res, 200, 0, 'Result captured for review');
    }
    if (verification.successful && receiptConflicts(payment.provider_receipt_id, callback.receipt)) {
      await sql`UPDATE public.external_payment_events SET processing_status = 'review',
        operator_review_required = true, reconciliation_status = 'pending_review',
        last_processing_error = 'Successful result conflicts with the receipt already posted for this checkout'
        WHERE id = ${event.id}`;
      return providerResponse(res, 200, 0, 'Conflicting result captured for review');
    }

    const transition = await transitionPaymentStatus(
      sql,
      { paymentId: payment.id },
      verification.successful ? 'completed' : 'failed',
      verification.successful
        ? {
            transactionId: callback.receipt,
            providerReceiptId: callback.receipt,
            sourceEventId: event.id,
            paymentMethod: 'mpesa',
            paidDate: new Date(),
          }
        : { sourceEventId: event.id, description: `M-PESA result: ${callback.resultDesc}` },
    );

    await sql`UPDATE public.external_payment_events SET is_verified = true,
      processing_status = 'processed', processed_at = NOW(), processing_attempts = processing_attempts + 1,
      reconciliation_status = ${verification.successful ? 'auto_matched' : 'ignored'},
      reconciled_at = NOW(), last_processing_error = NULL,
      matched_invoice_id = ${transition.payment.invoice_id || null}
      WHERE id = ${event.id}`;
    return providerResponse(res, 200, 0, transition.changed ? 'Result processed' : 'Already processed');
  } catch (error: any) {
    console.error('[M-PESA callback] Processing failed', error instanceof Error ? error.message : String(error));
    if (error instanceof z.ZodError) return providerResponse(res, 400, 1, 'Invalid callback payload');
    if (error instanceof InvoicePaymentError && error.code === 'PAYMENT_NOT_FOUND') {
      return providerResponse(res, 404, 1, 'Payment not found');
    }
    return providerResponse(res, 500, 1, 'Callback persistence or processing failed');
  } finally {
    await sql.end();
  }
}

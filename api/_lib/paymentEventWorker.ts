import { createDbConnection } from './db.js';
import { reconcilePayment, recordReconciliation } from './reconciliationEngine.js';
import { mpesaService } from './mpesaService.js';
import { parseStkCallback, receiptConflicts, verifyStkResult } from './mpesaVerification.js';
import { transitionPaymentStatus } from './invoicePayments.js';

export async function processPaymentEvents(batchSize = 20) {
  const sql = createDbConnection();
  try {
    const events = await sql`
      WITH candidates AS (
        SELECT id FROM public.external_payment_events
        WHERE processing_attempts < 5 AND next_attempt_at <= NOW()
          AND (processing_status IN ('received', 'retry')
            OR (processing_status = 'processing' AND processing_started_at < NOW() - INTERVAL '10 minutes'))
        ORDER BY received_at ASC FOR UPDATE SKIP LOCKED LIMIT ${batchSize}
      )
      UPDATE public.external_payment_events e SET processing_status = 'processing',
        processing_started_at = NOW(), processing_attempts = processing_attempts + 1
      FROM candidates WHERE e.id = candidates.id RETURNING e.*
    `;
    let processed = 0;
    let failed = 0;
    for (const event of events) {
      try {
        if (event.event_type === 'mpesa_c2b') {
          const payload = event.raw_payload as any;
          const timestamp = new Date(event.transaction_time);
          const result = await reconcilePayment(sql, {
            id: event.id, transactionId: event.external_transaction_id,
            phoneNumber: event.payer_phone, amount: Number(event.amount), timestamp,
            bankPaybillNumber: payload.BusinessShortCode,
            bankAccountNumber: payload.BillRefNumber, rawData: payload,
          });
          await recordReconciliation(sql, event.id, Number(event.amount), result);
        } else if (event.event_type === 'mpesa_stk_result') {
          const callback = parseStkCallback(event.raw_payload);
          const [payment] = await sql`SELECT id, amount,
            COALESCE(provider_checkout_id, pesapal_order_tracking_id) AS checkout_request_id,
            provider_merchant_request_id, expected_merchant_id, provider_receipt_id
            FROM public.payments WHERE COALESCE(provider_checkout_id, pesapal_order_tracking_id)
              = ${callback.checkoutRequestId} LIMIT 1`;
          if (!payment) throw new Error('STK payment attempt not found');
          const query = await mpesaService.queryStkPush(callback.checkoutRequestId);
          const verification = verifyStkResult(callback, query, {
            amount: Number(payment.amount), checkoutRequestId: payment.checkout_request_id,
            merchantRequestId: payment.provider_merchant_request_id,
            merchantId: payment.expected_merchant_id || mpesaService.getMerchantId(),
          });
          if (!verification.verified) throw new Error(verification.reason || 'STK verification failed');
          if (verification.successful && receiptConflicts(payment.provider_receipt_id, callback.receipt)) {
            await sql`UPDATE public.external_payment_events SET processing_status = 'review',
              operator_review_required = true, reconciliation_status = 'pending_review',
              last_processing_error = 'Successful result conflicts with the posted receipt'
              WHERE id = ${event.id}`;
            continue;
          }
          const transition = await transitionPaymentStatus(sql, { paymentId: payment.id },
            verification.successful ? 'completed' : 'failed', verification.successful
              ? { sourceEventId: event.id, providerReceiptId: callback.receipt,
                  transactionId: callback.receipt, paymentMethod: 'mpesa', paidDate: new Date() }
              : { sourceEventId: event.id, description: `M-PESA result: ${callback.resultDesc}` });
          await sql`UPDATE public.external_payment_events SET is_verified = true,
            processing_status = 'processed', processed_at = NOW(), last_processing_error = NULL,
            reconciliation_status = ${verification.successful ? 'auto_matched' : 'ignored'},
            reconciled_at = NOW(), matched_invoice_id = ${transition.payment.invoice_id || null}
            WHERE id = ${event.id}`;
        } else {
          await sql`UPDATE public.external_payment_events SET processing_status = 'review',
            operator_review_required = true, last_processing_error = 'No automatic processor for event type'
            WHERE id = ${event.id}`;
        }
        processed++;
      } catch (error: any) {
        failed++;
        await sql`UPDATE public.external_payment_events SET
          processing_status = CASE WHEN processing_attempts >= 5 THEN 'failed' ELSE 'retry' END,
          next_attempt_at = NOW() + (LEAST(processing_attempts, 5) * INTERVAL '5 minutes'),
          last_processing_error = ${String(error?.message || error).slice(0, 500)},
          operator_review_required = (processing_attempts >= 5)
          WHERE id = ${event.id}`;
      }
    }
    return { claimed: events.length, processed, failed };
  } finally {
    await sql.end();
  }
}

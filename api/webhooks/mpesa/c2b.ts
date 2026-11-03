import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { createDbConnection } from '../../_lib/db.js';
import { reconcilePayment, recordReconciliation } from '../../_lib/reconciliationEngine.js';
import { ownerHasSubscriptionFeature } from '../../_lib/subscription.js';

const SAFARICOM_IPS = new Set([
  '196.201.214.200', '196.201.214.206', '196.201.213.114', '196.201.214.207',
  '196.201.214.208', '196.201.213.44', '196.201.212.127', '196.201.212.128',
  '196.201.212.129', '196.201.212.136', '196.201.212.74', '196.201.212.69',
]);

const c2bSchema = z.object({
  TransactionType: z.string().min(1),
  TransID: z.string().min(1),
  TransTime: z.string().regex(/^\d{14}$/),
  TransAmount: z.coerce.number().positive(),
  BusinessShortCode: z.string().min(1),
  BillRefNumber: z.string().min(1),
  MSISDN: z.string().min(9),
}).passthrough();

function sourceIp(req: VercelRequest) {
  if (process.env.VERCEL === '1' || process.env.VERCEL === 'true') {
    return req.headers['x-forwarded-for']?.toString().split(',')[0].trim()
      || req.headers['x-real-ip']?.toString().trim();
  }
  return req.socket?.remoteAddress?.replace(/^::ffff:/, '');
}

function transactionTime(value: string) {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6)) - 1;
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(8, 10));
  const minute = Number(value.slice(10, 12));
  const second = Number(value.slice(12, 14));
  const result = new Date(Date.UTC(year, month, day, hour - 3, minute, second));
  if (Number.isNaN(result.getTime())) throw new Error('Invalid transaction time');
  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SAFARICOM_IPS.has(sourceIp(req) || '')) return res.status(403).json({ error: 'Forbidden' });

  let callback: z.infer<typeof c2bSchema>;
  try {
    callback = c2bSchema.parse(req.body);
  } catch (error) {
    return res.status(400).json({ ResultCode: 1, ResultDesc: 'Invalid callback payload' });
  }

  const sql = createDbConnection();
  let eventId: string | null = null;
  try {
    const [channel] = await sql`
      SELECT id, landlord_id FROM public.landlord_payment_channels
      WHERE bank_paybill_number = ${callback.BusinessShortCode}
        AND bank_account_number = ${callback.BillRefNumber}
        AND channel_type = 'mpesa_to_bank' AND is_active = true
      LIMIT 1
    `;
    const timestamp = transactionTime(callback.TransTime);
    const [event] = await sql`
      INSERT INTO public.external_payment_events (
        event_type, provider, landlord_id, payment_channel_id, external_transaction_id,
        amount, payer_phone, payer_account_ref, transaction_time, raw_payload,
        reconciliation_status, processing_status, is_verified, operator_review_required
      ) VALUES (
        'mpesa_c2b', 'safaricom', ${channel?.landlord_id || null}, ${channel?.id || null},
        ${callback.TransID}, ${callback.TransAmount}, ${callback.MSISDN}, ${callback.BillRefNumber},
        ${timestamp}, ${JSON.stringify(callback)}::jsonb,
        ${channel ? 'unmatched' : 'pending_review'}, ${channel ? 'received' : 'review'}, true, ${!channel}
      )
      ON CONFLICT ON CONSTRAINT uq_external_payment_events_provider_txn
      DO UPDATE SET external_transaction_id = EXCLUDED.external_transaction_id
      RETURNING id, landlord_id, processing_status
    `;
    eventId = event.id;

    if (!event.landlord_id) {
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Payment captured for channel review' });
    }
    if (event.processing_status === 'processed') {
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Already processed' });
    }
    if (!(await ownerHasSubscriptionFeature(event.landlord_id, 'payment_reconciliation'))) {
      await sql`UPDATE public.external_payment_events SET processing_status = 'review',
        operator_review_required = true, reconciliation_status = 'pending_review',
        reconciliation_notes = 'Reconciliation feature is not active for this portfolio'
        WHERE id = ${event.id}`;
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Payment captured for review' });
    }

    await sql`UPDATE public.external_payment_events SET processing_status = 'processing',
      processing_started_at = NOW() WHERE id = ${event.id}
      AND processing_status IN ('received', 'retry', 'processing')`;
    try {
      const result = await reconcilePayment(sql, {
        id: event.id,
        transactionId: callback.TransID,
        phoneNumber: callback.MSISDN,
        amount: callback.TransAmount,
        timestamp,
        bankPaybillNumber: callback.BusinessShortCode,
        bankAccountNumber: callback.BillRefNumber,
        rawData: callback,
      });
      await recordReconciliation(sql, event.id, callback.TransAmount, result);
    } catch (error: any) {
      await sql`UPDATE public.external_payment_events SET processing_status =
          CASE WHEN processing_attempts + 1 >= 5 THEN 'failed' ELSE 'retry' END,
        processing_attempts = processing_attempts + 1,
        next_attempt_at = NOW() + (LEAST(processing_attempts + 1, 5) * INTERVAL '5 minutes'),
        last_processing_error = ${String(error?.message || error).slice(0, 500)},
        operator_review_required = (processing_attempts + 1 >= 5)
        WHERE id = ${event.id}`;
    }

    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Payment captured' });
  } catch (error: any) {
    console.error('[M-PESA C2B] Durable ingestion failed', error instanceof Error ? error.message : String(error));
    // A non-success response is intentional: if durable capture itself failed,
    // the provider must retry rather than silently losing the notification.
    return res.status(500).json({ ResultCode: 1, ResultDesc: eventId ? 'Processing state update failed' : 'Capture failed' });
  } finally {
    await sql.end();
  }
}

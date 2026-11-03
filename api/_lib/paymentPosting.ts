import type { Sql } from 'postgres';
import { enqueuePaymentOutbox } from './paymentOutbox.js';

export type PostExternalEventInput = {
  invoiceId: string;
  method: 'automatic' | 'manual';
  reconciliationMethod: string;
  note: string;
  actorId?: string | null;
  allowUnverified?: boolean;
};

/**
 * The shared receipt/allocation boundary for external events. It locks the
 * source event and invoice, writes the receipt and audit evidence, then updates
 * balances and processing state in one transaction. Excess remains explicit on
 * the immutable event rather than being discarded or invented as invoice cash.
 */
export async function postExternalPaymentEvent(
  sql: Sql,
  eventId: string,
  input: PostExternalEventInput,
) {
  return sql.begin(async (tx) => {
    await tx`SET LOCAL TIME ZONE 'UTC'`;
    const [event] = await tx`
      SELECT * FROM public.external_payment_events WHERE id = ${eventId} FOR UPDATE
    `;
    if (!event) throw new Error('Payment event not found');
    if (event.processing_status === 'processed'
        || ['auto_matched', 'manually_matched'].includes(event.reconciliation_status)) {
      return { duplicate: true, applied: 0, unallocated: Number(event.unallocated_amount || 0) };
    }
    if (!event.is_verified && !input.allowUnverified) {
      throw new Error('Payment event has not been verified');
    }

    const [invoice] = await tx`
      SELECT id, lease_id, landlord_id, amount, COALESCE(amount_paid, 0) AS amount_paid,
             currency, status, due_date
      FROM public.invoices WHERE id = ${input.invoiceId} FOR UPDATE
    `;
    if (!invoice || !invoice.lease_id || invoice.landlord_id !== event.landlord_id) {
      throw new Error('Invoice is outside the receiving portfolio');
    }
    if (invoice.currency !== event.currency || ['cancelled', 'disputed'].includes(invoice.status)) {
      throw new Error('Invoice cannot receive this payment event');
    }

    const eventCents = Math.round(Number(event.amount) * 100);
    const outstandingCents = Math.max(0,
      Math.round(Number(invoice.amount) * 100) - Math.round(Number(invoice.amount_paid) * 100));
    const appliedCents = Math.min(eventCents, outstandingCents);
    if (eventCents <= 0 || appliedCents <= 0) throw new Error('Invoice has no payable balance');
    const applied = (appliedCents / 100).toFixed(2);
    const unallocated = ((eventCents - appliedCents) / 100).toFixed(2);

    const [receipt] = await tx`
      INSERT INTO public.payments (
        lease_id, invoice_id, bank_event_id, source_event_id, amount, due_date, paid_date,
        payment_method, payment_type, payment_source, status, description
      ) VALUES (
        ${invoice.lease_id}, ${invoice.id},
        ${event.event_type === 'bank_webhook' ? event.id : null}, ${event.id}, ${applied},
        ${invoice.due_date}, ${event.transaction_time},
        ${event.event_type.includes('mpesa') ? 'mpesa' : 'bank_transfer'}, 'rent',
        ${event.event_type}, 'completed', ${input.note}
      )
      ON CONFLICT (source_event_id, invoice_id)
        WHERE source_event_id IS NOT NULL AND invoice_id IS NOT NULL
      DO NOTHING
      RETURNING id
    `;
    if (!receipt) {
      return { duplicate: true, applied: 0, unallocated: Number(event.unallocated_amount || 0) };
    }

    const nextPaidCents = Math.round(Number(invoice.amount_paid) * 100) + appliedCents;
    const paid = nextPaidCents >= Math.round(Number(invoice.amount) * 100);
    await tx`UPDATE public.invoices SET amount_paid = ${(nextPaidCents / 100).toFixed(2)},
      status = ${paid ? 'paid' : 'partially_paid'}::invoice_status,
      paid_at = ${paid ? event.transaction_time : null}, updated_at = NOW() WHERE id = ${invoice.id}`;

    await tx`INSERT INTO public.payment_audit_history
      (payment_id, source_event_id, action, amount, actor_id, reason, evidence)
      VALUES (${receipt.id}, ${event.id}, 'posted', ${applied}, ${input.actorId || null}, ${input.note},
        ${JSON.stringify({ provider: event.provider, externalTransactionId: event.external_transaction_id })}::jsonb)`;
    await enqueuePaymentOutbox(tx, receipt.id);

    const needsReview = Number(unallocated) > 0;
    await tx`UPDATE public.external_payment_events SET
      processing_status = 'processed', processed_at = NOW(), last_processing_error = NULL,
      processing_attempts = processing_attempts + 1,
      reconciliation_status = ${input.method === 'manual' ? 'manually_matched' : 'auto_matched'},
      matched_invoice_id = ${invoice.id}, reconciliation_method = ${input.reconciliationMethod},
      reconciled_at = NOW(), reconciliation_notes = ${input.note},
      unallocated_amount = ${unallocated}, operator_review_required = ${needsReview}
      WHERE id = ${event.id}`;

    return { duplicate: false, paymentId: receipt.id, applied: Number(applied),
      unallocated: Number(unallocated), invoiceStatus: paid ? 'paid' : 'partially_paid' };
  });
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { requireAuth } from '../../_lib/auth.js';
import { createDbConnection } from '../../_lib/db.js';

const approveSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
  invoiceId: z.string().min(1).optional(),
  note: z.string().max(500).optional(),
});

/**
 * POST /api/landlord/reconciliation/approve
 * Manually approves a pending payment event and applies it to an invoice.
 */
export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (auth.role !== 'landlord') {
    return res.status(403).json({ error: 'Only landlords can approve reconciliations' });
  }

  const sql = createDbConnection();

  try {
    const payload = approveSchema.parse(req.body ?? {});

    const result = await sql.begin(async (tx) => {
      const [event] = await tx`
        SELECT
          id,
          landlord_id,
          amount,
          currency,
          event_type,
          transaction_time,
          reconciliation_status,
          matched_invoice_id,
          confidence_score,
          reconciliation_notes
        FROM public.external_payment_events
        WHERE id = ${payload.eventId}
          AND landlord_id = ${auth.userId}
        FOR UPDATE
      `;

      if (!event) {
        return { status: 404, body: { error: 'Pending review item not found' } };
      }

      if (event.reconciliation_status !== 'pending_review') {
        return {
          status: 409,
          body: {
            error: 'Item is not pending review',
            currentStatus: event.reconciliation_status,
          },
        };
      }

      const invoiceId = payload.invoiceId || event.matched_invoice_id;
      if (!invoiceId) {
        return {
          status: 400,
          body: { error: 'invoiceId is required when there is no suggested invoice' },
        };
      }

      const [invoice] = await tx`
        SELECT
          id,
          landlord_id,
          lease_id,
          currency,
          invoice_type,
          amount,
          amount_paid,
          status,
          due_date,
          paid_at
        FROM public.invoices
        WHERE id = ${invoiceId}
          AND landlord_id = ${auth.userId}
        FOR UPDATE
      `;

      if (!invoice) {
        return { status: 404, body: { error: 'Invoice not found for this landlord' } };
      }

      if (['cancelled', 'disputed'].includes(invoice.status)) {
        return {
          status: 400,
          body: { error: `Cannot apply payment to ${invoice.status} invoice` },
        };
      }

      const invoiceAmount = Number(invoice.amount || 0);
      const currentPaid = Number(invoice.amount_paid || 0);
      const paymentAmount = Number(event.amount || 0);
      const newAmountPaid = currentPaid + paymentAmount;

      if (event.event_type === 'bank_webhook' && (!invoice.lease_id
        || invoice.invoice_type !== 'rent' || invoice.currency !== event.currency
        || newAmountPaid > invoiceAmount + 0.005)) {
        return { status: 422, body: { error: 'Select a rent invoice with sufficient outstanding balance in the same currency' } };
      }

      if (event.event_type === 'bank_webhook') {
        const [existingReceipt] = await tx`
          SELECT id FROM public.payments
          WHERE bank_event_id = ${event.id} AND status = 'completed' LIMIT 1
        `;
        if (existingReceipt) return { status: 409, body: { error: 'Event already has a completed receipt' } };
        const receipts = await tx`
          INSERT INTO public.payments
            (lease_id, invoice_id, bank_event_id, amount, due_date, paid_date,
             payment_method, payment_type, payment_source, status, description)
          VALUES (${invoice.lease_id}, ${invoice.id}, ${event.id}, ${paymentAmount.toFixed(2)},
                  ${invoice.due_date}, ${event.transaction_time}, 'bank_transfer', 'rent',
                  'bank_reconciliation', 'completed', 'Bank payment approved by landlord')
          ON CONFLICT (bank_event_id, invoice_id) WHERE bank_event_id IS NOT NULL
          DO UPDATE SET amount = EXCLUDED.amount, status = 'completed',
                        paid_date = EXCLUDED.paid_date, updated_at = NOW()
          WHERE payments.status = 'cancelled'
          RETURNING id
        `;
        if (receipts.length !== 1) throw new Error('Bank event already has a completed receipt');
      }

      const nextStatus = newAmountPaid >= invoiceAmount - 0.01 ? 'paid' : 'partially_paid';
      const nextPaidAt = nextStatus === 'paid' ? new Date().toISOString() : null;

      await tx`
        UPDATE public.invoices
        SET
          amount_paid = ${newAmountPaid.toFixed(2)},
          status = ${nextStatus}::invoice_status,
          paid_at = ${nextPaidAt},
          updated_at = NOW()
        WHERE id = ${invoice.id}
      `;

      const note = payload.note?.trim();
      const reviewNote = note ? `Manually approved: ${note}` : 'Manually approved by landlord';

      await tx`
        UPDATE public.external_payment_events
        SET
          reconciliation_status = 'manually_matched',
          matched_invoice_id = ${invoice.id},
          reconciliation_method = 'manual_review',
          confidence_score = COALESCE(confidence_score, 0),
          reconciled_at = NOW(),
          reconciliation_notes = TRIM(BOTH '; ' FROM CONCAT(COALESCE(reconciliation_notes, ''), CASE WHEN COALESCE(reconciliation_notes, '') = '' THEN '' ELSE '; ' END, ${reviewNote}))
        WHERE id = ${event.id}
      `;

      return {
        status: 200,
        body: {
          success: true,
          eventId: event.id,
          invoiceId: invoice.id,
          amountApplied: paymentAmount,
          invoiceStatus: nextStatus,
        },
      };
    });

    return res.status(result.status).json(result.body);
  } catch (error: any) {
    console.error('[Reconciliation Approve] Error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request payload',
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: 'Failed to approve pending review item',
      details: error.message,
    });
  } finally {
    await sql.end();
  }
});

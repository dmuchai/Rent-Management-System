import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { requireAuth } from '../../_lib/auth.js';
import { createDbConnection } from '../../_lib/db.js';

const reverseSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/landlord/reconciliation/reverse
 * Reverses a previously matched event and re-queues it for manual review.
 */
export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (auth.role !== 'landlord') {
    return res.status(403).json({ error: 'Only landlords can reverse reconciliations' });
  }

  const sql = createDbConnection();

  try {
    const payload = reverseSchema.parse(req.body ?? {});

    const result = await sql.begin(async (tx) => {
      const [event] = await tx`
        SELECT
          id,
          amount,
          reconciliation_status,
          matched_invoice_id,
          reconciliation_notes
        FROM public.external_payment_events
        WHERE id = ${payload.eventId}
          AND landlord_id = ${auth.userId}
        FOR UPDATE
      `;

      if (!event) {
        return { status: 404, body: { error: 'Matched item not found' } };
      }

      if (!['auto_matched', 'manually_matched'].includes(event.reconciliation_status)) {
        return {
          status: 409,
          body: {
            error: 'Only matched items can be reversed',
            currentStatus: event.reconciliation_status,
          },
        };
      }

      if (!event.matched_invoice_id) {
        return {
          status: 400,
          body: { error: 'Matched invoice is missing; cannot reverse safely' },
        };
      }

      const [invoice] = await tx`
        SELECT
          id,
          landlord_id,
          amount,
          amount_paid,
          due_date,
          status,
          paid_at
        FROM public.invoices
        WHERE id = ${event.matched_invoice_id}
          AND landlord_id = ${auth.userId}
        FOR UPDATE
      `;

      if (!invoice) {
        return { status: 404, body: { error: 'Linked invoice not found for this landlord' } };
      }

      const invoiceAmount = Number(invoice.amount || 0);
      const currentPaid = Number(invoice.amount_paid || 0);
      const eventAmount = Number(event.amount || 0);
      const newAmountPaid = Math.max(0, currentPaid - eventAmount);

      let nextStatus = 'pending';
      if (newAmountPaid >= invoiceAmount - 0.01) {
        nextStatus = 'paid';
      } else if (newAmountPaid > 0.01) {
        nextStatus = 'partially_paid';
      } else {
        const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
        nextStatus = dueDate && dueDate.getTime() < Date.now() ? 'overdue' : 'pending';
      }

      const nextPaidAt = nextStatus === 'paid' ? (invoice.paid_at || new Date().toISOString()) : null;

      await tx`
        UPDATE public.invoices
        SET
          amount_paid = ${newAmountPaid.toFixed(2)},
          status = ${nextStatus},
          paid_at = ${nextPaidAt},
          updated_at = NOW()
        WHERE id = ${invoice.id}
      `;

      const reason = payload.reason?.trim();
      const reviewNote = reason ? `Reversed by landlord: ${reason}` : 'Reversed by landlord';

      await tx`
        UPDATE public.external_payment_events
        SET
          reconciliation_status = 'pending_review',
          matched_invoice_id = NULL,
          reconciliation_method = 'manual_review',
          confidence_score = 0,
          reconciled_at = NULL,
          reconciliation_notes = TRIM(BOTH '; ' FROM CONCAT(COALESCE(reconciliation_notes, ''), CASE WHEN COALESCE(reconciliation_notes, '') = '' THEN '' ELSE '; ' END, ${reviewNote}))
        WHERE id = ${event.id}
      `;

      return {
        status: 200,
        body: {
          success: true,
          eventId: event.id,
          invoiceId: invoice.id,
          invoiceStatus: nextStatus,
          amountPaid: Number(newAmountPaid.toFixed(2)),
        },
      };
    });

    return res.status(result.status).json(result.body);
  } catch (error: any) {
    console.error('[Reconciliation Reverse] Error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request payload',
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: 'Failed to reverse reconciliation',
      details: error.message,
    });
  } finally {
    await sql.end();
  }
});

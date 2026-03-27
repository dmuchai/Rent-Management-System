import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { requireAuth } from '../../_lib/auth.js';
import { createDbConnection } from '../../_lib/db.js';

const rejectSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/landlord/reconciliation/reject
 * Marks a pending payment event as rejected/ignored by landlord review.
 */
export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (auth.role !== 'landlord') {
    return res.status(403).json({ error: 'Only landlords can reject reconciliations' });
  }

  const sql = createDbConnection();

  try {
    const payload = rejectSchema.parse(req.body ?? {});

    const result = await sql.begin(async (tx) => {
      const [event] = await tx`
        SELECT id, reconciliation_status, reconciliation_notes
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

      const reason = payload.reason?.trim();
      const reviewNote = reason ? `Rejected by landlord: ${reason}` : 'Rejected by landlord';

      await tx`
        UPDATE public.external_payment_events
        SET
          reconciliation_status = 'ignored',
          matched_invoice_id = NULL,
          reconciliation_method = 'manual_review',
          reconciled_at = NOW(),
          reconciliation_notes = TRIM(BOTH '; ' FROM CONCAT(COALESCE(reconciliation_notes, ''), CASE WHEN COALESCE(reconciliation_notes, '') = '' THEN '' ELSE '; ' END, ${reviewNote}))
        WHERE id = ${event.id}
      `;

      return {
        status: 200,
        body: {
          success: true,
          eventId: event.id,
          reconciliationStatus: 'ignored',
        },
      };
    });

    return res.status(result.status).json(result.body);
  } catch (error: any) {
    console.error('[Reconciliation Reject] Error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request payload',
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: 'Failed to reject pending review item',
      details: error.message,
    });
  } finally {
    await sql.end();
  }
});

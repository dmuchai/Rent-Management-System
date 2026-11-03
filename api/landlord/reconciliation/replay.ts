import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { requireAuth } from '../../_lib/auth.js';
import { createDbConnection } from '../../_lib/db.js';

const schema = z.object({ eventId: z.string().min(1), reason: z.string().trim().min(3).max(500) });

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!['landlord', 'property_manager'].includes(auth.role)) return res.status(403).json({ error: 'Forbidden' });
  const sql = createDbConnection();
  try {
    const input = schema.parse(req.body);
    const [event] = await sql`UPDATE public.external_payment_events SET processing_status = 'retry',
      processing_attempts = 0, next_attempt_at = NOW(), replayed_at = NOW(),
      operator_review_required = false, last_processing_error = NULL,
      reconciliation_notes = CONCAT(COALESCE(reconciliation_notes || '; ', ''), ${`Replay requested: ${input.reason}`})
      WHERE id = ${input.eventId} AND landlord_id = ${auth.contextOwnerId}
        AND processing_status IN ('failed', 'review', 'retry')
      RETURNING id, amount`;
    if (!event) return res.status(404).json({ error: 'Replayable event not found' });
    await sql`INSERT INTO public.payment_audit_history
      (source_event_id, action, amount, actor_id, reason)
      VALUES (${event.id}, 'reviewed', ${event.amount}, ${auth.userId}, ${input.reason})`;
    return res.status(202).json({ success: true, eventId: event.id });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request', details: error.errors });
    console.error('[Payment replay] Failed', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ error: 'Failed to queue replay' });
  } finally { await sql.end(); }
});

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { requireAuth } from '../../_lib/auth.js';
import { createDbConnection } from '../../_lib/db.js';
import { postExternalPaymentEvent } from '../../_lib/paymentPosting.js';

const approveSchema = z.object({
  eventId: z.string().min(1),
  invoiceId: z.string().min(1).optional(),
  note: z.string().trim().min(3).max(500).optional(),
});

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!['landlord', 'property_manager'].includes(auth.role)) {
    return res.status(403).json({ error: 'Only portfolio managers can approve reconciliations' });
  }
  const sql = createDbConnection();
  try {
    const payload = approveSchema.parse(req.body ?? {});
    const [event] = await sql`SELECT id, landlord_id, matched_invoice_id, reconciliation_status
      FROM public.external_payment_events WHERE id = ${payload.eventId}`;
    if (!event || event.landlord_id !== auth.contextOwnerId) {
      return res.status(404).json({ error: 'Pending review item not found' });
    }
    if (!['pending_review', 'unmatched'].includes(event.reconciliation_status)) {
      return res.status(409).json({ error: 'Item is not awaiting review', currentStatus: event.reconciliation_status });
    }
    const invoiceId = payload.invoiceId || event.matched_invoice_id;
    if (!invoiceId) return res.status(400).json({ error: 'invoiceId is required' });
    const result = await postExternalPaymentEvent(sql, event.id, {
      invoiceId,
      method: 'manual',
      reconciliationMethod: 'manual_review',
      note: `Manually approved: ${payload.note || 'operator confirmed source evidence'}`,
      actorId: auth.userId,
      allowUnverified: true,
    });
    if (result.duplicate) return res.status(409).json({ error: 'Event was already posted' });
    return res.status(200).json({ success: true, eventId: event.id, invoiceId,
      amountApplied: result.applied, unallocatedAmount: result.unallocated,
      invoiceStatus: result.invoiceStatus });
  } catch (error: any) {
    console.error('[Reconciliation Approve] Error', error instanceof Error ? error.message : String(error));
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request payload', details: error.errors });
    const status = /outside|cannot receive|no payable/.test(String(error?.message)) ? 422 : 500;
    return res.status(status).json({ error: status === 422 ? error.message : 'Failed to approve review item' });
  } finally {
    await sql.end();
  }
});

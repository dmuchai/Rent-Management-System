import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../../_lib/auth.js';
import { createDbConnection } from '../../_lib/db.js';

/**
 * GET /api/landlord/reconciliation/pending-review
 * Lists payment events awaiting landlord manual review.
 */
export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (auth.role !== 'landlord') {
    return res.status(403).json({ error: 'Only landlords can review reconciliations' });
  }

  const sql = createDbConnection();

  try {
    const rows = await sql`
      SELECT
        e.id,
        e.provider,
        e.event_type,
        e.external_transaction_id,
        e.amount,
        e.currency,
        e.payer_phone,
        e.payer_name,
        e.payer_account_ref,
        e.transaction_time,
        e.reconciliation_status,
        e.reconciliation_method,
        e.confidence_score,
        e.reconciliation_notes,
        e.matched_invoice_id,
        e.created_at,
        i.reference_code AS suggested_invoice_reference,
        i.amount AS suggested_invoice_amount,
        i.status AS suggested_invoice_status,
        i.due_date AS suggested_invoice_due_date
      FROM public.external_payment_events e
      LEFT JOIN public.invoices i ON i.id = e.matched_invoice_id
      WHERE e.landlord_id = ${auth.userId}
        AND e.reconciliation_status = 'pending_review'
      ORDER BY e.transaction_time DESC, e.created_at DESC
      LIMIT 200
    `;

    const pending = rows.map((row: any) => ({
      id: row.id,
      provider: row.provider,
      eventType: row.event_type,
      externalTransactionId: row.external_transaction_id,
      amount: Number(row.amount),
      currency: row.currency,
      payerPhone: row.payer_phone,
      payerName: row.payer_name,
      payerAccountRef: row.payer_account_ref,
      transactionTime: row.transaction_time,
      reconciliationStatus: row.reconciliation_status,
      reconciliationMethod: row.reconciliation_method,
      confidenceScore: row.confidence_score != null ? Number(row.confidence_score) : null,
      reconciliationNotes: row.reconciliation_notes,
      suggestedInvoice: row.suggested_invoice_reference
        ? {
            id: row.matched_invoice_id,
            referenceCode: row.suggested_invoice_reference,
            amount: Number(row.suggested_invoice_amount),
            status: row.suggested_invoice_status,
            dueDate: row.suggested_invoice_due_date,
          }
        : null,
      createdAt: row.created_at,
    }));

    return res.status(200).json({
      total: pending.length,
      items: pending,
    });
  } catch (error: any) {
    console.error('[Pending Review] Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch pending review items',
      details: error.message,
    });
  } finally {
    await sql.end();
  }
});

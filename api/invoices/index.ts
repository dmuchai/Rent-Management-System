// GET /api/invoices - List formal invoices for the authenticated landlord
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';

const invoiceStatuses = new Set([
  'pending',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled',
  'disputed',
]);

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (auth.role !== 'landlord') {
    return res.status(403).json({ error: 'Only landlords can view landlord invoices' });
  }

  const requestedStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
  if (requestedStatus && requestedStatus !== 'outstanding' && !invoiceStatuses.has(requestedStatus)) {
    return res.status(400).json({ error: 'Invalid invoice status' });
  }

  const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || '100'), 10) || 100, 1), 200);
  const propertyId = typeof req.query.propertyId === 'string' ? req.query.propertyId : undefined;
  const sql = createDbConnection();

  try {
    const rows = await sql`
      SELECT
        i.id,
        i.reference_code,
        i.amount,
        COALESCE(i.amount_paid, 0) AS amount_paid,
        GREATEST(i.amount - COALESCE(i.amount_paid, 0), 0) AS amount_outstanding,
        COALESCE(i.currency, 'KES') AS currency,
        i.billing_period_start,
        i.billing_period_end,
        i.due_date,
        i.invoice_type,
        i.description,
        i.status,
        (
          i.status = 'overdue'
          OR (i.status IN ('pending', 'partially_paid') AND i.due_date < NOW())
        ) AS is_overdue,
        i.issued_at,
        i.created_at,
        t.id AS tenant_id,
        t.first_name,
        t.last_name,
        t.email AS tenant_email,
        u.id AS unit_id,
        u.unit_number,
        p.id AS property_id,
        p.name AS property_name
      FROM public.invoices i
      LEFT JOIN public.tenants t ON t.id = i.tenant_id
      LEFT JOIN public.leases l ON l.id = i.lease_id
      LEFT JOIN public.units u ON u.id = l.unit_id
      LEFT JOIN public.properties p ON p.id = u.property_id
      WHERE i.landlord_id = ${auth.userId}
        ${requestedStatus === 'outstanding'
          ? sql`AND i.status IN ('pending', 'partially_paid', 'overdue')`
          : requestedStatus
            ? sql`AND i.status = ${requestedStatus}`
            : sql``}
        ${propertyId ? sql`AND p.id = ${propertyId}` : sql``}
      ORDER BY
        CASE WHEN i.status IN ('pending', 'partially_paid', 'overdue') THEN 0 ELSE 1 END,
        i.due_date ASC,
        i.created_at DESC
      LIMIT ${limit}
    `;

    return res.status(200).json({
      data: rows.map((row: any) => ({
        id: row.id,
        referenceCode: row.reference_code,
        amount: Number(row.amount),
        amountPaid: Number(row.amount_paid),
        amountOutstanding: Number(row.amount_outstanding),
        currency: row.currency,
        billingPeriodStart: row.billing_period_start,
        billingPeriodEnd: row.billing_period_end,
        dueDate: row.due_date,
        invoiceType: row.invoice_type,
        description: row.description,
        status: row.status,
        isOverdue: row.is_overdue,
        issuedAt: row.issued_at,
        createdAt: row.created_at,
        tenant: row.tenant_id
          ? {
              id: row.tenant_id,
              firstName: row.first_name,
              lastName: row.last_name,
              email: row.tenant_email,
            }
          : null,
        unit: row.unit_id
          ? { id: row.unit_id, unitNumber: row.unit_number }
          : null,
        property: row.property_id
          ? { id: row.property_id, name: row.property_name }
          : null,
      })),
      pagination: { limit, nextCursor: null },
    });
  } catch (error) {
    console.error('[Invoices] Failed to list invoices:', error);
    return res.status(500).json({ error: 'Failed to fetch invoices' });
  } finally {
    await sql.end();
  }
});

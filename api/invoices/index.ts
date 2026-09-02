// GET /api/invoices - List canonical invoices visible to the authenticated account
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

  if (auth.role !== 'landlord' && auth.role !== 'tenant') {
    return res.status(403).json({ error: 'Only landlords and tenants can view invoices' });
  }

  const requestedStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
  if (requestedStatus && requestedStatus !== 'outstanding' && !invoiceStatuses.has(requestedStatus)) {
    return res.status(400).json({ error: 'Invalid invoice status' });
  }

  const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || '100'), 10) || 100, 1), 200);
  const propertyId = typeof req.query.propertyId === 'string' ? req.query.propertyId : undefined;
  const leaseId = typeof req.query.leaseId === 'string' ? req.query.leaseId : undefined;
  const rawCursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const sql = createDbConnection();

  const decodeCursor = (cursor: string | undefined) => {
    if (!cursor) return null;

    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
        statusRank?: number;
        dueDate?: string | null;
        createdAt?: string | null;
        id?: string;
      };

      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      return {
        statusRank: typeof parsed.statusRank === 'number' ? parsed.statusRank : 0,
        dueDate: typeof parsed.dueDate === 'string' ? parsed.dueDate : null,
        createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : null,
        id: typeof parsed.id === 'string' ? parsed.id : null,
      };
    } catch {
      return null;
    }
  };

  const encodeCursor = (row: { statusRank: number; dueDate: string | null; createdAt: string | null; id: string }) => {
    return Buffer.from(JSON.stringify({
      statusRank: row.statusRank,
      dueDate: row.dueDate,
      createdAt: row.createdAt,
      id: row.id,
    })).toString('base64');
  };

  try {
    const cursor = decodeCursor(rawCursor);
    const [orderRank, dueDate, createdAt, id] = [
      cursor?.statusRank ?? 0,
      cursor?.dueDate ? new Date(cursor.dueDate) : null,
      cursor?.createdAt ? new Date(cursor.createdAt) : null,
      cursor?.id ?? null,
    ];

    const rows = await sql`
      SELECT
        i.id,
        i.lease_id,
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
        i.paid_at,
        i.created_at,
        i.updated_at,
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
      WHERE ${auth.role === 'tenant' ? sql`t.user_id = ${auth.userId}` : sql`i.landlord_id = ${auth.userId}`}
        AND i.invoice_type <> 'uat_validation'
        ${requestedStatus === 'outstanding'
          ? sql`AND i.status IN ('pending', 'partially_paid', 'overdue')`
          : requestedStatus
            ? sql`AND i.status = ${requestedStatus}`
            : sql``}
        ${propertyId ? sql`AND p.id = ${propertyId}` : sql``}
        ${leaseId ? sql`AND i.lease_id = ${leaseId}` : sql``}
        ${cursor && id
          ? sql`AND (
              CASE WHEN i.status IN ('pending', 'partially_paid', 'overdue') THEN 0 ELSE 1 END,
              i.due_date,
              i.created_at,
              i.id
            ) > (${orderRank}, ${dueDate}, ${createdAt}, ${id})`
          : sql``}
      ORDER BY
        CASE WHEN i.status IN ('pending', 'partially_paid', 'overdue') THEN 0 ELSE 1 END,
        i.due_date ASC,
        i.created_at DESC,
        i.id ASC
      LIMIT ${limit + 1}
    `;

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const lastRow = pageRows[pageRows.length - 1];

    return res.status(200).json({
      data: pageRows.map((row: any) => ({
        id: row.id,
        leaseId: row.lease_id,
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
        paidAt: row.paid_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
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
      pagination: {
        limit,
        nextCursor: hasMore && lastRow
          ? encodeCursor({
              statusRank: lastRow.status_rank ?? (lastRow.status && ['pending', 'partially_paid', 'overdue'].includes(lastRow.status) ? 0 : 1),
              dueDate: lastRow.due_date ?? null,
              createdAt: lastRow.created_at ?? null,
              id: lastRow.id,
            })
          : null,
      },
    });
  } catch (error) {
    console.error('[Invoices] Failed to list invoices:', error);
    return res.status(500).json({ error: 'Failed to fetch invoices' });
  } finally {
    await sql.end();
  }
});

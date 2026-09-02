import { Router } from "express";
import { createDbConnection } from "../../api/_lib/db.js";
import { isAuthenticated } from "../supabaseAuth";

const router = Router();
const statuses = new Set(["pending", "partially_paid", "paid", "overdue", "cancelled", "disputed"]);

router.get("/", isAuthenticated, async (req: any, res: any) => {
  const userId = req.user.sub;
  const role = req.user.appRole;
  if (role !== "landlord" && role !== "tenant") {
    return res.status(403).json({ message: "Only landlords and tenants can view invoices" });
  }

  const requestedStatus = typeof req.query.status === "string" ? req.query.status : undefined;
  if (requestedStatus && requestedStatus !== "outstanding" && !statuses.has(requestedStatus)) {
    return res.status(400).json({ message: "Invalid invoice status" });
  }

  const leaseId = typeof req.query.leaseId === "string" ? req.query.leaseId : undefined;
  const propertyId = typeof req.query.propertyId === "string" ? req.query.propertyId : undefined;
  const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || "100"), 10) || 100, 1), 200);
  const sql = createDbConnection();

  try {
    const rows = await sql`
      SELECT
        i.*,
        GREATEST(i.amount - COALESCE(i.amount_paid, 0), 0) AS amount_outstanding,
        (i.status = 'overdue' OR (i.status IN ('pending', 'partially_paid') AND i.due_date < NOW())) AS is_overdue,
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
      WHERE ${role === "tenant" ? sql`t.user_id = ${userId}` : sql`i.landlord_id = ${userId}`}
        AND i.invoice_type <> 'uat_validation'
        ${requestedStatus === "outstanding"
          ? sql`AND i.status IN ('pending', 'partially_paid', 'overdue')`
          : requestedStatus
            ? sql`AND i.status = ${requestedStatus}`
            : sql``}
        ${leaseId ? sql`AND i.lease_id = ${leaseId}` : sql``}
        ${propertyId ? sql`AND p.id = ${propertyId}` : sql``}
      ORDER BY
        CASE WHEN i.status IN ('pending', 'partially_paid', 'overdue') THEN 0 ELSE 1 END,
        i.due_date ASC,
        i.created_at DESC
      LIMIT ${limit}
    `;

    return res.json({
      data: rows.map((row: any) => ({
        id: row.id,
        leaseId: row.lease_id,
        referenceCode: row.reference_code,
        amount: Number(row.amount),
        amountPaid: Number(row.amount_paid || 0),
        amountOutstanding: Number(row.amount_outstanding),
        currency: row.currency || "KES",
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
        tenant: row.tenant_id ? {
          id: row.tenant_id,
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.tenant_email,
        } : null,
        unit: row.unit_id ? { id: row.unit_id, unitNumber: row.unit_number } : null,
        property: row.property_id ? { id: row.property_id, name: row.property_name } : null,
      })),
      pagination: { limit, nextCursor: null },
    });
  } catch (error) {
    console.error("[Invoices] Failed to list invoices:", error);
    return res.status(500).json({ message: "Failed to fetch invoices" });
  } finally {
    await sql.end();
  }
});

export default router;

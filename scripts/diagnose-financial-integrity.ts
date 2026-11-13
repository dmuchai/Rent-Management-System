import postgres from 'postgres';

const connectionString = process.env.LOCAL_TEST_DATABASE_URL;
if (!connectionString) throw new Error('LOCAL_TEST_DATABASE_URL is required');
const parsed = new URL(connectionString);
if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
  throw new Error('Diagnostics are restricted to a disposable local PostgreSQL database');
}

const sql = postgres(connectionString, { max: 1 });
try {
  // The host restriction prevents accidental remote access; the session
  // setting independently prevents this diagnostic from mutating a local DB.
  await sql.unsafe('SET default_transaction_read_only = on');
  const invoiceMismatches = await sql`
    SELECT i.id, i.amount_paid AS recorded_amount_paid,
      COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) AS completed_receipts
    FROM public.invoices i LEFT JOIN public.payments p ON p.invoice_id = i.id
    GROUP BY i.id, i.amount_paid
    HAVING i.amount_paid <> COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0)
    ORDER BY i.id
  `;
  const matchedWithoutReceipt = await sql`
    SELECT e.id, e.provider, e.external_transaction_id, e.reconciliation_status
    FROM public.external_payment_events e
    LEFT JOIN public.payments p ON p.source_event_id = e.id OR p.bank_event_id = e.id
    WHERE e.reconciliation_status IN ('auto_matched', 'manually_matched') AND p.id IS NULL
    ORDER BY e.id
  `;
  const receiptConflicts = await sql`
    SELECT provider_receipt_id, COUNT(*)::int AS count
    FROM public.payments WHERE provider_receipt_id IS NOT NULL
    GROUP BY provider_receipt_id HAVING COUNT(*) > 1
  `;
  const unscopedAuthorities = await sql`
    SELECT u.id, u.role FROM public.users u
    LEFT JOIN public.user_context_memberships m ON m.user_id = u.id AND m.status = 'active'
    WHERE u.role IN ('landlord', 'tenant', 'property_manager', 'caretaker') AND m.id IS NULL
    ORDER BY u.id
  `;
  console.log(JSON.stringify({
    mode: 'read-only',
    invoiceMismatches,
    matchedWithoutReceipt,
    receiptConflicts,
    unscopedAuthorities,
    requiresHumanReview: invoiceMismatches.length + matchedWithoutReceipt.length
      + receiptConflicts.length + unscopedAuthorities.length,
  }, null, 2));
} finally {
  await sql.end();
}

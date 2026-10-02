import type { Sql } from 'postgres';

type OutstandingInvoice = {
  id: string;
  lease_id: string;
  amount: string | number;
  amount_paid: string | number;
  billing_period_start: Date | string;
  due_date: Date | string;
  created_at: Date | string;
};

export function normalizedPayerPhone(value: string | null | undefined): string | null {
  const digits = (value || '').replace(/\D/g, '');
  if (/^254[17]\d{8}$/.test(digits)) return digits.slice(3);
  if (/^0[17]\d{8}$/.test(digits)) return digits.slice(1);
  return null;
}

/** Work in cents; never guess an invoice from amount or landlord identity. */
export function oldestInvoiceAllocations(amount: number, invoices: OutstandingInvoice[]) {
  let remaining = Math.round(amount * 100);
  if (!Number.isFinite(amount) || remaining <= 0) return null;
  const ordered = [...invoices].sort((a, b) =>
    new Date(a.billing_period_start).getTime() - new Date(b.billing_period_start).getTime()
    || new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    || a.id.localeCompare(b.id));
  const allocations: { invoice: OutstandingInvoice; cents: number }[] = [];
  for (const invoice of ordered) {
    const outstanding = Math.max(0, Math.round(Number(invoice.amount) * 100)
      - Math.round(Number(invoice.amount_paid || 0) * 100));
    const cents = Math.min(remaining, outstanding);
    if (cents > 0) allocations.push({ invoice, cents });
    remaining -= cents;
    if (!remaining) break;
  }
  // Excess funds require an explicit credit policy. Do not lose a remainder.
  return remaining === 0 ? allocations : null;
}

export async function allocateBankEvent(
  sql: Sql,
  eventId: string,
  options: {
    dryRun?: boolean;
    // Operator-only recovery based on audit evidence; never changes is_verified.
    auditEvidence?: string;
    referenceCode?: string;
  } = {},
) {
  return sql.begin(async (tx) => {
    // Application timestamps without an offset are stored as UTC. Explicitly
    // preserve that meaning on operator machines in other time zones.
    await tx`SET LOCAL TIME ZONE 'UTC'`;
    const [event] = await tx`
      SELECT id, landlord_id, amount, currency, payer_phone, payer_account_ref,
             transaction_time AT TIME ZONE 'UTC' AS transaction_time,
             reconciliation_status, is_verified, provider
      FROM public.external_payment_events WHERE id = ${eventId} FOR UPDATE
    `;
    if (!event) throw new Error('Bank event not found');
    if (!['unmatched', 'pending_review'].includes(event.reconciliation_status)) {
      return { matched: ['auto_matched', 'manually_matched'].includes(event.reconciliation_status),
        duplicate: true, allocationCount: 0, amountApplied: 0, reason: 'Already processed' };
    }
    const review = async (reason: string) => {
      if (!options.dryRun) {
        await tx`
          UPDATE public.external_payment_events
          SET reconciliation_status = 'pending_review', reconciliation_method = 'manual_review',
              confidence_score = 0, reconciliation_notes = ${reason}
          WHERE id = ${eventId}
        `;
      }
      return { matched: false, duplicate: false, allocationCount: 0, amountApplied: 0, reason };
    };
    if (!event.landlord_id) return review('Receiving landlord is unresolved');
    if (event.currency !== 'KES') return review('Unsupported allocation currency');
    if (!event.is_verified && !options.auditEvidence) return review('Signature evidence requires operator review');

    const reference = options.referenceCode || event.payer_account_ref || '';
    const references = await tx`
      SELECT DISTINCT tenant_id FROM public.invoices
      WHERE landlord_id = ${event.landlord_id}
        AND reference_code IN (${reference}, ${event.payer_account_ref || ''})
        AND invoice_type = 'rent' AND tenant_id IS NOT NULL
    `;
    const phone = normalizedPayerPhone(event.payer_phone);
    const tenants = phone ? await tx`
      SELECT DISTINCT t.id FROM public.tenants t
      JOIN public.leases l ON l.tenant_id = t.id
      JOIN public.units u ON u.id = l.unit_id
      JOIN public.properties p ON p.id = u.property_id
      WHERE p.owner_id = ${event.landlord_id}
        AND right(regexp_replace(COALESCE(t.phone, ''), '[^0-9]', '', 'g'), 9) = ${phone}
    ` : [];
    const tenantId = references.length === 1 ? references[0].tenant_id
      : tenants.length === 1 ? tenants[0].id : null;
    if (!tenantId || references.length > 1 || tenants.length > 1
      || (references.length === 1 && tenants.length === 1 && tenants[0].id !== tenantId)) {
      return review('Tenant identity is missing, ambiguous, or conflicting');
    }
    // Serialize different callbacks for one tenant before reading balances.
    await tx`SELECT id FROM public.tenants WHERE id = ${tenantId} FOR UPDATE`;
    const invoices = await tx<OutstandingInvoice[]>`
      SELECT id, lease_id, amount, COALESCE(amount_paid, 0) AS amount_paid,
             billing_period_start AT TIME ZONE 'UTC' AS billing_period_start,
             due_date AT TIME ZONE 'UTC' AS due_date,
             created_at AT TIME ZONE 'UTC' AS created_at
      FROM public.invoices
      WHERE landlord_id = ${event.landlord_id} AND tenant_id = ${tenantId}
        AND invoice_type = 'rent' AND currency = ${event.currency} AND lease_id IS NOT NULL
        AND status IN ('pending', 'partially_paid', 'overdue')
        AND COALESCE(amount_paid, 0) < amount
      ORDER BY billing_period_start, due_date, created_at, id FOR UPDATE
    `;
    const allocations = oldestInvoiceAllocations(Number(event.amount), invoices);
    if (!allocations?.length) return review('No outstanding invoices or payment exceeds outstanding balance');
    const billingMonths = allocations.map(({ invoice }) => new Date(invoice.billing_period_start).toISOString().slice(0, 7));
    if (options.dryRun) return { matched: true, duplicate: false,
      allocationCount: allocations.length, amountApplied: Number(event.amount), billingMonths,
      reason: 'Oldest rent invoices identified' };

    for (const { invoice, cents } of allocations) {
      const amount = (cents / 100).toFixed(2);
      const nextPaid = ((Math.round(Number(invoice.amount_paid) * 100) + cents) / 100).toFixed(2);
      const paid = Math.round(Number(nextPaid) * 100) >= Math.round(Number(invoice.amount) * 100);
      // The event lock and unique index make concurrent/repeated delivery safe.
      const receipts = await tx`
        INSERT INTO public.payments
          (lease_id, invoice_id, bank_event_id, amount, due_date, paid_date,
           payment_method, payment_type, payment_source, status, description)
        VALUES (${invoice.lease_id}, ${invoice.id}, ${eventId}, ${amount},
                ${new Date(invoice.due_date)}, ${new Date(event.transaction_time)},
                'bank_transfer', 'rent', 'bank_reconciliation', 'completed',
                'Bank payment allocated to oldest outstanding rent invoice')
        ON CONFLICT (bank_event_id, invoice_id) WHERE bank_event_id IS NOT NULL
        DO UPDATE SET amount = EXCLUDED.amount, status = 'completed',
                      paid_date = EXCLUDED.paid_date, updated_at = NOW()
        WHERE payments.status = 'cancelled'
        RETURNING id
      `;
      if (receipts.length !== 1) throw new Error('Bank allocation already has a completed receipt');
      await tx`
        UPDATE public.invoices SET amount_paid = ${nextPaid},
          status = ${paid ? 'paid' : 'partially_paid'}::invoice_status,
          paid_at = ${paid ? new Date(event.transaction_time) : null}, updated_at = NOW()
        WHERE id = ${invoice.id}
      `;
    }
    const note = options.auditEvidence
      ? `Oldest-invoice allocation; operator approval based on ${options.auditEvidence}`
      : 'Oldest-invoice allocation; verified bank callback';
    await tx`
      UPDATE public.external_payment_events
      SET reconciliation_status = ${options.auditEvidence ? 'manually_matched' : 'auto_matched'},
          matched_invoice_id = ${allocations[0].invoice.id},
          reconciliation_method = 'oldest_invoice', confidence_score = 100,
          reconciled_at = NOW(), reconciliation_notes = ${note}
      WHERE id = ${eventId}
    `;
    return { matched: true, duplicate: false, allocationCount: allocations.length,
      amountApplied: Number(event.amount), billingMonths, reason: 'Allocated to oldest outstanding rent invoices' };
  });
}

/** Caller holds the event lock and owns the receiving landlord account. */
export async function reverseBankAllocations(tx: any, eventId: string, landlordId: string): Promise<number> {
  const allocations = await tx`
    SELECT p.id, p.invoice_id, p.amount FROM public.payments p
    WHERE p.bank_event_id = ${eventId} AND p.status = 'completed'
    ORDER BY p.invoice_id FOR UPDATE
  `;
  for (const allocation of allocations) {
    const [invoice] = await tx`
      SELECT id, COALESCE(amount_paid, 0) AS amount_paid FROM public.invoices
      WHERE id = ${allocation.invoice_id} AND landlord_id = ${landlordId} FOR UPDATE
    `;
    if (!invoice || Number(invoice.amount_paid) + 0.005 < Number(allocation.amount)) {
      throw new Error('Allocation balance cannot be reversed safely');
    }
    await tx`
      UPDATE public.invoices SET amount_paid = amount_paid - ${allocation.amount}::numeric,
        status = CASE
          WHEN status IN ('cancelled', 'disputed') THEN status
          WHEN amount_paid - ${allocation.amount}::numeric >= amount THEN 'paid'::invoice_status
          WHEN amount_paid - ${allocation.amount}::numeric > 0 THEN 'partially_paid'::invoice_status
          WHEN due_date < NOW() THEN 'overdue'::invoice_status ELSE 'pending'::invoice_status END,
        paid_at = CASE WHEN amount_paid - ${allocation.amount}::numeric >= amount THEN paid_at ELSE NULL END,
        updated_at = NOW() WHERE id = ${invoice.id}
    `;
    await tx`UPDATE public.payments SET status = 'cancelled', updated_at = NOW() WHERE id = ${allocation.id}`;
  }
  if (allocations.length) {
    await tx`
      UPDATE public.external_payment_events SET reconciliation_status = 'pending_review',
        matched_invoice_id = NULL, reconciliation_method = 'manual_review', confidence_score = 0,
        reconciled_at = NULL, reconciliation_notes = 'Bank allocations reversed by landlord; receipts cancelled'
      WHERE id = ${eventId}
    `;
  }
  return allocations.length;
}

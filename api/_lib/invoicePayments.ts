import { createHash } from 'node:crypto';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export class InvoicePaymentError extends Error {
  constructor(
    public readonly code:
      | 'LEASE_NOT_FOUND'
      | 'PAYMENT_ACCESS_DENIED'
      | 'RENT_INVOICE_REQUIRED'
      | 'INVOICE_NOT_PAYABLE'
      | 'PAYMENT_EXCEEDS_OUTSTANDING'
      | 'PAYMENT_NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'InvoicePaymentError';
  }
}

type Actor = {
  userId: string;
  role: string;
};

type CreatePaymentInput = {
  leaseId: string;
  invoiceId?: string | null;
  amount: number | string;
  dueDate?: Date;
  paidDate?: Date | null;
  paymentMethod?: string | null;
  paymentType?: string;
  paymentSource: string;
  status?: PaymentStatus;
  description?: string | null;
  actor: Actor;
};

type TransitionPatch = {
  transactionId?: string | null;
  paymentMethod?: string | null;
  description?: string | null;
  paidDate?: Date | null;
  allowCompletionReversal?: boolean;
};

export function canonicalRentInvoiceReference(leaseId: string, billingPeriodStart: Date): string {
  const period = `${billingPeriodStart.getUTCFullYear()}${String(billingPeriodStart.getUTCMonth() + 1).padStart(2, '0')}`;
  const hashToken = createHash('sha256').update(`${leaseId}:${period}`).digest('hex').slice(0, 12).toUpperCase();
  return `I${hashToken}`;
}

export function paymentCompletionDelta(
  previousStatus: PaymentStatus,
  nextStatus: PaymentStatus,
  amount: number,
): number {
  if (previousStatus !== 'completed' && nextStatus === 'completed') return amount;
  if (previousStatus === 'completed' && nextStatus !== 'completed') return -amount;
  return 0;
}

async function assertLeaseAccess(tx: any, leaseId: string, actor: Actor) {
  const [lease] = await tx`
    SELECT
      l.id,
      t.user_id AS tenant_user_id,
      p.owner_id AS landlord_user_id
    FROM public.leases l
    JOIN public.tenants t ON t.id = l.tenant_id
    JOIN public.units u ON u.id = l.unit_id
    JOIN public.properties p ON p.id = u.property_id
    WHERE l.id = ${leaseId}
    LIMIT 1
  `;

  if (!lease) {
    throw new InvoicePaymentError('LEASE_NOT_FOUND', 'Lease not found');
  }

  const isTenant = actor.role === 'tenant' && lease.tenant_user_id === actor.userId;
  const isLandlord = actor.role === 'landlord' && lease.landlord_user_id === actor.userId;
  if (!isTenant && !isLandlord) {
    throw new InvoicePaymentError('PAYMENT_ACCESS_DENIED', 'The lease does not belong to this account');
  }

  return lease;
}

async function resolvePayableRentInvoice(tx: any, input: CreatePaymentInput) {
  const amount = Number(input.amount);
  const requestedInvoiceId = input.invoiceId || null;
  await assertLeaseAccess(tx, input.leaseId, input.actor);

  const [invoice] = await tx`
    SELECT
      id,
      lease_id,
      amount,
      COALESCE(amount_paid, 0) AS amount_paid,
      due_date,
      status
    FROM public.invoices
    WHERE lease_id = ${input.leaseId}
      AND invoice_type = 'rent'
      AND status IN ('pending', 'partially_paid', 'overdue')
      AND COALESCE(amount_paid, 0) < amount
      ${requestedInvoiceId ? tx`AND id = ${requestedInvoiceId}` : tx``}
    ORDER BY due_date ASC, created_at ASC
    LIMIT 1
    FOR UPDATE
  `;

  if (!invoice) {
    throw new InvoicePaymentError(
      requestedInvoiceId ? 'INVOICE_NOT_PAYABLE' : 'RENT_INVOICE_REQUIRED',
      requestedInvoiceId
        ? 'The selected rent invoice is not payable for this lease'
        : 'No outstanding rent invoice exists for this lease',
    );
  }

  const outstanding = Number(invoice.amount) - Number(invoice.amount_paid);
  if (amount > outstanding + 0.005) {
    throw new InvoicePaymentError(
      'PAYMENT_EXCEEDS_OUTSTANDING',
      `Payment exceeds the invoice outstanding balance of KES ${outstanding.toFixed(2)}`,
    );
  }

  return invoice;
}

async function applyInvoiceDelta(tx: any, invoiceId: string | null, amount: number, deltaDirection: 1 | -1) {
  if (!invoiceId) return;

  const [invoice] = await tx`
    SELECT id, amount, COALESCE(amount_paid, 0) AS amount_paid, status
    FROM public.invoices
    WHERE id = ${invoiceId}
    FOR UPDATE
  `;
  if (!invoice) return;

  const nextAmountPaid = Math.max(0, Number(invoice.amount_paid) + amount * deltaDirection);
  const nextStatus = nextAmountPaid >= Number(invoice.amount) - 0.005
    ? 'paid'
    : nextAmountPaid > 0
      ? 'partially_paid'
      : 'pending';

  await tx`
    UPDATE public.invoices
    SET
      amount_paid = ${nextAmountPaid.toFixed(2)},
      status = CASE
        WHEN status IN ('cancelled', 'disputed') THEN status
        ELSE ${nextStatus}::invoice_status
      END,
      paid_at = CASE
        WHEN ${nextStatus} = 'paid' THEN COALESCE(paid_at, NOW())
        ELSE NULL
      END,
      updated_at = NOW()
    WHERE id = ${invoice.id}
  `;
}

export async function createPaymentRecord(sql: any, input: CreatePaymentInput) {
  return sql.begin(async (tx: any) => {
    const status = input.status || 'pending';
    const paymentType = input.paymentType || 'rent';
    let invoice = null;
    if (paymentType === 'rent') {
      invoice = await resolvePayableRentInvoice(tx, input);
    } else {
      await assertLeaseAccess(tx, input.leaseId, input.actor);
    }
    const paidDate = status === 'completed' ? (input.paidDate || new Date()) : (input.paidDate || null);

    const [payment] = await tx`
      INSERT INTO public.payments (
        lease_id,
        invoice_id,
        amount,
        due_date,
        paid_date,
        payment_method,
        payment_type,
        payment_source,
        status,
        description,
        created_at,
        updated_at
      )
      VALUES (
        ${input.leaseId},
        ${invoice?.id || null},
        ${Number(input.amount).toFixed(2)},
        ${input.dueDate || new Date()},
        ${paidDate},
        ${input.paymentMethod || null},
        ${paymentType},
        ${input.paymentSource},
        ${status},
        ${input.description || null},
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    if (status === 'completed' && invoice?.id) {
      await applyInvoiceDelta(tx, invoice.id, Number(input.amount), 1);
    }

    return payment;
  });
}

export async function transitionPaymentStatus(
  sql: any,
  lookup: { paymentId?: string | null; trackingId?: string | null },
  nextStatus: PaymentStatus,
  patch: TransitionPatch = {},
) {
  return sql.begin(async (tx: any) => {
    const paymentId = lookup.paymentId || null;
    const trackingId = lookup.trackingId || null;
    const [payment] = await tx`
      SELECT *
      FROM public.payments
      WHERE (${paymentId}::text IS NOT NULL AND id = ${paymentId})
         OR (${trackingId}::text IS NOT NULL AND pesapal_order_tracking_id = ${trackingId})
      ORDER BY CASE WHEN id = ${paymentId || ''} THEN 0 ELSE 1 END
      LIMIT 1
      FOR UPDATE
    `;

    if (!payment) {
      throw new InvoicePaymentError('PAYMENT_NOT_FOUND', 'Payment not found');
    }

    const previousStatus = payment.status as PaymentStatus;
    if (previousStatus === 'completed' && nextStatus !== 'completed' && !patch.allowCompletionReversal) {
      return { payment, changed: false, completedNow: false };
    }

    const changed = previousStatus !== nextStatus;
    const completionDelta = paymentCompletionDelta(previousStatus, nextStatus, Number(payment.amount));
    const completedNow = completionDelta > 0;
    const reversedNow = completionDelta < 0;

    const [updatedPayment] = await tx`
      UPDATE public.payments
      SET
        status = ${nextStatus},
        pesapal_transaction_id = COALESCE(${patch.transactionId ?? null}, pesapal_transaction_id),
        payment_method = COALESCE(${patch.paymentMethod ?? null}, payment_method),
        description = COALESCE(${patch.description ?? null}, description),
        paid_date = CASE
          WHEN ${nextStatus} = 'completed' THEN COALESCE(${patch.paidDate ?? null}, paid_date, NOW())
          WHEN ${reversedNow} THEN NULL
          ELSE paid_date
        END,
        updated_at = NOW()
      WHERE id = ${payment.id}
      RETURNING *
    `;

    if (completedNow) {
      await applyInvoiceDelta(tx, payment.invoice_id, Number(payment.amount), 1);
    } else if (reversedNow) {
      await applyInvoiceDelta(tx, payment.invoice_id, Number(payment.amount), -1);
    }

    return { payment: updatedPayment, changed, completedNow };
  });
}

export function invoicePaymentHttpStatus(error: unknown): number {
  if (!(error instanceof InvoicePaymentError)) return 500;
  if (error.code === 'LEASE_NOT_FOUND' || error.code === 'PAYMENT_NOT_FOUND') return 404;
  if (error.code === 'PAYMENT_ACCESS_DENIED') return 403;
  if (error.code === 'PAYMENT_EXCEEDS_OUTSTANDING') return 422;
  return 409;
}

-- Make invoices the canonical monthly rent obligation and keep payments as
-- actual payment attempts/receipts. This migration deliberately recognizes
-- only the exact rows emitted by the legacy monthly scheduler.

BEGIN;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS invoice_id VARCHAR REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_source VARCHAR;

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);

CREATE TABLE IF NOT EXISTS public.legacy_scheduled_payment_obligations (
  original_payment_id VARCHAR PRIMARY KEY,
  migrated_invoice_id VARCHAR REFERENCES public.invoices(id) ON DELETE SET NULL,
  used_existing_invoice BOOLEAN NOT NULL DEFAULT false,
  original_row JSONB NOT NULL,
  archived_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- This audit archive is for controlled database recovery only. With RLS
-- enabled and no client policies, anon/authenticated API clients cannot read it.
ALTER TABLE public.legacy_scheduled_payment_obligations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.legacy_scheduled_payment_obligations IS
  'Audit archive of scheduler-created payment placeholders migrated into canonical invoices';

-- Preserve dedicated UAT references for bank validation without allowing a
-- KES 1 test fixture to suppress the real rent obligation for that month.
UPDATE public.invoices
SET
  invoice_type = 'uat_validation',
  updated_at = NOW()
WHERE invoice_type = 'rent'
  AND reference_code ~ '^INV-(KCB-)?UAT';

-- Do not silently choose between pre-existing duplicate formal obligations.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.invoices
    WHERE invoice_type = 'rent' AND lease_id IS NOT NULL
    GROUP BY lease_id, date_trunc('month', billing_period_start)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enable canonical rent invoices: duplicate rent invoices already exist for a lease/billing period';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_rent_lease_period
  ON public.invoices(lease_id, (date_trunc('month', billing_period_start)))
  WHERE invoice_type = 'rent' AND lease_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payments p
    WHERE p.payment_type = 'rent'
      AND p.status = 'pending'
      AND p.paid_date IS NULL
      AND p.payment_method IS NULL
      AND p.pesapal_transaction_id IS NULL
      AND p.pesapal_order_tracking_id IS NULL
      AND p.receipt_url IS NULL
      AND p.due_date::date = date_trunc('month', p.due_date)::date
      AND p.description = 'Rent for ' || trim(to_char(p.due_date, 'Month')) || ' ' || to_char(p.due_date, 'YYYY')
    GROUP BY p.lease_id, date_trunc('month', p.due_date)
    HAVING COUNT(DISTINCT p.amount) > 1
  ) THEN
    RAISE EXCEPTION
      'Conflicting legacy scheduler amounts exist for the same lease/billing period';
  END IF;
END $$;

-- Record placeholders whose matching accounting invoice already exists.
INSERT INTO public.legacy_scheduled_payment_obligations (
  original_payment_id,
  migrated_invoice_id,
  used_existing_invoice,
  original_row
)
SELECT
  p.id,
  i.id,
  true,
  to_jsonb(p)
FROM public.payments p
JOIN public.invoices i
  ON i.lease_id = p.lease_id
 AND i.invoice_type = 'rent'
 AND date_trunc('month', i.billing_period_start) = date_trunc('month', p.due_date)
WHERE p.payment_type = 'rent'
  AND p.status = 'pending'
  AND p.paid_date IS NULL
  AND p.payment_method IS NULL
  AND p.pesapal_transaction_id IS NULL
  AND p.pesapal_order_tracking_id IS NULL
  AND p.receipt_url IS NULL
  AND p.due_date::date = date_trunc('month', p.due_date)::date
  AND p.description = 'Rent for ' || trim(to_char(p.due_date, 'Month')) || ' ' || to_char(p.due_date, 'YYYY')
ON CONFLICT (original_payment_id) DO NOTHING;

-- Convert one or more duplicate scheduler placeholders into exactly one formal
-- invoice for the lease/month. The partial unique index is the final guard.
INSERT INTO public.invoices (
  lease_id,
  landlord_id,
  tenant_id,
  amount,
  amount_paid,
  currency,
  billing_period_start,
  billing_period_end,
  due_date,
  reference_code,
  invoice_type,
  description,
  status,
  issued_at,
  created_at,
  updated_at
)
SELECT
  p.lease_id,
  prop.owner_id,
  l.tenant_id,
  MAX(p.amount),
  0,
  'KES',
  date_trunc('month', p.due_date),
  date_trunc('month', p.due_date) + INTERVAL '1 month' - INTERVAL '1 millisecond',
  MIN(p.due_date),
  'I' || upper(substr(md5(p.lease_id || ':' || to_char(MIN(p.due_date), 'YYYYMM')), 1, 12)),
  'rent',
  'Rent for ' || trim(to_char(MIN(p.due_date), 'Month')) || ' ' || to_char(MIN(p.due_date), 'YYYY'),
  'pending',
  MIN(COALESCE(p.created_at, p.due_date)),
  MIN(COALESCE(p.created_at, p.due_date)),
  NOW()
FROM public.payments p
JOIN public.leases l ON l.id = p.lease_id
JOIN public.units u ON u.id = l.unit_id
JOIN public.properties prop ON prop.id = u.property_id
WHERE p.payment_type = 'rent'
  AND p.status = 'pending'
  AND p.paid_date IS NULL
  AND p.payment_method IS NULL
  AND p.pesapal_transaction_id IS NULL
  AND p.pesapal_order_tracking_id IS NULL
  AND p.receipt_url IS NULL
  AND p.due_date::date = date_trunc('month', p.due_date)::date
  AND p.description = 'Rent for ' || trim(to_char(p.due_date, 'Month')) || ' ' || to_char(p.due_date, 'YYYY')
GROUP BY p.lease_id, prop.owner_id, l.tenant_id, date_trunc('month', p.due_date)
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payments p
    WHERE p.payment_type = 'rent'
      AND p.status = 'pending'
      AND p.paid_date IS NULL
      AND p.payment_method IS NULL
      AND p.pesapal_transaction_id IS NULL
      AND p.pesapal_order_tracking_id IS NULL
      AND p.receipt_url IS NULL
      AND p.due_date::date = date_trunc('month', p.due_date)::date
      AND p.description = 'Rent for ' || trim(to_char(p.due_date, 'Month')) || ' ' || to_char(p.due_date, 'YYYY')
      AND NOT EXISTS (
        SELECT 1
        FROM public.invoices i
        WHERE i.lease_id = p.lease_id
          AND i.invoice_type = 'rent'
          AND date_trunc('month', i.billing_period_start) = date_trunc('month', p.due_date)
      )
  ) THEN
    RAISE EXCEPTION
      'Canonical invoice backfill did not create an invoice for every legacy scheduler obligation';
  END IF;
END $$;

-- Archive all remaining recognized placeholders against their newly-created
-- canonical invoice before removing them from the payment ledger.
INSERT INTO public.legacy_scheduled_payment_obligations (
  original_payment_id,
  migrated_invoice_id,
  used_existing_invoice,
  original_row
)
SELECT
  p.id,
  i.id,
  false,
  to_jsonb(p)
FROM public.payments p
JOIN public.invoices i
  ON i.lease_id = p.lease_id
 AND i.invoice_type = 'rent'
 AND date_trunc('month', i.billing_period_start) = date_trunc('month', p.due_date)
WHERE p.payment_type = 'rent'
  AND p.status = 'pending'
  AND p.paid_date IS NULL
  AND p.payment_method IS NULL
  AND p.pesapal_transaction_id IS NULL
  AND p.pesapal_order_tracking_id IS NULL
  AND p.receipt_url IS NULL
  AND p.due_date::date = date_trunc('month', p.due_date)::date
  AND p.description = 'Rent for ' || trim(to_char(p.due_date, 'Month')) || ' ' || to_char(p.due_date, 'YYYY')
ON CONFLICT (original_payment_id) DO NOTHING;

-- Link genuine historical rent attempts/receipts only when the billing month
-- identifies a canonical invoice. Archived scheduler placeholders are excluded.
UPDATE public.payments p
SET
  invoice_id = i.id,
  payment_source = COALESCE(
    p.payment_source,
    CASE
      WHEN lower(COALESCE(p.payment_method, '')) = 'mpesa' THEN 'legacy_mpesa'
      WHEN lower(COALESCE(p.payment_method, '')) IN ('card', 'bank') THEN 'legacy_pesapal'
      WHEN p.payment_method IS NOT NULL THEN 'legacy_manual'
      ELSE 'legacy_record'
    END
  ),
  updated_at = NOW()
FROM public.invoices i
WHERE p.invoice_id IS NULL
  AND p.payment_type = 'rent'
  AND i.lease_id = p.lease_id
  AND i.invoice_type = 'rent'
  AND date_trunc('month', i.billing_period_start) = date_trunc('month', COALESCE(p.paid_date, p.due_date, p.created_at))
  AND NOT EXISTS (
    SELECT 1
    FROM public.legacy_scheduled_payment_obligations archived
    WHERE archived.original_payment_id = p.id
  );

-- Only newly-created backfill invoices derive their opening balance from linked
-- completed payments. Existing formal invoices retain their reconciled balance.
WITH completed_totals AS (
  SELECT
    archived.migrated_invoice_id AS invoice_id,
    COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) AS amount_paid,
    MAX(p.paid_date) FILTER (WHERE p.status = 'completed') AS last_paid_at
  FROM (
    SELECT DISTINCT migrated_invoice_id
    FROM public.legacy_scheduled_payment_obligations
    WHERE used_existing_invoice = false
  ) archived
  LEFT JOIN public.payments p ON p.invoice_id = archived.migrated_invoice_id
  GROUP BY archived.migrated_invoice_id
)
UPDATE public.invoices i
SET
  amount_paid = totals.amount_paid,
  status = CASE
    WHEN totals.amount_paid >= i.amount THEN 'paid'::invoice_status
    WHEN totals.amount_paid > 0 THEN 'partially_paid'::invoice_status
    ELSE 'pending'::invoice_status
  END,
  paid_at = CASE WHEN totals.amount_paid >= i.amount THEN totals.last_paid_at ELSE NULL END,
  updated_at = NOW()
FROM completed_totals totals
WHERE i.id = totals.invoice_id;

DELETE FROM public.payments p
USING public.legacy_scheduled_payment_obligations archived
WHERE p.id = archived.original_payment_id;

COMMENT ON COLUMN public.payments.invoice_id IS
  'Canonical obligation settled or attempted by this payment record';
COMMENT ON COLUMN public.payments.payment_source IS
  'Origin of the actual payment attempt/receipt; monthly schedulers must not write payments';

COMMENT ON COLUMN public.invoices.invoice_type IS
  'Obligation category; uat_validation records are non-accounting fixtures retained for bank integration tests';

COMMIT;

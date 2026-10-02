BEGIN;

-- A bank event may settle several monthly invoices. Each allocation is an
-- actual payment receipt, uniquely linked to its source event and invoice.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS bank_event_id VARCHAR
    REFERENCES public.external_payment_events(id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_bank_event_invoice
  ON public.payments(bank_event_id, invoice_id)
  WHERE bank_event_id IS NOT NULL;

COMMENT ON COLUMN public.payments.bank_event_id IS
  'Source bank notification; one payment receipt per invoice allocation';

COMMIT;

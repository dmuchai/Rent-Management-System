-- Adds reconciliation review metadata required by manual approve/reject/reverse APIs
-- Safe to run multiple times (IF NOT EXISTS guards)

ALTER TABLE public.external_payment_events
  ADD COLUMN IF NOT EXISTS matched_invoice_id VARCHAR REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reconciliation_method VARCHAR,
  ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_source VARCHAR;

CREATE INDEX IF NOT EXISTS idx_external_events_matched_invoice
  ON public.external_payment_events(matched_invoice_id);

CREATE INDEX IF NOT EXISTS idx_external_events_reconciled_at
  ON public.external_payment_events(reconciled_at DESC);

COMMENT ON COLUMN public.external_payment_events.matched_invoice_id IS 'Invoice selected by automated/manual reconciliation';
COMMENT ON COLUMN public.external_payment_events.reconciliation_method IS 'deterministic, heuristic_l2, heuristic_l3, manual_review';
COMMENT ON COLUMN public.external_payment_events.confidence_score IS 'Confidence score assigned by reconciliation engine (0-100)';
COMMENT ON COLUMN public.external_payment_events.reconciled_at IS 'Timestamp when event was reconciled (auto or manual)';
COMMENT ON COLUMN public.external_payment_events.reconciliation_notes IS 'Human-readable notes and reasons for reconciliation decisions';

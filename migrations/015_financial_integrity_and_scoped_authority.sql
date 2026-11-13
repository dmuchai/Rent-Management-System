-- Additive pilot-hardening migration. Apply after 014_bank_payment_allocations.sql.
-- Back up first. This migration does not infer missing receipts or rewrite balances.
BEGIN;

ALTER TABLE public.external_payment_events
  ADD COLUMN IF NOT EXISTS processing_status VARCHAR NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS processing_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_processing_error TEXT,
  ADD COLUMN IF NOT EXISTS operator_review_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unallocated_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replayed_at TIMESTAMP;

ALTER TABLE public.external_payment_events
  DROP CONSTRAINT IF EXISTS external_payment_events_processing_status_check;
ALTER TABLE public.external_payment_events
  ADD CONSTRAINT external_payment_events_processing_status_check
  CHECK (processing_status IN ('received', 'processing', 'processed', 'retry', 'failed', 'review'));

CREATE INDEX IF NOT EXISTS idx_external_payment_events_processing
  ON public.external_payment_events(processing_status, next_attempt_at, received_at);

-- Existing bank events are known ingestion records. Their reconciliation state
-- determines whether they were already applied; ambiguous history stays reviewable.
UPDATE public.external_payment_events
SET processing_status = CASE
      WHEN reconciliation_status IN ('auto_matched', 'manually_matched', 'ignored', 'duplicate') THEN 'processed'
      WHEN reconciliation_status = 'pending_review' THEN 'review'
      ELSE 'received'
    END,
    processed_at = CASE
      WHEN reconciliation_status IN ('auto_matched', 'manually_matched', 'ignored', 'duplicate')
        THEN COALESCE(reconciled_at, received_at, created_at)
      ELSE processed_at
    END
WHERE processing_attempts = 0 AND processing_status = 'received';

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS source_event_id VARCHAR REFERENCES public.external_payment_events(id),
  ADD COLUMN IF NOT EXISTS provider_checkout_id VARCHAR,
  ADD COLUMN IF NOT EXISTS provider_merchant_request_id VARCHAR,
  ADD COLUMN IF NOT EXISTS expected_merchant_id VARCHAR,
  ADD COLUMN IF NOT EXISTS provider_receipt_id VARCHAR;

UPDATE public.payments SET source_event_id = bank_event_id
WHERE source_event_id IS NULL AND bank_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_source_event_invoice
  ON public.payments(source_event_id, invoice_id)
  WHERE source_event_id IS NOT NULL AND invoice_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_receipt
  ON public.payments(provider_receipt_id)
  WHERE provider_receipt_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_checkout
  ON public.payments(provider_checkout_id)
  WHERE provider_checkout_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_audit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id VARCHAR REFERENCES public.payments(id),
  source_event_id VARCHAR REFERENCES public.external_payment_events(id),
  action VARCHAR NOT NULL CHECK (action IN ('posted', 'reversed', 'corrected', 'reviewed')),
  amount NUMERIC(10,2) NOT NULL,
  actor_id VARCHAR REFERENCES public.users(id),
  reason TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_audit_payment ON public.payment_audit_history(payment_id, created_at);
ALTER TABLE public.payment_audit_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS claim_token UUID,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR,
  ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR;
ALTER TABLE public.sms_queue
  ADD COLUMN IF NOT EXISTS claim_token UUID,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR,
  ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR;
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_queue_idempotency ON public.email_queue(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sms_queue_idempotency ON public.sms_queue(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_queue_claim ON public.email_queue(status, available_at, lease_expires_at);
CREATE INDEX IF NOT EXISTS idx_sms_queue_claim ON public.sms_queue(status, available_at, lease_expires_at);

-- Roles are scoped to a portfolio. users.role remains a temporary compatibility
-- field, but authentication no longer derives or overwrites it from profile metadata.
CREATE TABLE IF NOT EXISTS public.user_context_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  context_owner_id VARCHAR NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role VARCHAR NOT NULL CHECK (role IN ('landlord', 'tenant', 'property_manager', 'caretaker')),
  status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
  authority_source VARCHAR NOT NULL CHECK (authority_source IN ('legacy_backfill', 'property_ownership', 'tenant_link', 'invitation', 'assignment', 'administrator')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, context_owner_id, role)
);
CREATE INDEX IF NOT EXISTS idx_memberships_user_active
  ON public.user_context_memberships(user_id, status, context_owner_id);
ALTER TABLE public.user_context_memberships ENABLE ROW LEVEL SECURITY;

-- Deterministic memberships only. Conflicting or unprovable authority is left
-- out for the dry-run diagnostic and operator review.
INSERT INTO public.user_context_memberships(user_id, context_owner_id, role, authority_source)
SELECT DISTINCT p.owner_id, p.owner_id, 'landlord', 'property_ownership'
FROM public.properties p WHERE p.owner_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.user_context_memberships(user_id, context_owner_id, role, authority_source)
SELECT u.id, u.id, 'landlord', 'legacy_backfill'
FROM public.users u
WHERE u.role = 'landlord'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_context_memberships(user_id, context_owner_id, role, authority_source)
SELECT DISTINCT t.user_id, t.landlord_id, 'tenant', 'tenant_link'
FROM public.tenants t WHERE t.user_id IS NOT NULL AND t.landlord_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.user_context_memberships(user_id, context_owner_id, role, authority_source)
SELECT DISTINCT ca.caretaker_id, ca.landlord_id, 'caretaker', 'assignment'
FROM public.caretaker_assignments ca WHERE ca.status = 'active'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_context_memberships(user_id, context_owner_id, role, authority_source)
SELECT u.id, u.created_by, 'property_manager', 'legacy_backfill'
FROM public.users u
WHERE u.role = 'property_manager' AND u.created_by IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.operational_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name VARCHAR NOT NULL,
  status VARCHAR NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  processed_count INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT
);
ALTER TABLE public.operational_job_runs ENABLE ROW LEVEL SECURITY;

COMMIT;

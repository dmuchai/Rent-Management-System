                          -- Durable, email-verified account and data deletion requests.
                          CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
                            email VARCHAR(254) NOT NULL,
                            email_hash VARCHAR(64) NOT NULL,
                            request_type VARCHAR(32) NOT NULL,
                            details TEXT,
                            status VARCHAR(32) NOT NULL DEFAULT 'pending_verification',
                            verification_token_hash VARCHAR(64),
                            verification_expires_at TIMESTAMPTZ,
                            source_ip_hash VARCHAR(64) NOT NULL,
                            user_agent VARCHAR(500),
                            requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            verified_at TIMESTAMPTZ,
                            completed_at TIMESTAMPTZ,
                            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            CONSTRAINT account_deletion_request_type_check
                              CHECK (request_type IN ('account_and_data', 'specific_data')),
                            CONSTRAINT account_deletion_status_check
                              CHECK (status IN ('pending_verification', 'pending_review', 'in_progress', 'completed', 'declined', 'cancelled'))
                          );

                          CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_active_email_idx
                            ON public.account_deletion_requests (email_hash)
                            WHERE status IN ('pending_verification', 'pending_review', 'in_progress');

                          CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_verification_token_idx
                            ON public.account_deletion_requests (verification_token_hash)
                            WHERE verification_token_hash IS NOT NULL;

                          CREATE INDEX IF NOT EXISTS account_deletion_status_requested_idx
                            ON public.account_deletion_requests (status, requested_at DESC);

                          ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
                          REVOKE ALL ON public.account_deletion_requests FROM anon, authenticated;

                          COMMENT ON TABLE public.account_deletion_requests IS
                            'Email-verified account and personal-data deletion requests. Access is restricted to server-side service connections.';
                          COMMENT ON COLUMN public.account_deletion_requests.source_ip_hash IS
                            'Keyed one-way hash used for abuse investigation without retaining a raw IP address.';


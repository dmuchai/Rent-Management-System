-- Migration: Add Statement Upload History Table
-- Purpose: Track landlord statement uploads for audit and analytics

-- Create statement upload history table
CREATE TABLE IF NOT EXISTS public.statement_upload_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  statement_type TEXT NOT NULL, -- 'equity', 'kcb', 'coop', 'mpesa', etc.
  transactions_total INTEGER NOT NULL DEFAULT 0,
  transactions_matched INTEGER NOT NULL DEFAULT 0,
  transactions_unmatched INTEGER NOT NULL DEFAULT 0,
  transactions_duplicates INTEGER NOT NULL DEFAULT 0,
  upload_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_statement_uploads_landlord ON public.statement_upload_history(landlord_id);
CREATE INDEX IF NOT EXISTS idx_statement_uploads_date ON public.statement_upload_history(upload_date DESC);

-- Add RLS policies
ALTER TABLE public.statement_upload_history ENABLE ROW LEVEL SECURITY;

-- Policy: Landlords can view their own upload history
CREATE POLICY statement_uploads_landlord_select ON public.statement_upload_history
  FOR SELECT
  USING (auth.uid()::text = landlord_id);

-- Policy: Landlords can insert their own upload records
CREATE POLICY statement_uploads_landlord_insert ON public.statement_upload_history
  FOR INSERT
  WITH CHECK (auth.uid()::text = landlord_id);

-- Grant access
GRANT SELECT, INSERT ON public.statement_upload_history TO authenticated;

-- Comment
COMMENT ON TABLE public.statement_upload_history IS 'Tracks bank/M-Pesa statement uploads and reconciliation results';

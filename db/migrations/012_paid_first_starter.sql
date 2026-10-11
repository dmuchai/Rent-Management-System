-- Apply once, immediately before deploying paid-first registration rules.
-- Existing public.users rows retain Free even if they have no billing row yet.
BEGIN;
DO $$
BEGIN
  -- Snapshot once, including registered accounts that have not synced a profile.
  IF to_regclass('public.legacy_free_subscription_accounts') IS NULL THEN
    CREATE TABLE public.legacy_free_subscription_accounts (user_id text PRIMARY KEY);
    ALTER TABLE public.legacy_free_subscription_accounts ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.legacy_free_subscription_accounts FROM anon, authenticated;
    INSERT INTO public.legacy_free_subscription_accounts (user_id)
      SELECT id::text FROM auth.users UNION SELECT id::text FROM public.users;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name = 'legacy_free_eligible'
  ) THEN
    ALTER TABLE public.users ADD COLUMN legacy_free_eligible boolean NOT NULL DEFAULT false;
    UPDATE public.users SET legacy_free_eligible = EXISTS (
      SELECT 1 FROM public.legacy_free_subscription_accounts c WHERE c.user_id = users.id::text
    );
  END IF;
END $$;

-- Do not allow profile edits or client upserts to manufacture eligibility.
CREATE OR REPLACE FUNCTION public.preserve_legacy_free_eligibility()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.legacy_free_eligible := EXISTS (
      SELECT 1 FROM public.legacy_free_subscription_accounts c WHERE c.user_id = NEW.id::text
    );
  ELSE
    NEW.legacy_free_eligible := OLD.legacy_free_eligible;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS preserve_legacy_free_eligibility ON public.users;
CREATE TRIGGER preserve_legacy_free_eligibility
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.preserve_legacy_free_eligibility();

ALTER TABLE public.billing_accounts DROP CONSTRAINT IF EXISTS billing_accounts_plan_code_check;
ALTER TABLE public.billing_accounts ADD CONSTRAINT billing_accounts_plan_code_check
  CHECK (plan_code IN ('free', 'starter', 'bronze', 'silver', 'gold', 'enterprise'));
COMMIT;

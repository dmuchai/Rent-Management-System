-- Add manual M-PESA Send Money as a landlord payment channel.
ALTER TABLE public.landlord_payment_channels
  ADD COLUMN IF NOT EXISTS recipient_phone_number VARCHAR;

CREATE UNIQUE INDEX IF NOT EXISTS idx_landlord_mpesa_recipient_unique
  ON public.landlord_payment_channels (landlord_id, recipient_phone_number)
  WHERE recipient_phone_number IS NOT NULL;

ALTER TABLE public.landlord_payment_channels
  DROP CONSTRAINT IF EXISTS landlord_payment_channels_recipient_phone_format;

ALTER TABLE public.landlord_payment_channels
  ADD CONSTRAINT landlord_payment_channels_recipient_phone_format
  CHECK (
    recipient_phone_number IS NULL
    OR recipient_phone_number ~ '^254[17][0-9]{8}$'
  );

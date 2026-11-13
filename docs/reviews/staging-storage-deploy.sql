-- REVIEW-ONLY STAGING PACKAGE: private property-images Storage configuration.
-- Target: isolated Supabase project mcclctunrpyhumubpeyo only.
-- Verify the connected project in the Supabase dashboard before execution.
-- SQL cannot reliably discover the Supabase project reference.
-- Production project emdahodfztpfdjkrbnqz is prohibited.
-- This transaction deliberately ends with ROLLBACK.

BEGIN;

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'property-images') THEN
    RAISE EXCEPTION 'NO-GO: property-images bucket exists; inspect existing state before deployment';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
  ) THEN
    RAISE EXCEPTION 'NO-GO: storage.objects has existing policies; inspect every policy for cross-bucket access before deployment';
  END IF;
END
$guard$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-images',
  'property-images',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
);

SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'property-images';
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';

ROLLBACK;

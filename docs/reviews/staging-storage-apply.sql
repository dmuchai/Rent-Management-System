-- APPROVAL-REQUIRED PERSISTENT STAGING MIGRATION.
-- Target only Supabase project mcclctunrpyhumubpeyo.
-- Production project emdahodfztpfdjkrbnqz is prohibited.
-- Do not execute until the staging deployment approval gate is approved.
-- Unlike staging-storage-deploy.sql, this transaction ends with COMMIT.

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
      AND (
        policyname LIKE 'landee_private_images_%'
        OR COALESCE(qual, '') ILIKE '%property-images%'
        OR COALESCE(with_check, '') ILIKE '%property-images%'
      )
  ) THEN
    RAISE EXCEPTION 'NO-GO: Storage policy references property-images; inspect existing state before deployment';
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
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (
    policyname LIKE 'landee_private_images_%'
    OR COALESCE(qual, '') ILIKE '%property-images%'
    OR COALESCE(with_check, '') ILIKE '%property-images%'
  );

COMMIT;

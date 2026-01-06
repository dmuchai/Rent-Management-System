-- Create Storage Bucket for Property Images
-- Run this in your Supabase SQL Editor

-- Create the property-images bucket (public for easy access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-images',
  'property-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[];

-- Create RLS policies for the bucket
-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload property images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'property-images');

-- Allow public read access to property images
CREATE POLICY "Public access to property images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'property-images');

-- Allow users to update their own uploads
CREATE POLICY "Users can update their property images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'property-images');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their property images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'property-images');

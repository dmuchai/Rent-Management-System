# Fix Storage Bucket Error

## Problem
Error: `Bucket not found` when uploading property images.

## Solution

You need to create the `property-images` storage bucket in your Supabase project.

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Configure the bucket:
   - **Name**: `property-images`
   - **Public bucket**: Toggle ON (so images are publicly accessible)
   - **File size limit**: 5 MB
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp, image/gif`
5. Click **Create bucket**
6. Go to **Policies** tab and create these policies:
   - **Insert**: Allow authenticated users
   - **Select**: Allow public access
   - **Update/Delete**: Allow authenticated users

### Option 2: Via SQL Editor

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `create-storage-bucket.sql`
4. Click **Run**

### Option 3: Use Manual URL Entry (Temporary Workaround)

If you don't want to set up storage right now:
1. Upload your image to any image hosting service (Imgur, Cloudinary, etc.)
2. Copy the direct image URL
3. In the Property Form, scroll down to "Property Image (Optional)"
4. Paste the URL in the "Image URL (if not uploading)" field

## Verify Setup

After creating the bucket, try uploading an image again. The error should be resolved.

## Note

The application has been updated to show a helpful error message if the bucket is not configured, directing you to use manual URL entry as a fallback.

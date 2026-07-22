-- Migration: 023_create_analyzed_images_bucket.sql
-- Description: Create analyzed-images bucket in storage schema and setup policies

-- 1. Insert bucket definition
INSERT INTO storage.buckets (id, name, public)
VALUES ('analyzed-images', 'analyzed-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Setup RLS Select Policy: Allow anyone (public/doctors) to view analyzed images
CREATE POLICY "Allow public read access to analyzed-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'analyzed-images');

-- 3. Setup RLS Insert Policy: Allow authenticated users (patients) to upload analyzed images
CREATE POLICY "Allow authenticated users to upload to analyzed-images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'analyzed-images'
    AND auth.role() = 'authenticated'
  );

-- 4. Setup RLS Update/Delete Policies for authenticated users
CREATE POLICY "Allow authenticated users to update analyzed-images"
  ON storage.objects FOR UPDATE
  WITH CHECK (
    bucket_id = 'analyzed-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Allow authenticated users to delete analyzed-images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'analyzed-images'
    AND auth.role() = 'authenticated'
  );

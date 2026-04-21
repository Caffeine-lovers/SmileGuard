-- ============================================================================
-- Doctor Pictures Storage Policies
-- ============================================================================
-- This migration sets up Row Level Security (RLS) policies for the 
-- 'doctor-pictures' bucket to allow authenticated doctors to upload,
-- view, and delete their profile pictures.
-- ============================================================================

-- 1. Allow authenticated users to upload to their own profile folder
CREATE POLICY "Doctors can upload their own profile pictures"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'doctor-pictures'
    AND auth.role() = 'authenticated'
  );

-- 2. Allow anyone (public and authenticated) to view doctor pictures
CREATE POLICY "Anyone can view doctor profile pictures"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'doctor-pictures');

-- 3. Allow authenticated doctors to delete only their own pictures
CREATE POLICY "Doctors can delete their own profile pictures"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'doctor-pictures'
    AND auth.role() = 'authenticated'
  );

-- 4. Allow authenticated doctors to update (replace) their pictures
CREATE POLICY "Doctors can update their own profile pictures"
  ON storage.objects FOR UPDATE
  WITH CHECK (
    bucket_id = 'doctor-pictures'
    AND auth.role() = 'authenticated'
  );

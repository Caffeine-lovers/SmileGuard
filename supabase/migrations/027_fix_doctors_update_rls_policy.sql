-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 027: Complete Fix for Doctors Table Permissions & RLS Policies   ║
-- ║                                                                            ║
-- ║  Fixes:                                                                    ║
-- ║  1. "permission denied for table doctors" (Postgres error 42501)          ║
-- ║  2. "This table has custom Data API permissions" warning in Supabase       ║
-- ║  3. Broken policy using current_profile_role()                             ║
-- ║  4. Storage bucket 'doctor-pictures' policies for upload/view               ║
-- ║                                                                            ║
-- ║  HOW TO APPLY:                                                             ║
-- ║  Copy and paste this ENTIRE script into:                                  ║
-- ║  Supabase Dashboard → SQL Editor → New Query → Run                         ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- ============================================================================
-- Step 1: Ensure columns exist on public.doctors
-- ============================================================================
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS doctor_name TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS doctor_phone TEXT;

-- ============================================================================
-- Step 2: Grant Table-level Privileges to Supabase API Roles
-- (Fixes "This table has custom Data API permissions" and error 42501)
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.doctors TO authenticated;
GRANT ALL ON TABLE public.doctors TO service_role;
GRANT SELECT ON TABLE public.doctors TO anon;

-- Ensure sequences if any are accessible
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- Step 3: Define Helper Functions (SECURITY DEFINER to avoid RLS loops)
-- ============================================================================

-- Function: current_profile_role() - matches the policy in dashboard
CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role::text
  FROM public.profiles
  WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_profile_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated, anon, service_role;

-- Function: is_doctor()
CREATE OR REPLACE FUNCTION public.is_doctor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND LOWER(role) = 'doctor'
  );
$$;

REVOKE ALL ON FUNCTION public.is_doctor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_doctor() TO authenticated, anon, service_role;

-- ============================================================================
-- Step 4: Reset & Configure RLS Policies on public.doctors
-- ============================================================================
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

-- Drop all old/broken UPDATE policies
DROP POLICY IF EXISTS "Doctors can update own profile"        ON public.doctors;
DROP POLICY IF EXISTS "Doctors can update their own profile"  ON public.doctors;
DROP POLICY IF EXISTS "doctors_update_own"                    ON public.doctors;
DROP POLICY IF EXISTS "doctors update own"                    ON public.doctors;

-- Clean, bulletproof UPDATE policy: User can update their own doctor record
CREATE POLICY "doctors_update_own"
  ON public.doctors
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Drop all old INSERT policies
DROP POLICY IF EXISTS "doctors_insert_own"                    ON public.doctors;
DROP POLICY IF EXISTS "Doctors can insert own profile"        ON public.doctors;

-- Clean INSERT policy: User can insert their own doctor record
CREATE POLICY "doctors_insert_own"
  ON public.doctors
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Drop all old SELECT policies
DROP POLICY IF EXISTS "doctors_select_all"                    ON public.doctors;
DROP POLICY IF EXISTS "doctors_select_authenticated"          ON public.doctors;
DROP POLICY IF EXISTS "doctors_select_public"                 ON public.doctors;
DROP POLICY IF EXISTS "Doctors can view doctor profiles"      ON public.doctors;

-- Clean SELECT policy: Anyone authenticated or public can view doctor profiles
CREATE POLICY "doctors_select_all"
  ON public.doctors
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- ============================================================================
-- Step 5: Ensure 'doctor-pictures' Storage Bucket & Policies are Active
-- ============================================================================
-- Ensure bucket exists and is set to public
INSERT INTO storage.buckets (id, name, public)
VALUES ('doctor-pictures', 'doctor-pictures', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing storage policies for doctor-pictures
DROP POLICY IF EXISTS "Doctors can upload their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view doctor profile pictures"        ON storage.objects;
DROP POLICY IF EXISTS "Doctors can update their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Doctors can delete their own profile pictures" ON storage.objects;

-- Allow authenticated users to upload to doctor-pictures
CREATE POLICY "Doctors can upload their own profile pictures"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'doctor-pictures');

-- Allow public read access to doctor pictures
CREATE POLICY "Anyone can view doctor profile pictures"
  ON storage.objects FOR SELECT
  TO public, authenticated, anon
  USING (bucket_id = 'doctor-pictures');

-- Allow authenticated users to update pictures
CREATE POLICY "Doctors can update their own profile pictures"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'doctor-pictures')
  WITH CHECK (bucket_id = 'doctor-pictures');

-- Allow authenticated users to delete pictures
CREATE POLICY "Doctors can delete their own profile pictures"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'doctor-pictures');

-- ============================================================================
-- Verification query to verify policies applied successfully:
-- ============================================================================
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'doctors'
ORDER BY cmd, policyname;

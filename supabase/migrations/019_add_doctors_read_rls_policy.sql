-- ╔══════════════════════════════════════════════════════════════════╗
-- ║         MIGRATION: Add RLS Policy for Reading Doctors            ║
-- ║  Patients can read doctor names and information                   ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Drop existing overly restrictive policies if they exist
DROP POLICY IF EXISTS "doctors_select_authenticated" ON public.doctors;
DROP POLICY IF EXISTS "doctors_select_public" ON public.doctors;

-- Add new policy: Allow authenticated users (patients) to read all doctors
-- This allows patients to see doctor information when viewing appointments
CREATE POLICY "patients_can_read_doctors" ON public.doctors
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Keep existing policies for doctors to manage their own profiles
-- These policies already exist from 003_create_doctors_table.sql:
-- - "doctors_update_own" (UPDATE)
-- - "doctors_insert_own" (INSERT)

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║                    VERIFICATION QUERY                           ║
-- ║  Run this to verify the policy is created correctly:             ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'doctors'
-- ORDER BY policyname;

-- Expected: Multiple policies including "patients_can_read_doctors"

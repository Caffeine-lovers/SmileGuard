-- ╔══════════════════════════════════════════════════════════════════╗
-- ║     MIGRATION: Add RLS Policies for Doctors on dummy_accounts    ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝
--
-- This migration adds Row Level Security (RLS) policies to the
-- dummy_accounts table to ensure only doctors can create, view,
-- update, and manage patient records.

-- Step 1: Enable RLS on dummy_accounts table (if not already enabled)
ALTER TABLE public.dummy_accounts ENABLE ROW LEVEL SECURITY;

-- Step 2: DROP existing policies (if any) to start fresh
DROP POLICY IF EXISTS "doctors_can_insert_patients" ON public.dummy_accounts;
DROP POLICY IF EXISTS "doctors_can_select_patients" ON public.dummy_accounts;
DROP POLICY IF EXISTS "doctors_can_update_patients" ON public.dummy_accounts;

-- Step 3: CREATE policy for INSERT - Allow doctors to create patient records
CREATE POLICY "doctors_can_insert_patients" ON public.dummy_accounts
  FOR INSERT
  WITH CHECK (
    -- Check if user is authenticated and has doctor role
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'doctor'
    )
  );

-- Step 4: CREATE policy for SELECT - Allow doctors to view patient records
CREATE POLICY "doctors_can_select_patients" ON public.dummy_accounts
  FOR SELECT
  USING (
    -- Check if user is authenticated and has doctor role
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'doctor'
    )
  );

-- Step 5: CREATE policy for UPDATE - Allow doctors to update patient records
CREATE POLICY "doctors_can_update_patients" ON public.dummy_accounts
  FOR UPDATE
  USING (
    -- Check if user is authenticated and has doctor role
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'doctor'
    )
  )
  WITH CHECK (
    -- Check if user is authenticated and has doctor role
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'doctor'
    )
  );

-- Step 6: OPTIONAL - CREATE policy for DELETE - Allow doctors to delete patient records
CREATE POLICY "doctors_can_delete_patients" ON public.dummy_accounts
  FOR DELETE
  USING (
    -- Check if user is authenticated and has doctor role
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'doctor'
    )
  );

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║                         VERIFICATION                            ║
-- ║  Run this query to verify policies are applied correctly:        ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'dummy_accounts'
-- ORDER BY policyname;

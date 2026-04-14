-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION: Fix Dummy Accounts SELECT Policy                    ║
-- ║  Make sure doctors can read dummy_accounts via JWT               ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Problem: Direct SELECT queries on dummy_accounts return 0 rows
-- because the RLS policy checks auth.uid() against profiles.id

-- Solution: Create a more permissive SELECT policy that allows doctors to read
-- Check if user is a doctor in the profiles table

-- Drop old policies first
DROP POLICY IF EXISTS "doctors_can_select_dummy_accounts" ON public.dummy_accounts;
DROP POLICY IF EXISTS "authenticated_can_select_dummy_accounts" ON public.dummy_accounts;

-- Create new SELECT policy that properly checks doctor role
CREATE POLICY "doctor_select_dummy_accounts" ON public.dummy_accounts
  FOR SELECT
  USING (
    -- Check if current user is a doctor
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'doctor'
    )
  );

-- Keep the other operations (INSERT, UPDATE, DELETE) with doctor-only checks
-- But make sure they also use the same auth.uid() check

-- Fix INSERT if it exists
DROP POLICY IF EXISTS "doctors_can_insert_dummy_accounts" ON public.dummy_accounts;
CREATE POLICY "doctor_insert_dummy_accounts" ON public.dummy_accounts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'doctor'
    )
  );

-- Fix UPDATE if it exists
DROP POLICY IF EXISTS "doctors_can_update_dummy_accounts" ON public.dummy_accounts;
CREATE POLICY "doctor_update_dummy_accounts" ON public.dummy_accounts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'doctor'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'doctor'
    )
  );

-- Fix DELETE if it exists
DROP POLICY IF EXISTS "doctors_can_delete_dummy_accounts" ON public.dummy_accounts;
CREATE POLICY "doctor_delete_dummy_accounts" ON public.dummy_accounts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'doctor'
    )
  );

-- Verify the user has role='doctor' in profiles table
-- Debug query - run this to check:
-- SELECT id, email, role FROM public.profiles WHERE role = 'doctor' LIMIT 5;

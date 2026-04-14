-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION: Doctor-Only CRUD RLS Policies for dummy_accounts     ║
-- ║  Only users with role='doctor' in profiles table can CRUD         ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Step 1: DROP existing policies
DROP POLICY IF EXISTS "authenticated_can_select_dummy_accounts" ON public.dummy_accounts;
DROP POLICY IF EXISTS "authenticated_can_insert_dummy_accounts" ON public.dummy_accounts;
DROP POLICY IF EXISTS "authenticated_can_update_dummy_accounts" ON public.dummy_accounts;
DROP POLICY IF EXISTS "authenticated_can_delete_dummy_accounts" ON public.dummy_accounts;
DROP POLICY IF EXISTS "doctors_can_select_dummy_accounts" ON public.dummy_accounts;
DROP POLICY IF EXISTS "doctors_can_insert_dummy_accounts" ON public.dummy_accounts;
DROP POLICY IF EXISTS "doctors_can_update_dummy_accounts" ON public.dummy_accounts;
DROP POLICY IF EXISTS "doctors_can_delete_dummy_accounts" ON public.dummy_accounts;

-- Step 2: CREATE new doctor-only policies that check profiles table

-- SELECT: Only doctors can read dummy_accounts
CREATE POLICY "doctors_can_select_dummy_accounts" ON public.dummy_accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'doctor'
    )
  );

-- INSERT: Only doctors can create new dummy_accounts
CREATE POLICY "doctors_can_insert_dummy_accounts" ON public.dummy_accounts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'doctor'
    )
  );

-- UPDATE: Only doctors can update dummy_accounts
CREATE POLICY "doctors_can_update_dummy_accounts" ON public.dummy_accounts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'doctor'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'doctor'
    )
  );

-- DELETE: Only doctors can delete dummy_accounts
CREATE POLICY "doctors_can_delete_dummy_accounts" ON public.dummy_accounts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'doctor'
    )
  );

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║                    WHY THIS IS SECURE                           ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- ✅ auth.uid() reads from JWT token (always available)
-- ✅ Checks profiles table for user's actual role in database
-- ✅ Only users with role='doctor' can CRUD
-- ✅ Applies to ALL 4 operations: SELECT, INSERT, UPDATE, DELETE
-- ✅ Additional app-level protection: (doctor) layout route
-- ✅ Cannot be bypassed - enforced at database level

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║                    VERIFICATION QUERY                           ║
-- ║  Run this to verify all 4 policies are created correctly:        ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'dummy_accounts'
-- ORDER BY policyname;

-- Expected output: 4 rows with policies for SELECT, INSERT, UPDATE, DELETE

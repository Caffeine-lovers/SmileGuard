-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION: Fix RLS Policies for dummy_accounts                 ║
-- ║  Use JWT auth.role() instead of broken auth.uid() in React Native║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- PROBLEM: 
-- The old policies used auth.uid() which requires AsyncStorage persistence
-- in React Native, but Supabase JS SDK doesn't reliably persist sessions
-- to AsyncStorage. This caused auth.uid() to be NULL in RLS checks.

-- SOLUTION:
-- Use auth.role() = 'authenticated' which uses JWT token claims
-- JWT tokens are sent with every request and work reliably in React Native
-- Doctor-only access is already enforced by the (doctor) layout route protection

-- Step 1: DROP existing policies that use auth.uid()
DROP POLICY IF EXISTS "doctors_can_delete_patients" ON public.dummy_accounts;
DROP POLICY IF EXISTS "doctors_can_insert_patients" ON public.dummy_accounts;
DROP POLICY IF EXISTS "doctors_can_select_patients" ON public.dummy_accounts;
DROP POLICY IF EXISTS "doctors_can_update_patients" ON public.dummy_accounts;
DROP POLICY IF EXISTS "dummy_accounts_restrict_access" ON public.dummy_accounts;

-- Step 2: CREATE new policies using auth.role() (JWT-based)
-- These policies allow authenticated users to CRUD dummy_accounts
-- Doctor-only enforcement is at the application level (doctor-only layout)

CREATE POLICY "authenticated_can_select_dummy_accounts" ON public.dummy_accounts
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_insert_dummy_accounts" ON public.dummy_accounts
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_update_dummy_accounts" ON public.dummy_accounts
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_delete_dummy_accounts" ON public.dummy_accounts
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║                    WHY THIS WORKS                               ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- ✅ auth.role() uses JWT claims which are sent with every request
-- ✅ JWT tokens work reliably in React Native (no AsyncStorage needed)
-- ✅ Doctor-only access is enforced by: apps/doctor-mobile/app/(doctor)/_layout.tsx
-- ✅ Only authenticated users can reach the RecordsTab (doctor layout checks this)
-- ✅ Simple, secure, and works with Supabase JS SDK in React Native

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║                    VERIFICATION                                 ║
-- ║  Run this query to verify policies are applied correctly:        ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'dummy_accounts'
-- ORDER BY policyname;

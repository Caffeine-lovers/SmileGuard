  -- ╔══════════════════════════════════════════════════════════════════╗
  -- ║  MIGRATION 022: Fix Infinite Recursion in profiles RLS          ║
  -- ║                                                                  ║
  -- ║  Problem (code 42P17):                                           ║
  -- ║  "infinite recursion detected in policy for relation profiles"   ║
  -- ║                                                                  ║
  -- ║  Cause:                                                          ║
  -- ║  The policy "Doctors can view patient profiles" on profiles      ║
  -- ║  executes a subquery:                                            ║
  -- ║    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()  ║
  -- ║            AND role = 'doctor')                                  ║
  -- ║  Evaluating this SELECT on profiles triggers the SELECT policy   ║
  -- ║  again, causing an infinite loop.                                ║
  -- ║                                                                  ║
  -- ║  Fix:                                                            ║
  -- ║  1. Create a SECURITY DEFINER helper function `is_doctor()`      ║
  -- ║     which queries profiles bypassing RLS.                        ║
  -- ║  2. Replace recursive policies with calls to the helper function ║
  -- ║     or auth.jwt() claims.                                        ║
  -- ║                                                                  ║
  -- ║  Run this in Supabase → SQL Editor → New Query                   ║
  -- ╚══════════════════════════════════════════════════════════════════╝

  -- Step 1: Create SECURITY DEFINER helper functions that bypass RLS
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
        AND role = 'doctor'
    );
  $$;

  CREATE OR REPLACE FUNCTION public.get_my_role()
  RETURNS TEXT
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public
  AS $$
    SELECT role
    FROM public.profiles
    WHERE id = auth.uid();
  $$;

  -- Grant execution to authenticated users
  REVOKE ALL ON FUNCTION public.is_doctor() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.is_doctor() TO authenticated;

  REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;


  -- Step 2: Fix policies on public.profiles

  -- 2a. Fix SELECT policy for doctors
  DROP POLICY IF EXISTS "Doctors can view patient profiles" ON public.profiles;

  CREATE POLICY "Doctors can view patient profiles"
    ON public.profiles FOR SELECT
    USING (
      public.is_doctor() AND role = 'patient'
    );

  -- 2b. Ensure users can always view their own profile
  DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

  CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

  -- 2c. Fix UPDATE policy if it has a self-referencing role subquery
  DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

  CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
      auth.uid() = id
      AND role = COALESCE(public.get_my_role(), role)
    );




  -- ╔══════════════════════════════════════════════════════════════════╗
  -- ║                    VERIFICATION QUERY                           ║
  -- ╚══════════════════════════════════════════════════════════════════╝
  -- Run this to check policies on profiles:
  -- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
  -- FROM pg_policies
  -- WHERE tablename = 'profiles';

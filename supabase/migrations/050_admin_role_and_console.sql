-- ==============================================================================
-- Migration 050: Admin Role & Admin Console
-- ==============================================================================
-- 1. Adds 'admin' to profiles.role.
-- 2. Closes the doctor-access-code bypass in complete_doctor_registration
--    (previously ANY string >= 4 chars, or a hardcoded dev list, was accepted
--    as a valid doctor code — this made doctor_access_codes management a no-op).
-- 3. Creates support_requests table (thesis 3.4).
-- 4. Adds admin-only CRUD RLS on doctor_access_codes, admin read on
--    doctor_code_attempts, and admin-bypass CRUD on doctors/profiles.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. is_admin() HELPER (SECURITY DEFINER, mirrors public.is_doctor() from 022 —
--    avoids "infinite recursion detected in policy for relation profiles")
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
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
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. ALLOW 'admin' IN public.profiles(role)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('patient', 'doctor', 'assistant', 'admin'));

-- ------------------------------------------------------------------------------
-- 3. LET ADMINS BYPASS THE SELF-UPDATE GUARD (038_id_credentials_bucket_and_pwd_guard.sql)
--    so an admin can edit/deactivate another user's profile, including role.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW; -- service role / SECURITY DEFINER function
  END IF;

  IF current_user = 'anon' THEN
    RAISE EXCEPTION 'Sign in to update a profile.' USING ERRCODE = '42501';
  END IF;

  IF public.is_admin() AND NEW.id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW; -- an admin managing another account
  END IF;

  IF public.is_doctor() AND NEW.id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW; -- a doctor reviewing a patient
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT (OLD.role IS NULL AND NEW.role = 'patient') THEN
    RAISE EXCEPTION 'You cannot change your account role.' USING ERRCODE = '42501';
  END IF;

  IF NEW.pwd_status IS DISTINCT FROM OLD.pwd_status
     AND COALESCE(NEW.pwd_status, 'none') NOT IN ('pending', 'none') THEN
    RAISE EXCEPTION 'Only the clinic can approve or reject PWD/Senior verification.' USING ERRCODE = '42501';
  END IF;

  IF NEW.pwd_reviewed_at IS DISTINCT FROM OLD.pwd_reviewed_at
     OR NEW.pwd_reviewed_by IS DISTINCT FROM OLD.pwd_reviewed_by
     OR NEW.pwd_rejection_reason IS DISTINCT FROM OLD.pwd_rejection_reason THEN
    RAISE EXCEPTION 'Only the clinic can record a verification review.' USING ERRCODE = '42501';
  END IF;

  IF OLD.pwd_status = 'approved'
     AND (NEW.pwd_type IS DISTINCT FROM OLD.pwd_type
          OR NEW.pwd_id_path IS DISTINCT FROM OLD.pwd_id_path
          OR NEW.pwd_id_url IS DISTINCT FROM OLD.pwd_id_url) THEN
    NEW.pwd_status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. CLOSE THE ACCESS-CODE BYPASS
--    Only a code present and is_active = true in doctor_access_codes validates.
--    No more "any string >= 4 chars" or hardcoded dev-code fallback.
--    An 'admin'-tier code (e.g. CLINIC-ADMIN-01) is rejected here — admins are
--    provisioned directly in the database (Phase 2), never through self-registration.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.complete_doctor_registration(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.complete_doctor_registration(
  p_code TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_specialization TEXT,
  p_license_number TEXT,
  p_middle_name TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_profile_picture_url TEXT DEFAULT NULL,
  p_gender TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_doctor_id UUID;
  v_valid_code BOOLEAN := FALSE;
  v_code_tier TEXT;
  v_role TEXT := 'doctor';
  v_full_name TEXT;
  v_user_email TEXT;
  v_default_hours JSONB := '{
    "monday": {"open": "09:00", "close": "17:00"},
    "tuesday": {"open": "09:00", "close": "17:00"},
    "wednesday": {"open": "09:00", "close": "17:00"},
    "thursday": {"open": "09:00", "close": "17:00"},
    "friday": {"open": "09:00", "close": "17:00"},
    "saturday": {"isClosed": true, "open": "", "close": ""},
    "sunday": {"isClosed": true, "open": "", "close": ""}
  }'::jsonb;
BEGIN
  -- 1. Identify current authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Not authenticated. Please log in.'
    );
  END IF;

  -- 2. Validate Access Code strictly against doctor_access_codes (no bypass)
  SELECT tier INTO v_code_tier
  FROM public.doctor_access_codes
  WHERE UPPER(code) = UPPER(TRIM(p_code))
    AND is_active = TRUE
  LIMIT 1;

  IF v_code_tier IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Invalid or inactive Clinic Access Code.'
    );
  END IF;

  IF v_code_tier IN ('assistant', 'staff') THEN
    v_valid_code := TRUE;
    v_role := 'assistant';
  ELSIF v_code_tier = 'doctor' THEN
    v_valid_code := TRUE;
    v_role := 'doctor';
  ELSE
    -- 'admin' (or any other non-clinical tier) cannot self-register as a doctor/assistant
    v_valid_code := FALSE;
  END IF;

  IF NOT v_valid_code THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Invalid or inactive Clinic Access Code.'
    );
  END IF;

  -- Construct full name
  v_full_name := TRIM(
    CONCAT_WS(' ',
      NULLIF(TRIM(p_first_name), ''),
      NULLIF(TRIM(COALESCE(p_middle_name, '')), ''),
      NULLIF(TRIM(p_last_name), '')
    )
  );

  -- Fetch user email from auth.users
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- 3. ENSURE public.profiles HAS THE ACCURATE ROLE (assistant or doctor)
  INSERT INTO public.profiles (
    id,
    name,
    email,
    role,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    COALESCE(NULLIF(v_full_name, ''), CASE WHEN v_role = 'assistant' THEN 'Assistant Doctor' ELSE 'Doctor' END),
    COALESCE(v_user_email, ''),
    v_role,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    role = v_role,
    name = COALESCE(NULLIF(v_full_name, ''), public.profiles.name),
    email = COALESCE(NULLIF(public.profiles.email, ''), v_user_email, public.profiles.email),
    updated_at = now();

  -- 4. UPSERT INTO public.doctors WITH THE ACCURATE ROLE (assistant or doctor)
  INSERT INTO public.doctors (
    user_id,
    first_name,
    middle_name,
    last_name,
    gender,
    role,
    specialization,
    license_number,
    bio,
    profile_picture_url,
    years_of_experience,
    office_hours,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    TRIM(p_first_name),
    NULLIF(TRIM(COALESCE(p_middle_name, '')), ''),
    TRIM(p_last_name),
    NULLIF(TRIM(COALESCE(p_gender, '')), ''),
    v_role,
    TRIM(p_specialization),
    TRIM(p_license_number),
    TRIM(COALESCE(p_bio, '')),
    p_profile_picture_url,
    0,
    v_default_hours,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    middle_name = EXCLUDED.middle_name,
    last_name = EXCLUDED.last_name,
    gender = COALESCE(EXCLUDED.gender, public.doctors.gender),
    role = v_role,
    specialization = EXCLUDED.specialization,
    license_number = EXCLUDED.license_number,
    bio = EXCLUDED.bio,
    profile_picture_url = COALESCE(EXCLUDED.profile_picture_url, public.doctors.profile_picture_url),
    years_of_experience = COALESCE(public.doctors.years_of_experience, 0),
    office_hours = COALESCE(public.doctors.office_hours, v_default_hours),
    updated_at = now()
  RETURNING id INTO v_doctor_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'message', CASE WHEN v_role = 'assistant' THEN 'Assistant staff profile registered successfully.' ELSE 'Doctor profile registered successfully.' END,
    'doctor_id', v_doctor_id,
    'role', v_role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_doctor_registration(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;

-- ------------------------------------------------------------------------------
-- 5. support_requests TABLE (thesis 3.4)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requester_role TEXT, -- 'doctor' | 'assistant' | 'patient'
  subject TEXT,
  message TEXT,
  status TEXT DEFAULT 'open', -- open | in_progress | resolved
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.support_requests
  DROP CONSTRAINT IF EXISTS support_requests_status_check;
ALTER TABLE public.support_requests
  ADD CONSTRAINT support_requests_status_check
  CHECK (status IN ('open', 'in_progress', 'resolved'));

CREATE INDEX IF NOT EXISTS idx_support_requests_status ON public.support_requests(status);
CREATE INDEX IF NOT EXISTS idx_support_requests_requester ON public.support_requests(requester_id);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "requester_select_own" ON public.support_requests;
CREATE POLICY "requester_select_own" ON public.support_requests
  FOR SELECT
  USING (requester_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "requester_insert_own" ON public.support_requests;
CREATE POLICY "requester_insert_own" ON public.support_requests
  FOR INSERT
  WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "admin_update_all_support_requests" ON public.support_requests;
CREATE POLICY "admin_update_all_support_requests" ON public.support_requests
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT ON public.support_requests TO authenticated;
GRANT UPDATE ON public.support_requests TO authenticated;
GRANT ALL ON public.support_requests TO service_role;

-- ------------------------------------------------------------------------------
-- 6. ADMIN-ONLY CRUD ON doctor_access_codes (existing SELECT policy from 042
--    only exposes is_active = true codes to anon/authenticated — keep that for
--    the registration flow, and add an admin-only policy that sees/manages all)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin_full_access_codes" ON public.doctor_access_codes;
CREATE POLICY "admin_full_access_codes" ON public.doctor_access_codes
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT INSERT, UPDATE, DELETE ON public.doctor_access_codes TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. ADMIN READ-ONLY ON doctor_code_attempts (sibling to allow_select_attempts)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin_select_attempts" ON public.doctor_code_attempts;
CREATE POLICY "admin_select_attempts" ON public.doctor_code_attempts
  FOR SELECT
  USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 8. ADMIN CRUD ON doctors AND profiles
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin_full_access_doctors" ON public.doctors;
CREATE POLICY "admin_full_access_doctors" ON public.doctors
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_full_access_profiles" ON public.profiles;
CREATE POLICY "admin_full_access_profiles" ON public.profiles
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 9. Seeding an admin account: NOT done here. Provision directly, e.g.:
--    UPDATE public.profiles SET role = 'admin' WHERE id = '<existing-auth-user-uuid>';
--    Admins are never created through the public doctor/assistant registration flow.
-- ------------------------------------------------------------------------------

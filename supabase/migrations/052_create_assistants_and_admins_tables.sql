-- ==============================================================================
-- Migration 052: Create Dedicated 'assistants' and 'admins' Tables + Staff/Admin RLS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PROFILES ROLE CHECK
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('patient', 'doctor', 'assistant', 'admin'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Constraint update on profiles skipped: %', SQLERRM;
END $$;

-- ------------------------------------------------------------------------------
-- 2. CREATE 'assistants' TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assistants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_name          TEXT NOT NULL,
  middle_name         TEXT,
  last_name           TEXT NOT NULL,
  phone               TEXT,
  gender              TEXT,
  profile_picture_url TEXT,
  clinic_name         TEXT DEFAULT 'SmileGuard Dental Clinic',
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistants_user_id ON public.assistants(user_id);
CREATE INDEX IF NOT EXISTS idx_assistants_last_name ON public.assistants(last_name);

COMMENT ON TABLE public.assistants IS 'Dedicated clinic assistant and staff profiles';

-- ------------------------------------------------------------------------------
-- 3. CREATE 'admins' TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admins (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_name          TEXT NOT NULL,
  middle_name         TEXT,
  last_name           TEXT NOT NULL,
  phone               TEXT,
  admin_level         TEXT DEFAULT 'admin' CHECK (admin_level IN ('admin', 'superadmin', 'manager')),
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admins_user_id ON public.admins(user_id);

COMMENT ON TABLE public.admins IS 'Clinic administrators with full CRUD capabilities';

-- ------------------------------------------------------------------------------
-- 4. NON-RECURSIVE SECURITY DEFINER HELPERS
-- ------------------------------------------------------------------------------
-- Admin check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = auth.uid() AND is_active = TRUE
  );
$$;

-- Assistant check
CREATE OR REPLACE FUNCTION public.is_assistant()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'assistant'
  ) OR EXISTS (
    SELECT 1 FROM public.assistants
    WHERE user_id = auth.uid() AND is_active = TRUE
  );
$$;

-- Doctor check
CREATE OR REPLACE FUNCTION public.is_doctor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'doctor'
  ) OR EXISTS (
    SELECT 1 FROM public.doctors
    WHERE user_id = auth.uid()
  );
$$;

-- Unified Staff check (doctor OR assistant OR admin)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.is_admin() OR public.is_doctor() OR public.is_assistant();
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_assistant() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_doctor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_assistant() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_doctor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. RLS POLICIES FOR 'assistants'
-- ------------------------------------------------------------------------------
ALTER TABLE public.assistants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assistants_admin_all" ON public.assistants;
CREATE POLICY "assistants_admin_all" ON public.assistants
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "assistants_staff_select" ON public.assistants;
CREATE POLICY "assistants_staff_select" ON public.assistants
  FOR SELECT
  USING (public.is_staff());

DROP POLICY IF EXISTS "assistants_self_select" ON public.assistants;
CREATE POLICY "assistants_self_select" ON public.assistants
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "assistants_self_insert" ON public.assistants;
CREATE POLICY "assistants_self_insert" ON public.assistants
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "assistants_self_update" ON public.assistants;
CREATE POLICY "assistants_self_update" ON public.assistants
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 6. RLS POLICIES FOR 'admins'
-- ------------------------------------------------------------------------------
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_admin_all" ON public.admins;
CREATE POLICY "admins_admin_all" ON public.admins
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_self_select" ON public.admins;
CREATE POLICY "admins_self_select" ON public.admins
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admins_self_insert" ON public.admins;
CREATE POLICY "admins_self_insert" ON public.admins
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admins_self_update" ON public.admins;
CREATE POLICY "admins_self_update" ON public.admins
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 7. APPOINTMENTS RLS
-- ------------------------------------------------------------------------------
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointments_admin_all" ON public.appointments;
CREATE POLICY "appointments_admin_all" ON public.appointments
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "appointments_staff_select" ON public.appointments;
CREATE POLICY "appointments_staff_select" ON public.appointments
  FOR SELECT
  USING (public.is_staff() OR patient_id = auth.uid());

DROP POLICY IF EXISTS "appointments_staff_insert" ON public.appointments;
CREATE POLICY "appointments_staff_insert" ON public.appointments
  FOR INSERT
  WITH CHECK (public.is_staff() OR patient_id = auth.uid());

DROP POLICY IF EXISTS "appointments_staff_update" ON public.appointments;
CREATE POLICY "appointments_staff_update" ON public.appointments
  FOR UPDATE
  USING (public.is_staff() OR patient_id = auth.uid());

DROP POLICY IF EXISTS "appointments_staff_delete" ON public.appointments;
CREATE POLICY "appointments_staff_delete" ON public.appointments
  FOR DELETE
  USING (public.is_staff());

-- ------------------------------------------------------------------------------
-- 8. DUMMY PATIENTS RLS (Walk-in records)
-- ------------------------------------------------------------------------------
ALTER TABLE public.dummy_patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dummy_patients_admin_all" ON public.dummy_patients;
CREATE POLICY "dummy_patients_admin_all" ON public.dummy_patients
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "dummy_patients_staff_select" ON public.dummy_patients;
CREATE POLICY "dummy_patients_staff_select" ON public.dummy_patients
  FOR SELECT
  USING (public.is_staff());

DROP POLICY IF EXISTS "dummy_patients_staff_insert" ON public.dummy_patients;
CREATE POLICY "dummy_patients_staff_insert" ON public.dummy_patients
  FOR INSERT
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "dummy_patients_staff_update" ON public.dummy_patients;
CREATE POLICY "dummy_patients_staff_update" ON public.dummy_patients
  FOR UPDATE
  USING (public.is_staff());

DROP POLICY IF EXISTS "dummy_patients_staff_delete" ON public.dummy_patients;
CREATE POLICY "dummy_patients_staff_delete" ON public.dummy_patients
  FOR DELETE
  USING (public.is_staff());

-- ------------------------------------------------------------------------------
-- 9. BILLINGS RLS
-- ------------------------------------------------------------------------------
ALTER TABLE public.billings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billings_admin_all" ON public.billings;
CREATE POLICY "billings_admin_all" ON public.billings
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "billings_staff_select" ON public.billings;
CREATE POLICY "billings_staff_select" ON public.billings
  FOR SELECT
  USING (public.is_staff() OR patient_id = auth.uid());

DROP POLICY IF EXISTS "billings_staff_insert" ON public.billings;
CREATE POLICY "billings_staff_insert" ON public.billings
  FOR INSERT
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "billings_staff_update" ON public.billings;
CREATE POLICY "billings_staff_update" ON public.billings
  FOR UPDATE
  USING (public.is_staff());

DROP POLICY IF EXISTS "billings_staff_delete" ON public.billings;
CREATE POLICY "billings_staff_delete" ON public.billings
  FOR DELETE
  USING (public.is_staff());

-- ------------------------------------------------------------------------------
-- 10. CLINIC RULES & BLOCKOUT DATES RLS
-- ------------------------------------------------------------------------------
ALTER TABLE public.clinic_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic_rules_admin_all" ON public.clinic_rules;
CREATE POLICY "clinic_rules_admin_all" ON public.clinic_rules
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "clinic_rules_staff_select" ON public.clinic_rules;
CREATE POLICY "clinic_rules_staff_select" ON public.clinic_rules
  FOR SELECT
  USING (true);

ALTER TABLE public.clinic_blockout_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic_blockout_admin_all" ON public.clinic_blockout_dates;
CREATE POLICY "clinic_blockout_admin_all" ON public.clinic_blockout_dates
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "clinic_blockout_staff_select" ON public.clinic_blockout_dates;
CREATE POLICY "clinic_blockout_staff_select" ON public.clinic_blockout_dates
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "clinic_blockout_staff_manage" ON public.clinic_blockout_dates;
CREATE POLICY "clinic_blockout_staff_manage" ON public.clinic_blockout_dates
  FOR INSERT
  WITH CHECK (public.is_staff());

-- ------------------------------------------------------------------------------
-- 11. MEDICAL INTAKE & DOCTOR ACCESS CODES RLS
-- ------------------------------------------------------------------------------
ALTER TABLE public.medical_intake ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medical_intake_admin_all" ON public.medical_intake;
CREATE POLICY "medical_intake_admin_all" ON public.medical_intake
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "medical_intake_staff_select" ON public.medical_intake;
CREATE POLICY "medical_intake_staff_select" ON public.medical_intake
  FOR SELECT
  USING (public.is_staff() OR patient_id = auth.uid());

ALTER TABLE public.doctor_access_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doctor_access_codes_admin_all" ON public.doctor_access_codes;
CREATE POLICY "doctor_access_codes_admin_all" ON public.doctor_access_codes
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 12. UPDATE complete_doctor_registration RPC
--     Routes 'assistant' tier codes to public.assistants
--     Routes 'doctor' tier codes to public.doctors
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.complete_doctor_registration(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.complete_doctor_registration(
  p_code TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_specialization TEXT DEFAULT NULL,
  p_license_number TEXT DEFAULT NULL,
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
  v_entity_id UUID;
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

  -- 2. Validate Access Code strictly against doctor_access_codes
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
    COALESCE(NULLIF(v_full_name, ''), CASE WHEN v_role = 'assistant' THEN 'Clinic Assistant' ELSE 'Doctor' END),
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

  -- 4. INSERT INTO APPROPRIATE TABLE (assistants or doctors)
  IF v_role = 'assistant' THEN
    INSERT INTO public.assistants (
      user_id,
      first_name,
      middle_name,
      last_name,
      phone,
      gender,
      profile_picture_url,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      TRIM(p_first_name),
      NULLIF(TRIM(COALESCE(p_middle_name, '')), ''),
      TRIM(p_last_name),
      NULL,
      NULLIF(TRIM(COALESCE(p_gender, '')), ''),
      NULLIF(TRIM(COALESCE(p_profile_picture_url, '')), ''),
      now(),
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      middle_name = EXCLUDED.middle_name,
      last_name = EXCLUDED.last_name,
      gender = COALESCE(EXCLUDED.gender, public.assistants.gender),
      profile_picture_url = COALESCE(EXCLUDED.profile_picture_url, public.assistants.profile_picture_url),
      updated_at = now()
    RETURNING id INTO v_entity_id;

    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Assistant registration completed successfully.',
      'doctor_id', v_entity_id,
      'role', 'assistant'
    );
  ELSE
    -- Doctor role: insert into public.doctors
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
      'doctor',
      TRIM(COALESCE(p_specialization, 'General Dentistry')),
      TRIM(COALESCE(p_license_number, '0000000')),
      NULLIF(TRIM(COALESCE(p_bio, '')), ''),
      NULLIF(TRIM(COALESCE(p_profile_picture_url, '')), ''),
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
      role = 'doctor',
      specialization = EXCLUDED.specialization,
      license_number = EXCLUDED.license_number,
      bio = COALESCE(EXCLUDED.bio, public.doctors.bio),
      profile_picture_url = COALESCE(EXCLUDED.profile_picture_url, public.doctors.profile_picture_url),
      updated_at = now()
    RETURNING id INTO v_entity_id;

    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Doctor registration completed successfully.',
      'doctor_id', v_entity_id,
      'role', 'doctor'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_doctor_registration(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;

-- ------------------------------------------------------------------------------
-- 13. UPDATE claim_admin_access RPC
--     Populates public.admins and sets profiles.role = 'admin'
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_admin_access(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.claim_admin_access(p_code TEXT, p_platform TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_code TEXT := LEFT(UPPER(TRIM(COALESCE(p_code, ''))), 64);
  v_is_admin_code BOOLEAN;
  v_email TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT (tier = 'admin') INTO v_is_admin_code
  FROM public.doctor_access_codes
  WHERE UPPER(code) = v_code AND is_active = TRUE
  LIMIT 1;

  IF NOT COALESCE(v_is_admin_code, FALSE) THEN
    RETURN FALSE;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.profiles (id, name, email, role, created_at, updated_at)
  VALUES (
    v_user_id,
    COALESCE(SPLIT_PART(v_email, '@', 1), 'Clinic Admin'),
    COALESCE(v_email, ''),
    'admin',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET role = 'admin', updated_at = now();

  INSERT INTO public.admins (
    user_id,
    first_name,
    last_name,
    admin_level,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    COALESCE(SPLIT_PART(v_email, '@', 1), 'Clinic'),
    'Admin',
    'admin',
    TRUE,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET is_active = TRUE, updated_at = now();

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_admin_access(TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 14. SAFE DATA BACKFILL (Migrates existing assistants from doctors table)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'doctors') THEN
    INSERT INTO public.assistants (
      user_id,
      first_name,
      middle_name,
      last_name,
      phone,
      gender,
      profile_picture_url,
      created_at,
      updated_at
    )
    SELECT 
      d.user_id,
      COALESCE(d.first_name, 'Clinic'),
      d.middle_name,
      COALESCE(d.last_name, 'Assistant'),
      d.doctor_phone,
      d.gender,
      d.profile_picture_url,
      d.created_at,
      d.updated_at
    FROM public.doctors d
    WHERE d.role = 'assistant'
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 15. PERMISSION GRANTS
-- ------------------------------------------------------------------------------
GRANT ALL ON public.assistants TO authenticated, service_role;
GRANT ALL ON public.admins TO authenticated, service_role;

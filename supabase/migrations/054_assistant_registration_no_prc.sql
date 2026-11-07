-- ==============================================================================
-- Migration 054: Assistant Registration - Remove PRC Credentials from Database Insert
-- ==============================================================================
-- 1. Ensure columns on public.doctors are nullable (license_number, specialization,
--    years_of_experience, bio).
-- 2. Nullify any placeholder PRC values for assistant records in public.doctors.
-- 3. Update complete_doctor_registration RPC to explicitly insert NULL for PRC fields
--    (license_number, specialization, years_of_experience, bio) when role = 'assistant'.
-- ==============================================================================

-- 1. Ensure columns are NULLABLE in public.doctors
ALTER TABLE public.doctors ALTER COLUMN license_number DROP NOT NULL;
ALTER TABLE public.doctors ALTER COLUMN specialization DROP NOT NULL;
ALTER TABLE public.doctors ALTER COLUMN years_of_experience DROP NOT NULL;
ALTER TABLE public.doctors ALTER COLUMN bio DROP NOT NULL;

-- 2. Clean up any existing assistant records in public.doctors
UPDATE public.doctors
SET 
  license_number = NULL,
  specialization = NULL,
  years_of_experience = NULL,
  bio = NULL
WHERE LOWER(role) = 'assistant'
  OR (license_number IS NOT NULL AND TRIM(license_number) = '')
  OR specialization = 'Clinic Assistant';

-- 3. UPDATE complete_doctor_registration RPC
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

  -- 4. INSERT INTO public.doctors FOR ASSISTANT (no PRC credentials required)
  IF v_role = 'assistant' THEN
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
      'assistant',
      NULL,
      NULL,
      NULL,
      p_profile_picture_url,
      NULL,
      v_default_hours,
      now(),
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      middle_name = EXCLUDED.middle_name,
      last_name = EXCLUDED.last_name,
      gender = COALESCE(EXCLUDED.gender, public.doctors.gender),
      role = 'assistant',
      specialization = NULL,
      license_number = NULL,
      bio = NULL,
      profile_picture_url = COALESCE(EXCLUDED.profile_picture_url, public.doctors.profile_picture_url),
      years_of_experience = NULL,
      office_hours = COALESCE(public.doctors.office_hours, v_default_hours),
      updated_at = now()
    RETURNING id INTO v_entity_id;

    -- Also mirror to assistants table if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'assistants'
    ) THEN
      BEGIN
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
          first_name = TRIM(p_first_name),
          middle_name = NULLIF(TRIM(COALESCE(p_middle_name, '')), ''),
          last_name = TRIM(p_last_name),
          gender = COALESCE(NULLIF(TRIM(COALESCE(p_gender, '')), ''), public.assistants.gender),
          profile_picture_url = COALESCE(NULLIF(TRIM(COALESCE(p_profile_picture_url, '')), ''), public.assistants.profile_picture_url),
          updated_at = now();
      EXCEPTION WHEN OTHERS THEN
        -- Non-blocking mirror
      END;
    END IF;

    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Clinic assistant profile registered successfully in doctors table.',
      'doctor_id', v_entity_id,
      'role', 'assistant'
    );
  END IF;

  -- 5. DOCTOR REGISTRATION: Doctors Table Only
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
    role = 'doctor',
    specialization = EXCLUDED.specialization,
    license_number = EXCLUDED.license_number,
    bio = EXCLUDED.bio,
    profile_picture_url = COALESCE(EXCLUDED.profile_picture_url, public.doctors.profile_picture_url),
    years_of_experience = COALESCE(public.doctors.years_of_experience, 0),
    office_hours = COALESCE(public.doctors.office_hours, v_default_hours),
    updated_at = now()
  RETURNING id INTO v_entity_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Doctor profile registered successfully.',
    'doctor_id', v_entity_id,
    'role', 'doctor'
  );
END;
$$;


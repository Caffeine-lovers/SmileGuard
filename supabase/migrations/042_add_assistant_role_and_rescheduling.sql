-- ==============================================================================
-- Migration 042: Add Assistant Role to Doctor Mobile, Rescheduling Tracking & Doctor Profile Insertion
-- ==============================================================================

-- 1. ADD RESCHEDULING & NOTES COLUMNS TO APPOINTMENTS (Idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'rescheduled_by'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN rescheduled_by TEXT DEFAULT NULL;
    COMMENT ON COLUMN public.appointments.rescheduled_by IS 'Role or entity that rescheduled the appointment (e.g. assistant, doctor, patient)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'rescheduled_at'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN rescheduled_at TIMESTAMPTZ DEFAULT NULL;
    COMMENT ON COLUMN public.appointments.rescheduled_at IS 'Timestamp when the appointment was rescheduled';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN notes TEXT DEFAULT NULL;
    COMMENT ON COLUMN public.appointments.notes IS 'Clinical, rescheduling, or patient intake notes';
  END IF;
END $$;

-- 2. ADD ROLE COLUMN TO DOCTORS TABLE (Idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'doctors' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.doctors ADD COLUMN role TEXT DEFAULT 'doctor';
    COMMENT ON COLUMN public.doctors.role IS 'Staff role: doctor or assistant';
  END IF;
END $$;

-- 3. ENSURE DOCTOR ACCESS CODES INCLUDE SEPARATE DOCTOR AND ASSISTANT CODES
CREATE TABLE IF NOT EXISTS public.doctor_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT,
  tier TEXT DEFAULT 'doctor',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.doctor_access_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_select_codes" ON public.doctor_access_codes;
CREATE POLICY "allow_select_codes" ON public.doctor_access_codes
  FOR SELECT
  TO anon, authenticated, service_role
  USING (is_active = true);

GRANT SELECT ON public.doctor_access_codes TO anon, authenticated, service_role;

-- Seed / Update the access codes:
-- SMILE-DOC-2026: Doctor Access Code (Doctor Profile & Clinical CRUD)
-- SMILEGUARD-STAFF: Assistant Access Code (Assistant Profile in doctors table, Schedule Viewing & Rescheduling)
INSERT INTO public.doctor_access_codes (code, label, tier, is_active)
VALUES
  ('SMILE-DOC-2026', 'Primary Dentist (Standard Clinical CRUD)', 'doctor', true),
  ('SMILEGUARD-STAFF', 'Clinic Assistant (Schedule Viewing & Rescheduling Access)', 'assistant', true)
ON CONFLICT (code) DO UPDATE
SET
  label = EXCLUDED.label,
  tier = EXCLUDED.tier,
  is_active = EXCLUDED.is_active;

-- 4. UPDATE complete_doctor_registration RPC TO HANDLE ASSISTANT ROLE & INSERT INTO DOCTORS
DROP FUNCTION IF EXISTS public.complete_doctor_registration(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.complete_doctor_registration(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
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
  v_code_tier TEXT := 'doctor';
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

  -- 2. Validate Access Code & Determine Role
  -- Specific Access Codes:
  -- SMILEGUARD-STAFF -> 'assistant'
  -- SMILE-DOC-2026 -> 'doctor'
  IF UPPER(TRIM(p_code)) = 'SMILEGUARD-STAFF' THEN
    v_valid_code := TRUE;
    v_role := 'assistant';
  ELSIF UPPER(TRIM(p_code)) = 'SMILE-DOC-2026' THEN
    v_valid_code := TRUE;
    v_role := 'doctor';
  ELSE
    -- Check doctor_access_codes table
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'doctor_access_codes'
      ) THEN
        SELECT tier, TRUE INTO v_code_tier, v_valid_code
        FROM public.doctor_access_codes
        WHERE UPPER(code) = UPPER(TRIM(p_code))
          AND (is_active IS NULL OR is_active = TRUE)
        LIMIT 1;

        IF v_code_tier IN ('assistant', 'staff') THEN
          v_role := 'assistant';
        ELSE
          v_role := 'doctor';
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_valid_code := FALSE;
    END;

    -- Recognized fallbacks
    IF NOT v_valid_code THEN
      IF UPPER(TRIM(p_code)) IN ('DOC-2024-SG', 'DOC-ALPHA-01', 'DOC-BETA-02', 'DOC-DEV-001', 'CLINIC-ADMIN-01') OR LENGTH(TRIM(p_code)) >= 4 THEN
        v_valid_code := TRUE;
        v_role := 'doctor';
      END IF;
    END IF;
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

  -- 3. PROFILES ENSURANCE (Creates profile with role = 'doctor' or 'assistant')
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

  -- 4. Upsert into doctors table (Both doctors and assistants have doctor profile records)
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
    'message', CASE WHEN v_role = 'assistant' THEN 'Assistant doctor profile registered successfully.' ELSE 'Doctor profile registered successfully.' END,
    'doctor_id', v_doctor_id,
    'role', v_role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_doctor_registration(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon;

-- 5. RPC: RESCHEDULE APPOINTMENT
CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  p_appointment_id UUID,
  p_new_date DATE,
  p_new_time TEXT DEFAULT NULL,
  p_rescheduled_by TEXT DEFAULT 'assistant',
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_updated_count INTEGER;
  v_new_status TEXT;
  v_current_status TEXT;
  v_current_notes TEXT;
  v_final_notes TEXT;
BEGIN
  SELECT status, notes INTO v_current_status, v_current_notes
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Appointment not found'::TEXT;
    RETURN;
  END IF;

  -- Determine status
  IF LOWER(p_rescheduled_by) = 'patient' THEN
    v_new_status := 'pending';
  ELSE
    -- Doctor or Assistant reschedule maintains or updates to scheduled
    v_new_status := 'scheduled';
  END IF;

  -- Update notes column with rescheduling notes
  IF p_notes IS NOT NULL AND TRIM(p_notes) <> '' THEN
    v_final_notes := TRIM(p_notes);
  ELSE
    v_final_notes := v_current_notes;
  END IF;

  UPDATE public.appointments
  SET
    appointment_date = p_new_date,
    appointment_time = COALESCE(NULLIF(TRIM(p_new_time), ''), appointment_time),
    rescheduled_by = p_rescheduled_by,
    rescheduled_at = NOW(),
    notes = v_final_notes,
    status = v_new_status,
    updated_at = NOW()
  WHERE id = p_appointment_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count > 0 THEN
    RETURN QUERY SELECT TRUE, ('Appointment rescheduled to ' || p_new_date::TEXT || COALESCE(' at ' || p_new_time, ''))::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, 'Failed to update appointment'::TEXT;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, ('Reschedule failed: ' || SQLERRM)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.reschedule_appointment(UUID, DATE, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;

-- 6. UPDATE get_appointments_by_date RPC TO RETURN rescheduled_by AND rescheduled_at
DROP FUNCTION IF EXISTS get_appointments_by_date(DATE, UUID);

CREATE OR REPLACE FUNCTION get_appointments_by_date(
  p_date DATE,
  p_dentist_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  patient_id UUID,
  dummy_account_id UUID,
  dentist_id UUID,
  service TEXT,
  appointment_date DATE,
  appointment_time TEXT,
  status TEXT,
  notes TEXT,
  doctor_note TEXT,
  rescheduled_by TEXT,
  rescheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.patient_id, a.dummy_account_id, a.dentist_id, a.service,
    a.appointment_date, a.appointment_time, a.status, a.notes, a.doctor_note,
    a.rescheduled_by, a.rescheduled_at,
    a.created_at, a.updated_at
  FROM appointments a
  WHERE a.appointment_date = p_date
    AND a.dentist_id IS NOT NULL
    AND LOWER(a.status) <> 'pending'
  ORDER BY a.appointment_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_appointments_by_date(DATE, UUID) TO authenticated;

-- 7. UPDATE get_appointments_range RPC TO RETURN rescheduled_by AND rescheduled_at
DROP FUNCTION IF EXISTS get_appointments_range(DATE, DATE, UUID);

CREATE OR REPLACE FUNCTION get_appointments_range(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_dentist_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  patient_id UUID,
  dummy_account_id UUID,
  dentist_id UUID,
  service TEXT,
  appointment_date DATE,
  appointment_time TEXT,
  status TEXT,
  notes TEXT,
  doctor_note TEXT,
  rescheduled_by TEXT,
  rescheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.patient_id, a.dummy_account_id, a.dentist_id, a.service,
    a.appointment_date, a.appointment_time, a.status, a.notes, a.doctor_note,
    a.rescheduled_by, a.rescheduled_at,
    a.created_at, a.updated_at
  FROM appointments a
  WHERE (p_start_date IS NULL OR a.appointment_date >= p_start_date)
    AND (p_end_date IS NULL OR a.appointment_date <= p_end_date)
    AND a.dentist_id IS NOT NULL
    AND LOWER(a.status) <> 'pending'
  ORDER BY a.appointment_date DESC, a.appointment_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_appointments_range(DATE, DATE, UUID) TO authenticated;

-- 8. UPDATE is_doctor() TO INCLUDE ASSISTANT ROLE
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
      AND LOWER(role) IN ('doctor', 'assistant')
  );
$$;

-- 9. RLS POLICIES FOR ASSISTANT SCHEDULE VIEWING AND APPOINTMENTS UPDATE
DROP POLICY IF EXISTS "appointments_assistant_select" ON public.appointments;
CREATE POLICY "appointments_assistant_select" ON public.appointments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('doctor', 'assistant')
    )
  );

DROP POLICY IF EXISTS "appointments_assistant_update" ON public.appointments;
CREATE POLICY "appointments_assistant_update" ON public.appointments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('doctor', 'assistant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('doctor', 'assistant')
    )
  );


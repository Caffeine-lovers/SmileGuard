-- ==============================================================================
-- Migration 045: Create 'dummy_patients' Table & Support in Appointments
-- ==============================================================================
-- Allows clinic assistants and doctors to record walk-in / keeper patients who do
-- not have an online patient-web auth account in a dedicated table.
-- Also updates 'appointments' table so appointments can reference dummy patients.
-- ==============================================================================

-- 1. CREATE DUMMY_PATIENTS TABLE
CREATE TABLE IF NOT EXISTS public.dummy_patients (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  phone                   TEXT,
  email                   TEXT,
  date_of_birth           TEXT,
  gender                  TEXT,
  address                 TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  allergies               TEXT DEFAULT 'None',
  service                 TEXT DEFAULT 'General',
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

-- Index for searching dummy patients
CREATE INDEX IF NOT EXISTS idx_dummy_patients_name ON public.dummy_patients(name);
CREATE INDEX IF NOT EXISTS idx_dummy_patients_phone ON public.dummy_patients(phone);

-- 2. ENABLE ROW LEVEL SECURITY ON DUMMY_PATIENTS
ALTER TABLE public.dummy_patients ENABLE ROW LEVEL SECURITY;

-- Allow authenticated clinic staff (doctors, assistants) full access
DROP POLICY IF EXISTS "dummy_patients_select_policy" ON public.dummy_patients;
CREATE POLICY "dummy_patients_select_policy" ON public.dummy_patients
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "dummy_patients_insert_policy" ON public.dummy_patients;
CREATE POLICY "dummy_patients_insert_policy" ON public.dummy_patients
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "dummy_patients_update_policy" ON public.dummy_patients;
CREATE POLICY "dummy_patients_update_policy" ON public.dummy_patients
  FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "dummy_patients_delete_policy" ON public.dummy_patients;
CREATE POLICY "dummy_patients_delete_policy" ON public.dummy_patients
  FOR DELETE
  TO authenticated
  USING (true);

-- 3. UPDATE APPOINTMENTS TABLE FOR DUMMY PATIENT SUPPORT
-- Add dummy_patient_id column if not exists
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS dummy_patient_id UUID REFERENCES public.dummy_patients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_dummy_patient_id 
ON public.appointments(dummy_patient_id);

-- Make patient_id nullable so appointments can be for either registered or dummy patients
ALTER TABLE public.appointments ALTER COLUMN patient_id DROP NOT NULL;

-- 4. CREATE HELPER RPC TO INSERT DUMMY PATIENT SAFELY
CREATE OR REPLACE FUNCTION public.create_dummy_patient(
  p_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_service TEXT DEFAULT 'General',
  p_date_of_birth TEXT DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_emergency_contact_name TEXT DEFAULT NULL,
  p_emergency_contact_phone TEXT DEFAULT NULL,
  p_allergies TEXT DEFAULT 'None'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id UUID;
  v_result JSONB;
BEGIN
  INSERT INTO public.dummy_patients (
    name,
    email,
    phone,
    service,
    date_of_birth,
    gender,
    address,
    emergency_contact_name,
    emergency_contact_phone,
    allergies,
    created_at,
    updated_at
  ) VALUES (
    p_name,
    NULLIF(TRIM(p_email), ''),
    NULLIF(TRIM(p_phone), ''),
    COALESCE(NULLIF(TRIM(p_service), ''), 'General'),
    NULLIF(TRIM(p_date_of_birth), ''),
    NULLIF(TRIM(p_gender), ''),
    NULLIF(TRIM(p_address), ''),
    NULLIF(TRIM(p_emergency_contact_name), ''),
    NULLIF(TRIM(p_emergency_contact_phone), ''),
    COALESCE(NULLIF(TRIM(p_allergies), ''), 'None'),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_patient_id;

  SELECT json_build_object(
    'success', TRUE,
    'patient_id', v_patient_id,
    'name', p_name,
    'dummy', TRUE
  )::jsonb INTO v_result;

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', FALSE,
    'error', SQLERRM
  )::jsonb;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.create_dummy_patient TO authenticated;


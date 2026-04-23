-- Migration: Create medical_intake table with auto-creation trigger
-- Date: 2026-04-23
-- Purpose: Store patient medical history and complete signup flow

-- ============================================================================
-- 1. CREATE MEDICAL_INTAKE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.medical_intake (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  date_of_birth TEXT,
  gender TEXT,
  phone TEXT,
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  allergies TEXT,
  current_medications TEXT,
  medical_conditions TEXT,
  past_surgeries TEXT,
  smoking_status TEXT DEFAULT '',
  pregnancy_status TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_medical_intake_patient_id ON public.medical_intake(patient_id);

-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.medical_intake ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. CREATE RLS POLICIES
-- ============================================================================

-- Policy: Patients can view their own medical_intake record
DROP POLICY IF EXISTS "medical_intake_select_patient" ON public.medical_intake;
CREATE POLICY "medical_intake_select_patient" ON public.medical_intake
  FOR SELECT
  USING (auth.uid() = patient_id);

-- Policy: Patients can insert their own medical_intake record
DROP POLICY IF EXISTS "medical_intake_insert_patient" ON public.medical_intake;
CREATE POLICY "medical_intake_insert_patient" ON public.medical_intake
  FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

-- Policy: Patients can update their own medical_intake record
DROP POLICY IF EXISTS "medical_intake_update_patient" ON public.medical_intake;
CREATE POLICY "medical_intake_update_patient" ON public.medical_intake
  FOR UPDATE
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

-- Policy: Doctors can view medical_intake for their patients
DROP POLICY IF EXISTS "medical_intake_select_doctor" ON public.medical_intake;
CREATE POLICY "medical_intake_select_doctor" ON public.medical_intake
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments
      WHERE appointments.patient_id = medical_intake.patient_id
        AND appointments.dentist_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. CREATE TRIGGER TO AUTO-CREATE MEDICAL_INTAKE FOR NEW PATIENT SIGNUPS
-- ============================================================================

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.create_medical_intake_for_new_patient()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create medical_intake if the user is a patient
  IF NEW.role = 'patient' THEN
    INSERT INTO public.medical_intake (patient_id)
    VALUES (NEW.id)
    ON CONFLICT (patient_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS create_medical_intake_trigger ON public.profiles;

-- Create trigger on profile creation
CREATE TRIGGER create_medical_intake_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_medical_intake_for_new_patient();

-- ============================================================================
-- 6. GRANT PERMISSIONS FOR SUBSCRIPTIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.medical_intake TO authenticated;
GRANT SUBSCRIBE ON public.medical_intake TO authenticated;

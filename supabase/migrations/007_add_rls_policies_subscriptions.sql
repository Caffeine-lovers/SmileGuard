-- Migration: Add RLS SELECT policies for real-time subscriptions
-- Purpose: Enable Supabase real-time subscriptions by providing SELECT policies
-- Date: 2026-04-10

-- ============================================
-- 1. APPOINTMENTS TABLE - RLS POLICIES
-- ============================================

-- Enable RLS if not already enabled
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "appointments_select_doctor" ON public.appointments;
DROP POLICY IF EXISTS "appointments_select_patient" ON public.appointments;
DROP POLICY IF EXISTS "appointments_select_unassigned" ON public.appointments;

-- Policy: Doctors can view appointments they're assigned to
CREATE POLICY "appointments_select_doctor" ON public.appointments
  FOR SELECT
  USING (auth.uid() = dentist_id);

-- Policy: Doctors can view unassigned appointments (dentist_id IS NULL)
CREATE POLICY "appointments_select_unassigned" ON public.appointments
  FOR SELECT
  USING (dentist_id IS NULL);

-- Policy: Patients can view their own appointments
CREATE POLICY "appointments_select_patient" ON public.appointments
  FOR SELECT
  USING (auth.uid() = patient_id);

-- ============================================
-- 2. MEDICAL_INTAKE TABLE - RLS POLICIES
-- ============================================

-- Enable RLS if not already enabled
ALTER TABLE public.medical_intake ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "medical_intake_select_patient" ON public.medical_intake;
DROP POLICY IF EXISTS "medical_intake_select_doctor" ON public.medical_intake;

-- Policy: Patients can view their own medical intake
CREATE POLICY "medical_intake_select_patient" ON public.medical_intake
  FOR SELECT
  USING (auth.uid() = patient_id);

-- Policy: Doctors can view medical intake of their patients
CREATE POLICY "medical_intake_select_doctor" ON public.medical_intake
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments
      WHERE appointments.patient_id = medical_intake.patient_id
        AND appointments.dentist_id = auth.uid()
    )
  );

-- ============================================
-- 3. TREATMENTS TABLE - RLS POLICIES
-- ============================================

-- Enable RLS if not already enabled
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "treatments_select_patient" ON public.treatments;
DROP POLICY IF EXISTS "treatments_select_doctor" ON public.treatments;

-- Policy: Patients can view their own treatments
CREATE POLICY "treatments_select_patient" ON public.treatments
  FOR SELECT
  USING (auth.uid() = patient_id);

-- Policy: Doctors can view treatments of their patients
CREATE POLICY "treatments_select_doctor" ON public.treatments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments
      WHERE appointments.patient_id = treatments.patient_id
        AND appointments.dentist_id = auth.uid()
    )
  );

-- ============================================
-- 4. BILLINGS TABLE - RLS POLICIES
-- ============================================

-- Enable RLS if not already enabled
ALTER TABLE public.billings ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "billings_select_authenticated" ON public.billings;

-- Policy: Allow authenticated users to see billings (can be refined later)
-- Note: Adjust this based on your billing model (patient_id field, etc.)
CREATE POLICY "billings_select_authenticated" ON public.billings
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- Indexes for subscription performance
-- ============================================

-- Ensure patient_id indexes exist for subscriptions
CREATE INDEX IF NOT EXISTS idx_medical_intake_patient_id ON public.medical_intake(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatments_patient_id ON public.treatments(patient_id);

-- Ensure dentist_id index exists for appointments subscriptions
CREATE INDEX IF NOT EXISTS idx_appointments_dentist_id ON public.appointments(dentist_id);

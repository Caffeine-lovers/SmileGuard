-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 021: Fix Infinite Recursion in appointments RLS       ║
-- ║                                                                  ║
-- ║  Problem (code 42P17):                                           ║
-- ║  medical_intake_select_doctor policy queries appointments table  ║
-- ║  → which triggers appointments RLS evaluation                    ║
-- ║  → which may query back through the same chain → ♾️ recursion   ║
-- ║                                                                  ║
-- ║  Fix: Use a SECURITY DEFINER helper function that bypasses RLS   ║
-- ║  when checking if a doctor has appointments for a patient.       ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Step 1: Create a SECURITY DEFINER helper function that checks
-- appointments WITHOUT triggering RLS (runs as the function owner)
CREATE OR REPLACE FUNCTION public.doctor_has_appointment_with_patient(
  p_dentist_id UUID,
  p_patient_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER  -- bypasses RLS, runs as DB owner
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.dentist_id = p_dentist_id
      AND a.patient_id = p_patient_id
  );
$$;

-- Revoke public execute, only allow authenticated users
REVOKE ALL ON FUNCTION public.doctor_has_appointment_with_patient(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.doctor_has_appointment_with_patient(UUID, UUID) TO authenticated;

-- Step 2: Drop the recursive policies and replace with non-recursive versions

-- Fix medical_intake policy
DROP POLICY IF EXISTS "medical_intake_select_doctor" ON public.medical_intake;

CREATE POLICY "medical_intake_select_doctor" ON public.medical_intake
  FOR SELECT
  USING (
    public.doctor_has_appointment_with_patient(auth.uid(), patient_id)
  );

-- Fix treatments policy (same issue - also queries appointments)
DROP POLICY IF EXISTS "treatments_select_doctor" ON public.treatments;

CREATE POLICY "treatments_select_doctor" ON public.treatments
  FOR SELECT
  USING (
    public.doctor_has_appointment_with_patient(auth.uid(), patient_id)
  );

-- ✓ Migration complete!
-- The SECURITY DEFINER function bypasses RLS when checking appointments,
-- breaking the circular dependency.
--
-- Policies now work like this:
--   medical_intake SELECT → calls helper fn (no RLS) → checks appointments table directly ✅
--   treatments SELECT    → calls helper fn (no RLS) → checks appointments table directly ✅

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║                    VERIFICATION QUERY                           ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- SELECT schemaname, tablename, policyname, qual
-- FROM pg_policies
-- WHERE tablename IN ('medical_intake', 'treatments', 'appointments')
-- ORDER BY tablename, policyname;

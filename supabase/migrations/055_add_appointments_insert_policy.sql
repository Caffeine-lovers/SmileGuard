-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 055: Fix appointment booking — add INSERT policy for patients  ║
-- ║                                                                          ║
-- ║  Bug: Patients could SELECT their appointments but not INSERT (create)   ║
-- ║  new ones because migration 007 only defined SELECT policies.            ║
-- ║                                                                          ║
-- ║  Fix: Add INSERT policy allowing patients to create appointments where   ║
-- ║  patient_id = auth.uid().                                               ║
-- ║                                                                          ║
-- ║  Run this in Supabase → SQL Editor → New Query. Safe to re-run.          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Add INSERT policy for appointments: patients can create appointments for themselves
DROP POLICY IF EXISTS "appointments_insert_patient" ON public.appointments;
CREATE POLICY "appointments_insert_patient" ON public.appointments
  FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

NOTIFY pgrst, 'reload schema';

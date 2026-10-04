-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 024: RPC to fetch unassigned appointment requests     ║
-- ║                                                                  ║
-- ║  Problem: getAppointmentRequests() uses a direct table query     ║
-- ║  which is blocked by RLS — doctors can only see their own        ║
-- ║  appointments (dentist_id = auth.uid()), not unassigned ones.    ║
-- ║                                                                  ║
-- ║  Fix: SECURITY DEFINER RPC function that bypasses RLS and        ║
-- ║  returns all appointments where dentist_id IS NULL.              ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ╚══════════════════════════════════════════════════════════════════╝

DROP FUNCTION IF EXISTS get_appointment_requests();

CREATE OR REPLACE FUNCTION get_appointment_requests()
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
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.patient_id,
    a.dummy_account_id,
    a.dentist_id,
    a.service,
    a.appointment_date,
    a.appointment_time,
    a.status,
    a.notes,
    a.created_at,
    a.updated_at
  FROM appointments a
  WHERE a.dentist_id IS NULL
    AND a.status NOT IN ('cancelled', 'declined')
  ORDER BY a.appointment_date ASC, a.appointment_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ✓ Only authenticated users can call this function
REVOKE ALL ON FUNCTION get_appointment_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_appointment_requests() TO authenticated;

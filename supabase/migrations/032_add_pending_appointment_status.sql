-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 032: Add 'pending' status to appointments             ║
-- ║                                                                  ║
-- ║  Problem:                                                        ║
-- ║  The appointments_status_check constraint only allowed           ║
-- ║  ('scheduled','completed','cancelled','no-show','declined').     ║
-- ║  Patient bookings were saved as 'scheduled' immediately, so      ║
-- ║  there was no way to tell an un-approved request apart from a    ║
-- ║  confirmed visit. The web "Pending" tab relied on                ║
-- ║  dentist_id IS NULL, but bookings always carry the clinic        ║
-- ║  doctor's id → the Pending tab was always empty.                 ║
-- ║                                                                  ║
-- ║  Fix:                                                            ║
-- ║  1. Allow 'pending' in the CHECK constraint, make it the default ║
-- ║  2. Back-fill legacy unassigned rows to 'pending'                ║
-- ║  3. Requests RPC returns status = 'pending' (+ legacy rows)      ║
-- ║  4. Doctor schedule RPCs exclude pending (they live in Requests) ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- 1. CHECK constraint + default ------------------------------------------------
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check1;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check
  CHECK (LOWER(status) = ANY(ARRAY['pending', 'scheduled', 'completed', 'cancelled', 'no-show', 'declined']));

ALTER TABLE public.appointments ALTER COLUMN status SET DEFAULT 'pending';

-- 2. Back-fill: legacy un-approved requests (no dentist assigned yet) ----------
UPDATE public.appointments
SET status = 'pending', updated_at = NOW()
WHERE dentist_id IS NULL
  AND LOWER(status) = 'scheduled';

-- 3. Requests RPC ---------------------------------------------------------------
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
    a.id, a.patient_id, a.dummy_account_id, a.dentist_id, a.service,
    a.appointment_date, a.appointment_time, a.status, a.notes,
    a.created_at, a.updated_at
  FROM appointments a
  WHERE LOWER(a.status) = 'pending'
     OR (a.dentist_id IS NULL AND LOWER(a.status) NOT IN ('cancelled', 'declined', 'completed', 'no-show'))
  ORDER BY a.appointment_date ASC, a.appointment_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION get_appointment_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_appointment_requests() TO authenticated;

-- 4. Doctor schedule RPCs: exclude pending requests ----------------------------
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
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.patient_id, a.dummy_account_id, a.dentist_id, a.service,
    a.appointment_date, a.appointment_time, a.status, a.notes,
    a.created_at, a.updated_at
  FROM appointments a
  WHERE a.appointment_date = p_date
    AND a.dentist_id IS NOT NULL
    AND LOWER(a.status) <> 'pending'
  ORDER BY a.appointment_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.patient_id, a.dummy_account_id, a.dentist_id, a.service,
    a.appointment_date, a.appointment_time, a.status, a.notes,
    a.created_at, a.updated_at
  FROM appointments a
  WHERE (p_start_date IS NULL OR a.appointment_date >= p_start_date)
    AND (p_end_date IS NULL OR a.appointment_date <= p_end_date)
    AND a.dentist_id IS NOT NULL
    AND LOWER(a.status) <> 'pending'
  ORDER BY a.appointment_date DESC, a.appointment_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_appointments_by_date(DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_appointments_range(DATE, DATE, UUID) TO authenticated;

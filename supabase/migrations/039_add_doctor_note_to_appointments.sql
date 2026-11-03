-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 039: Add Doctor Decline Note to Appointments         ║
-- ║                                                                  ║
-- ║  1. Add 'doctor_note' column to public.appointments             ║
-- ║     Stores doctor's explanation/clinical note when an            ║
-- ║     appointment request or scheduled visit is declined/cancelled.║
-- ║  2. Update update_appointment_status_with_dentist RPC to accept ║
-- ║     an optional doctor note (p_doctor_note TEXT DEFAULT NULL)     ║
-- ║     while preserving backward compatibility with existing calls.  ║
-- ║  3. Update get_appointment_requests, get_appointments_by_date,   ║
-- ║     and get_appointments_range RPCs to return doctor_note.       ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- 1. ADD doctor_note COLUMN TO appointments (Idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'appointments' 
      AND column_name = 'doctor_note'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN doctor_note TEXT DEFAULT NULL;
    COMMENT ON COLUMN public.appointments.doctor_note IS 'Doctor note explaining why an appointment request or booking was declined or updated';
  END IF;
END $$;

-- 2. RECREATE update_appointment_status_with_dentist RPC WITH p_doctor_note
-- First drop existing signature
DROP FUNCTION IF EXISTS update_appointment_status_with_dentist(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS update_appointment_status_with_dentist(UUID, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION update_appointment_status_with_dentist(
  p_appointment_id UUID,
  p_new_status TEXT,
  p_dentist_id UUID,
  p_doctor_note TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_updated_count INTEGER;
  v_effective_status TEXT;
BEGIN
  v_effective_status := p_new_status;

  -- Update appointment status, dentist_id, and doctor_note (if provided or status is declined)
  UPDATE appointments
  SET
    status = v_effective_status,
    dentist_id = p_dentist_id,
    doctor_note = COALESCE(p_doctor_note, doctor_note),
    updated_at = NOW()
  WHERE id = p_appointment_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count > 0 THEN
    RETURN QUERY SELECT TRUE, ('Appointment updated to ' || v_effective_status)::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, 'Appointment not found or no rows updated'::TEXT;
  END IF;

EXCEPTION
  WHEN check_violation THEN
    -- Fallback in case constraint differs: if 'declined' violates constraint, save as cancelled
    IF p_new_status = 'declined' THEN
      UPDATE appointments
      SET
        status = 'cancelled',
        dentist_id = p_dentist_id,
        doctor_note = COALESCE(p_doctor_note, doctor_note),
        updated_at = NOW()
      WHERE id = p_appointment_id;

      GET DIAGNOSTICS v_updated_count = ROW_COUNT;

      IF v_updated_count > 0 THEN
        RETURN QUERY SELECT TRUE, 'Appointment declined (saved as cancelled)'::TEXT;
      ELSE
        RETURN QUERY SELECT FALSE, 'Appointment not found'::TEXT;
      END IF;
    ELSE
      RETURN QUERY SELECT FALSE, ('Check constraint violation for status: ' || p_new_status)::TEXT;
    END IF;
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, ('Unexpected error: ' || SQLERRM)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_appointment_status_with_dentist(UUID, TEXT, UUID, TEXT) TO authenticated;

-- Overload for backward compatibility with 3 arguments:
CREATE OR REPLACE FUNCTION update_appointment_status_with_dentist(
  p_appointment_id UUID,
  p_new_status TEXT,
  p_dentist_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM update_appointment_status_with_dentist(p_appointment_id, p_new_status, p_dentist_id, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_appointment_status_with_dentist(UUID, TEXT, UUID) TO authenticated;

-- 3. UPDATE get_appointment_requests RPC TO INCLUDE doctor_note
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
  doctor_note TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.patient_id, a.dummy_account_id, a.dentist_id, a.service,
    a.appointment_date, a.appointment_time, a.status, a.notes, a.doctor_note,
    a.created_at, a.updated_at
  FROM appointments a
  WHERE LOWER(a.status) = 'pending'
     OR (a.dentist_id IS NULL AND LOWER(a.status) NOT IN ('cancelled', 'declined', 'completed', 'no-show'))
  ORDER BY a.appointment_date ASC, a.appointment_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION get_appointment_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_appointment_requests() TO authenticated;

-- 4. UPDATE get_appointments_by_date RPC TO INCLUDE doctor_note
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
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.patient_id, a.dummy_account_id, a.dentist_id, a.service,
    a.appointment_date, a.appointment_time, a.status, a.notes, a.doctor_note,
    a.created_at, a.updated_at
  FROM appointments a
  WHERE a.appointment_date = p_date
    AND a.dentist_id IS NOT NULL
    AND LOWER(a.status) <> 'pending'
  ORDER BY a.appointment_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_appointments_by_date(DATE, UUID) TO authenticated;

-- 5. UPDATE get_appointments_range RPC TO INCLUDE doctor_note
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
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.patient_id, a.dummy_account_id, a.dentist_id, a.service,
    a.appointment_date, a.appointment_time, a.status, a.notes, a.doctor_note,
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


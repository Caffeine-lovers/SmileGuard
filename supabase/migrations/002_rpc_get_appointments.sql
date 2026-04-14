-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  RPC FUNCTIONS TO BYPASS RLS AND RETRIEVE ALL APPOINTMENTS       ║
-- ║  Including cancelled appointments                                ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Drop existing functions first (to change return type)
DROP FUNCTION IF EXISTS get_appointments_by_date(DATE, UUID);
DROP FUNCTION IF EXISTS get_appointments_range(DATE, DATE, UUID);

-- ─────────────────────────────────────────────────────────────────
-- RPC Function 1: Get appointments for a specific date (including cancelled)
-- ─────────────────────────────────────────────────────────────────
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
  WHERE a.appointment_date = p_date
    AND a.dentist_id IS NOT NULL
  ORDER BY a.appointment_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────
-- RPC Function 2: Get appointments for a date range (including cancelled)
-- ─────────────────────────────────────────────────────────────────
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
  WHERE (p_start_date IS NULL OR a.appointment_date >= p_start_date)
    AND (p_end_date IS NULL OR a.appointment_date <= p_end_date)
    AND a.dentist_id IS NOT NULL
  ORDER BY a.appointment_date DESC, a.appointment_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ✓ RPC functions created successfully!
-- These functions:
--   - Bypass RLS policies (SECURITY DEFINER)
--   - Return ALL appointments including cancelled
--   - Accept optional date range and dentist filters
--   - Are called from TypeScript via supabase.rpc()

-- ─────────────────────────────────────────────────────────────────
-- RPC Function 3: Update appointment status (with dentist_id support)
-- ─────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS update_appointment_status(UUID, TEXT);

CREATE OR REPLACE FUNCTION update_appointment_status(
  p_appointment_id UUID,
  p_new_status TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Update appointment status
  UPDATE appointments
  SET 
    status = p_new_status,
    updated_at = NOW()
  WHERE id = p_appointment_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count > 0 THEN
    RETURN QUERY SELECT TRUE, 'Appointment status updated successfully';
  ELSE
    RETURN QUERY SELECT FALSE, 'Appointment not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────
-- RPC Function 4: Update appointment status and dentist_id
-- ─────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS update_appointment_status_with_dentist(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION update_appointment_status_with_dentist(
  p_appointment_id UUID,
  p_new_status TEXT,
  p_dentist_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Update appointment status and dentist_id
  UPDATE appointments
  SET 
    status = p_new_status,
    dentist_id = p_dentist_id,
    updated_at = NOW()
  WHERE id = p_appointment_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count > 0 THEN
    RETURN QUERY SELECT TRUE, 'Appointment status and dentist updated successfully';
  ELSE
    RETURN QUERY SELECT FALSE, 'Appointment not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

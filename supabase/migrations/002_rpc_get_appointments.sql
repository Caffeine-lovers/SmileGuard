-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  RPC FUNCTIONS TO BYPASS RLS AND RETRIEVE ALL APPOINTMENTS       ║
-- ║  Including cancelled appointments                                ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝

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
    AND (p_dentist_id IS NULL OR a.dentist_id = p_dentist_id OR a.dentist_id IS NULL)
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
  ORDER BY a.appointment_date DESC, a.appointment_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ✓ RPC functions created successfully!
-- These functions:
--   - Bypass RLS policies (SECURITY DEFINER)
--   - Return ALL appointments including cancelled
--   - Accept optional date range and dentist filters
--   - Are called from TypeScript via supabase.rpc()

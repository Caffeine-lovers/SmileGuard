-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 025: Fix update_appointment_status_with_dentist RPC   ║
-- ║                                                                  ║
-- ║  Problems fixed:                                                  ║
-- ║  1. The original RPC had no EXCEPTION block — a check constraint  ║
-- ║     violation (e.g. for 'declined' if migration 008 wasn't run)  ║
-- ║     would propagate as an unhandled error.                        ║
-- ║  2. The TypeScript fallback (direct table UPDATE) is blocked by  ║
-- ║     RLS when the row has dentist_id IS NULL (unassigned rows).    ║
-- ║                                                                  ║
-- ║  Fix: Add EXCEPTION handling inside the RPC so 'declined' works  ║
-- ║  regardless of whether migration 008 was applied.                 ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- First, ensure 'declined' is in the check constraint (idempotent)
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check1;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check
  CHECK (status = ANY(ARRAY['scheduled', 'completed', 'cancelled', 'no-show', 'declined']));

-- Recreate the RPC with proper exception handling
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
  v_effective_status TEXT;
BEGIN
  -- Normalize status: if 'declined' is not in the constraint, fall back to 'cancelled'
  v_effective_status := p_new_status;

  -- Update appointment status and dentist_id
  UPDATE appointments
  SET
    status = v_effective_status,
    dentist_id = p_dentist_id,
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
    -- 'declined' not in constraint — fall back to 'cancelled'
    IF p_new_status = 'declined' THEN
      UPDATE appointments
      SET
        status = 'cancelled',
        dentist_id = p_dentist_id,
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION update_appointment_status_with_dentist(UUID, TEXT, UUID) TO authenticated;

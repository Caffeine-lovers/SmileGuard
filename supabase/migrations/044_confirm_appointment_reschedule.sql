-- ==============================================================================
-- Migration 044: Add confirm_appointment_reschedule RPC
-- ==============================================================================
-- Purpose: Allow assistants and doctors to confirm patient reschedule requests
-- and update rescheduled_by to 'assistant' or 'doctor' while bypassing RLS.

CREATE OR REPLACE FUNCTION public.confirm_appointment_reschedule(
  p_appointment_id UUID,
  p_confirmed_by TEXT DEFAULT 'assistant'
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE public.appointments
  SET
    status = 'scheduled',
    rescheduled_by = COALESCE(NULLIF(TRIM(p_confirmed_by), ''), 'assistant'),
    rescheduled_at = NOW(),
    updated_at = NOW()
  WHERE id = p_appointment_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count > 0 THEN
    RETURN QUERY SELECT TRUE, ('Reschedule confirmed by ' || p_confirmed_by)::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, 'Appointment not found or no rows updated'::TEXT;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, ('Confirm reschedule failed: ' || SQLERRM)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.confirm_appointment_reschedule(UUID, TEXT) TO authenticated, anon, service_role;


-- ==============================================================================
-- Migration 035: Add PWD & Senior Citizen Verification with Doctor Approval
-- ==============================================================================

-- 1. Add PWD & Senior Citizen verification fields to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pwd_status TEXT DEFAULT 'none'; -- 'none', 'pending', 'approved', 'rejected'
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pwd_type TEXT; -- 'pwd', 'senior'
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pwd_id_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pwd_submitted_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pwd_reviewed_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pwd_reviewed_by UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pwd_rejection_reason TEXT;

-- Create index for quick lookup of pending PWD/Senior verification requests
CREATE INDEX IF NOT EXISTS idx_profiles_pwd_status ON public.profiles(pwd_status);

-- 2. Update RLS policies to allow patients to submit and doctors to approve
-- Allow authenticated users to update their own PWD info
DROP POLICY IF EXISTS "allow_patient_submit_pwd" ON public.profiles;
CREATE POLICY "allow_patient_submit_pwd" ON public.profiles
  FOR UPDATE
  TO authenticated, service_role
  USING (auth.uid() = id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = id OR auth.role() = 'service_role');

-- Allow doctors to update patient verification status
DROP POLICY IF EXISTS "allow_doctors_review_pwd" ON public.profiles;
CREATE POLICY "allow_doctors_review_pwd" ON public.profiles
  FOR UPDATE
  TO authenticated, service_role
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'doctor'
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'doctor'
    )
    OR auth.role() = 'service_role'
  );

-- 3. Dedicated SECURITY DEFINER RPC for resilient doctor approval/rejection
CREATE OR REPLACE FUNCTION public.review_patient_pwd(
  p_patient_id UUID,
  p_status TEXT, -- 'approved' or 'rejected'
  p_doctor_id UUID DEFAULT NULL,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated RECORD;
BEGIN
  IF p_status NOT IN ('approved', 'rejected', 'none', 'pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status: ' || p_status);
  END IF;

  UPDATE public.profiles
  SET
    pwd_status = p_status,
    pwd_reviewed_at = now(),
    pwd_reviewed_by = COALESCE(p_doctor_id, auth.uid()),
    pwd_rejection_reason = p_rejection_reason,
    updated_at = now()
  WHERE id = p_patient_id
  RETURNING id, name, pwd_status, pwd_type INTO v_updated;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Patient profile not found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'patient_id', v_updated.id,
    'pwd_status', v_updated.pwd_status,
    'pwd_type', v_updated.pwd_type
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_patient_pwd(UUID, TEXT, UUID, TEXT) TO authenticated, service_role, anon;

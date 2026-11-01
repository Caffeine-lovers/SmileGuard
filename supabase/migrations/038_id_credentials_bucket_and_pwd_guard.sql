-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  038: Private "ID Credentials" bucket + PWD/Senior approval guard ║
-- ║                                                                  ║
-- ║  Run in Supabase → SQL Editor. Safe to run before or after the   ║
-- ║  matching app deploy (the apps fall back to the old pwd_id_url). ║
-- ║  Afterwards run apps/patient-web/scripts/migrate-id-credentials  ║
-- ║  to move IDs already sitting in the public "avatars" bucket.     ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ====================================================================
-- 1. PRIVATE BUCKET FOR GOVERNMENT IDs
-- ====================================================================
-- PWD / Senior Citizen IDs were stored in the PUBLIC "avatars" bucket with
-- permanent public links. They now live in a private bucket, one folder per
-- patient (<patient uuid>/<file>), readable only by that patient and doctors
-- through short-lived signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ID Credentials',
  'ID Credentials',
  false,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "id_credentials_insert_own_folder" ON storage.objects;
CREATE POLICY "id_credentials_insert_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ID Credentials' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "id_credentials_select_own_folder" ON storage.objects;
CREATE POLICY "id_credentials_select_own_folder" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ID Credentials' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "id_credentials_delete_own_folder" ON storage.objects;
CREATE POLICY "id_credentials_delete_own_folder" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ID Credentials' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "id_credentials_select_doctor" ON storage.objects;
CREATE POLICY "id_credentials_select_doctor" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ID Credentials' AND public.is_doctor());

-- Store the private object path (not a URL). pwd_id_url is kept only for
-- legacy rows until the migration script moves them, then cleared.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pwd_id_path TEXT;

-- ====================================================================
-- 2. PATIENTS CAN'T APPROVE THEMSELVES OR CHANGE THEIR ROLE
-- ====================================================================
-- "allow_patient_submit_pwd" lets a patient UPDATE any column of their own
-- profile, so pwd_status = 'approved' (free 20% discount) or role = 'doctor'
-- (read every patient's records) could be set from the browser console.
-- This trigger limits what a signed-in user may change on THEIR OWN row.
-- It only applies to direct API calls (current_user = authenticated/anon);
-- SECURITY DEFINER functions (doctor registration, review_patient_pwd) and the
-- service role are unaffected. Doctors are trusted to review patients.
CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW; -- service role / SECURITY DEFINER function
  END IF;

  IF current_user = 'anon' THEN
    RAISE EXCEPTION 'Sign in to update a profile.' USING ERRCODE = '42501';
  END IF;

  IF public.is_doctor() AND NEW.id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW; -- a doctor reviewing a patient
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT (OLD.role IS NULL AND NEW.role = 'patient') THEN
    RAISE EXCEPTION 'You cannot change your account role.' USING ERRCODE = '42501';
  END IF;

  IF NEW.pwd_status IS DISTINCT FROM OLD.pwd_status
     AND COALESCE(NEW.pwd_status, 'none') NOT IN ('pending', 'none') THEN
    RAISE EXCEPTION 'Only the clinic can approve or reject PWD/Senior verification.' USING ERRCODE = '42501';
  END IF;

  IF NEW.pwd_reviewed_at IS DISTINCT FROM OLD.pwd_reviewed_at
     OR NEW.pwd_reviewed_by IS DISTINCT FROM OLD.pwd_reviewed_by
     OR NEW.pwd_rejection_reason IS DISTINCT FROM OLD.pwd_rejection_reason THEN
    RAISE EXCEPTION 'Only the clinic can record a verification review.' USING ERRCODE = '42501';
  END IF;

  -- Swapping the ID or type after approval sends it back for review
  IF OLD.pwd_status = 'approved'
     AND (NEW.pwd_type IS DISTINCT FROM OLD.pwd_type
          OR NEW.pwd_id_path IS DISTINCT FROM OLD.pwd_id_path
          OR NEW.pwd_id_url IS DISTINCT FROM OLD.pwd_id_url) THEN
    NEW.pwd_status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_self_update ON public.profiles;
CREATE TRIGGER trg_guard_profile_self_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_self_update();

-- ====================================================================
-- 3. ONLY DOCTORS CAN REVIEW PWD/SENIOR REQUESTS
-- ====================================================================
-- review_patient_pwd is SECURITY DEFINER and was granted to anon without
-- checking the caller, so anyone could approve anyone's discount.
CREATE OR REPLACE FUNCTION public.review_patient_pwd(
  p_patient_id UUID,
  p_status TEXT, -- 'approved' or 'rejected'
  p_doctor_id UUID DEFAULT NULL,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated RECORD;
BEGIN
  IF NOT (public.is_doctor() OR auth.role() = 'service_role') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only clinic doctors can review PWD/Senior verification.');
  END IF;

  IF p_status NOT IN ('approved', 'rejected', 'none', 'pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status: ' || p_status);
  END IF;

  UPDATE public.profiles
  SET
    pwd_status = p_status,
    pwd_reviewed_at = now(),
    pwd_reviewed_by = COALESCE(auth.uid(), p_doctor_id), -- record who actually did it
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

REVOKE ALL ON FUNCTION public.review_patient_pwd(UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_patient_pwd(UUID, TEXT, UUID, TEXT) TO authenticated, service_role;

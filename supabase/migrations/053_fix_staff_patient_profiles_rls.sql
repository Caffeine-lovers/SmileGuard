-- ==============================================================================
-- MIGRATION 053: Fix Staff RLS on profiles, medical_intake, documents & scans
-- ==============================================================================
-- Resolves "Unknown Patient" and missing patients bug for Assistant accounts.
-- When Migration 052 decoupled assistants from doctors, is_doctor() was narrowed
-- to only check the 'doctor' role, leaving 'public.profiles' inaccessible to
-- assistants because the SELECT policy was still "Doctors can view patient profiles"
-- (public.is_doctor() AND role = 'patient').
--
-- This migration ensures that public.is_staff() (which includes doctors,
-- assistants, and admins) has full staff read/write access to manage patients.
-- ==============================================================================

-- 1. FIX PROFILES RLS FOR CLINIC STAFF (Doctors, Assistants, Admins)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop legacy doctor-only view policies
DROP POLICY IF EXISTS "Doctors can view patient profiles" ON public.profiles;
DROP POLICY IF EXISTS "Staff can view patient profiles" ON public.profiles;
DROP POLICY IF EXISTS "staff_view_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_staff_select" ON public.profiles;

-- Allow clinic staff (is_staff: doctor, assistant, admin) to view all profiles
-- (patients, doctors, assistants, admins) so assistant accounts can resolve
-- patient names, assigned doctors, and clinic staff.
CREATE POLICY "profiles_staff_select" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.is_staff()
  );

-- Ensure users can view their own profile (patients viewing own account)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Staff update policy on patient profiles (e.g. updating priority, details, service)
DROP POLICY IF EXISTS "staff_update_patient_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_staff_update" ON public.profiles;
CREATE POLICY "profiles_staff_update" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    public.is_staff() AND (role = 'patient' OR role IS NULL)
  )
  WITH CHECK (
    public.is_staff() AND (role = 'patient' OR role IS NULL)
  );

-- 2. UPDATE guard_profile_self_update TRIGGER TO ALLOW STAFF
-- Previously checked public.is_doctor(); now checks public.is_staff()
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

  IF public.is_admin() AND NEW.id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW; -- an admin managing another account
  END IF;

  IF public.is_staff() AND NEW.id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW; -- clinic staff (doctor/assistant) managing a patient profile
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

  RETURN NEW;
END;
$$;

-- 3. FIX MEDICAL INTAKE RLS (Staff insert and update)
ALTER TABLE public.medical_intake ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medical_intake_staff_select" ON public.medical_intake;
CREATE POLICY "medical_intake_staff_select" ON public.medical_intake
  FOR SELECT
  TO authenticated
  USING (public.is_staff() OR patient_id = auth.uid());

DROP POLICY IF EXISTS "medical_intake_staff_insert" ON public.medical_intake;
CREATE POLICY "medical_intake_staff_insert" ON public.medical_intake
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff() OR patient_id = auth.uid());

DROP POLICY IF EXISTS "medical_intake_staff_update" ON public.medical_intake;
CREATE POLICY "medical_intake_staff_update" ON public.medical_intake
  FOR UPDATE
  TO authenticated
  USING (public.is_staff() OR patient_id = auth.uid())
  WITH CHECK (public.is_staff() OR patient_id = auth.uid());

-- 4. FIX PATIENT DOCUMENTS & ANALYSIS RESULTS RLS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'patient_documents') THEN
    ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "documents_select_doctor" ON public.patient_documents;
    DROP POLICY IF EXISTS "documents_select_staff" ON public.patient_documents;
    CREATE POLICY "documents_select_staff" ON public.patient_documents
      FOR SELECT
      TO authenticated
      USING (public.is_staff() OR patient_id = auth.uid());

    DROP POLICY IF EXISTS "documents_insert_doctor" ON public.patient_documents;
    DROP POLICY IF EXISTS "documents_insert_staff" ON public.patient_documents;
    CREATE POLICY "documents_insert_staff" ON public.patient_documents
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_staff() OR (patient_id = auth.uid() AND auth.uid() = uploaded_by));

    DROP POLICY IF EXISTS "documents_delete_staff" ON public.patient_documents;
    CREATE POLICY "documents_delete_staff" ON public.patient_documents
      FOR DELETE
      TO authenticated
      USING (public.is_staff() OR (patient_id = auth.uid() AND auth.uid() = uploaded_by));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'analysis_results') THEN
    ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "analysis_select_doctor" ON public.analysis_results;
    DROP POLICY IF EXISTS "analysis_select_staff" ON public.analysis_results;
    CREATE POLICY "analysis_select_staff" ON public.analysis_results
      FOR SELECT
      TO authenticated
      USING (public.is_staff() OR patient_id = auth.uid());
  END IF;
END $$;

-- 5. FIX STORAGE OBJECTS POLICIES FOR CLINIC STAFF
DO $$
BEGIN
  -- Analyzed images bucket
  DROP POLICY IF EXISTS "scans_select_doctor" ON storage.objects;
  DROP POLICY IF EXISTS "scans_select_staff" ON storage.objects;
  CREATE POLICY "scans_select_staff" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'Analyzed images' AND (public.is_staff() OR (storage.foldername(name))[1] = auth.uid()::text));

  -- patient-documents bucket
  DROP POLICY IF EXISTS "patient_docs_doctor_all" ON storage.objects;
  DROP POLICY IF EXISTS "patient_docs_staff_all" ON storage.objects;
  CREATE POLICY "patient_docs_staff_all" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'patient-documents' AND (public.is_staff() OR (storage.foldername(name))[1] = auth.uid()::text))
    WITH CHECK (bucket_id = 'patient-documents' AND (public.is_staff() OR (storage.foldername(name))[1] = auth.uid()::text));

  -- ID Credentials bucket
  DROP POLICY IF EXISTS "id_credentials_select_doctor" ON storage.objects;
  DROP POLICY IF EXISTS "id_credentials_select_staff" ON storage.objects;
  CREATE POLICY "id_credentials_select_staff" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'ID Credentials' AND (public.is_staff() OR (storage.foldername(name))[1] = auth.uid()::text));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Storage policy update skipped: %', SQLERRM;
END $$;

-- 6. PWD REVIEW RPC: Allow clinic staff
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
  IF NOT (public.is_staff() OR auth.role() = 'service_role') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only clinic staff can review PWD/Senior verification.');
  END IF;

  IF p_status NOT IN ('approved', 'rejected', 'none', 'pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status: ' || p_status);
  END IF;

  UPDATE public.profiles
  SET
    pwd_status = p_status,
    pwd_reviewed_at = now(),
    pwd_reviewed_by = COALESCE(p_doctor_id, auth.uid()),
    pwd_rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE NULL END,
    updated_at = now()
  WHERE id = p_patient_id
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Patient profile not found.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Patient verification status updated to ' || p_status,
    'patient_id', p_patient_id,
    'status', p_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_patient_pwd(UUID, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_patient_pwd(UUID, TEXT, UUID, TEXT) TO authenticated, service_role;

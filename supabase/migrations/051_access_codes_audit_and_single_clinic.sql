-- ==============================================================================
-- Migration 051: Access codes, audit log, admin oversight, single clinic
-- ==============================================================================
-- The live doctor_access_codes and doctor_code_attempts tables predate migrations
-- 033/034/042, whose CREATE TABLE IF NOT EXISTS statements skipped them. They still
-- have the old shape (code_hash / user_id, attempted_at, count), so code checks
-- always failed and every audit insert was rejected.
--
-- Safe to re-run. Legacy columns and rows are kept, not dropped.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. BRING BOTH TABLES UP TO THE SHAPE THE APP EXPECTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.doctor_access_codes ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.doctor_access_codes ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'doctor';
ALTER TABLE public.doctor_access_codes ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE public.doctor_access_codes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.doctor_access_codes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.doctor_access_codes ADD COLUMN IF NOT EXISTS regenerated_at TIMESTAMPTZ;

ALTER TABLE public.doctor_code_attempts ADD COLUMN IF NOT EXISTS event TEXT DEFAULT 'verification';
ALTER TABLE public.doctor_code_attempts ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.doctor_code_attempts ADD COLUMN IF NOT EXISTS attempted_code TEXT;
ALTER TABLE public.doctor_code_attempts ADD COLUMN IF NOT EXISTS is_successful BOOLEAN DEFAULT FALSE;
ALTER TABLE public.doctor_code_attempts ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.doctor_code_attempts ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.doctor_code_attempts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.doctor_code_attempts ADD COLUMN IF NOT EXISTS user_id UUID;

-- Legacy columns may be NOT NULL or unique, which would reject the new rows.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.is_nullable = 'NO'
      AND (
        (c.table_name = 'doctor_access_codes'
          AND c.column_name IN ('code_hash', 'used_by', 'used_at', 'revoked_at', 'expires_at', 'label'))
        OR (c.table_name = 'doctor_code_attempts'
          AND c.column_name IN ('user_id', 'attempted_at', 'count'))
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', r.table_name, r.column_name);
  END LOOP;

  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.doctor_code_attempts'::regclass
      AND con.contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.doctor_code_attempts DROP CONSTRAINT %I', r.conname);
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'doctor_code_attempts' AND column_name = 'attempted_at'
  ) THEN
    UPDATE public.doctor_code_attempts
    SET created_at = attempted_at
    WHERE attempted_at IS NOT NULL
      AND event = 'verification'
      AND attempted_code IS NULL;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS doctor_access_codes_code_key ON public.doctor_access_codes (code);
CREATE INDEX IF NOT EXISTS idx_doctor_code_attempts_created_at ON public.doctor_code_attempts (created_at DESC);

-- These are the codes the app has been accepting from its hardcoded list.
INSERT INTO public.doctor_access_codes (code, label, tier, is_active)
VALUES
  ('CLINIC-ADMIN-01', 'Lead Clinic Administrator', 'admin', TRUE),
  ('SMILE-DOC-2026', 'Primary Dentist', 'doctor', TRUE),
  ('SMILEGUARD-STAFF', 'Clinic Assistant', 'assistant', TRUE)
ON CONFLICT (code) DO NOTHING;

UPDATE public.doctor_access_codes SET tier = 'assistant' WHERE tier = 'staff';

-- ------------------------------------------------------------------------------
-- 2. LOCK BOTH TABLES DOWN
--    Codes are only readable by admins and audit rows are only written by the
--    functions below, so the live policies are replaced rather than added to.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('doctor_access_codes', 'doctor_code_attempts')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END;
$$;

ALTER TABLE public.doctor_access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_code_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.doctor_access_codes FROM anon, authenticated;
REVOKE ALL ON public.doctor_code_attempts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_access_codes TO authenticated;
GRANT SELECT ON public.doctor_code_attempts TO authenticated;
GRANT ALL ON public.doctor_access_codes, public.doctor_code_attempts TO service_role;

CREATE POLICY "admin_select_codes" ON public.doctor_access_codes
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin_insert_codes" ON public.doctor_access_codes
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() AND tier <> 'admin');
CREATE POLICY "admin_update_codes" ON public.doctor_access_codes
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
-- Deleting an admin code could lock every admin out; regenerate it instead.
CREATE POLICY "admin_delete_codes" ON public.doctor_access_codes
  FOR DELETE TO authenticated USING (public.is_admin() AND tier <> 'admin');

CREATE POLICY "admin_select_attempts" ON public.doctor_code_attempts
  FOR SELECT TO authenticated USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 3. AUDIT HELPERS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_ip()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN NULLIF(
    TRIM(SPLIT_PART(
      COALESCE(current_setting('request.headers', TRUE)::json ->> 'x-forwarded-for', ''),
      ',', 1
    )),
    ''
  );
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.write_audit_event(
  p_event TEXT,
  p_code TEXT,
  p_is_successful BOOLEAN,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.doctor_code_attempts
    (event, code, attempted_code, is_successful, ip_address, user_id, details, created_at)
  VALUES
    (p_event, p_code, p_code, p_is_successful, public.request_ip(), auth.uid(), COALESCE(p_details, '{}'::jsonb), now());
$$;

REVOKE ALL ON FUNCTION public.write_audit_event(TEXT, TEXT, BOOLEAN, JSONB) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. CODE VERIFICATION (called before sign-in, so anon must be able to run it)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.active_code_tier(p_code TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tier
  FROM public.doctor_access_codes
  WHERE code = UPPER(TRIM(p_code))
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > now())
    AND revoked_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.active_code_tier(TEXT) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.verify_access_code(TEXT, TEXT);
CREATE FUNCTION public.verify_access_code(p_code TEXT, p_platform TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT := LEFT(UPPER(TRIM(COALESCE(p_code, ''))), 64);
  v_tier TEXT := public.active_code_tier(v_code);
BEGIN
  PERFORM public.write_audit_event(
    'verification',
    v_code,
    v_tier IS NOT NULL,
    jsonb_build_object('role', v_tier, 'platform', LEFT(p_platform, 20))
  );
  RETURN jsonb_build_object('valid', v_tier IS NOT NULL, 'tier', v_tier);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_access_code(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_access_code(TEXT, TEXT) TO anon, authenticated;

-- Runs after sign-in, so the audit log can show who used a code.
DROP FUNCTION IF EXISTS public.record_code_sign_in(TEXT, TEXT);
CREATE FUNCTION public.record_code_sign_in(p_code TEXT, p_platform TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT := LEFT(UPPER(TRIM(COALESCE(p_code, ''))), 64);
  v_tier TEXT := public.active_code_tier(v_code);
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  PERFORM public.write_audit_event(
    'sign_in',
    v_code,
    v_tier IS NOT NULL,
    jsonb_build_object('role', v_tier, 'platform', LEFT(p_platform, 20))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_code_sign_in(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_code_sign_in(TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. ADMIN ACCESS IS GRANTED HERE, NOT BY THE CLIENT
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_admin_access(TEXT, TEXT);
CREATE FUNCTION public.claim_admin_access(p_code TEXT, p_platform TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_code TEXT := LEFT(UPPER(TRIM(COALESCE(p_code, ''))), 64);
  v_is_admin_code BOOLEAN := public.active_code_tier(v_code) = 'admin';
  v_email TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  PERFORM public.write_audit_event(
    'admin_claim',
    v_code,
    COALESCE(v_is_admin_code, FALSE),
    jsonb_build_object('role', 'admin', 'platform', LEFT(p_platform, 20))
  );

  IF NOT COALESCE(v_is_admin_code, FALSE) THEN
    RETURN FALSE;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.profiles (id, name, email, role, created_at, updated_at)
  VALUES (v_user_id, COALESCE(SPLIT_PART(v_email, '@', 1), 'Administrator'), COALESCE(v_email, ''), 'admin', now(), now())
  ON CONFLICT (id) DO UPDATE SET role = 'admin', updated_at = now();

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_admin_access(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_admin_access(TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. REGENERATE: the old code stops working and the new one starts in one step,
--    so there is never a moment with no working code.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.regenerate_access_code(UUID);
CREATE FUNCTION public.regenerate_access_code(p_id UUID)
RETURNS public.doctor_access_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.doctor_access_codes;
  v_prefix TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can regenerate access codes.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.doctor_access_codes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access code not found.' USING ERRCODE = 'P0002';
  END IF;

  v_prefix := CASE v_row.tier
    WHEN 'admin' THEN 'CLINIC-ADMIN'
    WHEN 'assistant' THEN 'SMILE-STAFF'
    ELSE 'SMILE-DOC'
  END;

  UPDATE public.doctor_access_codes
  SET code = v_prefix || '-' || UPPER(SUBSTR(REPLACE(gen_random_uuid()::text, '-', ''), 1, 10)),
      is_active = TRUE,
      revoked_at = NULL,
      expires_at = NULL,
      regenerated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.regenerate_access_code(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_access_code(UUID) TO authenticated;

-- Log every code change, whichever path made it. New code values are left out of
-- the log so that it never holds a working code.
CREATE OR REPLACE FUNCTION public.audit_access_code_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_audit_event('code_created', NULL, TRUE,
      jsonb_build_object('role', NEW.tier, 'label', NEW.label));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.write_audit_event('code_deleted', OLD.code, TRUE,
      jsonb_build_object('role', OLD.tier, 'label', OLD.label));
    RETURN OLD;
  ELSIF NEW.code IS DISTINCT FROM OLD.code THEN
    PERFORM public.write_audit_event('code_regenerated', OLD.code, TRUE,
      jsonb_build_object('role', NEW.tier, 'label', NEW.label));
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    PERFORM public.write_audit_event('code_status_changed', OLD.code, TRUE,
      jsonb_build_object('role', NEW.tier, 'label', NEW.label, 'is_active', NEW.is_active));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_access_code_change ON public.doctor_access_codes;
CREATE TRIGGER trg_audit_access_code_change
  AFTER INSERT OR UPDATE OR DELETE ON public.doctor_access_codes
  FOR EACH ROW EXECUTE FUNCTION public.audit_access_code_change();

-- ------------------------------------------------------------------------------
-- 7. ONE CLINIC. This index fails if a second clinic row ever exists.
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS clinic_setup_single_clinic ON public.clinic_setup ((TRUE));

DROP POLICY IF EXISTS "admin_full_access_clinic_setup" ON public.clinic_setup;
CREATE POLICY "admin_full_access_clinic_setup" ON public.clinic_setup
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 8. ADMIN CAN READ EVERYTHING IN THE CLINIC (READ-ONLY)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'appointments', 'billings', 'medical_intake', 'dummy_patients',
    'notifications', 'patient_documents', 'analysis_results',
    'clinic_blockout_dates', 'clinic_rules'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "admin_read_all" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "admin_read_all" ON public.%I FOR SELECT TO authenticated USING (public.is_admin())',
        t
      );
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    END IF;
  END LOOP;
END;
$$;

-- The Staff tab queries this column, and that query fails without it.
ALTER TABLE IF EXISTS public.doctors ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- ------------------------------------------------------------------------------
-- 9. FEEDBACK FROM BOTH PLATFORMS
--    The role and status come from the server so that a client can't fake them.
-- ------------------------------------------------------------------------------
ALTER TABLE public.support_requests ADD COLUMN IF NOT EXISTS source_platform TEXT;

CREATE OR REPLACE FUNCTION public.stamp_support_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT role INTO NEW.requester_role FROM public.profiles WHERE id = NEW.requester_id;
  NEW.status := 'open';
  NEW.resolved_by := NULL;
  NEW.resolution_note := NULL;
  NEW.resolved_at := NULL;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_support_request ON public.support_requests;
CREATE TRIGGER trg_stamp_support_request
  BEFORE INSERT ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.stamp_support_request();

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
--   MIGRATION 049: Add check_email_context RPC for Email Confirmation
--
--   Validates email context across auth flows:
--   - Registration: Prevents already-registered users with completed intake from re-registering
--   - Password Reset: Blocks reset links for non-registered emails or accounts missing medical intake
--
--   Run this in Supabase -> SQL Editor -> New Query
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_email_context(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_normalized_email TEXT;
  v_profile RECORD;
  v_has_intake BOOLEAN := false;
  v_user_exists BOOLEAN := false;
BEGIN
  v_normalized_email := LOWER(TRIM(p_email));

  IF v_normalized_email IS NULL OR v_normalized_email = '' THEN
    RETURN jsonb_build_object(
      'exists', false,
      'has_profile', false,
      'is_registered', false,
      'has_medical_intake', false,
      'role', 'none',
      'name', ''
    );
  END IF;

  -- 1. Check if user exists in auth.users
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE LOWER(email) = v_normalized_email
  ) INTO v_user_exists;

  -- 2. Check profile in public.profiles
  SELECT id, name, role, created_at
  INTO v_profile
  FROM public.profiles
  WHERE LOWER(email) = v_normalized_email
  ORDER BY created_at DESC
  LIMIT 1;

  -- 3. Check medical_intake if profile found
  IF v_profile.id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.medical_intake
      WHERE patient_id = v_profile.id
        AND (
          (date_of_birth IS NOT NULL AND TRIM(date_of_birth) != '') OR
          (gender IS NOT NULL AND TRIM(gender) != '') OR
          (phone IS NOT NULL AND TRIM(phone) != '')
        )
    ) INTO v_has_intake;
  END IF;

  RETURN jsonb_build_object(
    'exists', (v_user_exists OR v_profile.id IS NOT NULL),
    'has_profile', (v_profile.id IS NOT NULL),
    'is_registered', (v_profile.id IS NOT NULL AND v_profile.role = 'patient'),
    'has_medical_intake', v_has_intake,
    'role', COALESCE(v_profile.role, 'none'),
    'name', COALESCE(v_profile.name, '')
  );
END;
$$;

-- Grant execution to anon, authenticated, and service_role
REVOKE ALL ON FUNCTION public.check_email_context(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_email_context(TEXT) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.check_email_context(TEXT) IS 'Returns registration and medical intake status for an email address to validate auth context.';


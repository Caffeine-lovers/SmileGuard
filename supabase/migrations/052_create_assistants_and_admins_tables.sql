-- ==============================================================================
-- Migration 052: Create Dedicated 'assistants' and 'admins' Tables + Staff/Admin RLS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PROFILES ROLE CHECK
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('patient', 'doctor', 'assistant', 'admin'));

-- ------------------------------------------------------------------------------
-- 2. CREATE 'assistants' TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assistants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_name          TEXT NOT NULL,
  middle_name         TEXT,
  last_name           TEXT NOT NULL,
  phone               TEXT,
  gender              TEXT,
  profile_picture_url TEXT,
  clinic_name         TEXT DEFAULT 'SmileGuard Dental Clinic',
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistants_user_id ON public.assistants(user_id);
CREATE INDEX IF NOT EXISTS idx_assistants_last_name ON public.assistants(last_name);

COMMENT ON TABLE public.assistants IS 'Dedicated clinic assistant and staff profiles';

-- ------------------------------------------------------------------------------
-- 3. CREATE 'admins' TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admins (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_name          TEXT NOT NULL,
  middle_name         TEXT,
  last_name           TEXT NOT NULL,
  phone               TEXT,
  admin_level         TEXT DEFAULT 'admin' CHECK (admin_level IN ('admin', 'superadmin', 'manager')),
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admins_user_id ON public.admins(user_id);

COMMENT ON TABLE public.admins IS 'Clinic administrators with full CRUD capabilities';

-- ------------------------------------------------------------------------------
-- 4. NON-RECURSIVE SECURITY DEFINER HELPERS
-- ------------------------------------------------------------------------------
-- Admin check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = auth.uid() AND is_active = TRUE
  );
$$;

-- Assistant check
CREATE OR REPLACE FUNCTION public.is_assistant()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'assistant'
  ) OR EXISTS (
    SELECT 1 FROM public.assistants
    WHERE user_id = auth.uid() AND is_active = TRUE
  );
$$;

-- Doctor check
CREATE OR REPLACE FUNCTION public.is_doctor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'doctor'
  ) OR EXISTS (
    SELECT 1 FROM public.doctors
    WHERE user_id = auth.uid()
  );
$$;

-- Unified Staff check (doctor OR assistant OR admin)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.is_admin() OR public.is_doctor() OR public.is_assistant();
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_assistant() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_doctor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_assistant() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_doctor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. RLS POLICIES FOR 'assistants'
-- ------------------------------------------------------------------------------
ALTER TABLE public.assistants ENABLE ROW LEVEL SECURITY;

-- Admins: Full CRUD
DROP POLICY IF EXISTS "assistants_admin_all" ON public.assistants;
CREATE POLICY "assistants_admin_all" ON public.assistants
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Staff: View assistant profiles
DROP POLICY IF EXISTS "assistants_staff_select" ON public.assistants;
CREATE POLICY "assistants_staff_select" ON public.assistants
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- Self: Insert own assistant profile
DROP POLICY IF EXISTS "assistants_self_insert" ON public.assistants;
CREATE POLICY "assistants_self_insert" ON public.assistants
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Self: Update own assistant profile
DROP POLICY IF EXISTS "assistants_self_update" ON public.assistants;
CREATE POLICY "assistants_self_update" ON public.assistants
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 6. RLS POLICIES FOR 'admins'
-- ------------------------------------------------------------------------------
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Admins: Full CRUD
DROP POLICY IF EXISTS "admins_admin_all" ON public.admins;
CREATE POLICY "admins_admin_all" ON public.admins
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Self: Read own admin profile
DROP POLICY IF EXISTS "admins_self_select" ON public.admins;
CREATE POLICY "admins_self_select" ON public.admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 7. RLS POLICIES FOR CORE CLINIC TABLES
--    (Admin: ALL CRUD | Assistant & Doctor: Staff Operations)
-- ------------------------------------------------------------------------------

-- APPOINTMENTS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointments_admin_all" ON public.appointments;
CREATE POLICY "appointments_admin_all" ON public.appointments
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "appointments_staff_select" ON public.appointments;
CREATE POLICY "appointments_staff_select" ON public.appointments
  FOR SELECT
  TO authenticated
  USING (public.is_staff() OR patient_id = auth.uid());

DROP POLICY IF EXISTS "appointments_staff_insert" ON public.appointments;
CREATE POLICY "appointments_staff_insert" ON public.appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff() OR patient_id = auth.uid());

DROP POLICY IF EXISTS "appointments_staff_update" ON public.appointments;
CREATE POLICY "appointments_staff_update" ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (public.is_staff() OR patient_id = auth.uid())
  WITH CHECK (public.is_staff() OR patient_id = auth.uid());

-- DUMMY PATIENTS (Walk-in records)
ALTER TABLE public.dummy_patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dummy_patients_admin_all" ON public.dummy_patients;
CREATE POLICY "dummy_patients_admin_all" ON public.dummy_patients
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "dummy_patients_staff_select" ON public.dummy_patients;
CREATE POLICY "dummy_patients_staff_select" ON public.dummy_patients
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "dummy_patients_staff_insert" ON public.dummy_patients;
CREATE POLICY "dummy_patients_staff_insert" ON public.dummy_patients
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "dummy_patients_staff_update" ON public.dummy_patients;
CREATE POLICY "dummy_patients_staff_update" ON public.dummy_patients
  FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- BILLINGS
ALTER TABLE public.billings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billings_admin_all" ON public.billings;
CREATE POLICY "billings_admin_all" ON public.billings
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "billings_staff_select" ON public.billings;
CREATE POLICY "billings_staff_select" ON public.billings
  FOR SELECT
  TO authenticated
  USING (public.is_staff() OR patient_id IN (SELECT id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "billings_staff_insert" ON public.billings;
CREATE POLICY "billings_staff_insert" ON public.billings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "billings_staff_update" ON public.billings;
CREATE POLICY "billings_staff_update" ON public.billings
  FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- CLINIC RULES & BLOCKOUT DATES
ALTER TABLE public.clinic_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_blockout_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic_rules_admin_all" ON public.clinic_rules;
CREATE POLICY "clinic_rules_admin_all" ON public.clinic_rules
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "clinic_rules_staff_select" ON public.clinic_rules;
CREATE POLICY "clinic_rules_staff_select" ON public.clinic_rules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "clinic_blockout_admin_all" ON public.clinic_blockout_dates;
CREATE POLICY "clinic_blockout_admin_all" ON public.clinic_blockout_dates
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "clinic_blockout_staff_select" ON public.clinic_blockout_dates;
CREATE POLICY "clinic_blockout_staff_select" ON public.clinic_blockout_dates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "clinic_blockout_staff_manage" ON public.clinic_blockout_dates;
CREATE POLICY "clinic_blockout_staff_manage" ON public.clinic_blockout_dates
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());

-- MEDICAL INTAKE (Staff can read patient intakes for consultations)
ALTER TABLE public.medical_intake ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medical_intake_admin_all" ON public.medical_intake;
CREATE POLICY "medical_intake_admin_all" ON public.medical_intake
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "medical_intake_staff_select" ON public.medical_intake;
CREATE POLICY "medical_intake_staff_select" ON public.medical_intake
  FOR SELECT TO authenticated
  USING (public.is_staff() OR patient_id = auth.uid());

-- ACCESS CODES (Admin only management)
ALTER TABLE public.doctor_access_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doctor_access_codes_admin_all" ON public.doctor_access_codes;
CREATE POLICY "doctor_access_codes_admin_all" ON public.doctor_access_codes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 8. DATA BACKFILL (Migrates any existing assistants from doctors table)
-- ------------------------------------------------------------------------------
INSERT INTO public.assistants (
  user_id,
  first_name,
  middle_name,
  last_name,
  phone,
  gender,
  profile_picture_url,
  created_at,
  updated_at
)
SELECT 
  d.user_id,
  COALESCE(d.first_name, 'Clinic'),
  d.middle_name,
  COALESCE(d.last_name, 'Assistant'),
  d.doctor_phone,
  d.gender,
  d.profile_picture_url,
  d.created_at,
  d.updated_at
FROM public.doctors d
WHERE d.role = 'assistant'
ON CONFLICT (user_id) DO NOTHING;

-- Clean up assistant records from doctors table now that they have their own table
DELETE FROM public.doctors WHERE role = 'assistant';

-- ------------------------------------------------------------------------------
-- 9. PERMISSION GRANTS
-- ------------------------------------------------------------------------------
GRANT ALL ON public.assistants TO authenticated, service_role;
GRANT ALL ON public.admins TO authenticated, service_role;

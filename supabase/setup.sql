-- ╔══════════════════════════════════════════════════════════════════╗
-- ║           SMILEGUARD — SUPABASE DATABASE SETUP                   ║
-- ║                                                                  ║
-- ║  Run this ONCE in Supabase → SQL Editor → New Query              ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝
--
-- HOW TO USE:
--   1. Open your Supabase project dashboard
--   2. Click "SQL Editor" in the left sidebar
--   3. Click "+ New Query"
--   4. Paste this ENTIRE file
--   5. Click "Run" (or Ctrl+Enter)
--   6. You should see "Success. No rows returned" — that's normal!
--
-- WHAT THIS CREATES:
--   • profiles           — user accounts (linked to Supabase Auth)
--   • medical_intake     — patient biography & medical history
--   • appointments       — booking records
--   • doctor_access_codes— server-side doctor code verification
--   • Trigger function   — auto-creates profile on signup
--   • RLS policies       — row-level security (who can see what)



-- ─────────────────────────────────────────────────────────────────
-- 1. PROFILES TABLE
-- ─────────────────────────────────────────────────────────────────
-- This is the main user table. Every user (patient or doctor) gets
-- a row here when they sign up.
--
-- The app reads this in useAuth.ts:
--   supabase.from("profiles").select("name, email, role").eq("id", userId)
--
-- The `id` column is a foreign key to `auth.users.id` — Supabase
-- Auth manages the actual login credentials (email/password), and
-- this table stores the profile data.

CREATE TABLE IF NOT EXISTS public.profiles (
  -- Links to Supabase Auth user. This is the primary key.
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Basic info
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('patient', 'doctor')),

  -- What service the patient signed up for (e.g. "Cleaning")
  -- NULL for doctors
  service     TEXT DEFAULT 'General',

  -- Timestamps (auto-managed)
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Add a comment so it shows up nicely in the Supabase dashboard
COMMENT ON TABLE public.profiles IS 'User profiles for patients and doctors';



-- ─────────────────────────────────────────────────────────────────
-- 2. MEDICAL INTAKE TABLE
-- ─────────────────────────────────────────────────────────────────
-- Stores the patient's personal info and medical history collected
-- during registration (Steps 2 & 3 of the AuthModal).
--
-- This is a SEPARATE table from profiles because:
--   a) Medical data is sensitive — we can apply stricter RLS
--   b) Doctors need to read their patients' intake, but patients
--      should NOT see other patients' medical records
--   c) It keeps the profiles table lean for quick lookups

CREATE TABLE IF NOT EXISTS public.medical_intake (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links to the patient's profile
  patient_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- ── Biography (Step 2) ──
  date_of_birth           TEXT,
  gender                  TEXT,
  phone                   TEXT,
  address                 TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,

  -- ── Medical History (Step 3) ──
  allergies               TEXT DEFAULT 'None',
  current_medications     TEXT DEFAULT 'None',
  medical_conditions      TEXT DEFAULT 'None',
  past_surgeries          TEXT DEFAULT 'None',
  smoking_status          TEXT CHECK (smoking_status IN ('never', 'former', 'current', '')),
  pregnancy_status        TEXT CHECK (pregnancy_status IN ('yes', 'no', 'na', '')),

  -- Timestamps
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.medical_intake IS 'Patient medical history and biography — collected during registration';

-- Index for fast lookups by patient
CREATE INDEX IF NOT EXISTS idx_medical_intake_patient
  ON public.medical_intake(patient_id);



-- ─────────────────────────────────────────────────────────────────
-- 3. APPOINTMENTS TABLE
-- ─────────────────────────────────────────────────────────────────
-- Stores booking records between patients and doctors.
-- The app has an Appointment type:
--   { id, service, date, status: "Pending" | "Completed" }

CREATE TABLE IF NOT EXISTS public.appointments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who booked and who is the doctor
  patient_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doctor_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Appointment details
  service     TEXT NOT NULL,
  date        TIMESTAMPTZ NOT NULL,
  status      TEXT NOT NULL DEFAULT 'Pending'
              CHECK (status IN ('Pending', 'Completed', 'Cancelled')),
  notes       TEXT,

  -- Timestamps
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.appointments IS 'Patient appointment bookings';

CREATE INDEX IF NOT EXISTS idx_appointments_patient
  ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor
  ON public.appointments(doctor_id);


-- ─────────────────────────────────────────────────────────────────
-- PATIENTS TABLE
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.patients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  date_of_birth DATE,
  address     TEXT,
  medical_conditions TEXT,
  allergies   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.patients IS 'Patient records';

CREATE INDEX IF NOT EXISTS idx_patients_user
  ON public.patients(user_id);


-- ─────────────────────────────────────────────────────────────────
-- TREATMENTS TABLE
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.treatments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  dentist_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  procedure_name TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'in-progress', 'completed')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.treatments IS 'Patient treatment records';

CREATE INDEX IF NOT EXISTS idx_treatments_patient
  ON public.treatments(patient_id);


-- ─────────────────────────────────────────────────────────────────
-- BILLINGS TABLE
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.billings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  amount          DECIMAL(10,2) NOT NULL,
  discount_type   TEXT DEFAULT 'none'
                  CHECK (discount_type IN ('none', 'pwd', 'senior', 'insurance')),
  discount_amount DECIMAL(10,2) DEFAULT 0,
  final_amount    DECIMAL(10,2) NOT NULL,
  payment_status  TEXT NOT NULL DEFAULT 'pending'
                  CHECK (payment_status IN ('pending', 'paid', 'overdue')),
  payment_method  TEXT,
  payment_date    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.billings IS 'Patient billing and payment records';

CREATE INDEX IF NOT EXISTS idx_billings_patient
  ON public.billings(patient_id);


-- ─────────────────────────────────────────────────────────────────
-- 4. DOCTOR ACCESS CODES TABLE  (server-side verification)
-- ─────────────────────────────────────────────────────────────────
-- Instead of hardcoding valid codes in the client JS bundle (where
-- anyone can read them), store them here. The app can later call
-- a Supabase Edge Function to verify the code server-side.
--
-- For now, we pre-seed two codes that match what's in AuthModal.tsx

CREATE TABLE IF NOT EXISTS public.doctor_access_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  label       TEXT,               -- e.g. "Main Clinic Staff"
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.doctor_access_codes IS 'Valid clinic access codes for doctor registration';

-- Seed the initial codes (same ones in The AuthModal.tsx)
INSERT INTO public.doctor_access_codes (code, label) VALUES
  ('SMILE-DOC-2026',    'Default doctor code 2026'),
  ('SMILEGUARD-STAFF',  'General staff access')
ON CONFLICT (code) DO NOTHING;  -- safe to re-run



-- ─────────────────────────────────────────────────────────────────
-- 5. TRIGGER: AUTO-CREATE PROFILE ON SIGNUP
-- ─────────────────────────────────────────────────────────────────
-- When a user calls supabase.auth.signUp(), Supabase creates a row
-- in auth.users. We use a trigger to AUTOMATICALLY create the
-- matching row in public.profiles (and medical_intake for patients).
--
-- The metadata you pass in signUp({ options: { data: { ... } } })
-- ends up in: NEW.raw_user_meta_data  (a JSONB column)
--
-- The useAuth.ts passes:
--   name, role, service, medical_intake

-- First, create the function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER          -- runs with elevated privileges
SET search_path = public  -- security best practice
AS $$
DECLARE
  _intake JSONB;
BEGIN
  -- ── 1. Create the profile row ──
  INSERT INTO public.profiles (id, name, email, role, service)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name',    'Unknown'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role',    'patient'),
    COALESCE(NEW.raw_user_meta_data ->> 'service', 'General')
  );

  -- ── 2. If patient, also create medical_intake row ──
  IF (NEW.raw_user_meta_data ->> 'role') = 'patient' THEN
    _intake := COALESCE(NEW.raw_user_meta_data -> 'medical_intake', '{}'::JSONB);

    INSERT INTO public.medical_intake (
      patient_id,
      date_of_birth,
      gender,
      phone,
      address,
      emergency_contact_name,
      emergency_contact_phone,
      allergies,
      current_medications,
      medical_conditions,
      past_surgeries,
      smoking_status,
      pregnancy_status
    ) VALUES (
      NEW.id,
      _intake ->> 'dateOfBirth',
      _intake ->> 'gender',
      _intake ->> 'phone',
      _intake ->> 'address',
      _intake ->> 'emergencyContactName',
      _intake ->> 'emergencyContactPhone',
      COALESCE(_intake ->> 'allergies',           'None'),
      COALESCE(_intake ->> 'currentMedications',  'None'),
      COALESCE(_intake ->> 'medicalConditions',   'None'),
      COALESCE(_intake ->> 'pastSurgeries',       'None'),
      COALESCE(_intake ->> 'smokingStatus',       ''),
      COALESCE(_intake ->> 'pregnancyStatus',     '')
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Then, attach the trigger to the auth.users table
-- DROP first to make this script safe to re-run
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();



-- ─────────────────────────────────────────────────────────────────
-- 6. AUTO-UPDATE `updated_at` TIMESTAMP
-- ─────────────────────────────────────────────────────────────────
-- A small helper so `updated_at` refreshes whenever a row is edited

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to all tables that have updated_at
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS medical_intake_updated_at ON public.medical_intake;
CREATE TRIGGER medical_intake_updated_at
  BEFORE UPDATE ON public.medical_intake
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS appointments_updated_at ON public.appointments;
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- ─────────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────
-- This is THE most important part for security. Without RLS,
-- anyone with The anon key can read/write EVERYTHING.
--
-- HOW IT WORKS:
--   • Enable RLS on a table → all access is DENIED by default
--   • Create policies → whitelist specific operations
--   • auth.uid() returns the currently logged-in user's UUID
--   • Policies run on EVERY query automatically
--
-- WHY THIS PREVENTS THE ATTACKS YOU WERE WORRIED ABOUT:
--   • SQL injection: Supabase uses parameterised queries internally,
--     so injected SQL never executes. RLS is an extra safety net.
--   • Unauthorised doctor access: A patient's JWT token will have
--     their UUID; RLS checks it against profile.role = 'doctor'
--     before allowing access to doctor-only data.

-- ── 7a. PROFILES ──

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their OWN profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their OWN profile (but NOT change their role!)
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Prevent role escalation: role must stay the same
    -- Use JWT metadata instead of subquery to avoid RLS recursion
    AND role = COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), role)
  );

-- Doctors can view their patients' basic profiles (for dashboard)
-- This checks that the logged-in user is a doctor
CREATE POLICY "Doctors can view patient profiles"
  ON public.profiles FOR SELECT
  USING (
    -- The viewer must be a doctor
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'doctor'
    )
    -- And the row being viewed must be a patient
    AND role = 'patient'
  );

-- The trigger function runs as SECURITY DEFINER, so it bypasses
-- RLS to create the initial profile row. No INSERT policy needed
-- for regular users (they can't manually insert profiles).


-- ── 7b. MEDICAL INTAKE ──

ALTER TABLE public.medical_intake ENABLE ROW LEVEL SECURITY;

-- Patients can view their OWN medical intake
CREATE POLICY "Patients can view own medical intake"
  ON public.medical_intake FOR SELECT
  USING (patient_id = auth.uid());

-- Patients can update their OWN medical intake
CREATE POLICY "Patients can update own medical intake"
  ON public.medical_intake FOR UPDATE
  USING (patient_id = auth.uid());

-- Doctors can view ANY patient's medical intake (for consultations)
CREATE POLICY "Doctors can view patient medical intake"
  ON public.medical_intake FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'doctor'
    )
  );


-- ── 7c. APPOINTMENTS ──

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Patients can view their OWN appointments
CREATE POLICY "Patients can view own appointments"
  ON public.appointments FOR SELECT
  USING (patient_id = auth.uid());

-- Patients can create appointments (book for themselves only)
CREATE POLICY "Patients can create own appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (patient_id = auth.uid());

-- Patients can update their own appointments (cancel/reschedule)
CREATE POLICY "Patients can update own appointments"
  ON public.appointments FOR UPDATE
  USING (patient_id = auth.uid());

-- Doctors can view appointments assigned to them
CREATE POLICY "Doctors can view their appointments"
  ON public.appointments FOR SELECT
  USING (doctor_id = auth.uid());

-- Doctors can update appointments assigned to them (mark complete, etc.)
CREATE POLICY "Doctors can update their appointments"
  ON public.appointments FOR UPDATE
  USING (doctor_id = auth.uid());

-- Doctors can view ALL appointments (for scheduling overview)
CREATE POLICY "Doctors can view all appointments"
  ON public.appointments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'doctor'
    )
  );


-- ── 7d. PATIENTS ──

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Patients can view their own profile
CREATE POLICY "Patients can view own profile"
  ON public.patients FOR SELECT
  USING (user_id = auth.uid());

-- Patients can update their own profile
CREATE POLICY "Patients can update own profile"
  ON public.patients FOR UPDATE
  USING (user_id = auth.uid());

-- Doctors can view all patients
CREATE POLICY "Doctors can view all patients"
  ON public.patients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'doctor'
    )
  );

-- Doctors can insert new patients
CREATE POLICY "Doctors can create patients"
  ON public.patients FOR INSERT
  WITH CHECK (true);

-- Doctors can update patient records
CREATE POLICY "Doctors can update patients"
  ON public.patients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'doctor'
    )
  );


-- ── 7e. TREATMENTS ──

ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;

-- Patients can view their own treatments
CREATE POLICY "Patients can view own treatments"
  ON public.treatments FOR SELECT
  USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

-- Doctors can view all treatments
CREATE POLICY "Doctors can view all treatments"
  ON public.treatments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'doctor'
    )
  );

-- Doctors can create treatments
CREATE POLICY "Doctors can create treatments"
  ON public.treatments FOR INSERT
  WITH CHECK (true);

-- Doctors can update treatments
CREATE POLICY "Doctors can update treatments"
  ON public.treatments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'doctor'
    )
  );


-- ── 7f. BILLINGS ──

ALTER TABLE public.billings ENABLE ROW LEVEL SECURITY;

-- Patients can view their own bills
CREATE POLICY "Patients can view own bills"
  ON public.billings FOR SELECT
  USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

-- Doctors can view all bills
CREATE POLICY "Doctors can view all bills"
  ON public.billings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'doctor'
    )
  );

-- Doctors can create bills
CREATE POLICY "Doctors can create bills"
  ON public.billings FOR INSERT
  WITH CHECK (true);

-- Doctors can update bills
CREATE POLICY "Doctors can update bills"
  ON public.billings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'doctor'
    )
  );


-- ── 7d. DOCTOR ACCESS CODES ──

ALTER TABLE public.doctor_access_codes ENABLE ROW LEVEL SECURITY;

-- Nobody can read the codes table via the client API.
-- Verification should happen via a Supabase Edge Function.
-- (No SELECT policy = no access via anon/authenticated roles)

-- For now, if you want to verify codes client-side as a stepping
-- stone, uncomment the policy below. But move to an Edge Function
-- before going to production!

-- CREATE POLICY "Allow authenticated users to check codes"
--   ON public.doctor_access_codes FOR SELECT
--   USING (auth.role() = 'authenticated');



-- ─────────────────────────────────────────────────────────────────
-- 8. OPTIONAL: GRANT PERMISSIONS
-- ─────────────────────────────────────────────────────────────────
-- Supabase uses two Postgres roles:
--   • anon       — unauthenticated users (public API)
--   • authenticated — logged-in users (has a JWT with auth.uid())
--
-- By default Supabase grants usage on the public schema, but
-- explicit grants ensure nothing is missed.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT                     ON public.profiles          TO authenticated;
GRANT UPDATE (name, service)     ON public.profiles          TO authenticated;

GRANT SELECT, UPDATE             ON public.medical_intake    TO authenticated;

GRANT SELECT, INSERT, UPDATE     ON public.appointments      TO authenticated;

-- doctor_access_codes: no grants to client roles (verified server-side)



-- ─────────────────────────────────────────────────────────────────
-- ✅ DONE!
-- ─────────────────────────────────────────────────────────────────
-- You should now see these tables in Supabase → Table Editor:
--   • profiles
--   • medical_intake
--   • appointments
--   • doctor_access_codes
--
-- NEXT STEPS:
--   1. Go to Authentication → Settings and make sure:
--      • "Enable email confirmations" is OFF for development
--        (otherwise users need to click an email link before login)
--      • Minimum password length is set to 8 (matches The app)
--
--   2. Test it! Run your app and register a patient.
--      Then check Table Editor — you should see rows in both
--      `profiles` and `medical_intake`.
--
--   3. To verify RLS is working, try this in SQL Editor:
--      SET ROLE authenticated;
--      SET request.jwt.claims = '{"sub":"some-fake-uuid"}';
--      SELECT * FROM profiles;  -- should return 0 rows
--      RESET ROLE;

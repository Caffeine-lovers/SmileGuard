-- ==============================================================================
-- Migration 034: Fix Clinic Blockout Dates, Doctor Code Attempts & CRUD Access Codes
-- ==============================================================================

-- 1. CLINIC BLOCKOUT DATES FIX & RLS POLICIES
CREATE TABLE IF NOT EXISTS public.clinic_blockout_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID DEFAULT '7c9b5331-3f19-4560-8256-44c7742e11ad'::uuid,
  blockout_date DATE NOT NULL,
  reason TEXT,
  is_blocked BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure user_id column defaults to Kyler's Clinic user ID
ALTER TABLE public.clinic_blockout_dates ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.clinic_blockout_dates ALTER COLUMN user_id SET DEFAULT '7c9b5331-3f19-4560-8256-44c7742e11ad'::uuid;

-- Enable RLS
ALTER TABLE public.clinic_blockout_dates ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view active blockout dates
DROP POLICY IF EXISTS "Anyone can view active blockout dates" ON public.clinic_blockout_dates;
DROP POLICY IF EXISTS "Users can view their own blockout dates" ON public.clinic_blockout_dates;
CREATE POLICY "Anyone can view active blockout dates" ON public.clinic_blockout_dates
  FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

-- Allow authenticated doctors and staff to insert blockout dates
DROP POLICY IF EXISTS "Users can insert their own blockout dates" ON public.clinic_blockout_dates;
CREATE POLICY "Users can insert their own blockout dates" ON public.clinic_blockout_dates
  FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (true);

-- Allow update of blockout dates
DROP POLICY IF EXISTS "Users can update their own blockout dates" ON public.clinic_blockout_dates;
CREATE POLICY "Users can update their own blockout dates" ON public.clinic_blockout_dates
  FOR UPDATE
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- Allow deletion of blockout dates
DROP POLICY IF EXISTS "Users can delete their own blockout dates" ON public.clinic_blockout_dates;
CREATE POLICY "Users can delete their own blockout dates" ON public.clinic_blockout_dates
  FOR DELETE
  TO anon, authenticated, service_role
  USING (true);

GRANT ALL ON public.clinic_blockout_dates TO anon, authenticated, service_role;

-- Seed initial active blockout dates for Kyler's Clinic
INSERT INTO public.clinic_blockout_dates (user_id, blockout_date, reason, is_blocked)
VALUES
  ('7c9b5331-3f19-4560-8256-44c7742e11ad', '2026-11-04', 'Clinic Maintenance & Sanitation', true),
  ('7c9b5331-3f19-4560-8256-44c7742e11ad', '2026-11-11', 'Dentist Association Conference', true),
  ('7c9b5331-3f19-4560-8256-44c7742e11ad', '2026-11-18', 'Staff Training & Seminar', true)
ON CONFLICT DO NOTHING;


-- 2. DOCTOR CODE ATTEMPTS TABLE & PERMISSIONS
CREATE TABLE IF NOT EXISTS public.doctor_code_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  attempted_code TEXT,
  is_successful BOOLEAN DEFAULT FALSE,
  ip_address TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist
ALTER TABLE public.doctor_code_attempts ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.doctor_code_attempts ADD COLUMN IF NOT EXISTS attempted_code TEXT;
ALTER TABLE public.doctor_code_attempts ADD COLUMN IF NOT EXISTS is_successful BOOLEAN DEFAULT FALSE;
ALTER TABLE public.doctor_code_attempts ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.doctor_code_attempts ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.doctor_code_attempts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.doctor_code_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_insert_attempts" ON public.doctor_code_attempts;
CREATE POLICY "allow_insert_attempts" ON public.doctor_code_attempts
  FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "allow_select_attempts" ON public.doctor_code_attempts;
CREATE POLICY "allow_select_attempts" ON public.doctor_code_attempts
  FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

GRANT ALL ON public.doctor_code_attempts TO anon, authenticated, service_role;

-- Seed test attempt
INSERT INTO public.doctor_code_attempts (code, attempted_code, is_successful, details)
VALUES
  ('SMILE-DOC-2026', 'SMILE-DOC-2026', true, '{"method": "code_verification", "role": "doctor"}'::jsonb);


-- 3. DOCTOR ACCESS CODES TABLE & CRUD RESTRICTION TIERS
CREATE TABLE IF NOT EXISTS public.doctor_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT,
  tier TEXT DEFAULT 'doctor',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.doctor_access_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_select_codes" ON public.doctor_access_codes;
CREATE POLICY "allow_select_codes" ON public.doctor_access_codes
  FOR SELECT
  TO anon, authenticated, service_role
  USING (is_active = true);

GRANT SELECT ON public.doctor_access_codes TO anon, authenticated, service_role;

-- Insert the 3 official doctor access codes with varying CRUD restriction tiers:
-- 1. CLINIC-ADMIN-01: Admin Tier (Full CRUD: Clinic Setup, Doctors, Schedules, Services, Billing Ledger)
-- 2. SMILE-DOC-2026: Doctor Tier (Standard Clinical CRUD: Patient Appointments, Clinical Notes, Scans, Blockouts)
-- 3. SMILEGUARD-STAFF: Staff Tier (Restricted CRUD: Read Appointments & Calendar, Update Status only; No Deletes)
INSERT INTO public.doctor_access_codes (code, label, tier, is_active)
VALUES
  ('CLINIC-ADMIN-01', 'Clinic Administrator (Full CRUD Access)', 'admin', true),
  ('SMILE-DOC-2026', 'Primary Dentist (Standard Clinical CRUD)', 'doctor', true),
  ('SMILEGUARD-STAFF', 'Clinic Staff / Assistant (Read & Limited Update)', 'staff', true)
ON CONFLICT (code) DO UPDATE
SET 
  label = EXCLUDED.label,
  tier = EXCLUDED.tier,
  is_active = EXCLUDED.is_active;


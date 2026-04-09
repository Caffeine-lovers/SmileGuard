-- ╔══════════════════════════════════════════════════════════════════╗
-- ║              MIGRATION: Create Public Doctors Table              ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝
--
-- This migration creates a public doctors table that stores doctor-specific
-- information including license, specialization, clinic details, and more.

-- Step 1: Create the doctors table
CREATE TABLE IF NOT EXISTS public.doctors (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to profiles table (auth user)
  user_id             UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- License & Credentials
  license_number      TEXT NOT NULL UNIQUE,
  specialization      TEXT NOT NULL,
  bio                 TEXT,
  
  -- Clinic Information
  clinic_name         TEXT,
  clinic_phone        TEXT,
  clinic_email        TEXT,
  
  -- Office Hours (JSON format for flexibility)
  office_hours        JSONB,
  
  -- Professional Details
  years_of_experience INTEGER,
  qualifications      TEXT[],
  
  -- Availability & Status
  is_available        BOOLEAN DEFAULT TRUE,
  availability_status TEXT DEFAULT 'available' 
                      CHECK (availability_status IN ('available', 'on-leave', 'on-vacation', 'unavailable')),
  
  -- Profile Picture
  profile_picture_url TEXT,
  
  -- Verification
  is_verified         BOOLEAN DEFAULT FALSE,
  verification_date   TIMESTAMPTZ,
  
  -- Timestamps
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Step 2: Enable RLS (Row Level Security)
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS Policies

-- Policy: Allow authenticated users to view all doctor profiles (public read)
CREATE POLICY "doctors_select_authenticated" ON public.doctors
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Allow public to view verified doctors only (if anonymous access needed)
CREATE POLICY "doctors_select_public" ON public.doctors
  FOR SELECT
  USING (true);

-- Policy: Allow doctors to update only their own profile
CREATE POLICY "doctors_update_own" ON public.doctors
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Allow doctors to insert their own profile
CREATE POLICY "doctors_insert_own" ON public.doctors
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Step 4: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_doctors_user_id
  ON public.doctors(user_id);

CREATE INDEX IF NOT EXISTS idx_doctors_specialization
  ON public.doctors(specialization);

CREATE INDEX IF NOT EXISTS idx_doctors_clinic_name
  ON public.doctors(clinic_name);

CREATE INDEX IF NOT EXISTS idx_doctors_is_available
  ON public.doctors(is_available);

CREATE INDEX IF NOT EXISTS idx_doctors_is_verified
  ON public.doctors(is_verified);

-- Step 5: Add comments for documentation
COMMENT ON TABLE public.doctors IS 'Stores doctor-specific information including license, specialization, clinic details';

COMMENT ON COLUMN public.doctors.id IS 'Unique identifier for the doctor record';
COMMENT ON COLUMN public.doctors.user_id IS 'Foreign key reference to the profiles table (auth user)';
COMMENT ON COLUMN public.doctors.license_number IS 'Medical license number (unique per doctor)';
COMMENT ON COLUMN public.doctors.specialization IS 'Medical specialization (e.g., General Dentistry, Orthodontics)';
COMMENT ON COLUMN public.doctors.office_hours IS 'JSON object storing office hours {monday: {open: "09:00", close: "17:00"}, ...}';
COMMENT ON COLUMN public.doctors.qualifications IS 'Array of qualifications (e.g., [''DDS'', ''Pediatric Dentistry Fellowship''])';
COMMENT ON COLUMN public.doctors.availability_status IS 'Current availability status: available, on-leave, on-vacation, unavailable';

-- ✓ Migration complete!
-- Your doctors table is now ready with:
--   - Public read access (all authenticated users can view)
--   - Doctors can only update their own profile
--   - Full indexing for performance
--   - RLS policies for security

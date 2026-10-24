-- ╔══════════════════════════════════════════════════════════════════╗
-- ║     MIGRATION: Add doctor_phone column to doctors table          ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Step 1: Add doctor_phone column if it doesn't exist
ALTER TABLE public.doctors
ADD COLUMN IF NOT EXISTS doctor_phone TEXT;

-- Step 2: Add comment for documentation
COMMENT ON COLUMN public.doctors.doctor_phone IS 'Doctor personal/professional direct phone number';

-- Step 3: Create index on doctor_phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_doctors_doctor_phone
  ON public.doctors(doctor_phone);

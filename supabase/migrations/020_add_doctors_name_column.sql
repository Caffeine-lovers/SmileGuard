-- ╔══════════════════════════════════════════════════════════════════╗
-- ║     MIGRATION: Update doctors table for doctor_name column       ║
-- ║  Ensure doctor_name column exists and is indexed properly        ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Step 1: Add doctor_name column if it doesn't exist
ALTER TABLE public.doctors
ADD COLUMN IF NOT EXISTS doctor_name TEXT;

-- Step 2: Add a comment for documentation
COMMENT ON COLUMN public.doctors.doctor_name IS 'Full name of the doctor for display in patient dashboard';

-- Step 3: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_doctors_doctor_name
  ON public.doctors(doctor_name);

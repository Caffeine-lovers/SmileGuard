-- ╔══════════════════════════════════════════════════════════════════╗
-- ║    MIGRATION: Add dummy_account_id Column to Appointments        ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝
--
-- This migration adds support for dummy account appointments
-- by adding the dummy_account_id column to the appointments table

-- Step 1: Add dummy_account_id column
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS dummy_account_id UUID REFERENCES public.dummy_accounts(id) ON DELETE CASCADE;

-- Step 2: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_appointments_dummy_account 
  ON public.appointments(dummy_account_id);

-- Step 3: Add constraint to ensure either patient_id OR dummy_account_id is set
-- (not both, not neither - for data integrity)
ALTER TABLE public.appointments 
ADD CONSTRAINT check_patient_xor_dummy 
CHECK (
  (patient_id IS NOT NULL AND dummy_account_id IS NULL) OR
  (patient_id IS NULL AND dummy_account_id IS NOT NULL)
) NOT VALID;

-- Note: NOT VALID means existing data isn't validated against this constraint
-- but all new data must comply

-- ✓ Migration complete!
-- Your appointments table now supports:
--   - Real patient appointments (patient_id + dummy_account_id IS NULL)
--   - Dummy account appointments (patient_id IS NULL + dummy_account_id set)

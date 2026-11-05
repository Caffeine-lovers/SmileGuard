-- ════════════════════════════════════════════════════════════════════════════
--   MIGRATION 048: Add Patient Priority Column (Staff Only)
--
--   Adds internal attendance/neglect priority level: 'Low', 'Medium', 'High'
--   Used by Doctor and Assistant to flag appointment neglect & no-show risk.
--   NOT visible to patients in patient-web portal.
--
--   Run this in Supabase -> SQL Editor -> New Query
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Add priority column to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Low' 
  CHECK (priority IN ('Low', 'Medium', 'High', 'low', 'medium', 'high'));

COMMENT ON COLUMN public.profiles.priority IS 'Internal attendance/neglect priority level: Low, Medium, High. Only visible to clinic staff (Doctor/Assistant).';

-- 2. Add index on profiles(priority) for fast filtering in records
CREATE INDEX IF NOT EXISTS idx_profiles_priority ON public.profiles(priority);

-- 3. Add priority column to dummy_patients table for walk-in / mock records
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dummy_patients') THEN
    ALTER TABLE public.dummy_patients 
      ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Low' 
      CHECK (priority IN ('Low', 'Medium', 'High', 'low', 'medium', 'high'));
    CREATE INDEX IF NOT EXISTS idx_dummy_patients_priority ON public.dummy_patients(priority);
    COMMENT ON COLUMN public.dummy_patients.priority IS 'Internal attendance/neglect priority level: Low, Medium, High.';
  END IF;
END $$;


-- Migration: 032_fix_medical_intake_pregnancy_constraints.sql
-- Date: 2026-10-28
-- Purpose: Resolve constraint key violation on pregnancy_status and smoking_status in medical_intake

-- ============================================================================
-- 1. DROP RESTRICTIVE CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE public.medical_intake DROP CONSTRAINT IF EXISTS medical_intake_pregnancy_status_check;
ALTER TABLE public.medical_intake DROP CONSTRAINT IF EXISTS medical_intake_pregnancy_check;
ALTER TABLE public.medical_intake DROP CONSTRAINT IF EXISTS medical_intake_smoking_status_check;
ALTER TABLE public.medical_intake DROP CONSTRAINT IF EXISTS medical_intake_smoking_check;

-- ============================================================================
-- 2. NORMALIZE EXISTING DATA
-- ============================================================================

UPDATE public.medical_intake 
SET pregnancy_status = CASE 
  WHEN LOWER(TRIM(pregnancy_status)) IN ('pregnant', 'currently pregnant', 'yes') THEN 'yes'
  WHEN LOWER(TRIM(pregnancy_status)) IN ('not pregnant', 'not_pregnant', 'no') THEN 'no'
  WHEN LOWER(TRIM(pregnancy_status)) IN ('not applicable', 'not_applicable', 'breastfeeding', 'na', 'n/a') THEN 'na'
  ELSE ''
END
WHERE pregnancy_status IS NOT NULL AND pregnancy_status != '';

UPDATE public.medical_intake 
SET smoking_status = CASE 
  WHEN LOWER(TRIM(smoking_status)) IN ('never', 'never smoked') THEN 'never'
  WHEN LOWER(TRIM(smoking_status)) IN ('former', 'former smoker') THEN 'former'
  WHEN LOWER(TRIM(smoking_status)) IN ('current', 'current smoker') THEN 'current'
  ELSE ''
END
WHERE smoking_status IS NOT NULL AND smoking_status != '';

-- ============================================================================
-- 3. ENSURE PATIENT_ID UNIQUE CONSTRAINT FOR SAFE UPSERTS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'medical_intake_patient_id_key' 
      AND conrelid = 'public.medical_intake'::regclass
  ) THEN
    ALTER TABLE public.medical_intake 
      ADD CONSTRAINT medical_intake_patient_id_key UNIQUE (patient_id);
  END IF;
END $$;

-- ============================================================================
-- 4. ADD FLEXIBLE CHECK CONSTRAINTS (SUPPORTING BOTH CODES & EXPANDED STRINGS)
-- ============================================================================

ALTER TABLE public.medical_intake ADD CONSTRAINT medical_intake_pregnancy_status_check
  CHECK (
    pregnancy_status IS NULL 
    OR pregnancy_status = '' 
    OR LOWER(pregnancy_status) IN ('yes', 'no', 'na', 'not_pregnant', 'pregnant', 'breastfeeding', 'not applicable', 'not pregnant')
  );

ALTER TABLE public.medical_intake ADD CONSTRAINT medical_intake_smoking_status_check
  CHECK (
    smoking_status IS NULL 
    OR smoking_status = '' 
    OR LOWER(smoking_status) IN ('never', 'former', 'current', 'never smoked', 'former smoker', 'current smoker')
  );

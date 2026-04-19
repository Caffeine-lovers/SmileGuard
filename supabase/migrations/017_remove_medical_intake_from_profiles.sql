-- ╔══════════════════════════════════════════════════════════════════╗
-- ║      MIGRATION: Remove profile references from medical_intake    ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝
--
-- This migration removes references to non-existent profile column
-- from the medical_intake table

-- Step 1: Drop profile column from medical_intake table if it exists
ALTER TABLE public.medical_intake
DROP COLUMN IF EXISTS profile;

-- Step 2: Verify structure
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'medical_intake';


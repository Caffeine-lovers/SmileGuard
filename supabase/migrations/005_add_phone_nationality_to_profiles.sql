-- ╔══════════════════════════════════════════════════════════════════╗
-- ║        MIGRATION: Add Phone & Nationality to Profiles            ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝
--
-- This migration adds phone_number and nationality fields to the profiles table
-- to store patient contact information for doctor visibility.

-- Step 1: Add phone_number and nationality columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS nationality TEXT;

-- Step 2: Add comment for documentation
COMMENT ON COLUMN public.profiles.phone_number IS 'Patient phone number in international format (e.g., +639123456789)';
COMMENT ON COLUMN public.profiles.nationality IS 'Country code/nationality (e.g., +63 for Philippines)';

-- Step 3: Create index on phone_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number);

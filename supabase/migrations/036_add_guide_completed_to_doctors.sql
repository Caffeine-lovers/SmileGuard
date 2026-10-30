-- ╔══════════════════════════════════════════════════════════════════╗
-- ║        MIGRATION 036: Add guide_completed to doctors table       ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝
--
-- This migration adds `guide_completed` and `completed_guides` to public.doctors
-- to track whether the doctor has finished or dismissed each app walkthrough guide,
-- turning `guide_completed` to TRUE only when all walkthroughs are completed,
-- and preventing guides from repeating when switching between pages.

ALTER TABLE public.doctors
ADD COLUMN IF NOT EXISTS guide_completed BOOLEAN DEFAULT FALSE;

ALTER TABLE public.doctors
ADD COLUMN IF NOT EXISTS completed_guides TEXT[] DEFAULT '{}'::TEXT[];

-- Ensure authenticated doctors have permission to update their record (including these columns)
GRANT ALL ON TABLE public.doctors TO authenticated;
GRANT ALL ON TABLE public.doctors TO service_role;
GRANT SELECT ON TABLE public.doctors TO anon;

COMMENT ON COLUMN public.doctors.guide_completed IS 'Flag indicating if the doctor has completed all in-app walkthrough guides';
COMMENT ON COLUMN public.doctors.completed_guides IS 'Array of completed guide IDs (dashboard, appointments, records, billing, requests)';

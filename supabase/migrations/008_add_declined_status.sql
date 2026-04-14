-- ╔══════════════════════════════════════════════════════════════════╗
-- ║      MIGRATION: Add 'declined' status to appointments table      ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Drop the existing constraint
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check1;

-- Add the new constraint with 'declined' status
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check 
  CHECK (status = ANY(ARRAY['scheduled', 'completed', 'cancelled', 'no-show', 'declined']));

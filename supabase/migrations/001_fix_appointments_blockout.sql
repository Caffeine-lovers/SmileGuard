-- ╔══════════════════════════════════════════════════════════════════╗
-- ║        MIGRATION: Fix Appointments Table for Blockout Feature    ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝
--
-- This migration updates the appointments table to support date/time
-- blockout functionality by separating date and time into distinct columns
-- and using the correct column names (appointment_date, appointment_time, dentist_id)

-- Step 1: Rename the old appointments table (backup)
ALTER TABLE IF EXISTS public.appointments RENAME TO appointments_old;

-- Step 2: Create the new appointments table with correct schema
CREATE TABLE IF NOT EXISTS public.appointments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who booked and who is the doctor
  patient_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dentist_id          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Appointment details
  service             TEXT NOT NULL,
  appointment_date    DATE NOT NULL,
  appointment_time    TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no-show')),
  notes               TEXT,

  -- Timestamps
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_appointments_patient
  ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_dentist
  ON public.appointments(dentist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date
  ON public.appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_date_time
  ON public.appointments(appointment_date, appointment_time);

-- Step 4: Migrate data from old table (if it has data)
-- This extracts date and time from the old 'date' column
INSERT INTO public.appointments (id, patient_id, dentist_id, service, appointment_date, appointment_time, status, notes, created_at, updated_at)
SELECT 
  id,
  patient_id,
  doctor_id,
  service,
  DATE(appointments_old.date),
  TO_CHAR(appointments_old.date, 'HH24:MI'),
  CASE 
    WHEN appointments_old.status = 'Pending' THEN 'scheduled'
    WHEN appointments_old.status = 'Completed' THEN 'completed'
    WHEN appointments_old.status = 'Cancelled' THEN 'cancelled'
    ELSE 'scheduled'
  END,
  notes,
  created_at,
  updated_at
FROM appointments_old
ON CONFLICT (id) DO NOTHING;

-- Step 5: Drop the old table
DROP TABLE IF EXISTS appointments_old;

-- Add comment
COMMENT ON TABLE public.appointments IS 'Patient appointment bookings with date/time blockout support';

-- ✓ Migration complete!
-- Your appointments table now has:
--   - appointment_date (DATE): The date of the appointment
--   - appointment_time (TEXT): The time in HH:MM format (24-hour)
--   - dentist_id: The dentist (instead of doctor_id)
--   - status: 'scheduled', 'completed', 'cancelled', 'no-show'

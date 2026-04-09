-- ╔══════════════════════════════════════════════════════════════════╗
-- ║          MIGRATION: Create Clinic Rules & Policies Table         ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝
--
-- This migration creates a clinic_rules table that stores operational rules,
-- policies, and configurations for each doctor's clinic.

-- Step 1: Create the clinic_rules table
CREATE TABLE IF NOT EXISTS public.clinic_rules (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to doctors table
  doctor_id                       UUID NOT NULL UNIQUE REFERENCES public.doctors(id) ON DELETE CASCADE,
  
  -- Appointment Rules
  min_advance_booking_hours       INTEGER DEFAULT 24 
                                  CHECK (min_advance_booking_hours >= 0),
  max_advance_booking_days        INTEGER DEFAULT 90 
                                  CHECK (max_advance_booking_days > 0),
  min_appointment_duration_mins   INTEGER DEFAULT 30 
                                  CHECK (min_appointment_duration_mins > 0),
  max_daily_appointments          INTEGER DEFAULT 20 
                                  CHECK (max_daily_appointments > 0),
  
  -- Cancellation & Rescheduling Policies
  cancellation_policy_text        TEXT,
  cancellation_fee_percentage     DECIMAL(5,2) DEFAULT 0 
                                  CHECK (cancellation_fee_percentage >= 0 AND cancellation_fee_percentage <= 100),
  min_hours_to_cancel             INTEGER DEFAULT 24 
                                  CHECK (min_hours_to_cancel >= 0),
  min_hours_to_reschedule         INTEGER DEFAULT 24 
                                  CHECK (min_hours_to_reschedule >= 0),
  
  -- No-Show Policy
  allow_no_show_penalty           BOOLEAN DEFAULT TRUE,
  no_show_penalty_percentage      DECIMAL(5,2) DEFAULT 50 
                                  CHECK (no_show_penalty_percentage >= 0 AND no_show_penalty_percentage <= 100),
  
  -- Break & Buffer Rules
  break_between_appointments_mins INTEGER DEFAULT 15 
                                  CHECK (break_between_appointments_mins >= 0),
  buffer_before_lunch_mins        INTEGER DEFAULT 30 
                                  CHECK (buffer_before_lunch_mins >= 0),
  lunch_start_time                TIME,
  lunch_end_time                  TIME,
  
  -- Notification Rules
  send_appointment_reminders      BOOLEAN DEFAULT TRUE,
  reminder_before_hours           INTEGER DEFAULT 24 
                                  CHECK (reminder_before_hours > 0),
  
  -- Patient Rules
  max_patients_per_slot           INTEGER DEFAULT 1 
                                  CHECK (max_patients_per_slot > 0),
  allow_walk_ins                  BOOLEAN DEFAULT FALSE,
  require_new_patient_form        BOOLEAN DEFAULT TRUE,
  
  -- Service-Level Rules
  auto_approve_appointments       BOOLEAN DEFAULT FALSE,
  require_payment_upfront         BOOLEAN DEFAULT FALSE,
  accepted_payment_methods        TEXT[] DEFAULT ARRAY['card', 'cash', 'insurance'],
  
  -- Operational Details
  clinic_notes                    TEXT,
  policies_url                    TEXT,
  
  -- Timestamps
  created_at                      TIMESTAMPTZ DEFAULT now(),
  updated_at                      TIMESTAMPTZ DEFAULT now()
);

-- Step 2: Enable RLS (Row Level Security)
ALTER TABLE public.clinic_rules ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS Policies

-- Policy: Allow authenticated users to view clinic rules
CREATE POLICY "clinic_rules_select_authenticated" ON public.clinic_rules
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Allow doctors to update only their own clinic rules
CREATE POLICY "clinic_rules_update_own" ON public.clinic_rules
  FOR UPDATE
  USING (
    auth.uid() = (
      SELECT user_id FROM public.doctors WHERE id = clinic_rules.doctor_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT user_id FROM public.doctors WHERE id = clinic_rules.doctor_id
    )
  );

-- Policy: Allow doctors to insert their own clinic rules
CREATE POLICY "clinic_rules_insert_own" ON public.clinic_rules
  FOR INSERT
  WITH CHECK (
    auth.uid() = (
      SELECT user_id FROM public.doctors WHERE id = doctor_id
    )
  );

-- Policy: Allow doctors to delete their own clinic rules
CREATE POLICY "clinic_rules_delete_own" ON public.clinic_rules
  FOR DELETE
  USING (
    auth.uid() = (
      SELECT user_id FROM public.doctors WHERE id = clinic_rules.doctor_id
    )
  );

-- Step 4: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_clinic_rules_doctor_id
  ON public.clinic_rules(doctor_id);

CREATE INDEX IF NOT EXISTS idx_clinic_rules_created_at
  ON public.clinic_rules(created_at);

CREATE INDEX IF NOT EXISTS idx_clinic_rules_updated_at
  ON public.clinic_rules(updated_at);

-- Step 5: Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_clinic_rules_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the update function
DROP TRIGGER IF EXISTS clinic_rules_update_timestamp ON public.clinic_rules;
CREATE TRIGGER clinic_rules_update_timestamp
  BEFORE UPDATE ON public.clinic_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_clinic_rules_timestamp();

-- Step 6: Add comments for documentation
COMMENT ON TABLE public.clinic_rules IS 
'Stores operational rules, policies, and configurations for each doctor''s clinic';

COMMENT ON COLUMN public.clinic_rules.id IS 
'Unique identifier for the clinic rules record';

COMMENT ON COLUMN public.clinic_rules.doctor_id IS 
'Foreign key reference to the doctors table';

COMMENT ON COLUMN public.clinic_rules.min_advance_booking_hours IS 
'Minimum hours in advance that appointments must be booked (e.g., 24 hours)';

COMMENT ON COLUMN public.clinic_rules.max_advance_booking_days IS 
'Maximum days in advance that patients can book appointments (e.g., 90 days)';

COMMENT ON COLUMN public.clinic_rules.min_appointment_duration_mins IS 
'Minimum duration for each appointment in minutes';

COMMENT ON COLUMN public.clinic_rules.max_daily_appointments IS 
'Maximum number of appointments allowed per day';

COMMENT ON COLUMN public.clinic_rules.cancellation_fee_percentage IS 
'Fee percentage charged if patient cancels (0-100)';

COMMENT ON COLUMN public.clinic_rules.min_hours_to_cancel IS 
'Minimum hours before appointment to allow cancellation without penalty';

COMMENT ON COLUMN public.clinic_rules.no_show_penalty_percentage IS 
'Percentage fee for no-shows (0-100)';

COMMENT ON COLUMN public.clinic_rules.break_between_appointments_mins IS 
'Required break time between consecutive appointments in minutes';

COMMENT ON COLUMN public.clinic_rules.reminder_before_hours IS 
'How many hours before appointment to send reminders';

COMMENT ON COLUMN public.clinic_rules.require_payment_upfront IS 
'Whether payment must be completed before appointment confirmation';

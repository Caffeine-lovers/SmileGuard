-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 046: Add Multi-Emergency Contacts to medical_intake           ║
-- ║                                                                          ║
-- ║  Supports up to 3 emergency contacts with relationships for patient web  ║
-- ║  and doctor mobile intake.                                               ║
-- ║                                                                          ║
-- ║  Run this in Supabase → SQL Editor → New Query                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.medical_intake 
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS emergency_contact_2_name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS emergency_contact_2_phone TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS emergency_contact_2_relationship TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS emergency_contact_3_name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS emergency_contact_3_phone TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS emergency_contact_3_relationship TEXT DEFAULT NULL;

COMMENT ON COLUMN public.medical_intake.emergency_contact_relationship IS 'Relationship of primary emergency contact (e.g. Parent, Spouse)';
COMMENT ON COLUMN public.medical_intake.emergency_contact_2_name IS 'Full name of secondary emergency contact';
COMMENT ON COLUMN public.medical_intake.emergency_contact_2_phone IS 'Phone number of secondary emergency contact';
COMMENT ON COLUMN public.medical_intake.emergency_contact_2_relationship IS 'Relationship of secondary emergency contact';
COMMENT ON COLUMN public.medical_intake.emergency_contact_3_name IS 'Full name of tertiary emergency contact';
COMMENT ON COLUMN public.medical_intake.emergency_contact_3_phone IS 'Phone number of tertiary emergency contact';
COMMENT ON COLUMN public.medical_intake.emergency_contact_3_relationship IS 'Relationship of tertiary emergency contact';


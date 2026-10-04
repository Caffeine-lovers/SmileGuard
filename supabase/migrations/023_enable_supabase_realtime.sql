-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 023: Enable Supabase Realtime Replication             ║
-- ║                                                                  ║
-- ║  Purpose:                                                        ║
-- ║  Enables live WebSocket broadcast events for doctor mobile app  ║
-- ║  so notifications pop up immediately (ASAP) on appointment and   ║
-- ║  record changes.                                                 ║
-- ║                                                                  ║
-- ║  Run this in:                                                    ║
-- ║  Supabase Dashboard → SQL Editor → New Query → Run               ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- 1. Add tables to supabase_realtime publication
DO $$
BEGIN
  -- appointments
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'appointments') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    ALTER TABLE public.appointments REPLICA IDENTITY FULL;
  END IF;

  -- medical_intake
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'medical_intake') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.medical_intake;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    ALTER TABLE public.medical_intake REPLICA IDENTITY FULL;
  END IF;

  -- treatments
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'treatments') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.treatments;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    ALTER TABLE public.treatments REPLICA IDENTITY FULL;
  END IF;

  -- billings
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billings') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.billings;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    ALTER TABLE public.billings REPLICA IDENTITY FULL;
  END IF;

  -- doctors
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'doctors') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.doctors;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;

  -- profiles
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- 2. Verify publication tables
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

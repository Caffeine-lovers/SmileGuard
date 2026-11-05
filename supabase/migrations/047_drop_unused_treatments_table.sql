-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 047: Drop unused treatments table                             ║
-- ║                                                                          ║
-- ║  The treatments table was never populated — doctor-mobile's              ║
-- ║  saveTreatment()/getTreatments() are defined but never called, and      ║
-- ║  patient-web's "Treatment Records" page reads from appointments         ║
-- ║  instead (comma-separated services split back apart for display).       ║
-- ║                                                                          ║
-- ║  Run this in Supabase → SQL Editor → New Query                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DROP TABLE IF EXISTS public.treatments CASCADE;

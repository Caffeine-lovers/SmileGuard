-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 033: Update billings.payment_status to 'not_paid'     ║
-- ║                                                                  ║
-- ║  Purpose:                                                        ║
-- ║  Align billing payment_status with patient-facing ledger         ║
-- ║  terminology: replace 'pending' with 'not_paid'.                ║
-- ║                                                                  ║
-- ║  Changes:                                                        ║
-- ║  1. Update existing 'pending' records to 'not_paid'             ║
-- ║  2. Update check constraint to allow ('not_paid','paid',         ║
-- ║     'overdue')                                                   ║
-- ║  3. Set column default to 'not_paid'                             ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- 1. Drop old constraint if exists
ALTER TABLE public.billings DROP CONSTRAINT IF EXISTS billings_payment_status_check;

-- 2. Back-fill existing 'pending' records to 'not_paid'
UPDATE public.billings
SET payment_status = 'not_paid', updated_at = NOW()
WHERE payment_status = 'pending';

-- 3. Add constraint enforcing ('not_paid', 'paid', 'overdue')
ALTER TABLE public.billings ADD CONSTRAINT billings_payment_status_check
  CHECK (LOWER(payment_status) = ANY(ARRAY['not_paid', 'paid', 'overdue']));

-- 4. Set default value for new rows
ALTER TABLE public.billings ALTER COLUMN payment_status SET DEFAULT 'not_paid';


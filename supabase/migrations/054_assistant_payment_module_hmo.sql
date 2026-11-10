-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 054: Assistant-run payment module + HMO coverage              ║
-- ║                                                                          ║
-- ║  Panel recommendations:                                                  ║
-- ║   1. Detach the payment method from the patient (no patient checkout).   ║
-- ║   2. Add an HMO option for HMO patients.                                 ║
-- ║   3. Give the payment process to the doctor's assistant.                 ║
-- ║                                                                          ║
-- ║  Requires migrations 052-053 (is_assistant / is_admin).                 ║
-- ║  Run this in Supabase → SQL Editor → New Query. Safe to re-run.          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ====================================================================
-- 1. BILLINGS: who pays (self / HMO) and who processed it
-- ====================================================================
ALTER TABLE public.billings
  ADD COLUMN IF NOT EXISTS payer_type TEXT NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS hmo_provider TEXT,
  ADD COLUMN IF NOT EXISTS hmo_member_id TEXT,
  ADD COLUMN IF NOT EXISTS hmo_approval_code TEXT,
  ADD COLUMN IF NOT EXISTS hmo_covered_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS processed_by UUID,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

ALTER TABLE public.billings DROP CONSTRAINT IF EXISTS billings_payer_type_check;
ALTER TABLE public.billings ADD CONSTRAINT billings_payer_type_check
  CHECK (payer_type IN ('self', 'hmo'));

ALTER TABLE public.billings DROP CONSTRAINT IF EXISTS billings_hmo_covered_amount_check;
ALTER TABLE public.billings ADD CONSTRAINT billings_hmo_covered_amount_check
  CHECK (hmo_covered_amount >= 0);

COMMENT ON COLUMN public.billings.payer_type IS 'self = patient pays the whole bill; hmo = an HMO covers part or all of it';
COMMENT ON COLUMN public.billings.hmo_provider IS 'HMO name (e.g. Maxicare, Intellicare)';
COMMENT ON COLUMN public.billings.hmo_member_id IS 'HMO card / member number';
COMMENT ON COLUMN public.billings.hmo_approval_code IS 'HMO Letter of Authorization (LOA) / approval number';
COMMENT ON COLUMN public.billings.hmo_covered_amount IS 'Portion of final_amount covered by the HMO; the patient pays final_amount - hmo_covered_amount';
COMMENT ON COLUMN public.billings.payment_reference IS 'Reference number typed in by the assistant (GCash/Maya/bank/card slip)';
COMMENT ON COLUMN public.billings.processed_by IS 'Clinic assistant / admin who processed the payment';

-- Any old CHECK on payment_method / discount_type would reject the new 'hmo' method
-- and the 'custom' discount. The allowed values are validated in process_billing_payment.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.billings'::regclass
      AND contype = 'c'
      AND (pg_get_constraintdef(oid) ILIKE '%payment_method%'
           OR pg_get_constraintdef(oid) ILIKE '%discount_type%')
  LOOP
    EXECUTE format('ALTER TABLE public.billings DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- ====================================================================
-- 2. Only the assistant (or an admin) may settle a bill
-- ====================================================================
-- Server-side callers (service role, SQL editor) have no auth.uid() and pass through.
CREATE OR REPLACE FUNCTION public.guard_billing_payment_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_assistant() OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF LOWER(COALESCE(NEW.payment_status, '')) = 'paid' THEN
      RAISE EXCEPTION 'Only the clinic assistant can record a payment.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF (NEW.payment_status IS DISTINCT FROM OLD.payment_status
        AND 'paid' IN (LOWER(COALESCE(NEW.payment_status, '')), LOWER(COALESCE(OLD.payment_status, ''))))
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.payment_date IS DISTINCT FROM OLD.payment_date
     OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
     OR NEW.payer_type IS DISTINCT FROM OLD.payer_type
     OR NEW.hmo_provider IS DISTINCT FROM OLD.hmo_provider
     OR NEW.hmo_member_id IS DISTINCT FROM OLD.hmo_member_id
     OR NEW.hmo_approval_code IS DISTINCT FROM OLD.hmo_approval_code
     OR NEW.hmo_covered_amount IS DISTINCT FROM OLD.hmo_covered_amount
  THEN
    RAISE EXCEPTION 'Only the clinic assistant can process payments.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_billing_payment_fields ON public.billings;
CREATE TRIGGER trg_guard_billing_payment_fields
  BEFORE INSERT OR UPDATE ON public.billings
  FOR EACH ROW EXECUTE FUNCTION public.guard_billing_payment_fields();

-- ====================================================================
-- 3. process_billing_payment: the single entry point for settling a bill
-- ====================================================================
CREATE OR REPLACE FUNCTION public.process_billing_payment(
  p_billing_id UUID,
  p_payment_status TEXT DEFAULT 'paid',
  p_payment_method TEXT DEFAULT 'cash',
  p_payment_reference TEXT DEFAULT NULL,
  p_amount NUMERIC DEFAULT NULL,
  p_discount_type TEXT DEFAULT NULL,
  p_discount_amount NUMERIC DEFAULT NULL,
  p_payer_type TEXT DEFAULT 'self',
  p_hmo_provider TEXT DEFAULT NULL,
  p_hmo_member_id TEXT DEFAULT NULL,
  p_hmo_approval_code TEXT DEFAULT NULL,
  p_hmo_covered_amount NUMERIC DEFAULT 0
)
RETURNS public.billings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill public.billings;
  v_status TEXT := LOWER(COALESCE(NULLIF(TRIM(p_payment_status), ''), 'paid'));
  v_method TEXT := LOWER(NULLIF(TRIM(p_payment_method), ''));
  v_payer TEXT := LOWER(COALESCE(NULLIF(TRIM(p_payer_type), ''), 'self'));
  v_discount_type TEXT;
  v_amount NUMERIC;
  v_discount NUMERIC;
  v_final NUMERIC;
  v_covered NUMERIC := 0;
  v_patient_share NUMERIC;
BEGIN
  IF NOT (public.is_assistant() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Only the clinic assistant can process payments.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_bill FROM public.billings WHERE id = p_billing_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billing record not found.';
  END IF;

  IF v_status NOT IN ('paid', 'not_paid', 'overdue', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid payment status: %', p_payment_status;
  END IF;
  IF v_payer NOT IN ('self', 'hmo') THEN
    RAISE EXCEPTION 'Invalid payer type: %', p_payer_type;
  END IF;

  -- Amounts
  v_amount := ROUND(COALESCE(p_amount, v_bill.amount, 0), 2);
  IF v_amount < 0 THEN
    RAISE EXCEPTION 'Amount cannot be negative.';
  END IF;

  v_discount_type := LOWER(COALESCE(NULLIF(TRIM(p_discount_type), ''), v_bill.discount_type, 'none'));
  IF v_discount_type NOT IN ('none', 'pwd', 'senior', 'insurance', 'custom') THEN
    RAISE EXCEPTION 'Invalid discount type: %', p_discount_type;
  END IF;

  IF v_discount_type IN ('pwd', 'senior') THEN
    v_discount := ROUND(v_amount * 0.20, 2);            -- statutory 20% (RA 9994 / RA 10754)
  ELSIF v_discount_type = 'none' THEN
    v_discount := 0;
  ELSE
    v_discount := ROUND(COALESCE(p_discount_amount, v_bill.discount_amount, 0), 2);
  END IF;
  v_discount := GREATEST(0, LEAST(v_discount, v_amount));
  v_final := v_amount - v_discount;

  -- HMO coverage
  IF v_payer = 'hmo' THEN
    IF NULLIF(TRIM(COALESCE(p_hmo_provider, '')), '') IS NULL THEN
      RAISE EXCEPTION 'HMO provider is required for an HMO patient.';
    END IF;
    v_covered := ROUND(COALESCE(p_hmo_covered_amount, 0), 2);
    IF v_covered < 0 OR v_covered > v_final THEN
      RAISE EXCEPTION 'HMO covered amount must be between 0 and the bill total (%).', v_final;
    END IF;
  END IF;
  v_patient_share := v_final - v_covered;

  -- Method used for the patient's own share
  IF v_status = 'paid' THEN
    IF v_payer = 'hmo' AND v_patient_share = 0 THEN
      v_method := 'hmo';
    ELSIF v_method IS NULL OR v_method NOT IN ('cash', 'gcash', 'card', 'paymaya', 'bank-transfer') THEN
      RAISE EXCEPTION 'Choose how the patient paid (cash, GCash, card, Maya or bank transfer).';
    END IF;
  ELSE
    v_method := NULL;
  END IF;

  UPDATE public.billings
  SET
    amount = v_amount,
    discount_type = v_discount_type,
    discount_amount = v_discount,
    final_amount = v_final,
    payer_type = v_payer,
    hmo_provider = CASE WHEN v_payer = 'hmo' THEN TRIM(p_hmo_provider) END,
    hmo_member_id = CASE WHEN v_payer = 'hmo' THEN NULLIF(TRIM(COALESCE(p_hmo_member_id, '')), '') END,
    hmo_approval_code = CASE WHEN v_payer = 'hmo' THEN NULLIF(TRIM(COALESCE(p_hmo_approval_code, '')), '') END,
    hmo_covered_amount = v_covered,
    payment_status = v_status,
    payment_method = v_method,
    payment_reference = CASE WHEN v_status = 'paid' THEN NULLIF(TRIM(COALESCE(p_payment_reference, '')), '') END,
    payment_date = CASE
      WHEN v_status = 'paid' THEN
        CASE WHEN LOWER(COALESCE(v_bill.payment_status, '')) = 'paid'
             THEN COALESCE(v_bill.payment_date, NOW()) ELSE NOW() END
      ELSE NULL
    END,
    processed_by = auth.uid(),
    processed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_billing_id
  RETURNING * INTO v_bill;

  -- Tell the patient (registered patients only; walk-ins have no profile)
  IF v_status = 'paid' THEN
    BEGIN
      IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_bill.patient_id) THEN
        INSERT INTO public.notifications (user_id, title, message, type, metadata)
        VALUES (
          v_bill.patient_id,
          'Payment Recorded',
          'The clinic recorded your payment of ₱' || TO_CHAR(v_patient_share, 'FM999,999,990.00')
            || CASE WHEN v_covered > 0
                 THEN ' (HMO ' || v_bill.hmo_provider || ' covered ₱' || TO_CHAR(v_covered, 'FM999,999,990.00') || ')'
                 ELSE '' END
            || '.',
          'billing_paid',
          jsonb_build_object(
            'billing_id', v_bill.id,
            'appointment_id', v_bill.appointment_id,
            'amount', v_final,
            'patient_share', v_patient_share,
            'hmo_covered_amount', v_covered,
            'payment_method', v_method
          )
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- a failed notification must never undo a recorded payment
    END;
  END IF;

  RETURN v_bill;
END;
$$;

REVOKE ALL ON FUNCTION public.process_billing_payment(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_billing_payment(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_billing_payment(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, NUMERIC) TO authenticated;

-- ====================================================================
-- 4. Retire the old walk-in billing RPCs
-- ====================================================================
-- Both were SECURITY DEFINER and granted to anon, so anyone holding the public
-- anon key could mark any bill as paid. process_billing_payment replaces them.
DROP FUNCTION IF EXISTS public.update_dummy_billing(UUID, NUMERIC, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.create_dummy_billing(UUID, UUID, NUMERIC, TEXT, NUMERIC, NUMERIC, TEXT, TEXT);

NOTIFY pgrst, 'reload schema';

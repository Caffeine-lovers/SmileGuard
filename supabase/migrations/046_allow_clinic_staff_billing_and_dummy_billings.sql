-- Migration 046: Allow Clinic Staff Billing Management and Editable Dummy Billings

-- 1. Update RLS policies on public.billings to allow authenticated clinic staff (assistants, doctors) full access
DROP POLICY IF EXISTS "billings_staff_select" ON public.billings;
CREATE POLICY "billings_staff_select" ON public.billings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "billings_staff_update" ON public.billings;
CREATE POLICY "billings_staff_update" ON public.billings
  FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "billings_staff_insert" ON public.billings;
CREATE POLICY "billings_staff_insert" ON public.billings
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 2. Secure RPC function to update dummy patient billing records
CREATE OR REPLACE FUNCTION public.update_dummy_billing(
  p_billing_id UUID,
  p_amount NUMERIC DEFAULT NULL,
  p_discount_type TEXT DEFAULT NULL,
  p_discount_amount NUMERIC DEFAULT NULL,
  p_final_amount NUMERIC DEFAULT NULL,
  p_payment_status TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_payment_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  billing_id UUID,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.billings
  SET
    amount = COALESCE(p_amount, amount),
    discount_type = COALESCE(p_discount_type, discount_type),
    discount_amount = COALESCE(p_discount_amount, discount_amount),
    final_amount = COALESCE(p_final_amount, final_amount),
    payment_status = COALESCE(p_payment_status, payment_status),
    payment_method = COALESCE(p_payment_method, payment_method),
    payment_date = CASE
      WHEN p_payment_status = 'paid' AND payment_date IS NULL THEN COALESCE(p_payment_date, NOW())
      WHEN p_payment_status = 'not_paid' THEN NULL
      ELSE COALESCE(p_payment_date, payment_date)
    END,
    updated_at = NOW()
  WHERE id = p_billing_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Billing record not found'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, p_billing_id, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_dummy_billing TO authenticated, anon;

-- 3. Secure RPC function to create a dummy billing record directly
CREATE OR REPLACE FUNCTION public.create_dummy_billing(
  p_patient_id UUID,
  p_appointment_id UUID DEFAULT NULL,
  p_amount NUMERIC DEFAULT 0,
  p_discount_type TEXT DEFAULT 'none',
  p_discount_amount NUMERIC DEFAULT 0,
  p_final_amount NUMERIC DEFAULT 0,
  p_payment_status TEXT DEFAULT 'not_paid',
  p_payment_method TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  billing_id UUID,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_id UUID;
BEGIN
  INSERT INTO public.billings (
    patient_id,
    appointment_id,
    amount,
    discount_type,
    discount_amount,
    final_amount,
    payment_status,
    payment_method,
    payment_date,
    created_at,
    updated_at
  ) VALUES (
    p_patient_id,
    p_appointment_id,
    p_amount,
    p_discount_type,
    p_discount_amount,
    p_final_amount,
    p_payment_status,
    p_payment_method,
    CASE WHEN p_payment_status = 'paid' THEN NOW() ELSE NULL END,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT true, v_new_id, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_dummy_billing TO authenticated, anon;

-- 4. Backfill any existing dummy appointments that were scheduled without a billing row
INSERT INTO public.billings (
  patient_id,
  appointment_id,
  amount,
  discount_type,
  discount_amount,
  final_amount,
  payment_status,
  created_at,
  updated_at
)
SELECT 
  a.dummy_patient_id,
  a.id,
  1500,
  'none',
  0,
  1500,
  'not_paid',
  NOW(),
  NOW()
FROM public.appointments a
WHERE a.dummy_patient_id IS NOT NULL 
  AND a.status = 'scheduled'
  AND NOT EXISTS (
    SELECT 1 FROM public.billings b WHERE b.appointment_id = a.id
  );


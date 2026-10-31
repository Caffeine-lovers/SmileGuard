-- ════════════════════════════════════════════════════════════════════
-- ║  MIGRATION 036: Appointment Reschedule & Notification System       ║
-- ║  1. Create public.notifications table with RLS                     ║
-- ║  2. Add reschedule tracking columns to public.appointments         ║
-- ║  3. Ensure patient payment update RLS on public.billings           ║
-- ║  4. Trigger notification generation on reschedule & cancel events   ║
-- ════════════════════════════════════════════════════════════════════

-- ====================================================================
-- 1. RESCHEDULE TRACKING & PREFERENCES COLUMNS
-- ====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'rescheduled_by'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN rescheduled_by TEXT DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'rescheduled_at'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN rescheduled_at TIMESTAMPTZ DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'notification_preferences'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN notification_preferences JSONB DEFAULT '{"appointment_alerts": true, "push_enabled": false, "software_updates": true}'::jsonb;
  END IF;
END $$;

-- ====================================================================
-- 2. CREATE NOTIFICATIONS TABLE
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'appointment', -- appointment_rescheduled, appointment_confirmed, appointment_cancelled, billing_paid, system_update
  read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert_all" ON public.notifications;
CREATE POLICY "notifications_insert_all" ON public.notifications
  FOR INSERT
  WITH CHECK (true);

-- Enable Realtime for notifications
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
  END IF;
END $$;

-- ====================================================================
-- 3. ENSURE PATIENT PAYMENT UPDATE RLS ON BILLINGS
-- ====================================================================

DROP POLICY IF EXISTS "billings_update_patient" ON public.billings;
CREATE POLICY "billings_update_patient" ON public.billings
  FOR UPDATE
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

DROP POLICY IF EXISTS "billings_insert_patient" ON public.billings;
CREATE POLICY "billings_insert_patient" ON public.billings
  FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

-- ====================================================================
-- 4. TRIGGER: HANDLE APPOINTMENT RESCHEDULING & NOTIFICATIONS
-- ====================================================================

CREATE OR REPLACE FUNCTION public.handle_appointment_reschedule_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_patient_name TEXT;
  v_doctor_name TEXT;
  v_patient_id UUID;
  v_dentist_id UUID;
  v_service TEXT;
BEGIN
  v_patient_id := NEW.patient_id;
  v_dentist_id := NEW.dentist_id;
  v_service := COALESCE(NEW.service, 'Dental Visit');

  -- Look up patient name
  SELECT name INTO v_patient_name FROM public.profiles WHERE id = v_patient_id LIMIT 1;
  IF v_patient_name IS NULL OR TRIM(v_patient_name) = '' THEN
    v_patient_name := 'Patient';
  END IF;

  -- Look up doctor name
  SELECT name INTO v_doctor_name FROM public.profiles WHERE id = v_dentist_id LIMIT 1;
  IF v_doctor_name IS NULL OR TRIM(v_doctor_name) = '' THEN
    v_doctor_name := 'Dr. Kyler';
  END IF;

  -- Safely create notifications (wrapped in exception handler so failures never block appointment updates)
  BEGIN
    -- Condition A: Appointment date or time was rescheduled
    IF (OLD.appointment_date <> NEW.appointment_date OR OLD.appointment_time <> NEW.appointment_time) THEN
      -- If Patient initiated reschedule -> Reverts to pending, notify doctor
      IF (NEW.rescheduled_by = 'patient' OR LOWER(NEW.status) = 'pending') THEN
        -- Notification to doctor
        IF v_dentist_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = v_dentist_id) THEN
          INSERT INTO public.notifications (user_id, title, message, type, metadata)
          VALUES (
            v_dentist_id,
            'Appointment Reschedule Request',
            v_patient_name || ' requested to reschedule ' || v_service || ' to ' || NEW.appointment_date || ' at ' || NEW.appointment_time || '. Approval required.',
            'appointment_rescheduled',
            jsonb_build_object('appointment_id', NEW.id, 'old_date', OLD.appointment_date, 'new_date', NEW.appointment_date, 'old_time', OLD.appointment_time, 'new_time', NEW.appointment_time, 'by', 'patient')
          );
        END IF;

        -- Notification / confirmation to patient
        IF v_patient_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = v_patient_id) THEN
          INSERT INTO public.notifications (user_id, title, message, type, metadata)
          VALUES (
            v_patient_id,
            'Reschedule Submitted (Pending Approval)',
            'Your reschedule request for ' || v_service || ' to ' || NEW.appointment_date || ' at ' || NEW.appointment_time || ' is pending approval from ' || v_doctor_name || '.',
            'appointment_rescheduled',
            jsonb_build_object('appointment_id', NEW.id, 'new_date', NEW.appointment_date, 'new_time', NEW.appointment_time, 'by', 'patient')
          );
        END IF;

      -- If Doctor initiated reschedule -> Notify patient immediately
      ELSE
        IF v_patient_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = v_patient_id) THEN
          INSERT INTO public.notifications (user_id, title, message, type, metadata)
          VALUES (
            v_patient_id,
            'Appointment Rescheduled by Doctor',
            v_doctor_name || ' rescheduled your ' || v_service || ' visit to ' || NEW.appointment_date || ' at ' || NEW.appointment_time || '.',
            'appointment_rescheduled',
            jsonb_build_object('appointment_id', NEW.id, 'old_date', OLD.appointment_date, 'new_date', NEW.appointment_date, 'old_time', OLD.appointment_time, 'new_time', NEW.appointment_time, 'by', 'doctor')
          );
        END IF;
      END IF;
    END IF;

    -- Condition B: Doctor cancelled appointment -> Notify patient
    IF (LOWER(OLD.status) <> 'cancelled' AND LOWER(NEW.status) = 'cancelled' AND (NEW.rescheduled_by IS NULL OR NEW.rescheduled_by <> 'patient')) THEN
      IF v_patient_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = v_patient_id) THEN
        INSERT INTO public.notifications (user_id, title, message, type, metadata)
        VALUES (
          v_patient_id,
          'Appointment Cancelled',
          v_doctor_name || ' has cancelled your ' || v_service || ' visit scheduled on ' || NEW.appointment_date || '.',
          'appointment_cancelled',
          jsonb_build_object('appointment_id', NEW.id, 'date', NEW.appointment_date, 'by', 'doctor')
        );
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Never allow notification logging issues to disrupt appointment writes
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- 5. BEFORE UPDATE TRIGGER: ENFORCE PATIENT RESCHEDULE REVERTS TO PENDING
-- ====================================================================

CREATE OR REPLACE FUNCTION public.handle_appointment_before_reschedule()
RETURNS TRIGGER AS $$
BEGIN
  -- If Patient reschedules date or time, force status back to 'pending'
  IF (OLD.appointment_date <> NEW.appointment_date OR OLD.appointment_time <> NEW.appointment_time) THEN
    IF (NEW.rescheduled_by = 'patient') THEN
      NEW.status := 'pending';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appointment_before_reschedule ON public.appointments;

CREATE TRIGGER trg_appointment_before_reschedule
BEFORE UPDATE OF appointment_date, appointment_time, rescheduled_by
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.handle_appointment_before_reschedule();

DROP TRIGGER IF EXISTS trg_appointment_reschedule_notification ON public.appointments;

CREATE TRIGGER trg_appointment_reschedule_notification
AFTER UPDATE OF appointment_date, appointment_time, status, rescheduled_by
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.handle_appointment_reschedule_notification();

-- ====================================================================
-- 6. RPC: CONFIRM BILLING PAYMENT WITH GATEWAY REFERENCE ID
-- ====================================================================

-- Ensure gateway_transaction_id exists on billings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'billings' AND column_name = 'gateway_transaction_id'
  ) THEN
    ALTER TABLE public.billings ADD COLUMN gateway_transaction_id TEXT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.confirm_billing_payment(
  p_appointment_id UUID,
  p_patient_id UUID,
  p_amount NUMERIC,
  p_reference_id TEXT,
  p_payment_method TEXT DEFAULT 'online'
)
RETURNS TABLE (
  id UUID,
  patient_id UUID,
  appointment_id UUID,
  amount NUMERIC,
  final_amount NUMERIC,
  payment_status TEXT,
  payment_method TEXT,
  gateway_transaction_id TEXT,
  payment_date TIMESTAMPTZ
) AS $$
DECLARE
  v_billing_id UUID;
  v_effective_amount NUMERIC;
BEGIN
  v_effective_amount := COALESCE(p_amount, 300);

  -- 1. Try to find existing billing row for this appointment
  SELECT b.id INTO v_billing_id
  FROM public.billings b
  WHERE b.appointment_id = p_appointment_id
  ORDER BY (b.payment_status = 'paid') DESC, b.created_at DESC
  LIMIT 1;

  IF v_billing_id IS NOT NULL THEN
    UPDATE public.billings
    SET
      payment_status = 'paid',
      payment_method = COALESCE(p_payment_method, 'online'),
      gateway_transaction_id = p_reference_id,
      payment_date = NOW(),
      final_amount = v_effective_amount,
      updated_at = NOW()
    WHERE public.billings.id = v_billing_id;
  ELSE
    INSERT INTO public.billings (
      patient_id,
      appointment_id,
      amount,
      discount_type,
      discount_amount,
      final_amount,
      payment_status,
      payment_method,
      gateway_transaction_id,
      payment_date,
      created_at,
      updated_at
    ) VALUES (
      p_patient_id,
      p_appointment_id,
      v_effective_amount,
      'none',
      0,
      v_effective_amount,
      'paid',
      COALESCE(p_payment_method, 'online'),
      p_reference_id,
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING public.billings.id INTO v_billing_id;
  END IF;

  -- Insert notification safely
  BEGIN
    IF p_patient_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE public.profiles.id = p_patient_id) THEN
      INSERT INTO public.notifications (user_id, title, message, type, metadata)
      VALUES (
        p_patient_id,
        'Payment Confirmed',
        'Payment of ₱' || TO_CHAR(v_effective_amount, 'FM999,990.00') || ' received. Reference ID: ' || COALESCE(p_reference_id, 'N/A'),
        'billing_paid',
        jsonb_build_object('appointment_id', p_appointment_id, 'reference_id', p_reference_id, 'amount', v_effective_amount)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY
  SELECT
    b.id,
    b.patient_id,
    b.appointment_id,
    b.amount,
    b.final_amount,
    b.payment_status,
    b.payment_method,
    b.gateway_transaction_id,
    b.payment_date
  FROM public.billings b
  WHERE b.id = v_billing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.confirm_billing_payment(UUID, UUID, NUMERIC, TEXT, TEXT) TO authenticated, anon;

-- ====================================================================
-- 7. SETTLE VERIFIED PAYMONGO PAYMENTS (WITH REFERENCE IDS)
-- ====================================================================

-- A. Check-up Payment (pay_bHJTKn3VcPdE2aHZpZPNqAz1 - ₱300.00)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.billings WHERE appointment_id = 'c2395afb-9970-4209-91d4-a4c0cbd50efd') THEN
    UPDATE public.billings
    SET 
      payment_status = 'paid',
      payment_method = 'gcash',
      gateway_transaction_id = 'pay_bHJTKn3VcPdE2aHZpZPNqAz1',
      final_amount = 300,
      payment_date = NOW(),
      updated_at = NOW()
    WHERE appointment_id = 'c2395afb-9970-4209-91d4-a4c0cbd50efd';
  ELSE
    INSERT INTO public.billings (
      patient_id,
      appointment_id,
      amount,
      discount_type,
      discount_amount,
      final_amount,
      payment_status,
      payment_method,
      gateway_transaction_id,
      payment_date,
      created_at,
      updated_at
    ) VALUES (
      'fdd75627-31af-4b0d-bdaf-4e3d55d0c5eb',
      'c2395afb-9970-4209-91d4-a4c0cbd50efd',
      300,
      'none',
      0,
      300,
      'paid',
      'gcash',
      'pay_bHJTKn3VcPdE2aHZpZPNqAz1',
      NOW(),
      NOW(),
      NOW()
    );
  END IF;
END $$;

-- B. Whitening Payment (pay_VxahdA5LhcsqxvSEhzMh71VM - ₱5,000.00)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.billings WHERE appointment_id = '63f40127-9ffd-4617-8fc8-09591ac5f0d1') THEN
    UPDATE public.billings
    SET 
      payment_status = 'paid',
      payment_method = 'gcash',
      gateway_transaction_id = 'pay_VxahdA5LhcsqxvSEhzMh71VM',
      final_amount = 5000,
      payment_date = NOW(),
      updated_at = NOW()
    WHERE appointment_id = '63f40127-9ffd-4617-8fc8-09591ac5f0d1';
  ELSE
    INSERT INTO public.billings (
      patient_id,
      appointment_id,
      amount,
      discount_type,
      discount_amount,
      final_amount,
      payment_status,
      payment_method,
      gateway_transaction_id,
      payment_date,
      created_at,
      updated_at
    ) VALUES (
      'c23d797d-0734-4491-a329-1b4ee42b1818',
      '63f40127-9ffd-4617-8fc8-09591ac5f0d1',
      5000,
      'none',
      0,
      5000,
      'paid',
      'gcash',
      'pay_VxahdA5LhcsqxvSEhzMh71VM',
      NOW(),
      NOW(),
      NOW()
    );
  END IF;
END $$;

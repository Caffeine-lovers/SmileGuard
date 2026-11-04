-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 034: Connect Appointments to Billings with Triggers    ║
-- ║                                                                  ║
-- ║  Purpose:                                                        ║
-- ║  1. Add Foreign Key between billings.appointment_id and        ║
-- ║     appointments.id with index for fast joins.                   ║
-- ║  2. Add 'cancelled' status to billings.payment_status.           ║
-- ║  3. Create an automated TRIGGER:                                ║
-- ║     - Appointment -> 'cancelled' (or 'declined'):               ║
-- ║       Marks associated unpaid billing records as 'cancelled'.    ║
-- ║     - Appointment -> 'scheduled':                                ║
-- ║       Automatically creates a billing record with the correct    ║
-- ║       clinic/service price (or reactivates cancelled billing).   ║
-- ║  4. Back-fill existing appointments without billing records.     ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ====================================================================
-- 1. SCHEMA CHANGES ON BILLINGS TABLE
-- ====================================================================

-- Ensure appointment_id column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billings' AND column_name = 'appointment_id'
  ) THEN
    ALTER TABLE public.billings ADD COLUMN appointment_id UUID;
  END IF;
END $$;

-- Clean up any invalid appointment_ids before applying foreign key
UPDATE public.billings
SET appointment_id = NULL
WHERE appointment_id IS NOT NULL
  AND appointment_id NOT IN (SELECT id FROM public.appointments);

-- Add Foreign Key constraint (cascading on delete)
ALTER TABLE public.billings DROP CONSTRAINT IF EXISTS fk_billings_appointment;
ALTER TABLE public.billings 
  ADD CONSTRAINT fk_billings_appointment 
  FOREIGN KEY (appointment_id) 
  REFERENCES public.appointments(id) 
  ON DELETE CASCADE;

-- Create index on appointment_id
CREATE INDEX IF NOT EXISTS idx_billings_appointment_id 
  ON public.billings(appointment_id);

-- Add 'cancelled' status to payment_status check constraint
ALTER TABLE public.billings DROP CONSTRAINT IF EXISTS billings_payment_status_check;
ALTER TABLE public.billings ADD CONSTRAINT billings_payment_status_check
  CHECK (LOWER(payment_status) = ANY(ARRAY['not_paid', 'paid', 'overdue', 'cancelled']));

-- Ensure default is 'not_paid'
ALTER TABLE public.billings ALTER COLUMN payment_status SET DEFAULT 'not_paid';


-- ====================================================================
-- 2. TRIGGER FUNCTION FOR APPOINTMENT <-> BILLING SYNCHRONIZATION
-- ====================================================================

CREATE OR REPLACE FUNCTION public.handle_appointment_billing_sync()
RETURNS TRIGGER AS $$
DECLARE
  v_service_price NUMERIC := 0;
  v_part_price NUMERIC;
  v_custom_price NUMERIC;
  v_catalog_price NUMERIC;
  v_parts TEXT[];
  v_part TEXT;
  v_has_services BOOLEAN := FALSE;
BEGIN
  -- ------------------------------------------------------------------
  -- A. APPOINTMENT CANCELLED / DECLINED:
  --    Cancel linked billing records (unless already paid)
  -- ------------------------------------------------------------------
  IF LOWER(NEW.status) IN ('cancelled', 'declined') THEN
    UPDATE public.billings
    SET 
      payment_status = 'cancelled',
      updated_at = NOW()
    WHERE appointment_id = NEW.id
      AND LOWER(payment_status) <> 'paid';
      
    RETURN NEW;
  END IF;

  -- ------------------------------------------------------------------
  -- B. APPOINTMENT SCHEDULED:
  --    Create billing record or reactivate previously cancelled billing
  -- ------------------------------------------------------------------
  IF LOWER(NEW.status) = 'scheduled' THEN
    -- If a billing record already exists for this appointment
    IF EXISTS (SELECT 1 FROM public.billings WHERE appointment_id = NEW.id) THEN
      -- Reactivate any previously cancelled billing record back to 'not_paid'
      UPDATE public.billings
      SET 
        payment_status = 'not_paid',
        updated_at = NOW()
      WHERE appointment_id = NEW.id
        AND LOWER(payment_status) = 'cancelled';
    ELSE
      -- Resolve multi-service prices separately and calculate the sum
      v_service_price := 0;
      v_parts := string_to_array(COALESCE(NEW.service, ''), ',');

      FOREACH v_part IN ARRAY v_parts
      LOOP
        v_part := TRIM(v_part);
        IF v_part = '' THEN
          CONTINUE;
        END IF;

        v_has_services := TRUE;
        v_custom_price := NULL;
        v_catalog_price := NULL;
        v_part_price := NULL;

        -- 1. Look up in clinic_setup.services for this doctor
        BEGIN
          SELECT (elem->>'price')::NUMERIC INTO v_custom_price
          FROM public.clinic_setup cs,
               jsonb_array_elements(
                 CASE 
                   WHEN jsonb_typeof(cs.services) = 'array' THEN cs.services 
                   ELSE '[]'::jsonb 
                 END
               ) elem
          WHERE (cs.user_id = NEW.dentist_id OR NEW.dentist_id IS NULL)
            AND (
              LOWER(TRIM(elem->>'name')) = LOWER(v_part)
              OR LOWER(v_part) LIKE '%' || LOWER(TRIM(elem->>'name')) || '%'
              OR LOWER(TRIM(elem->>'name')) LIKE '%' || LOWER(v_part) || '%'
            )
            AND (elem->>'price') IS NOT NULL
            AND (elem->>'price')::NUMERIC > 0
          ORDER BY 
            CASE WHEN LOWER(TRIM(elem->>'name')) = LOWER(v_part) THEN 0 ELSE 1 END
          LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
          v_custom_price := NULL;
        END;

        -- 2. If no custom price found in clinic_setup, look up in catalog
        IF v_custom_price IS NOT NULL AND v_custom_price > 0 THEN
          v_part_price := v_custom_price;
        ELSE
          v_catalog_price := CASE 
            WHEN LOWER(v_part) = 'whitening' OR LOWER(v_part) LIKE '%whitening%' THEN 5000
            WHEN LOWER(v_part) IN ('fillings', 'filling') OR LOWER(v_part) LIKE '%filling%' THEN 2000
            WHEN LOWER(v_part) IN ('root canal', 'root canals') OR LOWER(v_part) LIKE '%root canal%' THEN 8000
            WHEN LOWER(v_part) = 'extraction' OR LOWER(v_part) LIKE '%extraction%' THEN 1500
            WHEN LOWER(v_part) = 'cleaning' OR LOWER(v_part) LIKE '%cleaning%' THEN 1500
            WHEN LOWER(v_part) IN ('aligners', 'aligner') OR LOWER(v_part) LIKE '%aligner%' THEN 25000
            WHEN LOWER(v_part) IN ('braces consultation', 'braces') OR LOWER(v_part) LIKE '%brace%' THEN 35000
            WHEN LOWER(v_part) IN ('implants consultation', 'implants') OR LOWER(v_part) LIKE '%implant%' THEN 45000
            WHEN LOWER(v_part) IN ('x-ray', 'xray') OR LOWER(v_part) LIKE '%x-ray%' OR LOWER(v_part) LIKE '%xray%' THEN 500
            WHEN LOWER(v_part) IN ('check-up', 'checkup') OR LOWER(v_part) LIKE '%check%' THEN 300
            WHEN LOWER(v_part) IN ('consultation', 'initial consultation', 'general', 'general checkup') OR LOWER(v_part) LIKE '%consult%' THEN 500
            ELSE NULL
          END;

          IF v_catalog_price IS NOT NULL AND v_catalog_price > 0 THEN
            v_part_price := v_catalog_price;
          END IF;
        END IF;

        -- 3. Show an error when a service has no price
        IF v_part_price IS NULL OR v_part_price <= 0 THEN
          RAISE EXCEPTION 'Price not found for service: "%". Please configure the service price in clinic setup.', v_part;
        END IF;

        v_service_price := v_service_price + v_part_price;
      END LOOP;

      -- If no services parsed or total is non-positive, raise an error
      IF NOT v_has_services OR v_service_price <= 0 THEN
        RAISE EXCEPTION 'No valid billable services found for appointment: "%"', NEW.service;
      END IF;

      -- Insert billing record for this scheduled appointment
      IF NEW.patient_id IS NOT NULL THEN
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
        ) VALUES (
          NEW.patient_id,
          NEW.id,
          v_service_price,
          'none',
          0,
          v_service_price,
          'not_paid',
          NOW(),
          NOW()
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- 3. BIND TRIGGER TO APPOINTMENTS TABLE
-- ====================================================================

DROP TRIGGER IF EXISTS trg_appointment_billing_sync ON public.appointments;

CREATE TRIGGER trg_appointment_billing_sync
AFTER INSERT OR UPDATE OF status, service, dentist_id, patient_id
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.handle_appointment_billing_sync();


-- ====================================================================
-- 4. BACK-FILL DATA FOR EXISTING APPOINTMENTS
-- ====================================================================

-- 4.1 Set billing status to 'cancelled' for existing cancelled appointments
UPDATE public.billings b
SET 
  payment_status = 'cancelled',
  updated_at = NOW()
FROM public.appointments a
WHERE b.appointment_id = a.id
  AND LOWER(a.status) IN ('cancelled', 'declined')
  AND LOWER(b.payment_status) <> 'paid';

-- 4.2 Create missing billing records for existing scheduled appointments
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
  a.patient_id,
  a.id,
  CASE 
    WHEN LOWER(TRIM(a.service)) LIKE '%whitening%' THEN 5000
    WHEN LOWER(TRIM(a.service)) LIKE '%filling%' THEN 2000
    WHEN LOWER(TRIM(a.service)) LIKE '%root canal%' THEN 8000
    WHEN LOWER(TRIM(a.service)) LIKE '%extraction%' THEN 1500
    WHEN LOWER(TRIM(a.service)) LIKE '%aligner%' THEN 25000
    WHEN LOWER(TRIM(a.service)) LIKE '%brace%' THEN 35000
    WHEN LOWER(TRIM(a.service)) LIKE '%implant%' THEN 45000
    WHEN LOWER(TRIM(a.service)) LIKE '%x-ray%' OR LOWER(TRIM(a.service)) LIKE '%xray%' THEN 500
    WHEN LOWER(TRIM(a.service)) LIKE '%check%' THEN 300
    WHEN LOWER(TRIM(a.service)) LIKE '%consult%' THEN 500
    ELSE 1500
  END AS amount,
  'none' AS discount_type,
  0 AS discount_amount,
  CASE 
    WHEN LOWER(TRIM(a.service)) LIKE '%whitening%' THEN 5000
    WHEN LOWER(TRIM(a.service)) LIKE '%filling%' THEN 2000
    WHEN LOWER(TRIM(a.service)) LIKE '%root canal%' THEN 8000
    WHEN LOWER(TRIM(a.service)) LIKE '%extraction%' THEN 1500
    WHEN LOWER(TRIM(a.service)) LIKE '%aligner%' THEN 25000
    WHEN LOWER(TRIM(a.service)) LIKE '%brace%' THEN 35000
    WHEN LOWER(TRIM(a.service)) LIKE '%implant%' THEN 45000
    WHEN LOWER(TRIM(a.service)) LIKE '%x-ray%' OR LOWER(TRIM(a.service)) LIKE '%xray%' THEN 500
    WHEN LOWER(TRIM(a.service)) LIKE '%check%' THEN 300
    WHEN LOWER(TRIM(a.service)) LIKE '%consult%' THEN 500
    ELSE 1500
  END AS final_amount,
  'not_paid' AS payment_status,
  NOW() AS created_at,
  NOW() AS updated_at
FROM public.appointments a
WHERE LOWER(a.status) = 'scheduled'
  AND a.patient_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.billings b WHERE b.appointment_id = a.id
  );


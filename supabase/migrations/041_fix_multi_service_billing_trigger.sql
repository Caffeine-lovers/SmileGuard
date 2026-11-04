-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 041: Fix Multi-Service Billing Trigger Resolution      ║
-- ║                                                                  ║
-- ║  Resolves:                                                       ║
-- ║  When an appointment includes multiple services (comma-         ║
-- ║  separated), the billing trigger previously looked up the       ║
-- ║  composite string in clinic_setup, failing to match, and        ║
-- ║  silently fell back to a fixed ₱1,500 without showing an error.  ║
-- ║                                                                  ║
-- ║  Fix:                                                            ║
-- ║  1. Parse multi-service strings by comma into individual items.  ║
-- ║  2. Look up each service separately in clinic_setup.services     ║
-- ║     or the fallback dental catalog.                              ║
-- ║  3. Sum the individual service prices for the billing amount.    ║
-- ║  4. Raise an explicit error when any service has no price.       ║
-- ║  5. Recalculate existing multi-service scheduled billings that   ║
-- ║     were previously assigned the ₱1,500 fallback.                ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ====================================================================
-- 1. UPDATE TRIGGER FUNCTION FOR MULTI-SERVICE PRICING & ERROR GUARD
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

-- Re-ensure trigger is active on appointments table
DROP TRIGGER IF EXISTS trg_appointment_billing_sync ON public.appointments;

CREATE TRIGGER trg_appointment_billing_sync
AFTER INSERT OR UPDATE OF status, service, dentist_id, patient_id
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.handle_appointment_billing_sync();

-- ====================================================================
-- 2. RE-CALCULATE MULTI-SERVICE SCHEDULED BILLINGS THAT FELL BACK TO 1500
-- ====================================================================

DO $$
DECLARE
  r RECORD;
  v_corrected_price NUMERIC;
  v_item TEXT;
  v_item_price NUMERIC;
  v_custom NUMERIC;
  v_cat NUMERIC;
BEGIN
  FOR r IN 
    SELECT b.id AS billing_id, a.id AS appointment_id, a.service, a.dentist_id
    FROM public.billings b
    JOIN public.appointments a ON b.appointment_id = a.id
    WHERE LOWER(a.status) = 'scheduled'
      AND LOWER(b.payment_status) = 'not_paid'
      AND a.service LIKE '%,%'
      AND b.amount = 1500
  LOOP
    v_corrected_price := 0;
    FOR v_item IN SELECT TRIM(s) FROM unnest(string_to_array(r.service, ',')) s WHERE TRIM(s) <> ''
    LOOP
      v_custom := NULL;
      v_cat := NULL;
      v_item_price := NULL;

      SELECT (elem->>'price')::NUMERIC INTO v_custom
      FROM public.clinic_setup cs,
           jsonb_array_elements(
             CASE WHEN jsonb_typeof(cs.services) = 'array' THEN cs.services ELSE '[]'::jsonb END
           ) elem
      WHERE (cs.user_id = r.dentist_id OR r.dentist_id IS NULL)
        AND LOWER(TRIM(elem->>'name')) = LOWER(v_item)
        AND (elem->>'price') IS NOT NULL
      LIMIT 1;

      IF v_custom IS NOT NULL AND v_custom > 0 THEN
        v_item_price := v_custom;
      ELSE
        v_cat := CASE 
          WHEN LOWER(v_item) = 'whitening' OR LOWER(v_item) LIKE '%whitening%' THEN 5000
          WHEN LOWER(v_item) IN ('fillings', 'filling') OR LOWER(v_item) LIKE '%filling%' THEN 2000
          WHEN LOWER(v_item) IN ('root canal', 'root canals') OR LOWER(v_item) LIKE '%root canal%' THEN 8000
          WHEN LOWER(v_item) = 'extraction' OR LOWER(v_item) LIKE '%extraction%' THEN 1500
          WHEN LOWER(v_item) = 'cleaning' OR LOWER(v_item) LIKE '%cleaning%' THEN 1500
          WHEN LOWER(v_item) IN ('aligners', 'aligner') OR LOWER(v_item) LIKE '%aligner%' THEN 25000
          WHEN LOWER(v_item) IN ('braces consultation', 'braces') OR LOWER(v_item) LIKE '%brace%' THEN 35000
          WHEN LOWER(v_item) IN ('implants consultation', 'implants') OR LOWER(v_item) LIKE '%implant%' THEN 45000
          WHEN LOWER(v_item) IN ('x-ray', 'xray') OR LOWER(v_item) LIKE '%x-ray%' OR LOWER(v_item) LIKE '%xray%' THEN 500
          WHEN LOWER(v_item) IN ('check-up', 'checkup') OR LOWER(v_item) LIKE '%check%' THEN 300
          WHEN LOWER(v_item) IN ('consultation', 'initial consultation', 'general', 'general checkup') OR LOWER(v_item) LIKE '%consult%' THEN 500
          ELSE 1500
        END;
        v_item_price := v_cat;
      END IF;

      v_corrected_price := v_corrected_price + v_item_price;
    END LOOP;

    IF v_corrected_price > 1500 THEN
      UPDATE public.billings
      SET amount = v_corrected_price,
          final_amount = v_corrected_price,
          updated_at = NOW()
      WHERE id = r.billing_id;
    END IF;
  END LOOP;
END $$;

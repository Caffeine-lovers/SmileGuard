-- ==============================================================================
-- Migration 051: Auto-generate Billings for Dummy Patients (using dummy_patient_id)
-- ==============================================================================
-- 1. Ensures 'dummy_patient_id' column exists on 'appointments' table
-- 2. Ensures 'dummy_patient_id' column exists on 'billings' table
-- 3. Cleans up any accidental 'dummy_patient' extra column if present
-- 4. Updates 'handle_appointment_billing_sync' trigger so that when an appointment is
--    created/scheduled for a dummy patient (dummy_patient_id), a billing record is
--    automatically generated in public.billings (matching the process for regular
--    patients in patient-web).
-- 5. Backfills any existing scheduled dummy appointments that were missing a billing row.
-- ==============================================================================

-- 1. ENSURE 'dummy_patient_id' EXISTS ON 'appointments' (AND DROP EXTRA 'dummy_patient' IF PRESENT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'dummy_patient_id'
  ) THEN
    ALTER TABLE public.appointments 
    ADD COLUMN dummy_patient_id UUID REFERENCES public.dummy_patients(id) ON DELETE SET NULL;
    COMMENT ON COLUMN public.appointments.dummy_patient_id IS 'Reference to dummy_patients table for walk-in / keeper patients.';
  END IF;

  -- Drop redundant dummy_patient extra column if it was previously created
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'dummy_patient'
  ) THEN
    -- Preserve data if dummy_patient had values and dummy_patient_id was null
    UPDATE public.appointments 
    SET dummy_patient_id = dummy_patient 
    WHERE dummy_patient_id IS NULL AND dummy_patient IS NOT NULL;

    ALTER TABLE public.appointments DROP COLUMN dummy_patient CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_dummy_patient_id ON public.appointments(dummy_patient_id);

-- 2. ENSURE 'dummy_patient_id' EXISTS ON 'billings' (AND DROP EXTRA 'dummy_patient' IF PRESENT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'billings' AND column_name = 'dummy_patient_id'
  ) THEN
    ALTER TABLE public.billings 
    ADD COLUMN dummy_patient_id UUID REFERENCES public.dummy_patients(id) ON DELETE SET NULL;
    COMMENT ON COLUMN public.billings.dummy_patient_id IS 'Reference to dummy_patients table for walk-in billing records.';
  END IF;

  -- Drop redundant dummy_patient extra column if it was previously created
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'billings' AND column_name = 'dummy_patient'
  ) THEN
    UPDATE public.billings 
    SET dummy_patient_id = dummy_patient 
    WHERE dummy_patient_id IS NULL AND dummy_patient IS NOT NULL;

    ALTER TABLE public.billings DROP COLUMN dummy_patient CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_billings_dummy_patient_id ON public.billings(dummy_patient_id);

-- 3. UPDATE APPOINTMENT BILLING SYNC TRIGGER TO SUPPORT DUMMY PATIENTS
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
  v_effective_patient_id UUID;
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

        -- 2. If no custom price found in clinic_setup, look up in dental catalog
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
            ELSE 1500
          END;

          v_part_price := COALESCE(v_catalog_price, 1500);
        END IF;

        IF v_part_price IS NULL OR v_part_price <= 0 THEN
          v_part_price := 1500;
        END IF;

        v_service_price := v_service_price + v_part_price;
      END LOOP;

      IF NOT v_has_services OR v_service_price <= 0 THEN
        v_service_price := 1500;
      END IF;

      -- Determine effective patient ID (online patient or dummy/walk-in patient)
      v_effective_patient_id := COALESCE(NEW.patient_id, NEW.dummy_patient_id);

      -- Automatically insert billing record (works for both regular and dummy patients)
      IF v_effective_patient_id IS NOT NULL THEN
        INSERT INTO public.billings (
          patient_id,
          dummy_patient_id,
          appointment_id,
          amount,
          discount_type,
          discount_amount,
          final_amount,
          payment_status,
          created_at,
          updated_at
        ) VALUES (
          v_effective_patient_id,
          NEW.dummy_patient_id,
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

-- Re-create the trigger to watch dummy_patient_id as well
DROP TRIGGER IF EXISTS trg_appointment_billing_sync ON public.appointments;

CREATE TRIGGER trg_appointment_billing_sync
AFTER INSERT OR UPDATE OF status, service, dentist_id, patient_id, dummy_patient_id
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.handle_appointment_billing_sync();

-- 4. BACKFILL BILLINGS FOR EXISTING SCHEDULED DUMMY APPOINTMENTS
INSERT INTO public.billings (
  patient_id,
  dummy_patient_id,
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
  AND LOWER(a.status) = 'scheduled'
  AND NOT EXISTS (
    SELECT 1 FROM public.billings b WHERE b.appointment_id = a.id
  );

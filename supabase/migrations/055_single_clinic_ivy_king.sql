-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 055: One clinic only — Ivy King Dental Clinic                 ║
-- ║                                                                          ║
-- ║  clinic_setup was one row per doctor and readable only by its owner, so  ║
-- ║  every doctor created their own clinic, and assistants and patients      ║
-- ║  could not read any clinic (no hours, no services, failed bookings).     ║
-- ║                                                                          ║
-- ║  This migration:                                                         ║
-- ║   1. Backs up clinic_setup, then merges every row into a single clinic.  ║
-- ║   2. Forces the name "Ivy King Dental Clinic" and blocks a second row.   ║
-- ║   3. Lets everyone read the clinic; only doctors and admins edit it.     ║
-- ║   4. Prices appointments from the one clinic, whichever dentist is set.  ║
-- ║                                                                          ║
-- ║  Requires migration 052 (is_doctor / is_admin).                          ║
-- ║  Run this in Supabase → SQL Editor → New Query. Safe to re-run.          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ====================================================================
-- 1. BACKUP, THEN MERGE INTO ONE CLINIC
-- ====================================================================
-- Kept so the removed rows can be recovered. Not exposed through the API.
CREATE TABLE IF NOT EXISTS public.clinic_setup_backup_055 AS
  SELECT * FROM public.clinic_setup;
ALTER TABLE public.clinic_setup_backup_055 ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_keep UUID;
  r RECORD;
BEGIN
  -- Keep the Ivy King row if there is one, otherwise the most complete / most recent
  SELECT id INTO v_keep
  FROM public.clinic_setup
  ORDER BY (clinic_name ILIKE '%ivy%') DESC,
           (CASE WHEN jsonb_typeof(services::jsonb) = 'array' THEN jsonb_array_length(services::jsonb) > 0 ELSE FALSE END) DESC,
           updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_keep IS NULL THEN
    RETURN; -- no clinic saved yet; the first save in the app creates it
  END IF;

  -- Fill anything the kept row is missing from the other rows, newest first
  FOR r IN
    SELECT * FROM public.clinic_setup WHERE id <> v_keep ORDER BY updated_at DESC NULLS LAST
  LOOP
    UPDATE public.clinic_setup k
    SET
      address = CASE WHEN COALESCE(TRIM(k.address), '') = '' THEN r.address ELSE k.address END,
      logo_url = COALESCE(NULLIF(k.logo_url, ''), r.logo_url),
      services = CASE
        WHEN (CASE WHEN jsonb_typeof(k.services::jsonb) = 'array'
                   THEN jsonb_array_length(k.services::jsonb) > 0 ELSE FALSE END)
        THEN k.services ELSE r.services END,
      schedule = CASE
        WHEN k.schedule IS NULL OR k.schedule::jsonb = '{}'::jsonb
        THEN r.schedule ELSE k.schedule END
    WHERE k.id = v_keep;
  END LOOP;

  DELETE FROM public.clinic_setup WHERE id <> v_keep;

  UPDATE public.clinic_setup
  SET clinic_name = 'Ivy King Dental Clinic', updated_at = NOW()
  WHERE id = v_keep;
END $$;

-- ====================================================================
-- 2. ONLY ONE CLINIC, ALWAYS NAMED IVY KING DENTAL CLINIC
-- ====================================================================
CREATE UNIQUE INDEX IF NOT EXISTS clinic_setup_single_clinic ON public.clinic_setup ((TRUE));

CREATE OR REPLACE FUNCTION public.enforce_single_clinic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.clinic_name := 'Ivy King Dental Clinic';
  IF TG_OP = 'INSERT' AND NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_clinic ON public.clinic_setup;
CREATE TRIGGER trg_enforce_single_clinic
  BEFORE INSERT OR UPDATE ON public.clinic_setup
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_clinic();

-- ====================================================================
-- 3. EVERYONE READS THE CLINIC; ONLY DOCTORS AND ADMINS EDIT IT
-- ====================================================================
ALTER TABLE public.clinic_setup ENABLE ROW LEVEL SECURITY;

-- Older policies were owner-only ("Users can view their clinic setup"), which is
-- what hid the clinic from assistants and patients. Replace all of them.
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clinic_setup'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.clinic_setup', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "clinic_setup_read_all" ON public.clinic_setup
  FOR SELECT
  USING (true);

CREATE POLICY "clinic_setup_staff_insert" ON public.clinic_setup
  FOR INSERT TO authenticated
  WITH CHECK (public.is_doctor() OR public.is_admin());

CREATE POLICY "clinic_setup_staff_update" ON public.clinic_setup
  FOR UPDATE TO authenticated
  USING (public.is_doctor() OR public.is_admin())
  WITH CHECK (public.is_doctor() OR public.is_admin());

CREATE POLICY "clinic_setup_admin_delete" ON public.clinic_setup
  FOR DELETE TO authenticated
  USING (public.is_admin());

GRANT SELECT ON public.clinic_setup TO anon, authenticated;

-- ====================================================================
-- 4. PRICE APPOINTMENTS FROM THE ONE CLINIC
-- ====================================================================
-- Same function as migration 041, except the price lookup no longer requires the
-- clinic row to belong to the appointment's dentist. With a single clinic that
-- check made every other dentist's appointments miss the clinic price list.
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

        -- 1. Look up in the clinic price list (one clinic, shared by every dentist)
        BEGIN
          SELECT (elem->>'price')::NUMERIC INTO v_custom_price
          FROM public.clinic_setup cs,
               jsonb_array_elements(
                 CASE 
                   WHEN jsonb_typeof(cs.services) = 'array' THEN cs.services 
                   ELSE '[]'::jsonb 
                 END
               ) elem
          WHERE (
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

NOTIFY pgrst, 'reload schema';

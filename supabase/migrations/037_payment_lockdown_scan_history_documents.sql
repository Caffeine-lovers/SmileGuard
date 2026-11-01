-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  037: Payment lockdown, AI scan history, patient documents       ║
-- ║                                                                  ║
-- ║  Run in Supabase → SQL Editor AFTER:                             ║
-- ║   1. SUPABASE_SERVICE_ROLE_KEY is set on Vercel, and             ║
-- ║   2. the matching patient-web code is deployed.                  ║
-- ║  (Before that, the old code still relies on the open RPC.)       ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ====================================================================
-- 1. PAYMENTS: only the server may mark a bill as paid
-- ====================================================================
-- confirm_billing_payment is SECURITY DEFINER and was granted to `anon`,
-- so anyone holding the public anon key could mark any appointment paid.
REVOKE ALL ON FUNCTION public.confirm_billing_payment(UUID, UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_billing_payment(UUID, UUID, NUMERIC, TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_billing_payment(UUID, UUID, NUMERIC, TEXT, TEXT) TO service_role;

-- Patients could UPDATE/INSERT their own billing rows (e.g. set payment_status = 'paid').
-- Billing rows are created by the appointment trigger (SECURITY DEFINER) and settled by
-- the server, so patients only need to read them.
DROP POLICY IF EXISTS "billings_update_patient" ON public.billings;
DROP POLICY IF EXISTS "billings_insert_patient" ON public.billings;

-- A PayMongo payment can settle at most one bill.
-- Skipped (with a notice) if old test data already reuses a reference; find those with:
--   SELECT gateway_transaction_id, count(*) FROM billings
--   WHERE payment_status = 'paid' AND gateway_transaction_id IS NOT NULL
--   GROUP BY 1 HAVING count(*) > 1;
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_billings_gateway_transaction_id
    ON public.billings (gateway_transaction_id)
    WHERE gateway_transaction_id IS NOT NULL AND payment_status = 'paid';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Duplicate paid gateway_transaction_id values exist; unique index not created. Clean them up and re-run this block.';
END $$;

-- ====================================================================
-- 2. AI SCAN HISTORY
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_path TEXT,                         -- object path in the "Analyzed images" bucket
  detections JSONB NOT NULL DEFAULT '[]'::jsonb,
  detection_count INT GENERATED ALWAYS AS (jsonb_array_length(detections)) STORED,
  model TEXT NOT NULL DEFAULT 'yolov8m',
  confidence_threshold NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_results_patient_created
  ON public.analysis_results (patient_id, created_at DESC);

ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analysis_select_own" ON public.analysis_results;
CREATE POLICY "analysis_select_own" ON public.analysis_results
  FOR SELECT USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "analysis_insert_own" ON public.analysis_results;
CREATE POLICY "analysis_insert_own" ON public.analysis_results
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

DROP POLICY IF EXISTS "analysis_delete_own" ON public.analysis_results;
CREATE POLICY "analysis_delete_own" ON public.analysis_results
  FOR DELETE USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "analysis_select_doctor" ON public.analysis_results;
CREATE POLICY "analysis_select_doctor" ON public.analysis_results
  FOR SELECT USING (public.is_doctor());

-- Scan images: private bucket, one folder per patient (<patient uuid>/<file>)
INSERT INTO storage.buckets (id, name, public)
VALUES ('Analyzed images', 'Analyzed images', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "scans_insert_own_folder" ON storage.objects;
CREATE POLICY "scans_insert_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'Analyzed images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "scans_select_own_folder" ON storage.objects;
CREATE POLICY "scans_select_own_folder" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'Analyzed images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "scans_delete_own_folder" ON storage.objects;
CREATE POLICY "scans_delete_own_folder" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'Analyzed images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "scans_select_doctor" ON storage.objects;
CREATE POLICY "scans_select_doctor" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'Analyzed images' AND public.is_doctor());

-- ====================================================================
-- 3. PATIENT DOCUMENTS (uploads: x-rays, prescriptions, insurance forms…)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('xray', 'prescription', 'report', 'insurance', 'other')),
  storage_path TEXT NOT NULL,              -- object path in the "patient-documents" bucket
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_created
  ON public.patient_documents (patient_id, created_at DESC);

ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_select_own" ON public.patient_documents;
CREATE POLICY "documents_select_own" ON public.patient_documents
  FOR SELECT USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "documents_insert_own" ON public.patient_documents;
CREATE POLICY "documents_insert_own" ON public.patient_documents
  FOR INSERT WITH CHECK (auth.uid() = patient_id AND auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "documents_delete_own" ON public.patient_documents;
CREATE POLICY "documents_delete_own" ON public.patient_documents
  FOR DELETE USING (auth.uid() = patient_id AND auth.uid() = uploaded_by);

-- Doctors can read every patient's documents and file clinic records for them
DROP POLICY IF EXISTS "documents_select_doctor" ON public.patient_documents;
CREATE POLICY "documents_select_doctor" ON public.patient_documents
  FOR SELECT USING (public.is_doctor());

DROP POLICY IF EXISTS "documents_insert_doctor" ON public.patient_documents;
CREATE POLICY "documents_insert_doctor" ON public.patient_documents
  FOR INSERT WITH CHECK (public.is_doctor() AND auth.uid() = uploaded_by);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('patient-documents', 'patient-documents', false, 10485760) -- 10 MB
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "patient_docs_insert_own_folder" ON storage.objects;
CREATE POLICY "patient_docs_insert_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'patient-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "patient_docs_select_own_folder" ON storage.objects;
CREATE POLICY "patient_docs_select_own_folder" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'patient-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "patient_docs_delete_own_folder" ON storage.objects;
CREATE POLICY "patient_docs_delete_own_folder" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'patient-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "patient_docs_doctor_all" ON storage.objects;
CREATE POLICY "patient_docs_doctor_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'patient-documents' AND public.is_doctor())
  WITH CHECK (bucket_id = 'patient-documents' AND public.is_doctor());

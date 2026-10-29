-- Migration 033: Configure doctor_code_attempts table and public access permissions
-- Enables recording and tracking of doctor access code verification attempts

CREATE TABLE IF NOT EXISTS public.doctor_code_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  attempted_code TEXT,
  is_successful BOOLEAN DEFAULT FALSE,
  ip_address TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure indexes for quick lookup & monitoring
CREATE INDEX IF NOT EXISTS idx_doctor_code_attempts_created_at ON public.doctor_code_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doctor_code_attempts_code ON public.doctor_code_attempts(code);

-- Enable RLS
ALTER TABLE public.doctor_code_attempts ENABLE ROW LEVEL SECURITY;

-- Allow anon & authenticated roles to insert code verification attempts
DROP POLICY IF EXISTS "allow_insert_attempts" ON public.doctor_code_attempts;
CREATE POLICY "allow_insert_attempts" ON public.doctor_code_attempts
  FOR INSERT
  WITH CHECK (true);

-- Allow authenticated doctors and service role to view attempt logs
DROP POLICY IF EXISTS "allow_doctors_select_attempts" ON public.doctor_code_attempts;
CREATE POLICY "allow_doctors_select_attempts" ON public.doctor_code_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'doctor'
    )
    OR auth.role() = 'service_role'
  );

-- Grant privileges to anon, authenticated, and service_role
GRANT INSERT ON public.doctor_code_attempts TO anon, authenticated, service_role;
GRANT SELECT ON public.doctor_code_attempts TO authenticated, service_role;


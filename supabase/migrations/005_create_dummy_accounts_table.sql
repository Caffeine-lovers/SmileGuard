-- ╔══════════════════════════════════════════════════════════════════╗
-- ║          MIGRATION: Create Dummy Accounts Table                 ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝
--
-- This migration creates a dummy_accounts table for internal testing
-- and development purposes. This table stores test account credentials
-- and metadata but is NOT accessible from the patient web application.

-- Step 1: Create the dummy_accounts table
CREATE TABLE IF NOT EXISTS public.dummy_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Account Identifiers
  username            TEXT NOT NULL UNIQUE,
  email               TEXT NOT NULL UNIQUE,
  
  -- Account Type (doctor, patient, admin, receptionist, etc.)
  account_type        TEXT NOT NULL 
                      CHECK (account_type IN ('doctor', 'patient', 'admin', 'receptionist', 'staff', 'other')),
  
  -- Account Status
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'inactive', 'suspended', 'deleted')),
  
  -- Credentials (password hint, not actual storage for security)
  password_hint       TEXT,
  
  -- Test Account Details
  full_name           TEXT,
  phone               TEXT,
  clinic_name         TEXT,
  specialization      TEXT,
  
  -- Internal Notes & Purpose
  notes               TEXT,
  test_purpose        TEXT,
  created_by          TEXT,
  
  -- Timestamps
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  last_used_at        TIMESTAMPTZ
);

-- Step 2: Enable RLS (Row Level Security) to restrict access
ALTER TABLE public.dummy_accounts ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS Policy - Only allow access from admin/internal users
-- This ensures the table is not accessible to regular patient web users
CREATE POLICY "dummy_accounts_restrict_access" ON public.dummy_accounts
  FOR SELECT
  USING (
    -- Check if user's role (from profiles table) is admin or doctor
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'doctor')
    )
  );

-- Step 4: Create indexes for common queries
CREATE INDEX idx_dummy_accounts_username ON public.dummy_accounts(username);
CREATE INDEX idx_dummy_accounts_email ON public.dummy_accounts(email);
CREATE INDEX idx_dummy_accounts_account_type ON public.dummy_accounts(account_type);
CREATE INDEX idx_dummy_accounts_status ON public.dummy_accounts(status);

-- Step 5: Create an updated_at trigger to automatically update the timestamp
CREATE OR REPLACE FUNCTION update_dummy_accounts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dummy_accounts_updated_at_trigger
BEFORE UPDATE ON public.dummy_accounts
FOR EACH ROW
EXECUTE FUNCTION update_dummy_accounts_timestamp();

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║                    Example Data (Optional)                       ║
-- ║           Uncomment to insert test accounts                      ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- INSERT INTO public.dummy_accounts (username, email, account_type, status, password_hint, full_name, notes)
-- VALUES
--   ('doctor_test_001', 'doctor@test.example.com', 'doctor', 'active', 'Test@123456', 'Dr. John Smith', 'Main test doctor account'),
--   ('patient_test_001', 'patient@test.example.com', 'patient', 'active', 'Test@123456', 'Jane Doe', 'Main test patient account'),
--   ('admin_test_001', 'admin@test.example.com', 'admin', 'active', 'Test@123456', 'Admin User', 'Admin test account'),
--   ('receptionist_test_001', 'receptionist@test.example.com', 'receptionist', 'active', 'Test@123456', 'Reception Staff', 'Receptionist test account');

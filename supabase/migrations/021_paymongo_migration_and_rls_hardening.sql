-- Migration: Rename stripe_payment_intent_id to gateway_transaction_id
-- Purpose: Make billing table payment-gateway-agnostic (Stripe → PayMongo migration)
-- Date: 2026-10-04

-- ============================================
-- 1. RENAME STRIPE-SPECIFIC COLUMN
-- ============================================

-- Rename the Stripe-specific column to a gateway-agnostic name
-- This supports PayMongo, Stripe, or any future payment gateway
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'billings'
      AND column_name = 'stripe_payment_intent_id'
  ) THEN
    ALTER TABLE public.billings
      RENAME COLUMN stripe_payment_intent_id TO gateway_transaction_id;
  END IF;
END $$;

-- If the column doesn't exist at all, create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'billings'
      AND column_name = 'gateway_transaction_id'
  ) THEN
    ALTER TABLE public.billings
      ADD COLUMN gateway_transaction_id TEXT;
  END IF;
END $$;

-- ============================================
-- 2. TIGHTEN BILLINGS RLS (Fixes SEC-02)
-- ============================================

-- Drop the overly permissive policy that allows ANY authenticated user
-- to read ALL billing records
DROP POLICY IF EXISTS "billings_select_authenticated" ON public.billings;

-- Policy: Patients can only view their own billing records
CREATE POLICY "billings_select_patient" ON public.billings
  FOR SELECT
  USING (auth.uid() = patient_id);

-- Policy: Doctors can view billing records of their assigned patients
CREATE POLICY "billings_select_doctor" ON public.billings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'doctor'
    )
  );

-- ============================================
-- 3. TIGHTEN UNASSIGNED APPOINTMENTS RLS
-- ============================================

-- Drop the overly permissive unassigned appointments policy
DROP POLICY IF EXISTS "appointments_select_unassigned" ON public.appointments;

-- Policy: Only doctors can view unassigned appointments (not patients)
CREATE POLICY "appointments_select_unassigned" ON public.appointments
  FOR SELECT
  USING (
    dentist_id IS NULL AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'doctor'
    )
  );

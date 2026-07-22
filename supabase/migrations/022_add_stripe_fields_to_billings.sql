-- Migration: 022_add_stripe_fields_to_billings.sql
-- Description: Add Stripe transaction metadata columns to billings table

ALTER TABLE public.billings
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_client_secret TEXT,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Create index on stripe_payment_intent_id for fast webhook lookup
CREATE INDEX IF NOT EXISTS idx_billings_stripe_payment_intent_id 
ON public.billings (stripe_payment_intent_id);

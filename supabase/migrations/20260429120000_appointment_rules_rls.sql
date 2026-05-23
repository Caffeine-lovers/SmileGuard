-- Enable Row Level Security on the table
ALTER TABLE public.appointment_rules ENABLE ROW LEVEL SECURITY;

-- Delete existing policies (optional, in case you run this multiple times)
DROP POLICY IF EXISTS "Allow select for patients and doctors" ON public.appointment_rules;
DROP POLICY IF EXISTS "Allow all for doctors" ON public.appointment_rules;

-- Policy 1: Read Access (SELECT)
-- Both 'doctor' and 'patient' can read data from the appointment_rules table
CREATE POLICY "Allow select for patients and doctors" 
ON public.appointment_rules
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('patient', 'doctor')
  )
);

-- Policy 2: Write Access (INSERT, UPDATE, DELETE)
-- Only 'doctor' can modify the appointment_rules table
CREATE POLICY "Allow all for doctors" 
ON public.appointment_rules
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'doctor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'doctor'
  )
);

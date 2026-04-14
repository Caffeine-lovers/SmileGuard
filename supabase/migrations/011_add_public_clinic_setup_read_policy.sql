-- Enable public read access to clinic_setup table
-- This allows any user to read clinic schedules without authentication
-- Necessary for doctor-mobile app to fetch clinic settings

ALTER TABLE public.clinic_setup ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read clinic_setup records
CREATE POLICY "Anyone can read clinic setup" 
ON public.clinic_setup 
FOR SELECT 
USING (true);

-- Doctors can still update their own clinic setup
CREATE POLICY "Doctors can update own clinic setup" 
ON public.clinic_setup 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Doctors can insert their own clinic setup
CREATE POLICY "Doctors can insert own clinic setup" 
ON public.clinic_setup 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

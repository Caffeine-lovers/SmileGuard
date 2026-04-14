-- Add public read policy for clinic_blockout_dates
-- This allows patients (and any authenticated user) to see which dates are blocked
-- without being able to modify the blockout dates

-- Policy: Anyone can view blockout dates (read-only)
-- This is needed so patients can see which dates are unavailable when booking
CREATE POLICY "Anyone can view active blockout dates" ON clinic_blockout_dates
  FOR SELECT
  USING (is_blocked = true);

-- Note: The existing doctor-only policy still applies for UPDATE/DELETE/INSERT
-- This new policy only allows SELECT of blocked dates

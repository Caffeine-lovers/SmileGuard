-- Create clinic_blockout_dates table for managing specific date blockouts
CREATE TABLE IF NOT EXISTS clinic_blockout_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blockout_date DATE NOT NULL,
  reason TEXT, -- Optional reason for blockout
  is_blocked BOOLEAN DEFAULT true, -- true = blocked, false = unblocked (override for recurring)
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  CONSTRAINT unique_blockout_per_user UNIQUE(user_id, blockout_date)
);

-- Create index for faster queries
CREATE INDEX idx_clinic_blockout_user_date ON clinic_blockout_dates(user_id, blockout_date);
CREATE INDEX idx_clinic_blockout_date ON clinic_blockout_dates(blockout_date);

-- Enable RLS
ALTER TABLE clinic_blockout_dates ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own blockout dates
CREATE POLICY "Users can view their own blockout dates" ON clinic_blockout_dates
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own blockout dates
CREATE POLICY "Users can insert their own blockout dates" ON clinic_blockout_dates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own blockout dates
CREATE POLICY "Users can update their own blockout dates" ON clinic_blockout_dates
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own blockout dates
CREATE POLICY "Users can delete their own blockout dates" ON clinic_blockout_dates
  FOR DELETE
  USING (auth.uid() = user_id);

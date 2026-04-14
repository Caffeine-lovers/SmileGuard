-- Create clinic_setup table (single record per doctor)
CREATE TABLE IF NOT EXISTS clinic_setup (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  logo_url TEXT,
  gallery_images TEXT[] DEFAULT ARRAY[]::TEXT[], -- array of image URLs
  services JSONB DEFAULT '[]'::JSONB, -- array of services with name and description
  schedule JSONB DEFAULT '{}'::JSONB, -- weekly schedule with days, times, and open status
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create index for better query performance
CREATE INDEX idx_clinic_setup_user_id ON clinic_setup(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE clinic_setup ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for clinic_setup table
CREATE POLICY "Users can view their clinic setup" ON clinic_setup
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their clinic setup" ON clinic_setup
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their clinic setup" ON clinic_setup
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their clinic setup" ON clinic_setup
  FOR DELETE USING (auth.uid() = user_id);

-- Add expo_push_token column to profiles table for Expo push notifications
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_expo_push_token ON profiles(expo_push_token) WHERE expo_push_token IS NOT NULL;

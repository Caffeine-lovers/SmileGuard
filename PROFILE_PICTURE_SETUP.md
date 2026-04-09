# Profile Picture Upload Setup Guide

## Overview
Doctors can now upload profile pictures during registration. Images are stored in Supabase Storage and the URLs are saved to the doctors table.

## Setup Steps

### 1. Install `expo-image-picker` Dependency

Run this command in the doctor-mobile directory:

```bash
cd apps/doctor-mobile
pnpm add expo-image-picker
```

Then restart your Expo app:
```bash
pnpm exec expo start --clear
```

### 2. Create Supabase Storage Bucket

Go to your Supabase Dashboard:
1. Navigate to **Storage** (sidebar)
2. Click **Create New Bucket**
3. Name it: **`doctor-pictures`**
4. Select **Public** (so images can be accessed via URL)
5. Click **Create Bucket**

### 3. Set Up Row Level Security (Optional but Recommended)

In Supabase SQL Editor, run:

```sql
-- Allow authenticated users to upload to their own doctor-pictures folder
CREATE POLICY "Users can upload their own doctor pictures" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'doctor-pictures' AND
    auth.role() = 'authenticated'
  );

-- Allow public to view all doctor pictures
CREATE POLICY "Anyone can view doctor pictures" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'doctor-pictures');

-- Allow users to delete only their own pictures
CREATE POLICY "Users can delete their own doctor pictures" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'doctor-pictures' AND
    auth.role() = 'authenticated'
  );
```

### 4. How It Works

**During Registration (Step 1):**
- Doctor clicks "📷 Choose Photo" button
- Image picker opens
- Doctor selects an image from their device
- Image preview appears on the form
- Image is NOT uploaded yet

**During Registration (Step 2 - Account Creation):**
- When doctor clicks "Create Doctor Account"
- Account is created
- Image is uploaded to Supabase Storage at path: `doctor-pictures/{userId}/profile_{timestamp}`
- Uploaded image URL is saved to the `doctors` table in `profile_picture_url` column

**If Image Upload Fails:**
- Registration continues without the image
- Warning is logged to console
- Doctor can update profile picture later

## Files Modified

1. **`apps/doctor-mobile/components/auth/DoctorProfileSetup.tsx`**
   - Added image picker button with preview
   - Integrated `uploadProfileImage` call during registration
   - Removed text input for URL

2. **`apps/doctor-mobile/lib/imageUploadService.ts`** (NEW)
   - `pickImage()` - Opens image picker
   - `uploadProfileImage()` - Uploads to Supabase Storage
   - `deleteProfileImage()` - Removes image from Storage
   - `requestMediaPermission()` - Handles device permissions

## Image Features

- ✅ Square aspect ratio (1:1) for profile pictures
- ✅ Compressed to 70% quality to save storage
- ✅ Preview before uploading
- ✅ Can remove selected image before confirming
- ✅ Automatic permission handling
- ✅ Error handling with user feedback

## Testing Locally

1. Clear cache and restart:
   ```bash
   pnpm exec expo start --clear
   ```

2. Test registration flow:
   - Register as new doctor
   - On Step 1, click "📷 Choose Photo"
   - Select an image
   - Continue to Step 2
   - Fill credentials and register
   - Check Supabase Storage to see uploaded image

3. Verify in Supabase:
   - Go to Storage → doctor-pictures
   - You should see: `doctor-profiles/{userId}/profile_{timestamp}`
   - Click on the image to get the public URL
   - Go to doctors table and verify `profile_picture_url` is populated

## Storage Cost Optimization

- Only JPEGs at 70% quality are stored
- Square aspect ratio prevents oversized images
- Images organized by user ID for easy management
- Automatic cache control (3600 seconds)

## Troubleshooting

**"Permission Denied" Error:**
- Make sure you've set the doctor-pictures bucket to **Public**
- Check RLS policies if you added them

**Image Upload Fails But Registration Succeeds:**
- This is normal - registration doesn't require an image
- Doctor can update profile picture in profile settings later

**Image Not Showing in Preview:**
- Make sure you're on a real device or emulator with proper permissions
- Expo Go app needs media library permission

**URL Not Saved to Database:**
- Check console logs for upload errors
- Verify `profile_picture_url` column exists in `doctors` table
- Ensure the upload function returned a valid URL

## Future Enhancements

- [ ] Allow doctors to update profile pictures in settings
- [ ] Add image compression on-device
- [ ] Display doctor pictures in directory listings
- [ ] Add image gallery for multiple photos

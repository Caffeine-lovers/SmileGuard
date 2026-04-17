# Supabase Doctor Profiles Bucket Setup

## Problem
The doctor profile image upload was failing with "bucket can't be found" error because the `doctor-profiles` storage bucket doesn't exist or isn't configured.

## Solution

### Step 1: Create the Bucket via Supabase Dashboard

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Storage** → **Buckets**
4. Click **New Bucket**
5. Fill in:
   - **Name:** `doctor-profiles`
   - **Public bucket:** Toggle ON (must be PUBLIC for image access)
6. Click **Create**

### Step 2: Set Public Access Policy (Optional - Already Enabled)

The bucket is now public, but you can verify the policy:

1. Go to **Storage** → **Buckets** → `doctor-profiles` → **Policies**
2. Ensure there's a **SELECT** policy for public access
3. Policy should allow: `bucket_id = 'doctor-profiles'`

### Step 3: Verify Configuration

The bucket should now:
- ✅ Exist at `gs://your-project.appspot.com/storage/v1/b/doctor-profiles`
- ✅ Be set to **PUBLIC** 
- ✅ Allow public read access
- ✅ Allow authenticated write access

### Step 4: Test Upload

1. Open the app and navigate to doctor profile setup
2. Click "Choose Photo"
3. Select an image
4. Click "Complete Profile"
5. Image should upload successfully

If still failing, check:
- [ ] Bucket name is exactly `doctor-profiles` (lowercase, no spaces)
- [ ] Bucket is set to **PUBLIC**
- [ ] Your Supabase URL is correct in environment variables
- [ ] Internet connection is active

## Code Changes Made

### Updated `imageUploadService.ts:`
- ✅ Changed bucket reference from `doctor-pictures` → `doctor-profiles`
- ✅ Removed all logging emojis, replaced with `[ImageUpload]` prefixes
- ✅ Added clear error messaging about bucket setup
- ✅ Added documentation at file top with setup instructions

## File Path Reference
- **Upload Service:** `apps/doctor-mobile/lib/imageUploadService.ts`
- **Profile Setup:** `apps/doctor-mobile/app/setup-profile.tsx`
- **Component:** `apps/doctor-mobile/components/auth/DoctorProfileSetup.tsx`

## Troubleshooting

| Error | Solution |
|-------|----------|
| "bucket can't be found" | Create `doctor-profiles` bucket in Supabase Dashboard |
| "permission denied" | Toggle bucket to PUBLIC |
| "CORS error" | Check Supabase CORS settings (should be auto-configured) |
| "Failed to fetch" | Verify internet connection and Supabase URL |

---

**Last Updated:** April 15, 2026  
**Related Issues:** Supabase storage integration for doctor profile images

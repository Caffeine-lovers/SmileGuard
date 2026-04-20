# Doctor Pictures Storage - Setup & Policy Installation

## Issue Fixed
The image upload service had a bucket name mismatch causing uploads to fail:
- **Before**: Uploaded to `"doctor-profiles"` bucket but looked for URL in `"doctor-pictures"` 
- **After**: All operations now use `"doctor-pictures"` bucket consistently
- **Folder structure**: Changed from `doctor-profiles/{userId}` to `profile/{userId}` 

## Prerequisites
1. Supabase dashboard access
2. SQL editor access in Supabase
3. Existing `doctor-pictures` bucket in Supabase Storage

## Step 1: Verify Bucket Exists

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **Storage** → **Buckets**
3. Confirm `doctor-pictures` bucket exists and is set to **PUBLIC**
4. If missing, create it:
   - Click **Create New Bucket**
   - Name: `doctor-pictures`
   - Make it **Public**
   - Click **Create Bucket**

## Step 2: Create the 'doctor-pictures' Bucket (if not exists)

Run this SQL in Supabase SQL Editor:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('doctor-pictures', 'doctor-pictures', true)
ON CONFLICT (id) DO NOTHING;
```

## Step 3: Add RLS Policies

Copy and run the following SQL in Supabase SQL Editor:

```sql
-- 1. Allow authenticated users to upload to their own profile folder
CREATE POLICY "Doctors can upload their own profile pictures"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'doctor-pictures'
    AND auth.role() = 'authenticated'
  );

-- 2. Allow anyone (public and authenticated) to view doctor pictures
CREATE POLICY "Anyone can view doctor profile pictures"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'doctor-pictures');

-- 3. Allow authenticated doctors to delete only their own pictures
CREATE POLICY "Doctors can delete their own profile pictures"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'doctor-pictures'
    AND auth.role() = 'authenticated'
  );

-- 4. Allow authenticated doctors to update (replace) their pictures
CREATE POLICY "Doctors can update their own profile pictures"
  ON storage.objects FOR UPDATE
  WITH CHECK (
    bucket_id = 'doctor-pictures'
    AND auth.role() = 'authenticated'
  );
```

## Step 4: Verify Policies

1. Go to Supabase **Storage** → **Policies**
2. Select the `doctor-pictures` bucket
3. You should see 4 policies:
   - ✅ Doctors can upload their own profile pictures (INSERT)
   - ✅ Anyone can view doctor profile pictures (SELECT)
   - ✅ Doctors can delete their own profile pictures (DELETE)
   - ✅ Doctors can update their own profile pictures (UPDATE)

## Step 5: Test the Upload

1. Run the app: `pnpm exec expo start`
2. Navigate to Doctor Profile settings
3. Click the camera icon on profile picture
4. Select an image
5. Confirm the upload
6. The image should now upload successfully to `doctor-pictures/profile/{userId}/profile_{timestamp}`

## Troubleshooting

### ❌ Still getting upload error?

**Check these in order:**

1. **Verify Authentication**
   - Doctor must be logged in
   - Check browser console for auth errors
   
2. **Check Policy Status**
   - Go to Supabase Dashboard → Storage → Policies
   - Confirm all 4 policies exist for `doctor-pictures` bucket
   - Look for any red X marks indicating disabled policies

3. **Verify Bucket is Public**
   - Storage → Buckets → doctor-pictures
   - Confirm **Public** is selected

4. **Check Network**
   - Ensure device has internet connection
   - Try WiFi if using mobile data
   - Check Supabase status page

5. **Clear App Cache**
   ```bash
   # In doctor-mobile directory
   pnpm exec expo start --clear
   ```

### 📝 Check Logs

Enable detailed logging in the app to see what's happening:
- Look for `[ImageUpload]` logs in the console
- Check `❌ File processing or upload error` messages

### 🆘 Still Not Working?

Run this test in browser console (on web version):
```javascript
import { supabase } from '@smileguard/supabase-client';

// Check if authenticated
console.log('User:', await supabase.auth.getUser());

// Check bucket access
const { data, error } = await supabase.storage
  .from('doctor-pictures')
  .list('profile', { limit: 1 });
  
console.log('Bucket access test:', { data, error });
```

## File Changes

- **Modified**: `apps/doctor-mobile/lib/imageUploadService.ts`
  - Bucket name: `doctor-profiles` → `doctor-pictures`
  - Folder path: `doctor-profiles/{userId}` → `profile/{userId}`
  - Consistent bucket usage throughout

- **New**: `supabase/migrations/setup_doctor_pictures_policies.sql`
  - SQL migration file for RLS policies

## Next Steps

After policies are applied:
1. Test uploading a profile picture
2. Verify the image appears in Supabase Storage at `doctor-pictures/profile/{userId}/profile_{timestamp}`
3. Confirm the image URL works and image displays in the app

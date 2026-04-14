# Image Upload Troubleshooting Guide

## Issue: "StorageUnknownError: Network request failed"

When attempting to upload a profile picture, you see this error:
```
ERROR: StorageUnknownError: Network request failed
```

## Root Causes & Solutions

### ✓ Solution 1: Verify Supabase Storage Bucket Exists

**Problem:** The "doctor-pictures" storage bucket may not be created.

**Steps to Fix:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click on **Storage** in the left sidebar
4. Check if "doctor-pictures" bucket exists
5. If not, click **Create New Bucket** and name it "doctor-pictures"
6. Make sure it's set to **PUBLIC**
7. Restart your Expo app

**Debug Command:**
Add this to your app initialization or settings screen:
```javascript
import { logStorageDiagnostics } from '@app/lib/storageSetupCheck';

// Call this to see detailed diagnostics in console
await logStorageDiagnostics();
```

---

### ✓ Solution 2: Fix Deprecated ImagePicker API

**Fixed Issue:** The deprecated `ImagePicker.MediaTypeOptions` has been replaced with `ImagePicker.MediaType`.

**Note:** This was automatically fixed in the latest update. You should no longer see:
```
WARN [expo-image-picker] ImagePicker.MediaTypeOptions have been deprecated
```

---

### ✓ Solution 3: Verify Android/iOS Permissions

**Problem:** The app doesn't have permission to access media library.

**For Android:**
- Make sure the app has media permission
- On Android 13+, you need `READ_MEDIA_IMAGES` permission
- This is usually handled automatically by expo-image-picker

**For iOS:**
- Make sure you've granted photo library access
- If you keep getting permission denied, try:
  1. Reset app data
  2. Uninstall and reinstall the app

---

### ✓ Solution 4: Check Network Connectivity

**Problem:** Your device has no internet connection or poor connectivity.

**Steps:**
1. Check your device has active internet connection
2. Try using WiFi instead of mobile data (or vice versa)
3. Check if other apps can connect to the internet
4. If using Expo Go locally, make sure your device is on the same network as your computer

---

### ✓ Solution 5: Verify Supabase Security Rules

**Problem:** RLS (Row Level Security) policies might be blocking uploads.

**Check:**
1. Go to Supabase Dashboard
2. Navigate to **Storage → Policies**
3. Look for the "doctor-pictures" bucket
4. Should have these policies (if you set them up):
   - "Users can upload their own doctor pictures" (INSERT)
   - "Anyone can view doctor pictures" (SELECT)
   - "Users can delete their own doctor pictures" (DELETE)

**If No Policies:**
That's fine! You can also run this SQL in SQL Editor:
```sql
-- Allow authenticated users to upload
CREATE POLICY "Users can upload their own doctor pictures" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'doctor-pictures' AND
    auth.role() = 'authenticated'
  );

-- Allow public to view
CREATE POLICY "Anyone can view doctor pictures" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'doctor-pictures');

-- Allow users to delete their own
CREATE POLICY "Users can delete their own doctor pictures" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'doctor-pictures' AND
    auth.role() = 'authenticated'
  );
```

---

### ✓ Solution 6: Update Image Upload Service

**Latest Improvements:**
- Better error messages with detailed logging
- Handles React Native blob conversion properly
- Uses `expo-file-system` for reliable file reading
- Clearer network error detection

**To upgrade:**
- Make sure your `imageUploadService.ts` is using:
  - `ImagePicker.MediaType.Images` (not the deprecated `.MediaTypeOptions`)
  - `FileSystem.readAsStringAsync` for base64 conversion
  - Proper Uint8Array conversion for binary data

---

## Testing the Upload

### 1. Enable Detailed Console Logging
When uploading, look for these logs:
```
📤 Starting image upload...
✅ File read successfully, encoding as binary...
✅ Binary conversion complete, size: XXXX bytes
📤 Uploading to Supabase storage...
✅ Upload successful
🔗 Generating public URL...
✅ Public URL generated successfully
```

### 2. Check Browser Developer Console (for Web)
If testing on web (via `npm run web`):
1. Open DevTools (F12)
2. Go to Console tab
3. Look for the detailed upload logs

### 3. Check Expo CLI Output
When running on mobile via Expo Go:
```bash
pnpm exec expo start
```
Look for upload logs in the terminal output.

---

## Still Having Issues?

### Gather Debug Information

Run these commands to get diagnostic info:

**On Doctor Mobile App:**
1. After getting the error, check console for detailed error message
2. Look for any RLS policy violations or bucket errors

**Check Supabase Logs:**
1. Go to Supabase Dashboard
2. Click Functions (or API Logs if available)
3. Look for any error entries related to storage

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "doctor-pictures bucket does not exist" | Bucket not created | Create bucket in Supabase Dashboard |
| "Network request failed" | No internet or bucket doesn't exist | Check internet & verify bucket exists |
| "Permission denied" | RLS policy blocking | Check security policies or set to public |
| "Failed to generate public URL" | Bucket exists but can't be accessed | Make bucket PUBLIC |

---

## Quick Setup Checklist

- [ ] Supabase project created
- [ ] "doctor-pictures" bucket created in Storage
- [ ] Bucket is set to PUBLIC access
- [ ] (Optional) Security policies configured
- [ ] App has media library permissions
- [ ] Device has internet connection
- [ ] Expo app restarted after bucket creation
- [ ] Using latest `imageUploadService.ts` with `MediaType.Images`

---

## Alternative: Skip Image Upload

If you want to skip image uploads during registration:

**In DoctorProfileSetup.tsx:**
The image upload is optional - if it fails, registration still succeeds without the image.

**Later edit:** Doctor can update profile picture in Profile Settings screen.

# Expo Push Notifications Setup Guide for SmileGuard Doctor Mobile

## Overview
This guide sets up push notifications for new appointments in the doctor-mobile app using Expo and Supabase.

## Prerequisites
- Physical iOS or Android device (emulators don't support push notifications)
- Expo account: https://expo.dev
- Supabase project already set up
- `eas` CLI installed

## Step-by-Step Setup

### 1. Install Dependencies

First, ensure all required packages are installed:

```bash
cd apps/doctor-mobile
npm install expo-device
# expo-notifications is already installed
```

Verify in package.json that you have:
- `expo-notifications`: ~0.31.5 ✅ (already installed)
- `expo-device`: ^7.1.4 ✅ (already installed)

### 2. Create Expo Project and Get Credentials

The doctor-mobile app is already linked to Expo project `7380953f-ba09-42e5-8ab0-952c205fa3d1`.

#### Get Expo Access Token:

1. Go to https://expo.dev/accounts/_/settings/access-tokens
2. Click "Create new token"
3. Name it: `SmileGuard Push Notifications`
4. Select scopes:
   - ✅ Publish to Expo
   - ✅ Push notification services
5. Enable the toggle: **"Enhanced Security for Push Notifications"**
6. Copy the token (you'll need it in the next step)

### 3. Set Up Supabase Database

#### 3.1 Run Database Migration

Push the migration that adds the `expo_push_token` column to profiles:

```bash
supabase db push
```

This creates:
- `expo_push_token` column in `profiles` table
- Index for faster lookups

Verify in Supabase Dashboard:
- Go to SQL Editor
- Run: `SELECT id, expo_push_token FROM profiles LIMIT 5;`
- You should see the new column (currently NULL)

#### 3.2 Set EXPO_ACCESS_TOKEN Secret

Store your Expo access token as a Supabase secret:

```bash
supabase secrets set EXPO_ACCESS_TOKEN="<your_expo_access_token>"
```

Verify it was set:
```bash
supabase secrets list
```

### 4. Deploy Supabase Edge Function

Deploy the push notification edge function:

```bash
supabase functions deploy send-push-notification
```

This function:
- Listens for webhook events from the appointments table
- Retrieves the doctor's Expo push token
- Sends the push notification via Expo API
- Handles invalid tokens by clearing them

Check logs:
```bash
supabase functions list
supabase functions logs send-push-notification
```

### 5. Create Database Webhook

Create a webhook that triggers the function when new appointments are inserted:

#### Via Supabase Dashboard:

1. Go to your project dashboard
2. Navigate to **Integrations → Webhooks**
3. Click **Create a new webhook**

**Configure the webhook:**

| Field | Value |
|-------|-------|
| **Webhook name** | `appointment-push-notification` |
| **Table** | `appointments` |
| **Events** | ✅ INSERT |
| **Webhook function** | `send-push-notification` |
| **Method** | POST |
| **Timeout** | 30000 (ms) |
| **HTTP Headers** | Click "Add auth header" and select "Service Role Key" |
| **Content-Type** | `application/json` |

4. Click **Create webhook**

**Test the webhook:**
- You should see it in the webhooks list
- Status should be "Enabled"

### 6. Run the App

#### Build and Deploy to Device

```bash
# For Android
npm run android

# For iOS
npm run ios
```

Or use EAS:

```bash
eas build --platform android
```

#### On App Launch:

The app will:
1. ✅ Ask for push notification permission
2. ✅ Retrieve Expo push token
3. ✅ Store token in Supabase `profiles` table
4. ✅ Set up listeners for incoming notifications

### 7. Verify Setup

#### Check Push Token is Stored:

1. Log in with a doctor account
2. Go to Supabase Dashboard → SQL Editor
3. Run:
   ```sql
   SELECT id, email, expo_push_token 
   FROM profiles 
   WHERE id = 'your_doctor_id';
   ```
4. You should see the token populated (e.g., `ExponentPushToken[...]`)

#### Test Push Notification:

1. Insert a test appointment in Supabase:

   ```sql
   INSERT INTO appointments (
     patient_name,
     service,
     appointment_time,
     patient_id,
     dentist_id,
     status
   ) VALUES (
     'Test Patient',
     'Cleaning',
     NOW() + INTERVAL '1 hour',
     'test-patient-id',
     'your-doctor-id',
     'confirmed'
   );
   ```

2. Watch your device - you should receive a push notification!

3. Check edge function logs for any errors:
   ```bash
   supabase functions logs send-push-notification
   ```

## Troubleshooting

### Push notification not appearing?

**Check 1: Token stored?**
```sql
SELECT expo_push_token FROM profiles WHERE id = 'your-doctor-id';
```
- If NULL: Permission wasn't granted on app

**Check 2: Function logs**
```bash
supabase functions logs send-push-notification
```
- Look for errors about invalid tokens
- Check if doctor_id matches

**Check 3: Webhook enabled?**
- Dashboard → Integrations → Webhooks
- Ensure `appointment-push-notification` is enabled

**Check 4: Physical device?**
- Emulators don't receive push notifications
- Must use real iOS or Android device

### "INVALID_EXPO_PUSH_TOKEN" error?

The token may have expired. The edge function automatically clears it.
Solution:
1. Force clear the token in database
2. Restart the app
3. Allow permission again
4. New token will be generated

```sql
UPDATE profiles 
SET expo_push_token = NULL 
WHERE id = 'your-doctor-id';
```

### Permission denied?

Check app settings:
- **iOS**: Settings → SmileGuard Doctor → Notifications → Allow
- **Android**: Settings → Apps → SmileGuard Doctor → Permissions → Notifications

## Notification Handling

The app automatically handles:

### Foreground Notifications
When app is open and notification arrives:
- Sound plays
- Alert shows
- Badge updates

### Background Notifications
When app is closed:
- Notification appears in system tray
- Tapping navigates to appointment details (when implemented)

### Notification Data
Each push notification includes:
```json
{
  "title": "New Appointment",
  "body": "John Doe - Cleaning at 2:30 PM",
  "data": {
    "appointmentId": "...",
    "patientId": "...",
    "doctorId": "...",
    "type": "appointment-created"
  }
}
```

## Next Steps

### Add Navigation on Tap
Edit [usePushNotifications.ts](../hooks/usePushNotifications.ts) to navigate to appointment details when user taps notification:

```typescript
if (data?.appointmentId) {
  router.push(`/(doctor)/appointments/${data.appointmentId}`);
}
```

### Add More Notification Types
Update [send-push-notification/index.ts](../../../supabase/functions/send-push-notification/index.ts) to handle:
- Appointment updates
- Appointment cancellations
- Payment notifications
- Other events

### Customize Notification Appearance
Modify notification title/body in the edge function based on appointment details.

## Files Modified

- ✅ [migrations/021_add_expo_push_token.sql](../../../supabase/migrations/021_add_expo_push_token.sql)
- ✅ [supabase/functions/send-push-notification/index.ts](../../../supabase/functions/send-push-notification/index.ts)
- ✅ [hooks/usePushNotifications.ts](../hooks/usePushNotifications.ts)
- ✅ [app/_layout.tsx](../app/_layout.tsx)
- ℹ️ [lib/pushNotificationConfig.ts](../lib/pushNotificationConfig.ts) - Configuration reference

## References

- [Expo Push Notifications Docs](https://docs.expo.dev/push-notifications/overview/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Webhooks](https://supabase.com/docs/guides/database/webhooks)
- [Example: Expo Push with Supabase](https://github.com/supabase/supabase/tree/master/examples/user-management/expo-push-notifications)

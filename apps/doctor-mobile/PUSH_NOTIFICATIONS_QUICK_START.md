# Push Notifications Setup - Quick Reference

## 1️⃣ Get Expo Access Token (5 minutes)

```bash
# Visit: https://expo.dev/accounts/_/settings/access-tokens
# Create token → Copy it
EXPO_TOKEN="your_token_here"
```

## 2️⃣ Supabase Setup (2 minutes)

```bash
# Push database migration (adds expo_push_token column)
supabase db push

# Set the Expo token as a Supabase secret
supabase secrets set EXPO_ACCESS_TOKEN="$EXPO_TOKEN"

# Verify it worked
supabase secrets list
```

## 3️⃣ Deploy Edge Function (1 minute)

```bash
supabase functions deploy send-push-notification
```

## 4️⃣ Create Webhook in Dashboard (3 minutes)

1. Go to https://supabase.com/dashboard/project/_/integrations/webhooks
2. Click "Create a new hook"
3. **Configuration:**
   - Table: `appointments`
   - Events: ✅ INSERT
   - Webhook function: `send-push-notification`
   - Method: `POST`
   - Timeout: `30000`
   - Headers: Add auth header with "Service Role Key"

## 5️⃣ Build and Test (varies)

```bash
# Run on physical device
cd apps/doctor-mobile
npm run android  # or ios

# Wait for app to ask for notification permissions
# Grant permission
```

## 6️⃣ Verify Token Stored

```sql
-- In Supabase SQL Editor
SELECT id, email, expo_push_token 
FROM profiles 
LIMIT 5;
```

Token should be: `ExponentPushToken[...]`

## 7️⃣ Test with Sample Appointment

```sql
-- Insert test appointment
INSERT INTO appointments (
  patient_name, service, appointment_time, 
  patient_id, dentist_id, status
) VALUES (
  'Test Patient', 'Cleaning', NOW() + INTERVAL '1 hour',
  'patient-id', 'your-doctor-id', 'confirmed'
);
```

✅ **Check your device for push notification!**

## Troubleshooting Commands

```bash
# View edge function logs
supabase functions logs send-push-notification

# Check webhook status
supabase functions list

# Clear token manually (if stuck)
# In Supabase SQL Editor:
UPDATE profiles SET expo_push_token = NULL WHERE id = 'doctor-id';
```

## Files Created/Modified

```
✅ supabase/migrations/021_add_expo_push_token.sql
✅ supabase/functions/send-push-notification/index.ts
✅ apps/doctor-mobile/hooks/usePushNotifications.ts
✅ apps/doctor-mobile/app/_layout.tsx (imported hook)
✅ apps/doctor-mobile/lib/pushNotificationConfig.ts
ℹ️ apps/doctor-mobile/PUSH_NOTIFICATIONS_SETUP.md (full guide)
```

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| No push permission prompt | Use physical device, not emulator |
| Token is NULL in database | Check notification permission in app settings |
| "INVALID_EXPO_PUSH_TOKEN" error | Token expired - app will re-register automatically |
| Notification not received | Check webhook is enabled in Supabase dashboard |
| Function fails | Run `supabase functions logs send-push-notification` |

## What Happens When You Insert an Appointment

1. You insert a row in `appointments` table
2. Webhook triggers → calls `send-push-notification` function
3. Function retrieves doctor's expo_push_token from `profiles`
4. Function sends to Expo API
5. Expo sends to doctor's device
6. App receives notification → shows alert + sound

---

**Need detailed setup? See:** [PUSH_NOTIFICATIONS_SETUP.md](./PUSH_NOTIFICATIONS_SETUP.md)

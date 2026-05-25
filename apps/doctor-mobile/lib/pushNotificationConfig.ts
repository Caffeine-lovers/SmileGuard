/**
 * Push Notification Configuration
 * Setup steps for Expo Push Notifications with EAS
 * 
 * SETUP CHECKLIST:
 * 
 * 1. INSTALL DEPENDENCIES
 *    npm install expo-notifications expo-device
 * 
 * 2. CONFIGURE EAS PROJECT
 *    - Go to https://expo.dev/accounts/_/projects
 *    - Create new Expo project or select existing: smileguard-doctor
 *    - Run: eas init --id 7380953f-ba09-42e5-8ab0-952c205fa3d1 (if not already done)
 * 
 * 3. GET EXPO ACCESS TOKEN
 *    - Go to https://expo.dev/accounts/_/settings/access-tokens
 *    - Create new token (select "Publish to Expo" and "Push notification services")
 *    - Enable "Enhanced Security for Push Notifications" toggle
 *    - Copy token
 * 
 * 4. CONFIGURE SUPABASE
 *    - Run migration: supabase db push (includes expo_push_token column)
 *    - Set Expo access token as Supabase secret:
 *      supabase secrets set EXPO_ACCESS_TOKEN=<your_token>
 * 
 * 5. DEPLOY EDGE FUNCTION
 *    supabase functions deploy send-push-notification
 * 
 * 6. CREATE DATABASE WEBHOOK
 *    - Go to Supabase Dashboard > Integrations > Webhooks
 *    - Create new webhook:
 *      - Table: appointments
 *      - Events: Insert
 *      - Webhook function: send-push-notification
 *      - Method: POST
 *      - Timeout: 30000 (30 seconds)
 *      - Auth header: Service role key
 *      - Content-Type: application/json
 * 
 * 7. TEST SETUP
 *    - Run app on physical device: npm run android (or ios)
 *    - Check Supabase > Auth to see your profile
 *    - Verify expo_push_token is populated in profiles table
 *    - Insert test appointment in Supabase
 *    - Check if push notification appears on device
 *    - Check edge function logs for any errors
 */

export const pushNotificationConfig = {
  // These will be auto-populated when you use usePushNotifications hook
  requiredPermissions: ['notifications'],
  platforms: ['ios', 'android'],
  // Notification channels for Android
  androidChannelId: 'default',
  androidChannelName: 'Default Notifications',
} as const

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Configure foreground notification behavior (alert banner, sound, badge)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Configure Android notification channels and request user permission
 * to obtain the Expo Push Token for this physical device.
 */
export async function registerForPushNotificationsAsync(userId?: string): Promise<string | null> {
  let token: string | null = null;

  try {
    // 1. Android Notification Channel (Required for Android 8.0+)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'SmileGuard Appointments',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00B4A0',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    // 2. Check for physical device (Remote push notifications fail on iOS simulators)
    if (!Device.isDevice) {
      console.log('[PushNotification] Remote push notifications require a physical device.');
      return null;
    }

    // 3. Check and request notification permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[PushNotification] Permission was not granted for push notifications.');
      return null;
    }

    // 4. Retrieve EAS project ID
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      '7380953f-ba09-42e5-8ab0-952c205fa3d1';

    const pushTokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    token = pushTokenData.data;
    console.log('[PushNotification] Expo Push Token obtained:', token);

    // 5. Store the token in Supabase profiles table
    if (userId && token) {
      await savePushTokenToProfile(userId, token);
    }
  } catch (error) {
    console.error('[PushNotification] Error while registering for push notifications:', error);
  }

  return token;
}

/**
 * Persist the device's push token into public.profiles for the logged-in doctor
 */
export async function savePushTokenToProfile(userId: string, token: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ expo_push_token: token })
      .eq('id', userId);

    if (error) {
      console.error('[PushNotification] Failed to save push token to profiles:', error.message);
    } else {
      console.log(`[PushNotification] Successfully updated profiles.expo_push_token for user: ${userId}`);
    }
  } catch (err) {
    console.error('[PushNotification] Unexpected error updating profile push token:', err);
  }
}

/**
 * Remove push token on doctor logout so notifications are not sent to this device
 */
export async function clearPushTokenFromProfile(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ expo_push_token: null })
      .eq('id', userId);

    if (error) {
      console.warn('[PushNotification] Failed to clear push token on logout:', error.message);
    } else {
      console.log(`[PushNotification] Cleared push token for user: ${userId}`);
    }
  } catch (err) {
    console.warn('[PushNotification] Unexpected error clearing push token:', err);
  }
}

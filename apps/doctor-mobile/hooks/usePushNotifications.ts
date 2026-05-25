/**
 * usePushNotifications Hook
 * Simple one-time push notification registration
 * Call this ONLY when user is already authenticated
 */

import { useEffect } from 'react'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { supabase } from '@smileguard/supabase-client'
import { useCurrentUser } from './useCurrentUser'

// Set notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export function usePushNotifications() {
  const user = useCurrentUser()

  useEffect(() => {
    if (!user?.id) {
      console.log('🎣 usePushNotifications: Waiting for user...')
      return
    }

    console.log('🎣 usePushNotifications: Starting push notification setup with user:', user.id)
    registerPushNotifications(user.id)
  }, [user?.id])
}

async function registerPushNotifications(authUserId: string) {
  try {
    console.log('🎯 Registering push notifications for user:', authUserId)

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      console.log('🔔 Requesting notification permissions...')
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Notification permissions denied')
      return
    }

    console.log('✅ Notification permissions granted')

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync()
    const token = typeof tokenData === 'string' ? tokenData : tokenData?.data

    if (!token) {
      console.log('⚠️ Failed to get push token')
      return
    }

    console.log('🔐 Push token obtained:', token.substring(0, 30) + '...')

    // Store in database
    const { error, data } = await supabase
      .from('profiles')
      .update({ expo_push_token: token })
      .eq('id', authUserId)
      .select()

    if (error) {
      console.error('❌ Failed to store push token:', error.message)
    } else if (!data || data.length === 0) {
      console.error('❌ RLS blocked update: no rows affected')
    } else {
      console.log('✅ Push token stored successfully in database')
    }
  } catch (error: any) {
    console.error('❌ Push notification setup failed:', error?.message)
  }
}

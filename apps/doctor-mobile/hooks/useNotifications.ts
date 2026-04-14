/**
 * useNotifications Hook
 * Manages notification state and real-time subscriptions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Notification,
  NotificationType,
} from '../types/notifications';
import {
  subscribeToDoctorNotifications,
  markNotificationAsRead,
  getUnreadCount,
  sortNotificationsByTime,
  clearOldNotifications,
} from '../lib/notificationService';

export function useNotifications(doctorId: string | undefined, enabled: boolean = true) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const seenNotificationIds = useRef<Set<string>>(new Set());

  // Initialize real-time subscriptions
  useEffect(() => {
    if (!enabled || !doctorId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    // Subscribe to all doctor notifications
    const unsubscribe = subscribeToDoctorNotifications(
      doctorId,
      (notification: Notification) => {
        console.log('📬 New notification received:', notification);
        
        // Avoid duplicate notifications
        if (seenNotificationIds.current.has(notification.id)) {
          console.log('⏭️ Skipping duplicate notification:', notification.id);
          return;
        }
        
        seenNotificationIds.current.add(notification.id);
        
        setNotifications((prev) => {
          const updated = [notification, ...prev];
          // Keep notifications for up to 24 hours
          return clearOldNotifications(updated, 24);
        });

        // Update unread count
        setNotifications((prev) => {
          setUnreadCount(getUnreadCount(prev));
          return prev;
        });
      },
      (errorMsg: string) => {
        console.error('❌ Notification service error:', errorMsg);
        setError(errorMsg);
      }
    );

    unsubscribeRef.current = unsubscribe;
    setIsLoading(false);

    // Cleanup on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [doctorId, enabled]);

  // Update unread count whenever notifications change
  useEffect(() => {
    setUnreadCount(getUnreadCount(notifications));
  }, [notifications]);

  const handleMarkAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? markNotificationAsRead(n) : n
      )
    );
  }, []);

  const handleMarkAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleDeleteNotification = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.filter((n) => n.id !== notificationId)
    );
  }, []);

  const handleClearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const handleFilterByType = useCallback(
    (type: NotificationType): Notification[] => {
      return notifications.filter((n) => n.type === type);
    },
    [notifications]
  );

  const getSortedNotifications = useCallback((): Notification[] => {
    return sortNotificationsByTime(notifications);
  }, [notifications]);

  // Add a manual notification (useful when app triggers changes)
  const handleAddNotification = useCallback((notification: Notification) => {
    console.log('📢 Manual notification added:', notification.type);
    seenNotificationIds.current.add(notification.id);
    setNotifications((prev) => [notification, ...prev]);
  }, []);

  return {
    notifications: getSortedNotifications(),
    unreadCount,
    isLoading,
    error,
    actions: {
      markAsRead: handleMarkAsRead,
      markAllAsRead: handleMarkAllAsRead,
      deleteNotification: handleDeleteNotification,
      clearAll: handleClearAll,
      filterByType: handleFilterByType,
      addNotification: handleAddNotification,
    },
  };
}

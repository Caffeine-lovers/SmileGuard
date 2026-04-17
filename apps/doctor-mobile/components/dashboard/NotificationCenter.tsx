/**
 * NotificationCenter Component - Doctor Dashboard
 * Displays real-time Supabase table updates and changes
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { Notification, NotificationType } from '../../types/notifications';
import { HeroIcon } from '../ui/HeroIcon';

interface NotificationCenterProps {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onClearAll: () => void;
}

// Notification type to icon and color mapping
// Icons are sourced from assets/images/notification_icon/
const notificationConfig: Record<
  NotificationType,
  { icon: any; color: string; label: string }
> = {
  'appointment-created': {
    icon: require('../../assets/images/notification_icon/appointment-created.png'),
    color: '#4CAF50',
    label: 'Appointment Created',
  },
  'appointment-updated': {
    icon: require('../../assets/images/notification_icon/appointment-updated.png'),
    color: '#2196F3',
    label: 'Appointment Updated',
  },
  'appointment-cancelled': {
    icon: require('../../assets/images/notification_icon/appointment-cancelled.png'),
    color: '#F44336',
    label: 'Appointment Cancelled',
  },
  'appointment-completed': {
    icon: require('../../assets/images/notification_icon/appointment-updated.png'),
    color: '#4CAF50',
    label: 'Appointment Completed',
  },
  'appointment-declined': {
    icon: require('../../assets/images/notification_icon/appointment-cancelled.png'),
    color: '#FF6F00',
    label: 'Appointment Declined',
  },
  'patient-updated': {
    icon: require('../../assets/images/notification_icon/patient-updated.png'),
    color: '#FF9800',
    label: 'Patient Updated',
  },
  'medical-intake-updated': {
    icon: require('../../assets/images/notification_icon/medical-intake-updated.png'),
    color: '#9C27B0',
    label: 'Medical Records Updated',
  },
  'doctor-profile-updated': {
    icon: require('../../assets/images/notification_icon/doctor-profile-updated-man.png'),
    color: '#2196F3',
    label: 'Profile Updated',
  },
  'billing-updated': {
    icon: require('../../assets/images/notification_icon/appointment-updated.png'),
    color: '#FF5722',
    label: 'Billing Updated',
  },
  'treatment-added': {
    icon: require('../../assets/images/notification_icon/appointment-updated.png'),
    color: '#00BCD4',
    label: 'Treatment Added',
  },
  error: {
    icon: require('../../assets/images/notification_icon/notifications.png'),
    color: '#F44336',
    label: 'Error',
  },
};

export default function NotificationCenter({
  notifications,
  unreadCount,
  isLoading,
  error,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onClearAll,
}: NotificationCenterProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<NotificationType | 'all'>('all');

  const filteredNotifications =
    filterType === 'all'
      ? notifications
      : notifications.filter((n) => n.type === filterType);

  const formatTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleDeleteWithConfirm = (id: string) => {
    Alert.alert('Delete Notification', 'Remove this notification?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDeleteNotification(id),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <HeroIcon name="bell" size="md" color="#0b7fab" />
            <Text style={styles.headerTitle}>Notifications</Text>
          </View>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {filteredNotifications.length > 0 && (
          <TouchableOpacity onPress={onMarkAllAsRead} style={styles.headerAction}>
            <Text style={styles.headerActionText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Loading State */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0b7fab" />
          <Text style={styles.loadingText}>Setting up notifications...</Text>
        </View>
      )}

      {/* Error Display - Only show critical errors, hide subscription errors */}
      {error && !error.includes('subscribe') && (
        <View style={styles.errorBanner}>
          <HeroIcon name="information" size="sm" color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Filter Tabs */}
      {!isLoading && filteredNotifications.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterTabs}
          contentContainerStyle={styles.filterTabsContent}
        >
          <TouchableOpacity
            style={[
              styles.filterTab,
              filterType === 'all' && styles.filterTabActive,
            ]}
            onPress={() => setFilterType('all')}
          >
            <Text
              style={[
                styles.filterTabText,
                filterType === 'all' && styles.filterTabTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          {Object.entries(notificationConfig).map(([type, config]) => {
            const count = notifications.filter((n) => n.type === type as NotificationType).length;
            if (count === 0) return null;

            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.filterTab,
                  filterType === type && styles.filterTabActive,
                ]}
                onPress={() => setFilterType(type as NotificationType)}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filterType === type && styles.filterTabTextActive,
                  ]}
                >
                  {config.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Notifications List */}
      {isLoading ? null : filteredNotifications.length === 0 ? (
        <View style={styles.emptyState}>
          <HeroIcon name="bell" size="xl" color="#d1d5db" />
          <Text style={styles.emptyStateTitle}>No Notifications</Text>
          <Text style={styles.emptyStateMessage}>
            You're all caught up! Updates will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.notificationsList} contentContainerStyle={{ paddingBottom: 24 }}>
          {filteredNotifications.map((notification) => {
            const config = notificationConfig[notification.type];
            const isExpanded = expandedId === notification.id;

            return (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationCard,
                  !notification.read && styles.notificationCardUnread,
                ]}
                onPress={() => {
                  if (!notification.read) {
                    onMarkAsRead(notification.id);
                  }
                  setExpandedId(isExpanded ? null : notification.id);
                }}
                activeOpacity={0.7}
              >
                {/* Notification Header */}
                <View style={styles.notificationHeader}>
                  <View style={[styles.iconBadge, { backgroundColor: config.color }]}>
                    <Image
                      source={config.icon}
                      style={styles.notificationIcon}
                      resizeMode="contain"
                    />
                  </View>

                  <View style={styles.notificationContent}>
                    <View style={styles.titleRow}>
                      <Text style={styles.notificationTitle} numberOfLines={1}>{notification.title}</Text>
                      {!notification.read && (
                        <View style={styles.unreadDot} />
                      )}
                    </View>
                    <Text style={styles.notificationTime}>
                      {formatTime(notification.timestamp)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteWithConfirm(notification.id)}
                  >
                    <Image
                      source={require("../../assets/images/icon/trash.png")}
                      style={{ width: 18, height: 18, tintColor: "#6b7280" }}
                    />
                  </TouchableOpacity>
                </View>

                {/* Notification Body */}
                <View style={styles.notificationBody}>
                  <Text style={styles.notificationMessage}>{notification.message}</Text>
                </View>

                {/* Expanded Details */}
                {isExpanded && (
                  <View style={styles.expandedDetails}>
                    {notification.data && (
                      <>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Event Type:</Text>
                          <Text style={styles.detailValue}>{notification.data.action}</Text>
                        </View>
                        {notification.data.tableName && (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Table:</Text>
                            <Text style={styles.detailValue}>
                              {notification.data.tableName}
                            </Text>
                          </View>
                        )}
                        {notification.data.recordId && (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Record ID:</Text>
                            <Text style={styles.detailValue}>
                              {notification.data.recordId.substring(0, 8)}...
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Clear All Button */}
          {filteredNotifications.length > 3 && (
            <TouchableOpacity
              style={styles.clearAllButton}
              onPress={() => {
                Alert.alert('Clear Notifications', 'Remove all notifications?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: onClearAll,
                  },
                ]);
              }}
            >
              <Text style={styles.clearAllButtonText}>Clear All Notifications</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },

  badge: {
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  headerAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#E3F2FD',
  },

  headerActionText: {
    color: '#0b7fab',
    fontSize: 12,
    fontWeight: '600',
  },

  errorBanner: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#F44336',
  },

  errorText: {
    color: '#C62828',
    fontSize: 12,
    fontWeight: '500',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 12,
    color: '#0b7fab',
    fontSize: 14,
    fontWeight: '500',
  },

  filterTabs: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    maxHeight: 60,
  },

  filterTabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },

  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },

  filterTabActive: {
    backgroundColor: '#0b7fab',
    borderColor: '#0b7fab',
  },

  filterTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },

  filterTabTextActive: {
    color: '#fff',
  },

  notificationsList: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },

  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },

  emptyStateMessage: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },

  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#ddd',
    overflow: 'hidden',
  },

  notificationCardUnread: {
    backgroundColor: '#F0F8FF',
    borderLeftColor: '#0b7fab',
  },

  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },

  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  notificationIcon: {
    width: 24,
    height: 24,
  },

  notificationContent: {
    flex: 1,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },

  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0b7fab',
    flexShrink: 0,
  },

  notificationTime: {
    fontSize: 12,
    color: '#999',
  },

  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    flexShrink: 0,
  },

  deleteButtonText: {
    fontSize: 14,
    color: '#999',
  },

  notificationBody: {
    marginLeft: 50,
    marginTop: 8,
  },

  notificationMessage: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },

  expandedDetails: {
    marginLeft: 50,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
  },

  detailValue: {
    fontSize: 12,
    color: '#333',
    fontFamily: 'monospace',
  },

  clearAllButton: {
    marginVertical: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F44336',
  },

  clearAllButtonText: {
    textAlign: 'center',
    color: '#C62828',
    fontSize: 14,
    fontWeight: '600',
  },
});

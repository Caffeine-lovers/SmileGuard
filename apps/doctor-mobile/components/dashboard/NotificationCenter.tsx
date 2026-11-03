/**
 * NotificationCenter Component - Doctor Mobile
 * Modernized notifications center focused on:
 * 1. New appointment requests
 * 2. Paid bills
 * 3. New registered patients
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import {
  Bell,
  BellOff,
  Calendar,
  CreditCard,
  UserPlus,
  CheckCheck,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  Clock,
  Tag,
  Mail,
  Receipt,
  X,
  CheckCircle2,
} from 'lucide-react-native';
import { Notification, NotificationType } from '../../types/notifications';

export type NotificationNavTab =
  | 'appointments'
  | 'dashboard'
  | 'records'
  | 'billing'
  | 'settings'
  | 'appointment-requests';

export interface NotificationCenterProps {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onClearAll: () => void;
  onClose?: () => void;
  onNavigateToTab?: (tab: NotificationNavTab) => void;
}

type FilterCategory = 'all' | 'appointments' | 'billings' | 'patients';

interface CategoryConfig {
  label: string;
  badgeLabel: string;
  icon: any;
  color: string;
  bgColor: string;
  borderColor: string;
  pillBg: string;
  pillText: string;
  tabTarget?: NotificationNavTab;
}

const CATEGORY_MAP: Record<string, CategoryConfig> = {
  appointment: {
    label: 'Appointments',
    badgeLabel: 'New Appointment',
    icon: Calendar,
    color: '#059669', // Emerald
    bgColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    pillBg: '#DCFCE7',
    pillText: '#15803D',
    tabTarget: 'appointment-requests',
  },
  billing: {
    label: 'Paid Bills',
    badgeLabel: 'Bill Paid',
    icon: Receipt,
    color: '#0284C7', // Sky Blue
    bgColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    pillBg: '#E0F2FE',
    pillText: '#0369A1',
    tabTarget: 'billing',
  },
  patient: {
    label: 'New Patients',
    badgeLabel: 'New Patient',
    icon: UserPlus,
    color: '#7C3AED', // Violet
    bgColor: '#F5F3FF',
    borderColor: '#DDD6FE',
    pillBg: '#EDE9FE',
    pillText: '#6D28D9',
    tabTarget: 'records',
  },
  default: {
    label: 'Updates',
    badgeLabel: 'Update',
    icon: Bell,
    color: '#475569',
    bgColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    pillBg: '#F1F5F9',
    pillText: '#475569',
  },
};

function getCategoryConfig(type: NotificationType): CategoryConfig {
  if (type === 'appointment-created' || type.startsWith('appointment-')) {
    return CATEGORY_MAP.appointment;
  }
  if (type === 'bill-paid' || type === 'billing-paid' || type.startsWith('billing-')) {
    return CATEGORY_MAP.billing;
  }
  if (type === 'patient-registered' || type.startsWith('patient-')) {
    return CATEGORY_MAP.patient;
  }
  return CATEGORY_MAP.default;
}

export default function NotificationCenter({
  notifications,
  unreadCount,
  isLoading,
  error,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onClearAll,
  onClose,
  onNavigateToTab,
}: NotificationCenterProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');

  // Filter counts
  const counts = useMemo(() => {
    let appointments = 0;
    let billings = 0;
    let patients = 0;

    notifications.forEach((n) => {
      if (n.type === 'appointment-created' || n.type.startsWith('appointment-')) {
        appointments++;
      } else if (n.type === 'bill-paid' || n.type === 'billing-paid' || n.type.startsWith('billing-')) {
        billings++;
      } else if (n.type === 'patient-registered' || n.type.startsWith('patient-')) {
        patients++;
      }
    });

    return {
      all: notifications.length,
      appointments,
      billings,
      patients,
    };
  }, [notifications]);

  // Filtered notifications list
  const filteredNotifications = useMemo(() => {
    if (filterCategory === 'all') return notifications;
    if (filterCategory === 'appointments') {
      return notifications.filter((n) => n.type === 'appointment-created' || n.type.startsWith('appointment-'));
    }
    if (filterCategory === 'billings') {
      return notifications.filter((n) => n.type === 'bill-paid' || n.type === 'billing-paid' || n.type.startsWith('billing-'));
    }
    if (filterCategory === 'patients') {
      return notifications.filter((n) => n.type === 'patient-registered' || n.type.startsWith('patient-'));
    }
    return notifications;
  }, [notifications, filterCategory]);

  const formatTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const handleDeleteWithConfirm = (id: string) => {
    Alert.alert('Remove Notification', 'Are you sure you want to dismiss this notification?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => onDeleteNotification(id),
      },
    ]);
  };

  const handleClearAllWithConfirm = () => {
    Alert.alert(
      'Clear All Notifications',
      'This will remove all notifications from your notification center.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: onClearAll,
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconContainer}>
            <Bell size={20} color="#059669" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>
              {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={onMarkAllAsRead}
              style={styles.markAllButton}
              activeOpacity={0.7}
            >
              <CheckCheck size={14} color="#047857" />
              <Text style={styles.markAllButtonText}>Read All</Text>
            </TouchableOpacity>
          )}

          {onClose && (
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Loading Bar */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#059669" />
          <Text style={styles.loadingText}>Syncing updates...</Text>
        </View>
      )}

      {/* Critical Error Display */}
      {error && !error.includes('subscribe') && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Category Filter Chips */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabsContent}
        >
          {/* All Tab */}
          <TouchableOpacity
            style={[
              styles.filterTab,
              filterCategory === 'all' && styles.filterTabActive,
            ]}
            onPress={() => setFilterCategory('all')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterTabText,
                filterCategory === 'all' && styles.filterTabTextActive,
              ]}
            >
              All
            </Text>
            <View
              style={[
                styles.filterBadge,
                filterCategory === 'all' && styles.filterBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.filterBadgeText,
                  filterCategory === 'all' && styles.filterBadgeTextActive,
                ]}
              >
                {counts.all}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Appointments Tab */}
          <TouchableOpacity
            style={[
              styles.filterTab,
              filterCategory === 'appointments' && styles.filterTabActive,
            ]}
            onPress={() => setFilterCategory('appointments')}
            activeOpacity={0.8}
          >
            <Calendar
              size={14}
              color={filterCategory === 'appointments' ? '#FFFFFF' : '#059669'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.filterTabText,
                filterCategory === 'appointments' && styles.filterTabTextActive,
              ]}
            >
              Appointments
            </Text>
            {counts.appointments > 0 && (
              <View
                style={[
                  styles.filterBadge,
                  filterCategory === 'appointments' && styles.filterBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterBadgeText,
                    filterCategory === 'appointments' && styles.filterBadgeTextActive,
                  ]}
                >
                  {counts.appointments}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Paid Bills Tab */}
          <TouchableOpacity
            style={[
              styles.filterTab,
              filterCategory === 'billings' && styles.filterTabActive,
            ]}
            onPress={() => setFilterCategory('billings')}
            activeOpacity={0.8}
          >
            <Receipt
              size={14}
              color={filterCategory === 'billings' ? '#FFFFFF' : '#0284C7'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.filterTabText,
                filterCategory === 'billings' && styles.filterTabTextActive,
              ]}
            >
              Paid Bills
            </Text>
            {counts.billings > 0 && (
              <View
                style={[
                  styles.filterBadge,
                  filterCategory === 'billings' && styles.filterBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterBadgeText,
                    filterCategory === 'billings' && styles.filterBadgeTextActive,
                  ]}
                >
                  {counts.billings}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* New Patients Tab */}
          <TouchableOpacity
            style={[
              styles.filterTab,
              filterCategory === 'patients' && styles.filterTabActive,
            ]}
            onPress={() => setFilterCategory('patients')}
            activeOpacity={0.8}
          >
            <UserPlus
              size={14}
              color={filterCategory === 'patients' ? '#FFFFFF' : '#7C3AED'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.filterTabText,
                filterCategory === 'patients' && styles.filterTabTextActive,
              ]}
            >
              New Patients
            </Text>
            {counts.patients > 0 && (
              <View
                style={[
                  styles.filterBadge,
                  filterCategory === 'patients' && styles.filterBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterBadgeText,
                    filterCategory === 'patients' && styles.filterBadgeTextActive,
                  ]}
                >
                  {counts.patients}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main List */}
      {filteredNotifications.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <BellOff size={36} color="#94A3B8" />
          </View>
          <Text style={styles.emptyStateTitle}>
            {filterCategory === 'all'
              ? 'No Notifications'
              : filterCategory === 'appointments'
              ? 'No Appointment Requests'
              : filterCategory === 'billings'
              ? 'No Paid Bills'
              : 'No New Patients'}
          </Text>
          <Text style={styles.emptyStateMessage}>
            {filterCategory === 'all'
              ? "You're all caught up! New patient registrations, paid bills, and appointment bookings will appear here in real-time."
              : filterCategory === 'appointments'
              ? 'When patients book or request appointments, you will see them here.'
              : filterCategory === 'billings'
              ? 'When invoices or bills are marked paid, confirmations will appear here.'
              : 'When new patients sign up with the clinic, their profiles will appear here.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.notificationsList}
          contentContainerStyle={styles.notificationsListContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredNotifications.map((notification) => {
            const config = getCategoryConfig(notification.type);
            const IconComponent = config.icon;
            const isExpanded = expandedId === notification.id;
            const isUnread = !notification.read;

            return (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationCard,
                  isUnread && styles.notificationCardUnread,
                ]}
                onPress={() => {
                  if (isUnread) {
                    onMarkAsRead(notification.id);
                  }
                  setExpandedId(isExpanded ? null : notification.id);
                }}
                activeOpacity={0.85}
              >
                {/* Header Row */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderLeft}>
                    <View
                      style={[
                        styles.iconBadge,
                        { backgroundColor: config.bgColor, borderColor: config.borderColor },
                      ]}
                    >
                      <IconComponent size={18} color={config.color} />
                    </View>

                    <View style={styles.metaColumn}>
                      <View style={styles.categoryPillRow}>
                        <View style={[styles.categoryPill, { backgroundColor: config.pillBg }]}>
                          <Text style={[styles.categoryPillText, { color: config.pillText }]}>
                            {config.badgeLabel}
                          </Text>
                        </View>
                        {isUnread && (
                          <View style={styles.newBadge}>
                            <Text style={styles.newBadgeText}>NEW</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.timeRow}>
                        <Clock size={11} color="#94A3B8" />
                        <Text style={styles.notificationTime}>
                          {formatTime(notification.timestamp)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.deleteIconButton}
                    onPress={() => handleDeleteWithConfirm(notification.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={15} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{notification.title}</Text>
                  <Text style={styles.cardMessage}>{notification.message}</Text>
                </View>

                {/* Structured Info Chips */}
                {notification.data && (
                  <View style={styles.chipsContainer}>
                    {notification.data.patientName && (
                      <View style={styles.infoChip}>
                        <UserPlus size={12} color="#475569" />
                        <Text style={styles.infoChipText} numberOfLines={1}>
                          {notification.data.patientName}
                        </Text>
                      </View>
                    )}

                    {notification.data.service && (
                      <View style={styles.infoChip}>
                        <Tag size={12} color="#059669" />
                        <Text style={[styles.infoChipText, { color: '#047857' }]} numberOfLines={1}>
                          {notification.data.service}
                        </Text>
                      </View>
                    )}

                    {notification.data.appointmentDate && (
                      <View style={styles.infoChip}>
                        <Calendar size={12} color="#2563EB" />
                        <Text style={[styles.infoChipText, { color: '#1D4ED8' }]}>
                          {notification.data.appointmentDate}
                          {notification.data.appointmentTime ? ` ${notification.data.appointmentTime}` : ''}
                        </Text>
                      </View>
                    )}

                    {notification.data.amount !== undefined && (
                      <View style={[styles.infoChip, { backgroundColor: '#ECFDF5' }]}>
                        <Receipt size={12} color="#059669" />
                        <Text style={[styles.infoChipText, { color: '#047857', fontWeight: '700' }]}>
                          ₱{notification.data.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </Text>
                      </View>
                    )}

                    {notification.data.paymentMethod && (
                      <View style={styles.infoChip}>
                        <CreditCard size={12} color="#0284C7" />
                        <Text style={[styles.infoChipText, { color: '#0369A1' }]}>
                          {notification.data.paymentMethod}
                        </Text>
                      </View>
                    )}

                    {notification.data.email && (
                      <View style={styles.infoChip}>
                        <Mail size={12} color="#6D28D9" />
                        <Text style={[styles.infoChipText, { color: '#6D28D9' }]} numberOfLines={1}>
                          {notification.data.email}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Expand Toggle Cue */}
                <View style={styles.cardFooter}>
                  <Text style={styles.expandCueText}>
                    {isExpanded ? 'Hide details' : 'Tap for details & actions'}
                  </Text>
                  {isExpanded ? (
                    <ChevronUp size={14} color="#94A3B8" />
                  ) : (
                    <ChevronDown size={14} color="#94A3B8" />
                  )}
                </View>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <View style={styles.expandedDrawer}>
                    <View style={styles.drawerDivider} />

                    <View style={styles.drawerGrid}>
                      {notification.data?.patientName && (
                        <View style={styles.drawerItem}>
                          <Text style={styles.drawerItemLabel}>Patient</Text>
                          <Text style={styles.drawerItemValue}>{notification.data.patientName}</Text>
                        </View>
                      )}

                      {notification.data?.service && (
                        <View style={styles.drawerItem}>
                          <Text style={styles.drawerItemLabel}>Service</Text>
                          <Text style={styles.drawerItemValue}>{notification.data.service}</Text>
                        </View>
                      )}

                      {notification.data?.appointmentDate && (
                        <View style={styles.drawerItem}>
                          <Text style={styles.drawerItemLabel}>Date & Time</Text>
                          <Text style={styles.drawerItemValue}>
                            {notification.data.appointmentDate}{' '}
                            {notification.data.appointmentTime || ''}
                          </Text>
                        </View>
                      )}

                      {notification.data?.amount !== undefined && (
                        <View style={styles.drawerItem}>
                          <Text style={styles.drawerItemLabel}>Amount Paid</Text>
                          <Text style={[styles.drawerItemValue, { color: '#047857', fontWeight: '700' }]}>
                            ₱{notification.data.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </Text>
                        </View>
                      )}

                      {notification.data?.paymentMethod && (
                        <View style={styles.drawerItem}>
                          <Text style={styles.drawerItemLabel}>Payment Method</Text>
                          <Text style={styles.drawerItemValue}>{notification.data.paymentMethod}</Text>
                        </View>
                      )}

                      {notification.data?.email && (
                        <View style={styles.drawerItem}>
                          <Text style={styles.drawerItemLabel}>Email</Text>
                          <Text style={styles.drawerItemValue}>{notification.data.email}</Text>
                        </View>
                      )}
                    </View>

                    {/* Action Buttons Row */}
                    <View style={styles.drawerActions}>
                      {config.tabTarget && onNavigateToTab && (
                        <TouchableOpacity
                          style={[styles.primaryActionBtn, { backgroundColor: config.color }]}
                          onPress={() => onNavigateToTab(config.tabTarget!)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.primaryActionBtnText}>
                            View in {config.label}
                          </Text>
                          <ExternalLink size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.secondaryActionBtn}
                        onPress={() => onMarkAsRead(notification.id)}
                        activeOpacity={0.8}
                      >
                        <CheckCircle2 size={14} color="#059669" />
                        <Text style={styles.secondaryActionBtnText}>
                          {notification.read ? 'Marked as read' : 'Mark as read'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Clear All Footer Button */}
          {filteredNotifications.length > 2 && (
            <TouchableOpacity
              style={styles.clearAllBtn}
              onPress={handleClearAllWithConfirm}
              activeOpacity={0.8}
            >
              <Trash2 size={16} color="#DC2626" />
              <Text style={styles.clearAllBtnText}>Clear All Notifications</Text>
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
    backgroundColor: '#F8FAFC',
  },

  /* Top Bar */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  headerIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },

  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },

  markAllButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
  },

  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    backgroundColor: '#ECFDF5',
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
  },

  loadingText: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },

  errorBanner: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },

  errorText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '500',
  },

  /* Filter Section */
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
  },

  filterTabsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },

  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  filterTabActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },

  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },

  filterTabTextActive: {
    color: '#FFFFFF',
  },

  filterBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },

  filterBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },

  filterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },

  filterBadgeTextActive: {
    color: '#FFFFFF',
  },

  /* List */
  notificationsList: {
    flex: 1,
  },

  notificationsListContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 36,
  },

  /* Card */
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },

  notificationCardUnread: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
  },

  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },

  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  metaColumn: {
    flex: 1,
  },

  categoryPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },

  categoryPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  newBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: '#059669',
  },

  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },

  notificationTime: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },

  deleteIconButton: {
    padding: 6,
    borderRadius: 6,
  },

  cardBody: {
    marginTop: 10,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },

  cardMessage: {
    fontSize: 13,
    lineHeight: 18,
    color: '#475569',
    marginTop: 3,
  },

  /* Info Chips */
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },

  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
  },

  infoChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#F1F5F9',
  },

  expandCueText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },

  /* Expanded Drawer */
  expandedDrawer: {
    marginTop: 6,
  },

  drawerDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 10,
  },

  drawerGrid: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },

  drawerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  drawerItemLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },

  drawerItemValue: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
  },

  drawerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },

  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
  },

  primaryActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  secondaryActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },

  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 8,
  },

  clearAllBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },

  /* Empty State */
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },

  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  emptyStateTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },

  emptyStateMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: '#64748B',
    textAlign: 'center',
  },
});

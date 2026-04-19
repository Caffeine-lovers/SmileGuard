/**
 * Notification Service - Doctor Mobile
 * Handles real-time Supabase subscriptions for table updates
 */

import { supabase } from './supabase';
import { Notification, NotificationType } from '../types/notifications';

let notificationId = 0;

const generateNotificationId = (): string => {
  return `notification-${++notificationId}-${Date.now()}`;
};

/**
 * Generate notification based on event type and table
 */
function generateNotification(
  tableName: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  newRecord: any,
  oldRecord: any
): Notification | null {
  const baseNotification = {
    id: generateNotificationId(),
    timestamp: new Date(),
    read: false,
  };

  // Helper function to get changed fields
  const getChangedFields = (): string[] => {
    if (action === 'DELETE') return ['record deleted'];
    if (action === 'INSERT') return ['new record'];
    if (action === 'UPDATE' && oldRecord) {
      return Object.keys(newRecord).filter(key => newRecord[key] !== oldRecord[key]);
    }
    return [];
  };

  switch (tableName) {
    case 'appointments':
      return {
        ...baseNotification,
        type: getAppointmentNotificationType(action, newRecord),
        title: `Appointment ${action === 'INSERT' ? 'Created' : action === 'DELETE' ? 'Cancelled' : 'Updated'}`,
        message: `${newRecord.patient_name || 'Patient'} - ${newRecord.service || 'Service'} at ${newRecord.appointment_time || 'TBD'}`,
        data: {
          appointmentId: newRecord.id,
          patientId: newRecord.patient_id,
          doctorId: newRecord.dentist_id,
          tableName,
          recordId: newRecord.id,
          action,
        },
      };

    case 'medical_intake':
      return {
        ...baseNotification,
        type: 'medical-intake-updated',
        title: 'Medical Intake Updated',
        message: `Patient medical records have been updated: ${getChangedFields().join(', ')}`,
        data: {
          patientId: newRecord.patient_id,
          tableName,
          recordId: newRecord.id,
          action,
        },
      };

    case 'treatments':
      if (action === 'INSERT') {
        return {
          ...baseNotification,
          type: 'treatment-added',
          title: 'New Treatment Added',
          message: `${newRecord.treatment_name || 'Treatment'} added to patient records`,
          data: {
            patientId: newRecord.patient_id,
            tableName,
            recordId: newRecord.id,
            action,
          },
        };
      }
      return null;

    case 'billings':
      return {
        ...baseNotification,
        type: 'billing-updated',
        title: 'Billing Updated',
        message: `Invoice #${newRecord.id?.substring(0, 8) || 'N/A'} - Amount: $${newRecord.amount || 0}`,
        data: {
          tableName,
          recordId: newRecord.id,
          action,
        },
      };

    case 'doctors':
      if (action === 'UPDATE') {
        return {
          ...baseNotification,
          type: 'doctor-profile-updated',
          title: 'Your Profile Updated',
          message: `Profile changes: ${getChangedFields().join(', ')}`,
          data: {
            doctorId: newRecord.id,
            tableName,
            recordId: newRecord.id,
            action,
          },
        };
      }
      return null;

    case 'profiles':
      if (newRecord.role === 'patient') {
        return {
          ...baseNotification,
          type: 'patient-updated',
          title: 'Patient Profile Updated',
          message: `${newRecord.name || 'Patient'} profile information updated`,
          data: {
            patientId: newRecord.id,
            tableName,
            recordId: newRecord.id,
            action,
          },
        };
      }
      return null;

    default:
      return null;
  }
}

/**
 * Determine appointment notification type
 */
function getAppointmentNotificationType(
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  record: any
): NotificationType {
  if (action === 'INSERT') return 'appointment-created';
  if (action === 'DELETE') return 'appointment-cancelled';
  if (action === 'UPDATE') {
    if (record.status === 'completed') return 'appointment-completed';
    if (record.status === 'cancelled') return 'appointment-cancelled';
    return 'appointment-updated';
  }
  return 'appointment-updated';
}

/**
 * Subscribe to real-time changes for a specific table
 */
export function subscribeToTableChanges(
  tableName: string,
  doctorId: string,
  onNotification: (notification: Notification) => void,
  onError: (error: string) => void
): (() => void) {
  try {
    console.log(`📡 Subscribing to ${tableName} real-time updates for doctor ${doctorId}`);

    const filter = getSubscriptionFilter(tableName, doctorId);
    console.log(`📍 Subscription filter: ${filter || 'none (all events)'}`);
    console.log(`🆔 Doctor ID: ${doctorId}`);

    const channel = supabase
      .channel(`${tableName}-${doctorId}-${Date.now()}`, {
        config: {
          broadcast: { self: true }, // Enable self-broadcast to catch own changes
        },
      })
      .on<any>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          ...(filter && { filter }),
        },
        (payload: any) => {
          console.log(`🔔 Change detected in ${tableName}:`, {
            eventType: payload.eventType,
            recordId: payload.new?.id,
            newRecord: payload.new,
            oldRecord: payload.old,
            changeCount: Object.keys(payload.new || {}).length,
          });

          const notification = generateNotification(
            tableName,
            payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            payload.new,
            payload.old
          );

          if (notification) {
            console.log(`[NotificationService] Emitting notification:`, notification.type, notification.title);
            onNotification(notification);
          } else {
            console.log(`⏭️ Skipped notification for ${tableName} (generateNotification returned null)`);
          }
        }
      )
      .subscribe(async (status) => {
        console.log(`🔄 Subscription status for ${tableName}: ${status}`);
        if (status === 'CLOSED') {
          console.warn(`⚠️ Subscription to ${tableName} closed`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Subscription error for ${tableName}`);
          onError(`Failed to subscribe to ${tableName} updates`);
        } else if (status === 'SUBSCRIBED') {
          console.log(`✅ Successfully subscribed to ${tableName}`);
        }
      });

    // Return unsubscribe function
    return () => {
      supabase.removeChannel(channel);
      console.log(`🛑 Unsubscribed from ${tableName}`);
    };
  } catch (error) {
    const errorMsg = `Error subscribing to ${tableName}: ${error}`;
    console.error(errorMsg);
    onError(errorMsg);
    return () => {};
  }
}

/**
 * Get filter string based on table and doctor ID
 */
function getSubscriptionFilter(tableName: string, doctorId: string): string | null {
  switch (tableName) {
    case 'appointments':
      // Subscribe to appointments where:
      // 1. You're assigned as the dentist, OR
      // 2. No dentist is assigned yet (dentist_id is NULL)
      return `or(dentist_id.eq.${doctorId},dentist_id.is.null)`;
    case 'medical_intake':
      return `patient_id=eq.${doctorId}`;
    case 'doctors':
      return `id=eq.${doctorId}`;
    case 'dummy_accounts':
      // Subscribe to all dummy accounts (updated/inserted for this doctor's clinic)
      // Filter can be added based on clinic_id if needed
      return null; // No filter - see all dummy accounts
    case 'profiles':
      // Subscribe to all profile updates (can be filtered by role='doctor' if needed)
      return null; // No filter - see all profile changes
    default:
      return null;
  }
}

/**
 * Subscribe to multiple Supabase tables for doctor
 */
export function subscribeToDoctorNotifications(
  doctorId: string,
  onNotification: (notification: Notification) => void,
  onError: (error: string) => void,
  tables: string[] = [
    'doctors',
    'appointments',
    'medical_intake',
    'treatments',
    'billings',
    'dummy_accounts',
    'profiles',
  ]
): (() => void) {
  const unsubscribers: Array<() => void> = [];

  tables.forEach((tableName) => {
    const unsubscribe = subscribeToTableChanges(
      tableName,
      doctorId,
      onNotification,
      (errorMsg: string) => {
        // Only report non-subscription errors to user
        if (!errorMsg.includes('subscribe')) {
          onError(errorMsg);
        } else {
          // Log subscription errors but don't show to user
          console.warn('📻 Background subscription error (not shown to user):', errorMsg);
        }
      }
    );
    unsubscribers.push(unsubscribe);
  });

  // Return function to unsubscribe from all tables
  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

/**
 * Mark notification as read
 */
export function markNotificationAsRead(notification: Notification): Notification {
  return {
    ...notification,
    read: true,
  };
}

/**
 * Mark multiple notifications as read
 */
export function markNotificationsAsRead(notifications: Notification[]): Notification[] {
  return notifications.map((notif) => ({ ...notif, read: true }));
}

/**
 * Get unread notification count
 */
export function getUnreadCount(notifications: Notification[]): number {
  return notifications.filter((n) => !n.read).length;
}

/**
 * Sort notifications by timestamp (newest first)
 */
export function sortNotificationsByTime(notifications: Notification[]): Notification[] {
  return [...notifications].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
}

/**
 * Filter notifications by type
 */
export function filterNotificationsByType(
  notifications: Notification[],
  type: NotificationType
): Notification[] {
  return notifications.filter((n) => n.type === type);
}

/**
 * Clear old notifications (older than specified hours)
 */
export function clearOldNotifications(
  notifications: Notification[],
  hoursOld: number = 24
): Notification[] {
  const cutoffTime = Date.now() - hoursOld * 60 * 60 * 1000;
  return notifications.filter((n) => n.timestamp.getTime() > cutoffTime);
}

/**
 * Manually trigger a notification
 * Use when you make changes in the app that need immediate feedback
 */
export function createManualNotification(
  type: NotificationType,
  title: string,
  message: string,
  data?: Partial<Notification['data']>
): Notification {
  return {
    id: generateNotificationId(),
    type,
    title,
    message,
    timestamp: new Date(),
    read: false,
    data,
  };
}

/**
 * Trigger appointment created notification
 */
export function notifyAppointmentCreated(
  patientName: string,
  service: string,
  time: string,
  appointmentId: string,
  patientId: string,
  doctorId: string
): Notification {
  return createManualNotification(
    'appointment-created',
    'Appointment Created',
    `${patientName} - ${service} at ${time}`,
    {
      appointmentId,
      patientId,
      doctorId,
      tableName: 'appointments',
      recordId: appointmentId,
      action: 'INSERT',
    }
  );
}

/**
 * Trigger appointment updated notification
 */
export function notifyAppointmentUpdated(
  patientName: string,
  service: string,
  time: string,
  appointmentId: string,
  patientId: string,
  doctorId: string
): Notification {
  return createManualNotification(
    'appointment-updated',
    'Appointment Updated',
    `${patientName} - ${service} at ${time} has been updated`,
    {
      appointmentId,
      patientId,
      doctorId,
      tableName: 'appointments',
      recordId: appointmentId,
      action: 'UPDATE',
    }
  );
}

/**
 * Trigger appointment status changed notification
 */
export function notifyAppointmentStatusChanged(
  status: 'completed' | 'cancelled' | 'no-show',
  patientName: string,
  appointmentId: string,
  patientId: string,
  doctorId: string
): Notification {
  const statusTitles = {
    completed: 'Appointment Completed',
    cancelled: 'Appointment Cancelled',
    'no-show': 'Appointment No-Show',
  };

  return createManualNotification(
    status === 'completed' ? 'appointment-completed' : 'appointment-cancelled',
    statusTitles[status],
    `${patientName} appointment - ${status.toUpperCase()}`,
    {
      appointmentId,
      patientId,
      doctorId,
      tableName: 'appointments',
      recordId: appointmentId,
      action: 'UPDATE',
    }
  );
}

/**
 * Trigger medical intake updated notification
 */
export function notifyMedicalIntakeUpdated(
  patientName: string,
  recordId: string,
  patientId: string
): Notification {
  return createManualNotification(
    'medical-intake-updated',
    'Medical Records Updated',
    `${patientName} medical records have been updated`,
    {
      patientId,
      tableName: 'medical_intake',
      recordId,
      action: 'UPDATE',
    }
  );
}

/**
 * Trigger doctor profile updated notification
 */
export function notifyDoctorProfileUpdated(
  doctorName: string,
  doctorId: string
): Notification {
  return createManualNotification(
    'doctor-profile-updated',
    'Your Profile Updated',
    `${doctorName} profile information has been updated`,
    {
      doctorId,
      tableName: 'doctors',
      recordId: doctorId,
      action: 'UPDATE',
    }
  );
}

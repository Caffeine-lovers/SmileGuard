/**
 * Notification Service - Doctor Mobile
 * Handles real-time Supabase subscriptions for:
 * 1. New patient registrations (profiles table INSERT)
 * 2. Paid bills (billings table when payment_status === 'paid')
 * 3. New appointment bookings (appointments table INSERT)
 *
 * Removes unnecessary noise and database update notifications.
 */

import { supabase } from '@smileguard/supabase-client';
import { Notification, NotificationType } from '../types/notifications';
import { formatAppointmentDate, formatAppointmentTime } from './dateFormatters';
import { formatCurrency } from './currencyFormatters';

let notificationId = 0;

const generateNotificationId = (): string => {
  return `notification-${++notificationId}-${Date.now()}`;
};

/**
 * Generate targeted notification for key events only:
 * - New appointment bookings
 * - Paid bills
 * - New patient registrations
 */
async function generateNotification(
  tableName: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  newRecord: any,
  oldRecord: any,
  doctorId?: string
): Promise<Notification | null> {
  const baseNotification = {
    id: generateNotificationId(),
    timestamp: new Date(),
    read: false,
  };

  switch (tableName) {
    case 'appointments': {
      // ONLY notify on NEW appointment booking requests (INSERT)
      if (action !== 'INSERT' || !newRecord) {
        return null;
      }

      let patientName = newRecord.patient_name || newRecord.name;
      if (!patientName && newRecord.patient_id) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', newRecord.patient_id)
            .maybeSingle();
          if (profile?.name) {
            patientName = profile.name;
          }
        } catch {
          // Fallback if network or auth error
        }
      }

      const displayPatient = patientName || 'A patient';
      const service = newRecord.service || 'Dental Consultation';
      const formattedDate = formatAppointmentDate(newRecord.appointment_date, 'long');
      const formattedTime = formatAppointmentTime(newRecord.appointment_time);
      const timeSuffix = formattedTime && formattedTime !== 'Not specified' ? ` at ${formattedTime}` : '';

      return {
        ...baseNotification,
        type: 'appointment-created',
        title: 'New Appointment Request',
        message: `${displayPatient} booked an appointment for ${service} on ${formattedDate}${timeSuffix}.`,
        data: {
          appointmentId: newRecord.id,
          patientId: newRecord.patient_id,
          patientName: displayPatient,
          service,
          appointmentDate: formattedDate,
          appointmentTime: formattedTime,
          doctorId: newRecord.dentist_id,
          tableName,
          recordId: newRecord.id,
          action,
        },
      };
    }

    case 'billings': {
      if (!newRecord) return null;

      const isPaidNow =
        newRecord.payment_status === 'paid' ||
        newRecord.status === 'paid';

      const wasAlreadyPaid =
        oldRecord &&
        (oldRecord.payment_status === 'paid' || oldRecord.status === 'paid');

      // ONLY notify when a bill is paid (either INSERT as paid, or UPDATE transitioning to paid)
      if (!isPaidNow || wasAlreadyPaid) {
        return null;
      }

      let patientName = newRecord.patient_name;
      if (!patientName && newRecord.patient_id) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', newRecord.patient_id)
            .maybeSingle();
          if (profile?.name) {
            patientName = profile.name;
          }
        } catch {
          // Fallback
        }
      }

      const amount = Number(newRecord.final_amount ?? newRecord.amount ?? 0);
      const formattedAmount = formatCurrency(amount);

      const rawMethod = newRecord.payment_method || 'Online';
      const cleanMethod = String(rawMethod)
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const invoiceCode = newRecord.id ? String(newRecord.id).substring(0, 8).toUpperCase() : '';

      return {
        ...baseNotification,
        type: 'bill-paid',
        title: 'Bill Paid',
        message: `Payment of ${formattedAmount} received${
          patientName ? ` from ${patientName}` : ''
        } via ${cleanMethod}${invoiceCode ? ` for invoice #${invoiceCode}` : ''}.`,
        data: {
          patientId: newRecord.patient_id,
          patientName,
          amount,
          paymentMethod: cleanMethod,
          tableName,
          recordId: newRecord.id,
          action,
        },
      };
    }

    case 'profiles': {
      // ONLY notify on NEW patient registrations (INSERT into profiles)
      if (action !== 'INSERT' || !newRecord) {
        return null;
      }

      // Check role: ignore doctor registrations or non-patient roles
      if (newRecord.role && newRecord.role !== 'patient') {
        return null;
      }
      if (newRecord.license_number) {
        return null; // Doctor record
      }

      const name = newRecord.name || 'New Patient';
      const email = newRecord.email || '';

      return {
        ...baseNotification,
        type: 'patient-registered',
        title: 'New Patient Registered',
        message: `${name}${email ? ` (${email})` : ''} has registered as a new patient.`,
        data: {
          patientId: newRecord.id,
          patientName: name,
          email,
          service: newRecord.service,
          tableName,
          recordId: newRecord.id,
          action,
        },
      };
    }

    default:
      // Remove all other unnecessary table updates (medical_intake, treatments, doctors, etc.)
      return null;
  }
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

    const channel = supabase
      .channel(`${tableName}-${doctorId}-${Date.now()}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on<any>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
        },
        async (payload: any) => {
          try {
            const notification = await generateNotification(
              tableName,
              payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
              payload.new,
              payload.old,
              doctorId
            );

            if (notification) {
              console.log(
                `[NotificationService] Emitting notification:`,
                notification.type,
                notification.title
              );
              onNotification(notification);
            }
          } catch (err) {
            console.error(`[NotificationService] Error generating notification:`, err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Subscription error for ${tableName}`);
          onError(`Failed to subscribe to ${tableName} updates`);
        } else if (status === 'SUBSCRIBED') {
          console.log(`✅ Successfully subscribed to ${tableName}`);
        }
      });

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
 * Subscribe to essential tables for doctor notifications:
 * - appointments (New appointment requests)
 * - billings (Paid bills)
 * - profiles (New patient registrations)
 */
export function subscribeToDoctorNotifications(
  doctorId: string,
  onNotification: (notification: Notification) => void,
  onError: (error: string) => void,
  tables: string[] = ['appointments', 'billings', 'profiles']
): (() => void) {
  const unsubscribers: Array<() => void> = [];

  tables.forEach((tableName) => {
    const unsubscribe = subscribeToTableChanges(
      tableName,
      doctorId,
      onNotification,
      (errorMsg: string) => {
        if (!errorMsg.includes('subscribe')) {
          onError(errorMsg);
        } else {
          console.warn('📻 Background subscription notice:', errorMsg);
        }
      }
    );
    unsubscribers.push(unsubscribe);
  });

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
  hoursOld: number = 72
): Notification[] {
  const cutoffTime = Date.now() - hoursOld * 60 * 60 * 1000;
  return notifications.filter((n) => n.timestamp.getTime() > cutoffTime);
}

/**
 * Manually create a notification
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
  doctorId: string,
  appointmentDate?: string
): Notification {
  return createManualNotification(
    'appointment-created',
    'New Appointment Request',
    `${patientName} booked an appointment for ${service}${appointmentDate ? ` on ${appointmentDate}` : ''}${time ? ` at ${time}` : ''}.`,
    {
      appointmentId,
      patientId,
      patientName,
      service,
      appointmentDate,
      appointmentTime: time,
      doctorId,
      tableName: 'appointments',
      recordId: appointmentId,
      action: 'INSERT',
    }
  );
}

/**
 * Trigger paid bill notification
 */
export function notifyBillPaid(
  patientName: string,
  amount: number,
  paymentMethod: string = 'Cash',
  billId?: string,
  patientId?: string
): Notification {
  const formattedAmount = formatCurrency(amount);
  const code = billId ? billId.substring(0, 8).toUpperCase() : '';

  return createManualNotification(
    'bill-paid',
    'Bill Paid',
    `Payment of ${formattedAmount} received${patientName ? ` from ${patientName}` : ''} via ${paymentMethod}${code ? ` for invoice #${code}` : ''}.`,
    {
      patientId,
      patientName,
      amount,
      paymentMethod,
      tableName: 'billings',
      recordId: billId,
      action: 'UPDATE',
    }
  );
}

/**
 * Trigger new patient registered notification
 */
export function notifyPatientRegistered(
  patientName: string,
  email?: string,
  patientId?: string
): Notification {
  return createManualNotification(
    'patient-registered',
    'New Patient Registered',
    `${patientName}${email ? ` (${email})` : ''} has registered as a new patient.`,
    {
      patientId,
      patientName,
      email,
      tableName: 'profiles',
      recordId: patientId,
      action: 'INSERT',
    }
  );
}

/**
 * Backward compatibility stubs for legacy callers
 */
export function notifyAppointmentUpdated(): Notification {
  return createManualNotification('appointment-updated', 'Appointment Updated', '');
}

export function notifyAppointmentStatusChanged(
  status: 'completed' | 'cancelled' | 'no-show',
  patientName: string,
  appointmentId: string,
  patientId: string,
  doctorId: string
): Notification {
  return createManualNotification(
    status === 'completed' ? 'appointment-completed' : 'appointment-cancelled',
    `Appointment ${status}`,
    `${patientName}'s appointment marked as ${status}`,
    { appointmentId, patientId, doctorId }
  );
}

export function notifyMedicalIntakeUpdated(): Notification {
  return createManualNotification('medical-intake-updated', 'Medical Records Updated', '');
}

export function notifyDoctorProfileUpdated(): Notification {
  return createManualNotification('doctor-profile-updated', 'Profile Updated', '');
}

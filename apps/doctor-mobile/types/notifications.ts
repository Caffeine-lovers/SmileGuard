/**
 * Notification Types for Doctor Dashboard
 * Handles real-time updates for new appointments, paid bills, and new patient registrations
 */

export type NotificationType = 
  | 'appointment-created'
  | 'bill-paid'
  | 'billing-paid'
  | 'patient-registered'
  // Fallbacks for backward compatibility
  | 'appointment-updated'
  | 'appointment-cancelled'
  | 'appointment-completed'
  | 'appointment-declined'
  | 'patient-updated'
  | 'medical-intake-updated'
  | 'doctor-profile-updated'
  | 'billing-updated'
  | 'treatment-added'
  | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: {
    appointmentId?: string;
    patientId?: string;
    patientName?: string;
    doctorId?: string;
    amount?: number;
    paymentMethod?: string;
    service?: string;
    appointmentDate?: string;
    appointmentTime?: string;
    email?: string;
    tableName?: string;
    recordId?: string;
    action?: 'INSERT' | 'UPDATE' | 'DELETE';
  };
  action?: {
    label: string;
    onPress: () => void;
  };
}

export interface NotificationCenter {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
}

export interface NotificationSubscription {
  tableNames: string[];
  doctorId: string;
  onNotification: (notification: Notification) => void;
}

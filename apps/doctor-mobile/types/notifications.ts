/**
 * Notification Types for Doctor Dashboard
 * Handles real-time updates from Supabase tables
 */

export type NotificationType = 
  | 'appointment-created'
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
    doctorId?: string;
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
